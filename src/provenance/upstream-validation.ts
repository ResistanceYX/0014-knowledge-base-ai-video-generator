import {MAX_JSON_BYTES} from "../config.js";
import {AppError} from "../errors.js";
import {readLocalFileLimited} from "../ingest/input.js";
import type {UpstreamValidationRecord} from "../types.js";
import {sha256} from "./pointer.js";

const REQUIRED_COMMANDS = [
  "python3 scripts/validate.py --root .",
  "python3 scripts/generate_index.py --root . --check",
] as const;
const REQUIRED_FIELDS = ["schemaVersion", "repository", "commit", "validatedAt", "status", "commands", "log", "logSha256", "note"] as const;
const ALLOWED_FIELDS = new Set<string>(REQUIRED_FIELDS);
const COMMIT_RE = /^[0-9a-f]{40}$/u;
const SHA256_RE = /^[0-9a-f]{64}$/u;
const ISO_SECONDS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new AppError("E_NODE_SCOPE", `上游校验证据无效：${message}`, "/sourceSnapshot/upstreamValidation");
}

export function validateUpstreamValidationRecord(value: unknown, expectedCommit: string | null): UpstreamValidationRecord {
  if (!isRecord(value)) invalid("证据必须是 JSON 对象");
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(value, field)) invalid(`缺少字段 ${field}`);
  }
  for (const field of Object.keys(value)) {
    if (!ALLOWED_FIELDS.has(field)) invalid(`存在未定义字段 ${field}`);
  }
  if (value.schemaVersion !== "0.1.0") invalid("schemaVersion 必须为 0.1.0");
  if (value.repository !== "ResistanceYX/idea-tree") invalid("repository 必须为 ResistanceYX/idea-tree");
  if (!expectedCommit || !COMMIT_RE.test(expectedCommit)) invalid("当前节点快照没有可用于绑定的完整 commit");
  if (typeof value.commit !== "string" || !COMMIT_RE.test(value.commit)) invalid("commit 必须是完整 40 位小写哈希");
  if (value.commit !== expectedCommit) invalid("证据 commit 与节点快照 commit 不一致");
  if (value.status !== "passed") invalid("status 必须为 passed");
  if (typeof value.validatedAt !== "string" || !ISO_SECONDS_RE.test(value.validatedAt) || Number.isNaN(Date.parse(value.validatedAt))) {
    invalid("validatedAt 必须是秒级 UTC ISO 时间");
  }
  if (!Array.isArray(value.commands) || value.commands.length !== REQUIRED_COMMANDS.length || value.commands.some((command, index) => command !== REQUIRED_COMMANDS[index])) {
    invalid("commands 必须完整且按顺序记录上游 G01／G02 校验命令");
  }
  if (typeof value.log !== "string" || value.log.length === 0) invalid("log 必须包含完整校验日志");
  if (typeof value.logSha256 !== "string" || !SHA256_RE.test(value.logSha256)) invalid("logSha256 必须是 64 位小写 SHA-256");
  if (sha256(value.log) !== value.logSha256) invalid("logSha256 与 log 实际哈希不一致");
  if (typeof value.note !== "string" || value.note.trim().length === 0) invalid("note 必须声明证据边界");

  const requiredLines = [
    `source_commit=${expectedCommit}`,
    `validated_at=${value.validatedAt}`,
    ...value.commands.map((command) => `command=${command}`),
    "UPSTREAM_VALIDATION_PASSED",
  ];
  for (const line of requiredLines) {
    if (!value.log.split(/\r?\n/u).includes(line)) invalid(`日志缺少独立行：${line}`);
  }

  return {
    schemaVersion: "0.1.0",
    repository: "ResistanceYX/idea-tree",
    commit: value.commit,
    validatedAt: value.validatedAt,
    status: "passed",
    commands: [...value.commands],
    log: value.log,
    logSha256: value.logSha256,
    note: value.note,
  };
}

export async function readUpstreamValidationFile(filename: string): Promise<unknown> {
  const bytes = await readLocalFileLimited(filename, MAX_JSON_BYTES);
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch (error) {
    invalid(`证据 JSON 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
}
