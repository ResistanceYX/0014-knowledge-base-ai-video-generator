import path from "node:path";
import {mkdir, lstat, writeFile} from "node:fs/promises";
import {AppError} from "../errors.js";
import {readLocalFileLimited} from "../ingest/input.js";
import {sha256} from "../provenance/pointer.js";
import type {SubtitleOverride} from "../types.js";

export interface TerminologyEntry {term: string; replacement: string}
export interface TerminologyTable {
  entries: TerminologyEntry[];
  sha256: string;
  apply: (text: string) => string;
}
export interface SubtitleOverrides {
  entries: SubtitleOverride[];
  sha256: string;
}

function object(value: unknown, location: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new AppError("E_MEDIA_CONFIG", `${location} 必须是对象`, location);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], location: string): void {
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || keys.slice().sort().some((key, index) => actual[index] !== key)) {
    throw new AppError("E_MEDIA_CONFIG", `${location} 只允许字段：${keys.join("、")}`, location);
  }
}

async function readJsonIfExists(filename: string): Promise<{value: unknown; text: string} | null> {
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink()) throw new AppError("E_MEDIA_CONFIG", "语音人工配置必须是普通文件，不能是符号链接", filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const text = (await readLocalFileLimited(filename)).toString("utf8");
  try {
    return {value: JSON.parse(text) as unknown, text};
  } catch (error) {
    throw new AppError("E_JSON_PARSE", `语音人工配置 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`, filename);
  }
}

export async function ensureSpeechInputFiles(project: string): Promise<void> {
  const directory = path.join(path.resolve(project), "speech");
  await mkdir(directory, {recursive: true});
  const defaults: Array<[string, unknown]> = [
    ["terminology.json", {schemaVersion: "0.3.0", entries: []}],
    ["subtitle-overrides.json", {schemaVersion: "0.3.0", entries: []}],
  ];
  for (const [name, value] of defaults) {
    const filename = path.join(directory, name);
    try {
      await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, {encoding: "utf8", flag: "wx"});
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

export async function loadTerminology(project: string): Promise<TerminologyTable> {
  const filename = path.join(path.resolve(project), "speech", "terminology.json");
  const loaded = await readJsonIfExists(filename);
  if (!loaded) return {entries: [], sha256: sha256(Buffer.from("missing-terminology-v0.3.0", "utf8")), apply: (text) => text};
  const root = object(loaded.value, filename);
  exactKeys(root, ["schemaVersion", "entries"], filename);
  if (root.schemaVersion !== "0.3.0" || !Array.isArray(root.entries)) throw new AppError("E_MEDIA_CONFIG", "术语表版本或 entries 无效", filename);
  const entries = root.entries.map((value, index) => {
    const item = object(value, `entries/${index}`);
    exactKeys(item, ["term", "replacement"], `entries/${index}`);
    if (typeof item.term !== "string" || !item.term.trim() || item.term.length > 100 || typeof item.replacement !== "string" || !item.replacement.trim() || item.replacement.length > 200) {
      throw new AppError("E_MEDIA_CONFIG", "术语与替换读音必须是非空且有长度限制的字符串", `entries/${index}`);
    }
    return {term: item.term, replacement: item.replacement};
  });
  if (new Set(entries.map((entry) => entry.term)).size !== entries.length) throw new AppError("E_MEDIA_CONFIG", "术语表不得包含重复术语", filename);
  const ordered = [...entries].sort((a, b) => b.term.length - a.term.length);
  return {
    entries,
    sha256: sha256(Buffer.from(loaded.text, "utf8")),
    apply: (text: string) => ordered.reduce((result, entry) => result.split(entry.term).join(entry.replacement), text),
  };
}

export async function loadSubtitleOverrides(project: string): Promise<SubtitleOverrides> {
  const filename = path.join(path.resolve(project), "speech", "subtitle-overrides.json");
  const loaded = await readJsonIfExists(filename);
  if (!loaded) return {entries: [], sha256: sha256(Buffer.from("missing-subtitle-overrides-v0.3.0", "utf8"))};
  const root = object(loaded.value, filename);
  exactKeys(root, ["schemaVersion", "entries"], filename);
  if (root.schemaVersion !== "0.3.0" || !Array.isArray(root.entries)) throw new AppError("E_MEDIA_CONFIG", "字幕覆盖表版本或 entries 无效", filename);
  const entries = root.entries.map((value, index): SubtitleOverride => {
    const item = object(value, `entries/${index}`);
    const keys = Object.keys(item);
    if (!keys.includes("segmentId") || keys.some((key) => !["segmentId", "text", "offsetMs", "durationMs"].includes(key))) {
      throw new AppError("E_MEDIA_CONFIG", "字幕覆盖只允许 segmentId、text、offsetMs、durationMs", `entries/${index}`);
    }
    if (typeof item.segmentId !== "string" || !/^[A-Za-z0-9_-]+$/.test(item.segmentId)) throw new AppError("E_MEDIA_CONFIG", "字幕覆盖 segmentId 无效", `entries/${index}`);
    if (item.text !== undefined && (typeof item.text !== "string" || !item.text.trim() || item.text.length > 1000)) throw new AppError("E_MEDIA_CONFIG", "字幕覆盖文本无效", `entries/${index}`);
    for (const key of ["offsetMs", "durationMs"] as const) {
      if (item[key] !== undefined && !Number.isInteger(item[key])) throw new AppError("E_MEDIA_CONFIG", `${key} 必须是整数毫秒`, `entries/${index}`);
    }
    if (item.offsetMs !== undefined && Math.abs(item.offsetMs as number) > 2000) throw new AppError("E_MEDIA_CONFIG", "字幕偏移绝对值不得超过 2000ms", `entries/${index}`);
    if (item.durationMs !== undefined && ((item.durationMs as number) < 40 || (item.durationMs as number) > 120000)) throw new AppError("E_MEDIA_CONFIG", "字幕时长必须位于 40—120000ms", `entries/${index}`);
    return {
      segmentId: item.segmentId,
      ...(item.text !== undefined ? {text: item.text as string} : {}),
      ...(item.offsetMs !== undefined ? {offsetMs: item.offsetMs as number} : {}),
      ...(item.durationMs !== undefined ? {durationMs: item.durationMs as number} : {}),
    };
  });
  if (new Set(entries.map((entry) => entry.segmentId)).size !== entries.length) throw new AppError("E_MEDIA_CONFIG", "字幕覆盖不得包含重复 segmentId", filename);
  return {entries, sha256: sha256(Buffer.from(loaded.text, "utf8"))};
}
