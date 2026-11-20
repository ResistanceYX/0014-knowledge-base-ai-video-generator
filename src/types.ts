export type ArchiveType = "预审" | "验尸";
export type RevivalStatus = "死透" | "复活候选" | "已复活";
export type ReviewStatus = "unreviewed" | "approved" | "changes-requested";
export type SegmentKind = "factual" | "transition" | "editorial" | "placeholder";
export type SupportStatus = "supported" | "partially-supported" | "needs-evidence" | "not-applicable";
export type SceneType = "Title" | "Idea" | "DeathReason" | "EvidenceAndLimits" | "ReusableParts" | "Outro";

export interface DeathRecord {
  类型: string;
  证据: string;
  推理?: string;
  分析?: string;
  案例?: string;
  证据链接?: string[];
  置信度: string;
  备注?: string;
}

export interface IdeaTreeNode extends Record<string, unknown> {
  编号: string;
  id: string;
  标题: string;
  一句话: string;
  档案类型: ArchiveType;
  复活状态: RevivalStatus;
  结论边界?: string;
  创新类型: string[];
  领域: string;
  子领域: string;
  死法: DeathRecord[];
  需求证据?: {类型: string; 说明?: string; 附件?: string; [key: string]: unknown};
  商业及社会价值评估?: string;
  可拆零件: string[];
  相关节点?: unknown[];
  死因保质期: string;
  起草AI: string;
  审核人: string;
  审核日期: string;
  备注?: string;
}

export interface LicenseRecord {
  spdxId: string;
  referenceUrl: string | null;
  notice: string;
}

export interface SourceSnapshot {
  sourceType: "github-public-node" | "local-yaml" | "synthetic-fixture";
  originalUrl: string | null;
  normalizedUrl: string | null;
  commit: string | null;
  retrievedAt: string;
  fileSha256: string;
  nodeFormatVersion: string;
  parserVersion: string;
  license: LicenseRecord;
}

export interface Review {
  status: ReviewStatus;
  reviewer: string | null;
  reviewedAt: string | null;
}

export interface NarrationSegment {
  segmentId: string;
  text: string;
  kind: SegmentKind;
}

export interface Scene {
  sceneId: string;
  order: number;
  type: SceneType;
  durationSeconds: number;
  narrationSegments: NarrationSegment[];
  visual: {
    heading: string;
    bodyLines: string[];
    accentColor: string;
  };
}

export interface SceneDocument {
  schemaVersion: "0.1.0";
  projectId: string;
  sourceSnapshot: SourceSnapshot;
  node: {
    number: string;
    id: string;
    title: string;
    archiveType: ArchiveType;
    revivalStatus: RevivalStatus;
    conclusionBoundary: string | null;
  };
  video: {fps: 30; width: 1280; height: 720; aspectRatio: "16:9"};
  scenes: Scene[];
  scriptReview: Review;
}

export interface NodeFieldSource {
  kind: "node-field";
  jsonPointer: string;
  excerpt: string;
  fieldRole: "metadata" | "evidence" | "reasoning" | "limit" | "reusable-part" | "other";
}

export interface SourceMapEntry {
  segmentId: string;
  sceneId: string;
  supportStatus: SupportStatus;
  sources: NodeFieldSource[];
  qualifiers: string[];
  openQuestion: string | null;
  review: Review;
}

export interface SourceMapDocument {
  schemaVersion: "0.1.0";
  projectId: string;
  sourceSnapshotSha256: string;
  entries: SourceMapEntry[];
}

export interface ScriptBundle {
  scenes: SceneDocument;
  sourceMap: SourceMapDocument;
}

export interface CostRecord {
  schemaVersion: "0.1.0";
  sourceSnapshotSha256: string;
  mode: "offline-template";
  externalCalls: {
    status: "none";
    count: 0;
    apiFees: {amount: 0; currency: null; note: string};
  };
  optionalServicesPricing: {
    status: "unknown";
    queriedAt: null;
    note: string;
  };
  localCompute: {status: "measured"; durationMs: number; monetaryCost: "not-estimated"; note: string};
  retries: number;
  manualRevisionRounds: number;
}

export interface GeneratedProjectPaths {
  root: string;
  sourceYaml: string;
  provenance: string;
  scenes: string;
  sourceMap: string;
  narration: string;
  sourceTable: string;
  checklist: string;
  cost: string;
}
