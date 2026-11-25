export type ArchiveType = "预审" | "验尸";
export type RevivalStatus = "死透" | "复活候选" | "已复活";
export type ReviewStatus = "unreviewed" | "approved" | "changes-requested";
export type SegmentKind = "factual" | "transition" | "editorial" | "placeholder";
export type SupportStatus = "supported" | "partially-supported" | "needs-evidence" | "not-applicable";
export type SceneType = "Title" | "Idea" | "DeathReason" | "EvidenceAndLimits" | "ReusableParts" | "Outro";
export type SpeechMode = "none" | "fixture" | "edge-tts";

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

export interface UpstreamValidationRecord {
  schemaVersion: "0.1.0";
  repository: "ResistanceYX/idea-tree";
  commit: string;
  validatedAt: string;
  status: "passed";
  commands: string[];
  log: string;
  logSha256: string;
  note: string;
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
  upstreamValidation?: UpstreamValidationRecord;
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

export interface MediaCostRecord {
  schemaVersion: "0.3.0";
  speechMode: SpeechMode;
  speechExternalCalls: number;
  speechRetries: number;
  speechApiFees: {status: "unknown" | "not-run"; amount: null; currency: null; note: string};
  renderCount: number;
  localRebuildCount: number;
  renderDurationMs: number;
  speechDurationMs: number;
  generatedClipCount: number;
  manualAudioReplacements: number;
  manualSubtitleOverrides: number;
  note: string;
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
  media?: MediaCostRecord;
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

export interface NoneSpeechConfig {mode: "none"}
export interface FixtureSpeechConfig {
  mode: "fixture";
  segmentDurationMs: number;
  segmentPauseMs: number;
  scenePauseMs: number;
}
export interface EdgeTtsSpeechConfig {
  mode: "edge-tts";
  voice: string;
  rate: string;
  timeoutMs: number;
  maxRetries: number;
  segmentPauseMs: number;
  scenePauseMs: number;
}
export type SpeechConfig = NoneSpeechConfig | FixtureSpeechConfig | EdgeTtsSpeechConfig;
export interface RenderConfig {concurrency: number; crf: number; scale: number}
export type MediaConfig =
  | {schemaVersion: "0.2.0"; speech: NoneSpeechConfig; render: RenderConfig}
  | {schemaVersion: "0.3.0"; speech: FixtureSpeechConfig | EdgeTtsSpeechConfig; render: RenderConfig};

export interface SpeechClip {
  sceneId: string;
  segmentId: string;
  file: string;
  publicFile: string;
  durationMs: number;
  sha256: string;
  generatedSha256: string;
  manuallyReplaced: boolean;
  spokenText: string;
}

export interface SpeechManifest {
  schemaVersion: "0.3.0";
  mode: FixtureSpeechConfig["mode"] | EdgeTtsSpeechConfig["mode"];
  status: "ready";
  sourceScriptSha256: string;
  terminologySha256: string;
  provider: {name: "local-tone-fixture" | "edge-tts"; version: string; voice: string | null; rate: string | null};
  externalCalls: {
    count: number;
    retries: number;
    apiFees: {status: "unknown" | "not-run"; amount: null; currency: null; note: string};
  };
  segmentPauseMs: number;
  scenePauseMs: number;
  clips: SpeechClip[];
  note: string;
}

export interface SubtitleOverride {
  segmentId: string;
  text?: string;
  offsetMs?: number;
  durationMs?: number;
}

export interface MediaSegmentTiming {
  segmentId: string;
  from: number;
  durationInFrames: number;
  audioFile?: string;
  audioDurationMs?: number;
  manuallyReplaced?: boolean;
  subtitleText?: string;
  subtitleOffsetMs?: number;
  subtitleDurationMs?: number;
}

export interface MediaSceneTiming {
  sceneId: string;
  compositionId: string;
  type: SceneType;
  from: number;
  durationInFrames: number;
  segments: MediaSegmentTiming[];
}

export interface MediaPlan {
  schemaVersion: "0.2.0" | "0.3.0";
  projectId: string;
  fps: 30;
  width: 1280;
  height: 720;
  fullCompositionId: "IdeaTreeFull";
  fullDurationInFrames: number;
  scenes: MediaSceneTiming[];
  sourceScriptSha256: string;
  speech: {
    mode: SpeechMode;
    alignment: "estimated" | "audio-segment";
    clipCount: number;
    manuallyReplacedClips: number;
    subtitleOverrides: number;
  };
}

export interface MaterializeResult {
  project: string;
  plan: MediaPlan;
  config: MediaConfig;
  reviewStatus: ReviewStatus;
  componentFiles: string[];
  overwrittenComponents: boolean;
  subtitles: {vtt: string; srt: string};
  speech: string;
}

export interface RenderReport {
  schemaVersion: "0.2.0" | "0.3.0";
  kind: "still" | "video";
  compositionId: string;
  sceneId: string | null;
  output: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  frame: number | null;
  durationInFrames: number;
  renderedFrameRange: [number, number] | null;
  renderedFrameCount: number;
  fps: number;
  width: number;
  height: number;
  scale: number;
  reviewStatus: ReviewStatus;
  speechMode: SpeechMode;
  externalCalls: {count: 0; apiFees: 0};
  audio: {hasAudio: boolean; clipCount: number; manuallyReplacedClips: number};
  inputSha256: string;
  localDraft: true;
}
