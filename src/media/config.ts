import path from "node:path";
import {lstat} from "node:fs/promises";
import {AppError} from "../errors.js";
import {readLocalFileLimited} from "../ingest/input.js";
import {MAX_JSON_BYTES} from "../config.js";
import type {MediaConfig, RenderConfig} from "../types.js";

export const DEFAULT_MEDIA_CONFIG: MediaConfig = {
  schemaVersion: "0.2.0",
  speech: {mode: "none"},
  render: {concurrency: 2, crf: 23, scale: 1},
};

export function mediaConfigPath(project: string): string {
  return path.join(path.resolve(project), "video", "config.json");
}

function record(value: unknown, location: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("E_MEDIA_CONFIG", `${location} 必须是对象`, location);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], location: string): void {
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || keys.slice().sort().some((key, index) => actual[index] !== key)) {
    throw new AppError("E_MEDIA_CONFIG", `${location} 只允许字段：${keys.join("、")}`, location);
  }
}

function integer(value: unknown, minimum: number, maximum: number, location: string): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new AppError("E_MEDIA_CONFIG", `${location} 必须是 ${minimum}—${maximum} 的整数`, location);
  }
  return value as number;
}

function renderConfig(value: unknown): RenderConfig {
  const render = record(value, "render");
  exactKeys(render, ["concurrency", "crf", "scale"], "render");
  const concurrency = integer(render.concurrency, 1, 4, "render.concurrency");
  const crf = integer(render.crf, 18, 35, "render.crf");
  if (![0.25, 0.5, 0.75, 1].includes(render.scale as number)) {
    throw new AppError("E_MEDIA_CONFIG", "render.scale 只允许 0.25、0.5、0.75 或 1", "render.scale");
  }
  return {concurrency, crf, scale: render.scale as number};
}

export function parseMediaConfig(input: unknown): MediaConfig {
  const root = record(input, "video/config.json");
  exactKeys(root, ["schemaVersion", "speech", "render"], "video/config.json");
  const render = renderConfig(root.render);
  const speech = record(root.speech, "speech");
  if (root.schemaVersion === "0.2.0") {
    exactKeys(speech, ["mode"], "speech");
    if (speech.mode !== "none") throw new AppError("E_SPEECH_MODE", "0.2.0 配置只允许 speech.mode = none", "speech.mode");
    return {schemaVersion: "0.2.0", speech: {mode: "none"}, render};
  }
  if (root.schemaVersion !== "0.3.0") throw new AppError("E_MEDIA_CONFIG", "媒体配置版本必须为 0.2.0 或 0.3.0", "schemaVersion");
  if (speech.mode === "fixture") {
    exactKeys(speech, ["mode", "segmentDurationMs", "segmentPauseMs", "scenePauseMs"], "speech");
    return {
      schemaVersion: "0.3.0",
      speech: {
        mode: "fixture",
        segmentDurationMs: integer(speech.segmentDurationMs, 40, 2000, "speech.segmentDurationMs"),
        segmentPauseMs: integer(speech.segmentPauseMs, 0, 2000, "speech.segmentPauseMs"),
        scenePauseMs: integer(speech.scenePauseMs, 0, 2000, "speech.scenePauseMs"),
      },
      render,
    };
  }
  if (speech.mode === "edge-tts") {
    exactKeys(speech, ["mode", "voice", "rate", "timeoutMs", "maxRetries", "segmentPauseMs", "scenePauseMs"], "speech");
    if (typeof speech.voice !== "string" || !/^[A-Za-z0-9-]{3,64}$/.test(speech.voice)) {
      throw new AppError("E_MEDIA_CONFIG", "speech.voice 格式无效", "speech.voice");
    }
    if (typeof speech.rate !== "string" || !/^[+-](?:0|[1-9][0-9]{0,2})%$/.test(speech.rate) || Math.abs(Number.parseInt(speech.rate, 10)) > 50) {
      throw new AppError("E_MEDIA_CONFIG", "speech.rate 必须为 +0% 等百分比，且绝对值不超过 50%", "speech.rate");
    }
    return {
      schemaVersion: "0.3.0",
      speech: {
        mode: "edge-tts",
        voice: speech.voice,
        rate: speech.rate,
        timeoutMs: integer(speech.timeoutMs, 5000, 120000, "speech.timeoutMs"),
        maxRetries: integer(speech.maxRetries, 0, 2, "speech.maxRetries"),
        segmentPauseMs: integer(speech.segmentPauseMs, 0, 2000, "speech.segmentPauseMs"),
        scenePauseMs: integer(speech.scenePauseMs, 0, 2000, "speech.scenePauseMs"),
      },
      render,
    };
  }
  throw new AppError("E_SPEECH_MODE", "M3 仅支持 none、fixture 或 edge-tts；真实外部服务最多一种", "speech.mode");
}

export async function loadMediaConfig(project: string): Promise<MediaConfig | null> {
  const filename = mediaConfigPath(project);
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink()) throw new AppError("E_MEDIA_CONFIG", "媒体配置必须是普通文件，不能是目录或符号链接", filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const bytes = await readLocalFileLimited(filename, MAX_JSON_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new AppError("E_MEDIA_CONFIG", `媒体配置 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`, filename);
  }
  return parseMediaConfig(parsed);
}
