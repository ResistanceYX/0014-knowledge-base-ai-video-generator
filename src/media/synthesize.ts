import path from "node:path";
import {mkdir, readFile, rename, rm} from "node:fs/promises";
import {performance} from "node:perf_hooks";
import {AppError} from "../errors.js";
import {validateProject} from "../project.js";
import {assertExternalStageGate} from "../cost/record.js";
import {updateMediaCost} from "../cost/media.js";
import {sha256} from "../provenance/pointer.js";
import type {MaterializeResult, SceneDocument, SpeechClip, SpeechManifest} from "../types.js";
import {loadMediaConfig} from "./config.js";
import {loadTerminology} from "./overrides.js";
import {probeAudio, runProcess, safeProjectPath, writeToneWav} from "./audio.js";
import {readSpeechManifest, writeSpeechManifest, type AudioSpeechConfig} from "./speech.js";
import {scriptRevision} from "./timeline.js";
import {materializeProject} from "./materialize.js";

export interface SynthesizeSpeechOptions {
  project: string;
  sceneId?: string;
  force?: boolean;
  allowSyntheticUnreviewed?: boolean;
  refreshDerived?: boolean;
}

export interface SynthesizeSpeechResult {
  project: string;
  manifest: SpeechManifest;
  materialized: MaterializeResult;
  externalCalls: number;
  retries: number;
  durationMs: number;
}

function validId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function segments(document: SceneDocument): Array<{sceneId: string; segmentId: string; text: string}> {
  return document.scenes.flatMap((scene) => scene.narrationSegments.map((segment) => ({sceneId: scene.sceneId, segmentId: segment.segmentId, text: segment.text})));
}

