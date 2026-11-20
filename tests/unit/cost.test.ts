import {describe, expect, it} from "vitest";
import {assertExternalStageGate, createCostRecord} from "../../src/cost/record.js";
import {validateJsonSchema} from "../../src/scenes/schema.js";
import type {CostRecord} from "../../src/types.js";
import {clone, expectCode, FIXTURE_SHA256, makeBundle} from "../helpers.js";

describe("成本与人工审核闸门", () => {
  it("区分零外部调用、未知价格与本地计算成本", () => {
    const cost = createCostRecord(FIXTURE_SHA256, 12.6);
    expect(cost.externalCalls.count).toBe(0);
    expect(cost.externalCalls.apiFees.amount).toBe(0);
    expect(cost.optionalServicesPricing.status).toBe("unknown");
    expect(cost.localCompute.durationMs).toBe(13);
    expect(cost.localCompute.monetaryCost).toBe("not-estimated");
    expect(() => validateJsonSchema<CostRecord>("cost-schema.json", cost, "E_SCENE_SEMANTICS")).not.toThrow();
  });

  it("未审核脚本不能进入外部阶段；机器生成不自动 approved", async () => {
    const bundle = await makeBundle();
    expect(bundle.scenes.scriptReview.status).toBe("unreviewed");
    await expectCode(() => assertExternalStageGate(bundle.scenes, bundle.sourceMap), "E_REVIEW_REQUIRED");
    const approved = clone(bundle);
    approved.scenes.scriptReview = {status: "approved", reviewer: "human-reviewer", reviewedAt: "2026-11-20T01:00:00Z"};
    await expectCode(() => assertExternalStageGate(approved.scenes, approved.sourceMap), "E_REVIEW_REQUIRED");
    approved.sourceMap.entries.forEach((entry) => {
      entry.review = {status: "approved", reviewer: "human-reviewer", reviewedAt: "2026-11-20T01:00:00Z"};
    });
    expect(() => assertExternalStageGate(approved.scenes, approved.sourceMap)).not.toThrow();
  });
});
