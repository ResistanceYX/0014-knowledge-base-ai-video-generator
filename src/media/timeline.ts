import {FULL_COMPOSITION_ID} from "../config.js";
import {AppError} from "../errors.js";
import {sha256} from "../provenance/pointer.js";
import type {MediaPlan, MediaSceneTiming, MediaSegmentTiming, SceneDocument, SpeechManifest, SubtitleOverride} from "../types.js";

export function sceneCompositionId(sceneId: string): string {
  return `Scene-${sceneId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

export function mediaSegments(scene: SceneDocument["scenes"][number]): SceneDocument["scenes"][number]["narrationSegments"] {
  return scene.narrationSegments.filter((segment) => segment.kind !== "placeholder");
}

function allocateSegments(scene: SceneDocument["scenes"][number], durationInFrames: number): MediaSegmentTiming[] {
  const segments = mediaSegments(scene);
  if (segments.length > durationInFrames) {
    throw new AppError("E_MEDIA_CONFIG", `场景 ${scene.sceneId} 的帧数少于旁白段数，无法生成非零时长字幕`, scene.sceneId);
  }
  const weights = segments.map((segment) => Math.max(1, Array.from(segment.text).length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const result: MediaSegmentTiming[] = [];
  let elapsedWeight = 0;
  let previousEnd = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const weight = weights[index];
    if (!segment || weight === undefined) throw new AppError("E_SCENE_SEMANTICS", "场景旁白时间轴无法建立", scene.sceneId);
    elapsedWeight += weight;
    const proportionalEnd = Math.round((elapsedWeight / totalWeight) * durationInFrames);
    const remainingSegments = segments.length - index - 1;
    const end = index === segments.length - 1
      ? durationInFrames
      : Math.min(durationInFrames - remainingSegments, Math.max(previousEnd + 1, proportionalEnd));
    result.push({segmentId: segment.segmentId, from: previousEnd, durationInFrames: end - previousEnd});
    previousEnd = end;
  }
  return result;
}

function millisecondsToFrames(milliseconds: number, fps: number): number {
  return Math.max(1, Math.ceil(milliseconds * fps / 1000));
}

function audioSegments(options: {
  scene: SceneDocument["scenes"][number];
  manifest: SpeechManifest;
  overrides: Map<string, SubtitleOverride>;
  fps: number;
}): {segments: MediaSegmentTiming[]; durationInFrames: number} {
  const {scene, manifest, overrides, fps} = options;
  const pauseFrames = Math.round(manifest.segmentPauseMs * fps / 1000);
  const scenePauseFrames = Math.round(manifest.scenePauseMs * fps / 1000);
  const result: MediaSegmentTiming[] = [];
  const narrationSegments = mediaSegments(scene);
  let cursor = 0;
  for (const [index, segment] of narrationSegments.entries()) {
    const clip = manifest.clips.find((item) => item.sceneId === scene.sceneId && item.segmentId === segment.segmentId);
    if (!clip) throw new AppError("E_AUDIO", `配音清单缺少片段 ${segment.segmentId}`, segment.segmentId);
    const durationInFrames = millisecondsToFrames(clip.durationMs, fps);
    const override = overrides.get(segment.segmentId);
    result.push({
      segmentId: segment.segmentId,
      from: cursor,
      durationInFrames,
      audioFile: clip.publicFile,
      audioDurationMs: clip.durationMs,
      manuallyReplaced: clip.manuallyReplaced,
      ...(override?.text !== undefined ? {subtitleText: override.text} : {}),
      ...(override?.offsetMs !== undefined ? {subtitleOffsetMs: override.offsetMs} : {}),
      ...(override?.durationMs !== undefined ? {subtitleDurationMs: override.durationMs} : {}),
    });
    cursor += durationInFrames;
    if (index < narrationSegments.length - 1) cursor += pauseFrames;
  }
  return {segments: result, durationInFrames: cursor + scenePauseFrames};
}

export function buildMediaPlan(
  document: SceneDocument,
  sourceScriptSha256: string,
  audio?: {manifest: SpeechManifest; overrides: SubtitleOverride[]},
): MediaPlan {
  const scenes: MediaSceneTiming[] = [];
  let sceneFrom = 0;
  if (audio) {
    const expected = document.scenes.flatMap((scene) => mediaSegments(scene).map((segment) => `${scene.sceneId}/${segment.segmentId}`)).sort();
    const actual = audio.manifest.clips.map((clip) => `${clip.sceneId}/${clip.segmentId}`).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new AppError("E_AUDIO", "配音清单与当前可播放脚本片段不一致；placeholder 只保留审校记录", "media/speech");
    const validSegmentIds = new Set(document.scenes.flatMap((scene) => mediaSegments(scene).map((segment) => segment.segmentId)));
    const orphan = audio.overrides.find((override) => !validSegmentIds.has(override.segmentId));
    if (orphan) throw new AppError("E_AUDIO", `字幕覆盖指向不存在的片段：${orphan.segmentId}`, orphan.segmentId);
  }
  const overrides = new Map(audio?.overrides.map((override) => [override.segmentId, override]) ?? []);
  for (const scene of document.scenes) {
    if (mediaSegments(scene).length === 0) continue;
    const allocated = audio
      ? audioSegments({scene, manifest: audio.manifest, overrides, fps: document.video.fps})
      : {segments: allocateSegments(scene, Math.round(scene.durationSeconds * document.video.fps)), durationInFrames: Math.round(scene.durationSeconds * document.video.fps)};
    const durationInFrames = allocated.durationInFrames;
    if (!Number.isSafeInteger(durationInFrames) || durationInFrames < 1) {
      throw new AppError("E_MEDIA_CONFIG", `场景 ${scene.sceneId} 的时长无法换算为正整数帧`, scene.sceneId);
    }
    scenes.push({
      sceneId: scene.sceneId,
      compositionId: sceneCompositionId(scene.sceneId),
      type: scene.type,
      from: sceneFrom,
      durationInFrames,
      segments: allocated.segments,
    });
    sceneFrom += durationInFrames;
  }
  if (!Number.isSafeInteger(sceneFrom) || sceneFrom < 1) throw new AppError("E_MEDIA_CONFIG", "完整视频时长无效");
  return {
    schemaVersion: audio ? "0.3.0" : "0.2.0",
    projectId: document.projectId,
    fps: document.video.fps,
    width: document.video.width,
    height: document.video.height,
    fullCompositionId: FULL_COMPOSITION_ID,
    fullDurationInFrames: sceneFrom,
    scenes,
    sourceScriptSha256,
    speech: {
      mode: audio?.manifest.mode ?? "none",
      alignment: audio ? "audio-segment" : "estimated",
      clipCount: audio?.manifest.clips.length ?? 0,
      manuallyReplacedClips: audio?.manifest.clips.filter((clip) => clip.manuallyReplaced).length ?? 0,
      subtitleOverrides: audio?.overrides.length ?? 0,
    },
  };
}

export function scriptRevision(scenesText: string, sourceMapText: string): string {
  return sha256(Buffer.from(`${scenesText}\n${sourceMapText}\n`, "utf8"));
}
