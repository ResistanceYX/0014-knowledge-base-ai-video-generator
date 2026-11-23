import path from "node:path";
import {lstat} from "node:fs/promises";
import {AppError} from "../errors.js";
import {readLocalFileLimited} from "../ingest/input.js";
import {MAX_JSON_BYTES} from "../config.js";
import type {MediaConfig} from "../types.js";

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

export function parseMediaConfig(input: unknown): MediaConfig {
  const root = record(input, "video/config.json");
  exactKeys(root, ["schemaVersion", "speech", "render"], "video/config.json");
  if (root.schemaVersion !== "0.2.0") throw new AppError("E_MEDIA_CONFIG", "媒体配置版本必须为 0.2.0");
  const speech = record(root.speech, "speech");
  exactKeys(speech, ["mode"], "speech");
  if (speech.mode !== "none") throw new AppError("E_SPEECH_MODE", "M2 只允许 speech.mode = none；真实配音属于 M3");
  const render = record(root.render, "render");
  exactKeys(render, ["concurrency", "crf", "scale"], "render");
  if (!Number.isInteger(render.concurrency) || (render.concurrency as number) < 1 || (render.concurrency as number) > 4) {
    throw new AppError("E_MEDIA_CONFIG", "render.concurrency 必须是 1—4 的整数", "render.concurrency");
  }
  if (!Number.isInteger(render.crf) || (render.crf as number) < 18 || (render.crf as number) > 35) {
    throw new AppError("E_MEDIA_CONFIG", "render.crf 必须是 18—35 的整数", "render.crf");
  }
  if (![0.25, 0.5, 0.75, 1].includes(render.scale as number)) {
    throw new AppError("E_MEDIA_CONFIG", "render.scale 只允许 0.25、0.5、0.75 或 1", "render.scale");
  }
  return {
    schemaVersion: "0.2.0",
    speech: {mode: "none"},
    render: {concurrency: render.concurrency as number, crf: render.crf as number, scale: render.scale as number},
  };
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