async function fileHash(filename: string): Promise<string | null> {
  try {
    return sha256(await readFile(filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

class ClipSynthesisError extends AppError {
  constructor(message: string, location: string, readonly calls: number, readonly retries: number) {
    super("E_SPEECH_MODE", message, location);
  }
}

async function generateClip(options: {
  project: string;
  config: AudioSpeechConfig;
  file: string;
  spokenText: string;
  seed: number;
}): Promise<{calls: number; retries: number}> {
  const {config, file, spokenText} = options;
  await mkdir(path.dirname(file), {recursive: true});
  if (config.mode === "fixture") {
    await writeToneWav(file, config.segmentDurationMs, options.seed);
    return {calls: 0, retries: 0};
  }
  const extension = path.extname(file);
  const temporary = file.slice(0, -extension.length) + `.tmp-${process.pid}${extension}`;
  const boundary = safeProjectPath(options.project, file.slice(path.resolve(options.project).length + 1))
    .replace(`${path.sep}clips${path.sep}`, `${path.sep}boundaries${path.sep}`)
    .replace(/\.mp3$/, ".srt");
  await mkdir(path.dirname(boundary), {recursive: true});
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    await rm(temporary, {force: true});
    try {
      await runProcess({
        command: "python3",
        args: ["-m", "edge_tts", "--voice", config.voice, "--rate", config.rate, "--text", spokenText, "--write-media", temporary, "--write-subtitles", boundary],
        timeoutMs: config.timeoutMs,
        errorCode: "E_SPEECH_MODE",
      });
      const probed = await probeAudio(temporary, config.timeoutMs);
      if (probed.codec !== "mp3") throw new AppError("E_AUDIO", `Edge TTS 输出编码不是 mp3：${probed.codec}`, temporary);
      await rename(temporary, file);
      return {calls: attempt + 1, retries: attempt};
    } catch (error) {
      lastError = error;
      await rm(temporary, {force: true});
    }
  }
  throw new ClipSynthesisError(`Edge TTS 合成失败，已重试 ${config.maxRetries} 次：${lastError instanceof Error ? lastError.message : String(lastError)}`, file, config.maxRetries + 1, config.maxRetries);
}

export async function synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<SynthesizeSpeechResult> {
  const started = performance.now();
  const project = path.resolve(options.project);
  const validated = await validateProject({project, refreshDerived: options.refreshDerived ?? false});
  const config = await loadMediaConfig(project);
  if (!config || config.speech.mode === "none") throw new AppError("E_SPEECH_MODE", "speech 命令需要 0.3.0 fixture 或 edge-tts 配置；none 请直接使用 materialize");
  if (config.speech.mode === "edge-tts") {
    if (validated.scenes.sourceSnapshot.sourceType === "synthetic-fixture" && options.allowSyntheticUnreviewed) {
      // Only the explicit synthetic-fixture escape hatch may bypass human approval.
    } else {
      assertExternalStageGate(validated.scenes, validated.sourceMap);
    }
  }
  if (options.sceneId && !validated.scenes.scenes.some((scene) => scene.sceneId === options.sceneId)) throw new AppError("E_AUDIO", `找不到需重建配音的场景：${options.sceneId}`, options.sceneId);
  const scenesText = await readFile(path.join(project, "script", "scenes.json"), "utf8");
  const sourceMapText = await readFile(path.join(project, "script", "source-map.json"), "utf8");
  const revision = scriptRevision(scenesText, sourceMapText);
  const terminology = await loadTerminology(project);
  const previous = await readSpeechManifest(project, config.speech.mode);
  const previousClips = new Map(previous?.clips.map((clip) => [`${clip.sceneId}/${clip.segmentId}`, clip]) ?? []);
  const sameVoice = previous?.provider.voice === (config.speech.mode === "edge-tts" ? config.speech.voice : null)
    && previous?.provider.rate === (config.speech.mode === "edge-tts" ? config.speech.rate : null);
  const clips: SpeechClip[] = [];
  let externalCalls = 0;
  let retries = 0;

  try {
    for (const [index, segment] of segments(validated.scenes).entries()) {
    if (!validId(segment.sceneId) || !validId(segment.segmentId)) throw new AppError("E_AUDIO", "场景或片段 ID 含不安全字符", segment.segmentId);
    const extension = config.speech.mode === "fixture" ? ".wav" : ".mp3";
    const relative = `audio/clips/${segment.sceneId}/${segment.segmentId}${extension}`;
    const file = safeProjectPath(project, relative);
    const spokenText = terminology.apply(segment.text).trim();
    if (!spokenText) throw new AppError("E_AUDIO", "术语替换后的配音文本为空", segment.segmentId);
    const previousClip = previousClips.get(`${segment.sceneId}/${segment.segmentId}`);
    const selected = !options.sceneId || options.sceneId === segment.sceneId;
    const currentHashBefore = await fileHash(file);
    const reusable = !options.force && sameVoice && previousClip?.spokenText === spokenText && currentHashBefore !== null;
    if (!reusable && !selected) throw new AppError("E_AUDIO", `场景外片段 ${segment.segmentId} 不能复用；请取消 --scene 或先完整合成`, segment.segmentId);
    if (reusable && previousClip) {
      const probed = await probeAudio(file);
      clips.push({
        ...previousClip,
        file: relative,
        publicFile: `audio/clips/${segment.sceneId}/${segment.segmentId}${extension}`,
        durationMs: probed.durationMs,
        sha256: currentHashBefore,
        manuallyReplaced: currentHashBefore !== previousClip.generatedSha256,
        spokenText,
      });
      continue;
    }
    const generated = await generateClip({project, config: config.speech, file, spokenText, seed: index});
    externalCalls += generated.calls;
    retries += generated.retries;
    const generatedSha256 = sha256(await readFile(file));
    const probed = await probeAudio(file);
    clips.push({
      sceneId: segment.sceneId,
      segmentId: segment.segmentId,
      file: relative,
      publicFile: `audio/clips/${segment.sceneId}/${segment.segmentId}${extension}`,
      durationMs: probed.durationMs,
      sha256: generatedSha256,
      generatedSha256,
      manuallyReplaced: false,
      spokenText,
    });
    }
  } catch (error) {
    const failedCalls = error instanceof ClipSynthesisError ? error.calls : 0;
    const failedRetries = error instanceof ClipSynthesisError ? error.retries : 0;
    if (externalCalls + failedCalls > 0) {
      await updateMediaCost({
        project,
        speechMode: config.speech.mode,
        speechCalls: externalCalls + failedCalls,
        speechRetries: retries + failedRetries,
        speechDurationMs: Math.round(performance.now() - started),
      });
    }
    throw error;
  }

  const manifest: SpeechManifest = {
    schemaVersion: "0.3.0",
    mode: config.speech.mode,
    status: "ready",
    sourceScriptSha256: revision,
    terminologySha256: terminology.sha256,
    provider: {
      name: config.speech.mode === "fixture" ? "local-tone-fixture" : "edge-tts",
      version: config.speech.mode === "fixture" ? "0.3.0" : "7.3.1",
      voice: config.speech.mode === "edge-tts" ? config.speech.voice : null,
      rate: config.speech.mode === "edge-tts" ? config.speech.rate : null,
    },
    externalCalls: {
      count: externalCalls,
      retries,
      apiFees: config.speech.mode === "edge-tts"
        ? {status: "unknown", amount: null, currency: null, note: "未查询正式价格、服务条款或账单；无 API Key 不等于已确认免费，费用保持 unknown。"}
        : {status: "not-run", amount: null, currency: null, note: "本地非语音音调 fixture，无外部调用，不代表真实配音质量。"},
    },
    segmentPauseMs: config.speech.segmentPauseMs,
    scenePauseMs: config.speech.scenePauseMs,
    clips,
    note: config.speech.mode === "fixture"
      ? "fixture 是可闻音调而非可懂语音，只验证音轨封装和按段时间轴。"
      : "Edge TTS 真实合成仅由显式 speech 命令触发；字幕按音频片段对齐，不做词级或唇形同步。",
  };
  await mkdir(path.join(project, "media", "speech"), {recursive: true});
  await writeSpeechManifest(project, manifest);
  const materialized = await materializeProject({project, refreshDerived: options.refreshDerived ?? false});
  const durationMs = Math.round(performance.now() - started);
  await updateMediaCost({
    project,
    speechMode: config.speech.mode,
    generatedClipCount: materialized.plan.speech.clipCount,
    manualAudioReplacements: materialized.plan.speech.manuallyReplacedClips,
    manualSubtitleOverrides: materialized.plan.speech.subtitleOverrides,
    speechCalls: externalCalls,
    speechRetries: retries,
    speechDurationMs: durationMs,
  });
  return {project, manifest, materialized, externalCalls, retries, durationMs};
}
