import {FORMAT_VERSION} from "../config.js";
import {AppError, issue, type ValidationIssue} from "../errors.js";
import {validateJsonSchema} from "../scenes/schema.js";
import type {IdeaTreeNode, SceneDocument, ScriptBundle, SourceMapDocument, SourceSnapshot} from "../types.js";
import {resolveJsonPointer, scalarText} from "./pointer.js";
import {
  PARTS_QUALIFIER,
  boundaryQualifier,
  deathEvidenceQualifier,
  deathReasoningQualifier,
  noteQualifier,
  statusQualifier,
} from "./qualifiers.js";

function fail(code: "E_SCENE_SEMANTICS" | "E_SOURCE_ORPHAN" | "E_SOURCE_COVERAGE" | "E_SOURCE_POINTER" | "E_SOURCE_EXCERPT" | "E_SOURCE_SNAPSHOT" | "E_LIMIT_DROPPED" | "E_REVIEW_REQUIRED", location: string, message: string): never {
  throw new AppError(code, message, location);
}

export function validateScriptBundle(node: IdeaTreeNode, snapshot: SourceSnapshot, input: ScriptBundle): ScriptBundle {
  const scenes = validateJsonSchema<SceneDocument>("scene-schema.json", input.scenes, "E_SCENE_SCHEMA");
  const sourceMap = validateJsonSchema<SourceMapDocument>("source-map-schema.json", input.sourceMap, "E_SOURCE_SCHEMA");
  const expectedProjectId = `${node.编号}-${node.id}`;
  if (scenes.projectId !== expectedProjectId || sourceMap.projectId !== expectedProjectId) {
    fail("E_SCENE_SEMANTICS", "/projectId", `projectId 必须与节点编号和 id 一致：${expectedProjectId}`);
  }
  if (snapshot.nodeFormatVersion !== FORMAT_VERSION) {
    fail("E_SOURCE_SNAPSHOT", "/sourceSnapshot/nodeFormatVersion", `本实现只接受 ${FORMAT_VERSION} 快照记录`);
  }
  if (snapshot.sourceType === "github-public-node" && (!snapshot.commit || !snapshot.normalizedUrl)) {
    fail("E_SOURCE_SNAPSHOT", "/sourceSnapshot", "远程 GitHub 节点必须固定完整 commit 并保存规范化 URL");
  }
  if (scenes.sourceSnapshot.fileSha256 !== snapshot.fileSha256 || sourceMap.sourceSnapshotSha256 !== snapshot.fileSha256) {
    fail("E_SOURCE_SNAPSHOT", "/sourceSnapshotSha256", "脚本或来源表的快照哈希与当前 source/node.yaml 不一致");
  }
  if (JSON.stringify(scenes.sourceSnapshot) !== JSON.stringify(snapshot)) {
    fail("E_SOURCE_SNAPSHOT", "/sourceSnapshot", "Scene 中的快照记录与 source/provenance.json 不一致");
  }
  if (
    scenes.node.number !== node.编号 || scenes.node.id !== node.id || scenes.node.title !== node.标题 ||
    scenes.node.archiveType !== node.档案类型 || scenes.node.revivalStatus !== node.复活状态 ||
    scenes.node.conclusionBoundary !== (node.结论边界 ?? null)
  ) {
    fail("E_SCENE_SEMANTICS", "/node", "Scene 节点摘要与当前 YAML 不一致");
  }

  const sceneIds = new Set<string>();
  const segments = new Map<string, {sceneId: string; kind: string; text: string}>();
  scenes.scenes.forEach((scene, sceneIndex) => {
    if (sceneIds.has(scene.sceneId)) fail("E_SCENE_SEMANTICS", `/scenes/${sceneIndex}/sceneId`, `重复 sceneId：${scene.sceneId}`);
    sceneIds.add(scene.sceneId);
    if (scene.order !== sceneIndex + 1) fail("E_SCENE_SEMANTICS", `/scenes/${sceneIndex}/order`, "场景 order 必须从 1 开始连续排列");
    for (const segment of scene.narrationSegments) {
      if (segments.has(segment.segmentId)) fail("E_SCENE_SEMANTICS", `/scenes/${sceneIndex}`, `重复 segmentId：${segment.segmentId}`);
      segments.set(segment.segmentId, {sceneId: scene.sceneId, kind: segment.kind, text: segment.text});
    }
  });

  const entryIds = new Set<string>();
  const allQualifiers = new Set<string>();
  for (const [entryIndex, entry] of sourceMap.entries.entries()) {
    const location = `/entries/${entryIndex}`;
    if (entryIds.has(entry.segmentId)) fail("E_SOURCE_COVERAGE", location, `同一段落存在重复来源映射：${entry.segmentId}`);
    entryIds.add(entry.segmentId);
    const segment = segments.get(entry.segmentId);
    if (!segment) fail("E_SOURCE_ORPHAN", location, `来源映射指向不存在的 segmentId：${entry.segmentId}`);
    if (segment.sceneId !== entry.sceneId) fail("E_SOURCE_ORPHAN", location, `segmentId 与 sceneId 的归属不一致：${entry.segmentId}`);
    if (segment.kind === "factual" && !["supported", "partially-supported"].includes(entry.supportStatus)) {
      fail("E_SOURCE_COVERAGE", location, "factual 陈述必须有来源并标为 supported 或 partially-supported；无法定位时请改用 placeholder／needs-evidence");
    }
    if (segment.kind === "placeholder" && entry.supportStatus !== "needs-evidence") {
      fail("E_SOURCE_COVERAGE", location, "placeholder 必须标为 needs-evidence，不能伪装成已支持事实");
    }
    if (["transition", "editorial"].includes(segment.kind) && entry.supportStatus !== "not-applicable") {
      fail("E_SOURCE_COVERAGE", location, "transition／editorial 的过程性文字应标为 not-applicable；实质事实请改用 factual 并提供来源");
    }
    for (const [sourceIndex, item] of entry.sources.entries()) {
      const sourceLocation = `${location}/sources/${sourceIndex}`;
      let resolved;
      try {
        resolved = resolveJsonPointer(node, item.jsonPointer);
      } catch (error) {
        fail("E_SOURCE_POINTER", sourceLocation, error instanceof Error ? error.message : String(error));
      }
      if (!resolved.found) fail("E_SOURCE_POINTER", sourceLocation, `JSON Pointer 无法解析：${item.jsonPointer}`);
      const text = scalarText(resolved.value);
      if (text === null) fail("E_SOURCE_EXCERPT", sourceLocation, "来源目标必须是字符串、数字或布尔值，以便核对原文摘录");
      if (!text.includes(item.excerpt)) fail("E_SOURCE_EXCERPT", sourceLocation, `摘录不存在于目标字段：${item.jsonPointer}`);
    }
    entry.qualifiers.forEach((qualifier) => allQualifiers.add(qualifier));
  }
  for (const segmentId of segments.keys()) {
    if (!entryIds.has(segmentId)) fail("E_SOURCE_COVERAGE", "/entries", `段落缺少来源映射：${segmentId}`);
  }

  const requiredQualifiers = [statusQualifier(node)];
  if (typeof node.结论边界 === "string") requiredQualifiers.push(boundaryQualifier(node.结论边界));
  if (typeof node.备注 === "string") requiredQualifiers.push(noteQualifier(node.备注));
  node.死法.forEach((death, index) => {
    requiredQualifiers.push(deathEvidenceQualifier(index, death.证据));
    requiredQualifiers.push(deathReasoningQualifier(index, death.推理 ?? death.分析 ?? ""));
  });
  if (node.可拆零件.length > 0) requiredQualifiers.push(PARTS_QUALIFIER);
  for (const qualifier of requiredQualifiers) {
    if (!allQualifiers.has(qualifier)) fail("E_LIMIT_DROPPED", "/entries", `必要限定条件被删除或改写：${qualifier}`);
  }
  if (!node.结论边界) {
    const retained = sourceMap.entries.some((entry) => entry.supportStatus === "needs-evidence" && entry.openQuestion?.includes("结论边界"));
    if (!retained) fail("E_LIMIT_DROPPED", "/entries", "原节点缺少结论边界时，必须保留对应的 needs-evidence 待补证记录");
  }

  if (scenes.scriptReview.status === "approved") {
    const notApproved = sourceMap.entries.find((entry) => entry.review.status !== "approved");
    if (notApproved) fail("E_REVIEW_REQUIRED", "/scriptReview", `整稿标为 approved，但段落 ${notApproved.segmentId} 尚未 approved`);
  }
  return {scenes, sourceMap};
}

export function collectQualifiers(sourceMap: SourceMapDocument): readonly string[] {
  return sourceMap.entries.flatMap((entry) => entry.qualifiers);
}

export function validationIssuesFromError(error: unknown): readonly ValidationIssue[] {
  return error instanceof AppError ? error.issues : [issue("E_SCENE_SEMANTICS", "/", String(error))];
}
