import type {MediaPlan, SceneDocument} from "../types.js";

function timestamp(frame: number, fps: number, separator: "." | ","): string {
  const totalMilliseconds = Math.floor((frame * 1000) / fps);
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(milliseconds).padStart(3, "0")}`;
}

function cueText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .trim();
}

interface Cue {index: number; from: number; to: number; text: string}

export function buildSubtitleCues(document: SceneDocument, plan: MediaPlan): Cue[] {
  const cues: Cue[] = [];
  for (const sceneTiming of plan.scenes) {
    const scene = document.scenes.find((item) => item.sceneId === sceneTiming.sceneId);
    if (!scene) continue;
    for (const segmentTiming of sceneTiming.segments) {
      const segment = scene.narrationSegments.find((item) => item.segmentId === segmentTiming.segmentId);
      if (!segment) continue;
      cues.push({
        index: cues.length + 1,
        from: sceneTiming.from + segmentTiming.from,
        to: sceneTiming.from + segmentTiming.from + segmentTiming.durationInFrames,
        text: cueText(segment.text),
      });
    }
  }
  return cues;
}

export function renderVtt(document: SceneDocument, plan: MediaPlan): string {
  const cues = buildSubtitleCues(document, plan);
  const body = cues.map((cue) => [
    `${timestamp(cue.from, plan.fps, ".")} --> ${timestamp(cue.to, plan.fps, ".")}`,
    cue.text,
  ].join("\n")).join("\n\n");
  return `WEBVTT\n\nNOTE M2 字幕草稿；按字符数分配时长，未做真实配音或音画同步。\n\n${body}\n`;
}

export function renderSrt(document: SceneDocument, plan: MediaPlan): string {
  return `${buildSubtitleCues(document, plan).map((cue) => [
    String(cue.index),
    `${timestamp(cue.from, plan.fps, ",")} --> ${timestamp(cue.to, plan.fps, ",")}`,
    cue.text,
  ].join("\n")).join("\n\n")}\n`;
}
