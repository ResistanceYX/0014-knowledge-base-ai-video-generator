import type {CostRecord, Review, SceneDocument, SourceMapDocument} from "../types.js";
import {AppError} from "../errors.js";

export function createCostRecord(sourceSnapshotSha256: string, durationMs: number): CostRecord {
  return {
    schemaVersion: "0.1.0",
    sourceSnapshotSha256,
    mode: "offline-template",
    externalCalls: {
      status: "none",
      count: 0,
      apiFees: {
        amount: 0,
        currency: null,
        note: "本次仅运行本地离线模板，未调用外部模型、配音或渲染 API；0 仅表示本次外部 API 调用费用。",
      },
    },
    optionalServicesPricing: {
      status: "unknown",
      queriedAt: null,
      note: "未查询任何可选外部服务的当前价格；unknown 不表示免费，也不构成报价。",
    },
    localCompute: {
      status: "measured",
      durationMs: Math.max(0, Math.round(durationMs)),
      monetaryCost: "not-estimated",
      note: "本地解析与生成仍消耗机器时间和电力；本阶段只记录耗时，不折算货币成本。",
    },
    retries: 0,
    manualRevisionRounds: 0,
  };
}

export function assertExternalStageGate(scenes: SceneDocument, sourceMap: SourceMapDocument): void {
  const review: Review = scenes.scriptReview;
  if (review.status !== "approved" || !review.reviewer || !review.reviewedAt) {
    throw new AppError("E_REVIEW_REQUIRED", "脚本尚未由人工完整审核，不能进入外部付费或发布阶段", "/scriptReview");
  }
  const incomplete = sourceMap.entries.filter((entry) =>
    entry.review.status !== "approved" || !entry.review.reviewer || !entry.review.reviewedAt
  );
  if (incomplete.length > 0) {
    throw new AppError(
      "E_REVIEW_REQUIRED",
      `仍有 ${incomplete.length} 条逐句来源记录未由人工完整审核`,
      "/entries",
    );
  }
}
