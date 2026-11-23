import path from "node:path";
import {readFile, writeFile} from "node:fs/promises";
import type {CostRecord, MediaCostRecord, SpeechMode} from "../types.js";

export async function updateMediaCost(options: {
  project: string;
  speechMode: SpeechMode;
  generatedClipCount?: number;
  manualAudioReplacements?: number;
  manualSubtitleOverrides?: number;
  speechCalls?: number;
  speechRetries?: number;
  speechDurationMs?: number;
  renderDurationMs?: number;
  localRebuild?: boolean;
}): Promise<MediaCostRecord> {
  const filename = path.join(path.resolve(options.project), "cost.json");
  const cost = JSON.parse(await readFile(filename, "utf8")) as CostRecord;
  const previous: MediaCostRecord = cost.media ?? {
    schemaVersion: "0.3.0",
    speechMode: options.speechMode,
    speechExternalCalls: 0,
    speechRetries: 0,
    speechApiFees: {status: "not-run", amount: null, currency: null, note: "尚未调用真实配音服务。"},
    renderCount: 0,
    localRebuildCount: 0,
    renderDurationMs: 0,
    speechDurationMs: 0,
    generatedClipCount: 0,
    manualAudioReplacements: 0,
    manualSubtitleOverrides: 0,
    note: "M3 媒体成本记录。",
  };
  const speechCalls = options.speechCalls ?? 0;
  const realSpeech = options.speechMode === "edge-tts";
  const media: MediaCostRecord = {
    ...previous,
    speechMode: options.speechMode,
    speechExternalCalls: previous.speechExternalCalls + speechCalls,
    speechRetries: previous.speechRetries + (options.speechRetries ?? 0),
    speechApiFees: realSpeech
      ? {status: "unknown", amount: null, currency: null, note: "Edge TTS 无 API Key 不等于已确认免费；未查询正式价格、服务条款或账单，费用记为 unknown，不写成 0。"}
      : previous.speechApiFees,
    renderCount: previous.renderCount + (options.renderDurationMs === undefined ? 0 : 1),
    localRebuildCount: previous.localRebuildCount + (options.localRebuild ? 1 : 0),
    renderDurationMs: previous.renderDurationMs + Math.round(options.renderDurationMs ?? 0),
    speechDurationMs: previous.speechDurationMs + Math.round(options.speechDurationMs ?? 0),
    generatedClipCount: options.generatedClipCount ?? previous.generatedClipCount,
    manualAudioReplacements: options.manualAudioReplacements ?? previous.manualAudioReplacements,
    manualSubtitleOverrides: options.manualSubtitleOverrides ?? previous.manualSubtitleOverrides,
    note: "script 顶层 externalCalls 仅指 M1 离线脚本；media 分别累计配音调用、重试和渲染耗时。人工修改轮次沿用 manualRevisionRounds，不由工具虚构。",
  };
  cost.media = media;
  const addedDuration = Math.round((options.speechDurationMs ?? 0) + (options.renderDurationMs ?? 0));
  cost.localCompute = {
    ...cost.localCompute,
    durationMs: cost.localCompute.durationMs + addedDuration,
    note: "累计本地脚本、配音处理与渲染耗时；机器时间、电力、存储与人工审校仍有成本，不折算为货币金额。",
  };
  await writeFile(filename, `${JSON.stringify(cost, null, 2)}\n`, "utf8");
  return media;
}
