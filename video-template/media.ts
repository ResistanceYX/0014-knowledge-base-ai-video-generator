import type {MediaSceneTiming, SourceMapEntry} from "./types.js";

export function mediaSourceEntries(
  entries: SourceMapEntry[],
  sceneId: string,
  timing: MediaSceneTiming,
): SourceMapEntry[] {
  const playableSegmentIds = new Set(timing.segments.map((segment) => segment.segmentId));
  return entries.filter((entry) => entry.sceneId === sceneId && playableSegmentIds.has(entry.segmentId));
}
