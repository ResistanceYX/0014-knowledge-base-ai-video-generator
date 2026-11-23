import {AppError} from "../errors.js";
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
      const baseFrom = sceneTiming.from + segmentTiming.from;
      const baseDuration = segmentTiming.durationInFrames;
      const offsetFrames = Math.round((segmentTiming.subtitleOffsetMs ?? 0) * plan.fps / 1000);
      const durationFrames = segmentTiming.subtitleDurationMs === undefined
        ? baseDuration
        : Math.max(1, Math.round(segmentTiming.subtitleDurationMs * plan.fps / 1000));
      const sceneEnd = sceneTiming.from + sceneTiming.durationInFrames;
      const rawFrom = baseFrom + offsetFrames;
      const rawTo = rawFrom + durationFrames;
      if (rawFrom >= sceneEnd || rawTo <= sceneTiming.from) throw new AppError("E_MEDIA_CONFIG", `字幕覆盖使片段完全移出场景：${segment.segmentId}`, segment.segmentId);
      const from = Math.max(sceneTiming.from, rawFrom);
      const to = Math.min(sceneEnd, rawTo);
      if (to <= from) throw new AppError("E_MEDIA_CONFIG", `字幕覆盖后的时长无效：${segment.segmentId}`, segment.segmentId);
      cues.push({
        index: cues.length + 1,
        from,
        to,
        text: cueText(segmentTiming.subtitleText ?? segment.text),
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
  const note = plan.speech.alignment === "audio-segment"
    ? "M3 字幕：按真实音频片段对齐；人工覆盖已应用；不承诺词级对齐或唇形同步。"
    : "M2 字幕草稿；按字符数分配时长，未做真实配音或音画同步。";
  return `WEBVTT\n\nNOTE ${note}\n\n${body}\n`;
}

export function renderSrt(document: SceneDocument, plan: MediaPlan): string {
  return `${buildSubtitleCues(document, plan).map((cue) => [
    String(cue.index),
    `${timestamp(cue.from, plan.fps, ",")} --> ${timestamp(cue.to, plan.fps, ",")}`,
    cue.text,
  ].join("\n")).join("\n\n")}\n`;
}
