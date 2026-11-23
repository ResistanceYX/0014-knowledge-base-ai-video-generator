import {FULL_COMPOSITION_ID} from "../config.js";
import {AppError} from "../errors.js";
import {sha256} from "../provenance/pointer.js";
import type {MediaPlan, MediaSceneTiming, MediaSegmentTiming, SceneDocument} from "../types.js";

export function sceneCompositionId(sceneId: string): string {
  return `Scene-${sceneId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function allocateSegments(scene: SceneDocument["scenes"][number], durationInFrames: number): MediaSegmentTiming[] {
  const segments = scene.narrationSegments;
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

export function buildMediaPlan(document: SceneDocument, sourceScriptSha256: string): MediaPlan {
  const scenes: MediaSceneTiming[] = [];
  let sceneFrom = 0;
  for (const scene of document.scenes) {
    const durationInFrames = Math.round(scene.durationSeconds * document.video.fps);
    if (!Number.isSafeInteger(durationInFrames) || durationInFrames < 1) {
      throw new AppError("E_MEDIA_CONFIG", `场景 ${scene.sceneId} 的时长无法换算为正整数帧`, scene.sceneId);
    }
    scenes.push({
      sceneId: scene.sceneId,
      compositionId: sceneCompositionId(scene.sceneId),
      type: scene.type,
      from: sceneFrom,
      durationInFrames,
      segments: allocateSegments(scene, durationInFrames),
    });
    sceneFrom += durationInFrames;
  }
  if (!Number.isSafeInteger(sceneFrom) || sceneFrom < 1) throw new AppError("E_MEDIA_CONFIG", "完整视频时长无效");
  return {
    schemaVersion: "0.2.0",
    projectId: document.projectId,
    fps: document.video.fps,
    width: document.video.width,
    height: document.video.height,
    fullCompositionId: FULL_COMPOSITION_ID,
    fullDurationInFrames: sceneFrom,
    scenes,
    sourceScriptSha256,
  };
}

export function scriptRevision(scenesText: string, sourceMapText: string): string {
  return sha256(Buffer.from(`${scenesText}\n${sourceMapText}\n`, "utf8"));
}
