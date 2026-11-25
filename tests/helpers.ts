import path from "node:path";
import {expect} from "vitest";
import {PACKAGE_ROOT} from "../src/config.js";
import {AppError, type ErrorCode} from "../src/errors.js";
import {loadNodeSnapshot} from "../src/ingest/snapshot.js";
import {parseAndValidateNode} from "../src/node-schema/validate.js";
import {TemplateScriptWriter} from "../src/script/template.js";
import {sha256} from "../src/provenance/pointer.js";
import type {ScriptBundle, UpstreamValidationRecord} from "../src/types.js";

export const FIXTURE = path.join(PACKAGE_ROOT, "tests", "fixtures", "synthetic-node.yaml");
export const FIXED_NOW = new Date("2026-11-20T00:00:00.000Z");
export const FIXTURE_SHA256 = "23687ce6224e91463121eca1172ef2ca82cbc693f7287dd697aa03ca0ca9e1f0";
export const UPSTREAM_TEST_COMMIT = "3ecc35b0c00e7bfa55ce5f890f11f28587de9581";

export function makeUpstreamValidation(commit = UPSTREAM_TEST_COMMIT): UpstreamValidationRecord {
  const validatedAt = "2026-11-24T17:06:33Z";
  const commands = [
    "python3 scripts/validate.py --root .",
    "python3 scripts/generate_index.py --root . --check",
  ];
  const log = [
    `source_commit=${commit}`,
    `validated_at=${validatedAt}`,
    "python=Python 3.12.12",
    `command=${commands[0]}`,
    "检查汇总：节点 43 个，死法 228 条，不同证据链接 356 个，链接出现 754 次，错误 0 个，警告 0 个。",
    `command=${commands[1]}`,
    "索引检查通过：INDEX.md 与 43 个节点及统计一致。",
    "UPSTREAM_VALIDATION_PASSED",
    "",
  ].join("\n");
  return {
    schemaVersion: "0.1.0",
    repository: "ResistanceYX/idea-tree",
    commit,
    validatedAt,
    status: "passed",
    commands,
    log,
    logSha256: sha256(log),
    note: "合成测试证据；不是上游签名，不替代人工审校。",
  };
}

export async function makeContext() {
  const {snapshot, yamlText} = await loadNodeSnapshot({input: FIXTURE, synthetic: true, now: FIXED_NOW});
  const node = parseAndValidateNode(yamlText);
  return {snapshot, node};
}

export async function makeBundle(): Promise<ScriptBundle> {
  const {snapshot, node} = await makeContext();
  return new TemplateScriptWriter().write(node, snapshot);
}

export async function expectCode(action: () => unknown | Promise<unknown>, code: ErrorCode): Promise<AppError> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`预期抛出 ${code}，但操作成功`);
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
