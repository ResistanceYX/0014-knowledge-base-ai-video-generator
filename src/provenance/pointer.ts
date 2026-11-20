import {createHash} from "node:crypto";
import type {IdeaTreeNode, NodeFieldSource} from "../types.js";

export function decodeJsonPointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error("JSON Pointer 必须以 / 开头");
  return pointer.slice(1).split("/").map((token) => {
    if (/~(?![01])/u.test(token)) throw new Error("JSON Pointer 含非法转义");
    return token.replaceAll("~1", "/").replaceAll("~0", "~");
  });
}

export function resolveJsonPointer(root: unknown, pointer: string): {found: boolean; value?: unknown} {
  let current = root;
  for (const token of decodeJsonPointer(pointer)) {
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(token)) return {found: false};
      const index = Number(token);
      if (index >= current.length) return {found: false};
      current = current[index];
    } else if (current !== null && typeof current === "object" && Object.hasOwn(current, token)) {
      current = (current as Record<string, unknown>)[token];
    } else {
      return {found: false};
    }
  }
  return {found: true, value: current};
}

export function scalarText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function source(node: IdeaTreeNode, jsonPointer: string, fieldRole: NodeFieldSource["fieldRole"]): NodeFieldSource {
  const resolved = resolveJsonPointer(node, jsonPointer);
  const excerpt = resolved.found ? scalarText(resolved.value) : null;
  if (excerpt === null || excerpt.length === 0) {
    throw new Error(`无法为 ${jsonPointer} 建立非空原文摘录`);
  }
  return {kind: "node-field", jsonPointer, excerpt, fieldRole};
}

export function sha256(text: string | Uint8Array): string {
  return createHash("sha256").update(text).digest("hex");
}
