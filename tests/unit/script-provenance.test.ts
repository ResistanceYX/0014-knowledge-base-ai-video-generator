import {describe, expect, it} from "vitest";
import {validateScriptBundle} from "../../src/provenance/validate.js";
import {boundaryQualifier, statusQualifier} from "../../src/provenance/qualifiers.js";
import {clone, expectCode, makeBundle, makeContext} from "../helpers.js";

describe("离线保守模板与 Scene／SourceMap", () => {
  it("生成六类场景且每条 factual 陈述有来源", async () => {
    const {node, snapshot} = await makeContext();
    const bundle = await makeBundle();
    expect(new Set(bundle.scenes.scenes.map((scene) => scene.type))).toEqual(new Set([
      "Title", "Idea", "DeathReason", "EvidenceAndLimits", "ReusableParts", "Outro",
    ]));
    expect(bundle.scenes.scenes).toHaveLength(8);
    expect(bundle.sourceMap.entries).toHaveLength(22);
    expect(() => validateScriptBundle(node, snapshot, bundle)).not.toThrow();
    const factual = bundle.scenes.scenes.flatMap((scene) => scene.narrationSegments).filter((segment) => segment.kind === "factual");
    for (const segment of factual) {
      const entry = bundle.sourceMap.entries.find((item) => item.segmentId === segment.segmentId);
      expect(entry?.supportStatus).toBe("supported");
      expect(entry?.sources.length).toBeGreaterThan(0);
    }
    expect(bundle.sourceMap.entries.some((entry) => entry.qualifiers.includes(statusQualifier(node)))).toBe(true);
    expect(bundle.sourceMap.entries.some((entry) => entry.qualifiers.includes(boundaryQualifier(node.结论边界!)))).toBe(true);
  });

  it("无法定位的内容只能以待补证占位存在", async () => {
    const {node, snapshot} = await makeContext();
    const bundle = clone(await makeBundle());
    const segment = bundle.scenes.scenes[1]!.narrationSegments[0]!;
    segment.kind = "placeholder";
    segment.text = "待补证：这里保留一个人工待确认问题。";
    const entry = bundle.sourceMap.entries.find((item) => item.segmentId === segment.segmentId)!;
    entry.supportStatus = "needs-evidence";
    entry.sources = [];
    entry.openQuestion = "需要人工补充获准来源，不得把该占位当成事实。";
    expect(() => validateScriptBundle(node, snapshot, bundle)).not.toThrow();
  });

  it("拒绝未知场景、重复 ID、乱序和非法画幅", async () => {
    const {node, snapshot} = await makeContext();
    const unknown = clone(await makeBundle()) as any;
    unknown.scenes.scenes[0].type = "Unknown";
    await expectCode(() => validateScriptBundle(node, snapshot, unknown), "E_SCENE_SCHEMA");

    const duplicate = clone(await makeBundle());
    duplicate.scenes.scenes[1]!.sceneId = duplicate.scenes.scenes[0]!.sceneId;
    await expectCode(() => validateScriptBundle(node, snapshot, duplicate), "E_SCENE_SEMANTICS");

    const order = clone(await makeBundle());
    order.scenes.scenes[1]!.order = 9;
    await expectCode(() => validateScriptBundle(node, snapshot, order), "E_SCENE_SEMANTICS");

    const video = clone(await makeBundle()) as any;
    video.scenes.video.width = 1920;
    await expectCode(() => validateScriptBundle(node, snapshot, video), "E_SCENE_SCHEMA");
  });

  it("逐句映射必须恰好覆盖，不能有悬空引用", async () => {
    const {node, snapshot} = await makeContext();
    const missing = clone(await makeBundle());
    missing.sourceMap.entries.pop();
    await expectCode(() => validateScriptBundle(node, snapshot, missing), "E_SOURCE_COVERAGE");

    const orphan = clone(await makeBundle());
    orphan.sourceMap.entries[0]!.segmentId = "seg-not-present";
    await expectCode(() => validateScriptBundle(node, snapshot, orphan), "E_SOURCE_ORPHAN");
  });

  it("supported 无来源与 factual 待补证均被拒绝", async () => {
    const {node, snapshot} = await makeContext();
    const noSource = clone(await makeBundle());
    noSource.sourceMap.entries[0]!.sources = [];
    await expectCode(() => validateScriptBundle(node, snapshot, noSource), "E_SOURCE_SCHEMA");

    const unsupported = clone(await makeBundle());
    const entry = unsupported.sourceMap.entries[0]!;
    entry.supportStatus = "needs-evidence";
    entry.sources = [];
    entry.openQuestion = "没有来源";
    await expectCode(() => validateScriptBundle(node, snapshot, unsupported), "E_SOURCE_COVERAGE");
  });

  it("检查 JSON Pointer、原文摘录和快照哈希", async () => {
    const {node, snapshot} = await makeContext();
    const pointer = clone(await makeBundle());
    pointer.sourceMap.entries[0]!.sources[0]!.jsonPointer = "/不存在";
    await expectCode(() => validateScriptBundle(node, snapshot, pointer), "E_SOURCE_POINTER");

    const excerpt = clone(await makeBundle());
    excerpt.sourceMap.entries[0]!.sources[0]!.excerpt = "不存在的原文";
    await expectCode(() => validateScriptBundle(node, snapshot, excerpt), "E_SOURCE_EXCERPT");

    const changed = clone(await makeBundle());
    changed.sourceMap.sourceSnapshotSha256 = "0".repeat(64);
    await expectCode(() => validateScriptBundle(node, snapshot, changed), "E_SOURCE_SNAPSHOT");
  });

  it("删除结论边界或证据限定条件会失败", async () => {
    const {node, snapshot} = await makeContext();
    const bundle = clone(await makeBundle());
    bundle.sourceMap.entries.forEach((entry) => {
      entry.qualifiers = entry.qualifiers.filter((qualifier) => !qualifier.startsWith("限定条件（结论边界）"));
    });
    await expectCode(() => validateScriptBundle(node, snapshot, bundle), "E_LIMIT_DROPPED");
  });

  it("approved 必须有审核人、时间，且逐句审校一致", async () => {
    const {node, snapshot} = await makeContext();
    const missingReviewer = clone(await makeBundle());
    missingReviewer.scenes.scriptReview.status = "approved";
    await expectCode(() => validateScriptBundle(node, snapshot, missingReviewer), "E_SCENE_SCHEMA");

    const inconsistent = clone(await makeBundle());
    inconsistent.scenes.scriptReview = {status: "approved", reviewer: "human", reviewedAt: "2026-11-20T01:00:00Z"};
    await expectCode(() => validateScriptBundle(node, snapshot, inconsistent), "E_REVIEW_REQUIRED");
  });
});
