import path from "node:path";
import {expect} from "vitest";
import {PACKAGE_ROOT} from "../src/config.js";
import {AppError, type ErrorCode} from "../src/errors.js";
import {loadNodeSnapshot} from "../src/ingest/snapshot.js";
import {parseAndValidateNode} from "../src/node-schema/validate.js";
import {TemplateScriptWriter} from "../src/script/template.js";
import type {ScriptBundle} from "../src/types.js";

export const FIXTURE = path.join(PACKAGE_ROOT, "tests", "fixtures", "synthetic-node.yaml");
export const FIXED_NOW = new Date("2026-11-20T00:00:00.000Z");
export const FIXTURE_SHA256 = "23687ce6224e91463121eca1172ef2ca82cbc693f7287dd697aa03ca0ca9e1f0";

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
