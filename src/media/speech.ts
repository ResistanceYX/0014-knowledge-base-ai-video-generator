import {AppError} from "../errors.js";
import type {MediaPlan, SceneDocument} from "../types.js";

export interface SpeechRequest {
  document: SceneDocument;
  plan: MediaPlan;
}

export interface NoneSpeechResult {
  schemaVersion: "0.2.0";
  mode: "none";
  status: "disabled";
  clips: [];
  externalCalls: {count: 0; apiFees: 0};
  note: string;
}

export interface SpeechAdapter {
  readonly mode: "none";
  synthesize(request: SpeechRequest): Promise<NoneSpeechResult>;
}

export class NoneSpeechAdapter implements SpeechAdapter {
  readonly mode = "none" as const;

  async synthesize(request: SpeechRequest): Promise<NoneSpeechResult> {
    return {
      schemaVersion: "0.2.0",
      mode: "none",
      status: "disabled",
      clips: [],
      externalCalls: {count: 0, apiFees: 0},
      note: `M2 不生成配音；${request.plan.scenes.length} 个场景可无声预览。字幕仅按字符数分配时间，不代表音画同步。`,
    };
  }
}

export function getSpeechAdapter(mode: string): SpeechAdapter {
  if (mode === "none") return new NoneSpeechAdapter();
  throw new AppError("E_SPEECH_MODE", `M2 仅支持 SpeechAdapter 的 none 模式，收到：${mode}`);
}
