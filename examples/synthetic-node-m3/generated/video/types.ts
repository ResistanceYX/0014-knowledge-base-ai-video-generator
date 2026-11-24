export type ReviewStatus = "unreviewed" | "approved" | "changes-requested";
export type SceneType = "Title" | "Idea" | "DeathReason" | "EvidenceAndLimits" | "ReusableParts" | "Outro";

export interface NarrationSegment {segmentId: string; text: string; kind: "factual" | "transition" | "editorial" | "placeholder"}
export interface Scene {
  sceneId: string;
  order: number;
  type: SceneType;
  durationSeconds: number;
  narrationSegments: NarrationSegment[];
  visual: {heading: string; bodyLines: string[]; accentColor: string};
}
export interface SceneDocument {
  projectId: string;
  node: {number: string; id: string; title: string; archiveType: "预审" | "验尸"; revivalStatus: "死透" | "复活候选" | "已复活"; conclusionBoundary: string | null};
  video: {fps: 30; width: 1280; height: 720};
  sourceSnapshot: {license: {spdxId: string}; normalizedUrl: string | null; fileSha256: string; commit: string | null};
  scenes: Scene[];
  scriptReview: {status: ReviewStatus; reviewer: string | null; reviewedAt: string | null};
}
export interface SourceMapEntry {
  segmentId: string;
  sceneId: string;
  supportStatus: "supported" | "partially-supported" | "needs-evidence" | "not-applicable";
  sources: {kind: "node-field"; jsonPointer: string; excerpt: string; fieldRole: string}[];
  qualifiers: string[];
  openQuestion: string | null;
}
export interface SourceMapDocument {entries: SourceMapEntry[]}
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
  fps: 30;
  fullDurationInFrames: number;
  scenes: MediaSceneTiming[];
  speech: {mode: "none" | "fixture" | "edge-tts"; alignment: "estimated" | "audio-segment"};
}
export interface SceneProps {scene: Scene; entries: SourceMapEntry[]; timing: MediaSceneTiming}
