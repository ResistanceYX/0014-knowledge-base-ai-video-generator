import path from "node:path";
import {readFile, writeFile} from "node:fs/promises";
import {AppError} from "../errors.js";
import {sha256} from "../provenance/pointer.js";
import type {EdgeTtsSpeechConfig, FixtureSpeechConfig, MediaPlan, SceneDocument, SpeechManifest} from "../types.js";
import {probeAudio, safeProjectPath} from "./audio.js";

export interface SpeechRequest {
  document: SceneDocument;
  plan: MediaPlan;
}

export interface NoneSpeechResult {
  schemaVersion: "0.2.0";
  mode: "none";
  status: "disabled";
  clips: [];
  externalCalls: {count: 0; apiFees: 0};
  note: string;
}

export interface SpeechAdapter {
  readonly mode: "none";
  synthesize(request: SpeechRequest): Promise<NoneSpeechResult>;
}

export class NoneSpeechAdapter implements SpeechAdapter {
  readonly mode = "none" as const;

  async synthesize(request: SpeechRequest): Promise<NoneSpeechResult> {
    return {
      schemaVersion: "0.2.0",
      mode: "none",
      status: "disabled",
      clips: [],
      externalCalls: {count: 0, apiFees: 0},
      note: `none 模式不生成配音；${request.plan.scenes.length} 个场景可无声预览。字幕仅按字符数分配时间，不代表音画同步。`,
    };
  }
}

export function getSpeechAdapter(mode: string): SpeechAdapter {
  if (mode === "none") return new NoneSpeechAdapter();
  throw new AppError("E_SPEECH_MODE", `该模式不是 none 离线适配器：${mode}；fixture 与 edge-tts 必须经显式 speech 命令处理`);
}

export type AudioSpeechConfig = FixtureSpeechConfig | EdgeTtsSpeechConfig;

export function speechManifestPath(project: string, mode: AudioSpeechConfig["mode"]): string {
  return path.join(path.resolve(project), "media", "speech", `${mode}.json`);
}

export async function readSpeechManifest(project: string, mode: AudioSpeechConfig["mode"]): Promise<SpeechManifest | null> {
  try {
    const text = await readFile(speechManifestPath(project, mode), "utf8");
    const value = JSON.parse(text) as SpeechManifest;
    if (value.schemaVersion !== "0.3.0" || value.mode !== mode || value.status !== "ready" || !Array.isArray(value.clips)) {
      throw new AppError("E_AUDIO", "配音清单结构或版本无效", speechManifestPath(project, mode));
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new AppError("E_JSON_PARSE", `配音清单 JSON 无法解析：${error.message}`, speechManifestPath(project, mode));
    throw error;
  }
}

export async function writeSpeechManifest(project: string, manifest: SpeechManifest): Promise<string> {
  const filename = speechManifestPath(project, manifest.mode);
  await writeFile(filename, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return filename;
}

export async function refreshSpeechManifest(options: {
  project: string;
  config: AudioSpeechConfig;
  sourceScriptSha256: string;
  terminologySha256: string;
}): Promise<{manifest: SpeechManifest; filename: string}> {
  const {project, config} = options;
  const manifest = await readSpeechManifest(project, config.mode);
  if (!manifest) throw new AppError("E_AUDIO", `缺少 ${config.mode} 配音清单；请先显式运行 speech 命令，渲染不会隐式联网合成`, speechManifestPath(project, config.mode));
  if (manifest.sourceScriptSha256 !== options.sourceScriptSha256) {
    throw new AppError("E_DERIVED_STALE", "脚本已变化，配音清单已过期；请重新运行 speech，未变片段会复用", speechManifestPath(project, config.mode));
  }
  if (manifest.terminologySha256 !== options.terminologySha256) {
    throw new AppError("E_DERIVED_STALE", "术语表已变化，配音清单已过期；请重新运行 speech", speechManifestPath(project, config.mode));
  }
  const expected = new Set(manifest.clips.map((clip) => `${clip.sceneId}/${clip.segmentId}`));
  if (expected.size !== manifest.clips.length) throw new AppError("E_AUDIO", "配音清单包含重复片段", speechManifestPath(project, config.mode));
  for (const clip of manifest.clips) {
    const filename = safeProjectPath(project, clip.file);
    const bytes = await readFile(filename);
    const currentHash = sha256(bytes);
    const probed = await probeAudio(filename);
    clip.sha256 = currentHash;
    clip.durationMs = probed.durationMs;
    clip.manuallyReplaced = currentHash !== clip.generatedSha256;
    clip.publicFile = `audio/clips/${clip.sceneId}/${clip.segmentId}${path.extname(clip.file)}`;
  }
  const filename = await writeSpeechManifest(project, manifest);
  return {manifest, filename};
}
