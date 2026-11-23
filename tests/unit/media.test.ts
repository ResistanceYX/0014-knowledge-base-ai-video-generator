import {describe, expect, it} from "vitest";
import {buildMediaPlan, scriptRevision} from "../../src/media/timeline.js";
import {renderSrt, renderVtt} from "../../src/media/subtitles.js";
import {NoneSpeechAdapter, getSpeechAdapter} from "../../src/media/speech.js";
import {parseMediaConfig} from "../../src/media/config.js";
import {renderArtifact} from "../../src/media/render.js";
import {clone, expectCode, makeBundle} from "../helpers.js";

describe("M2 时间轴、字幕与 none 配音", () => {
  it("所有场景和逐句字幕连续、非零且覆盖完整时间轴", async () => {
    const bundle = await makeBundle();
    const plan = buildMediaPlan(bundle.scenes, scriptRevision(JSON.stringify(bundle.scenes), JSON.stringify(bundle.sourceMap)));
    expect(plan.scenes).toHaveLength(8);
    expect(plan.fullCompositionId).toBe("IdeaTreeFull");
    expect(plan.fullDurationInFrames).toBe(7590);
    expect(plan.scenes.map((scene) => scene.compositionId)).toContain("Scene-scene-title");
    let sceneEnd = 0;
    for (const scene of plan.scenes) {
      expect(scene.from).toBe(sceneEnd);
      let segmentEnd = 0;
      for (const segment of scene.segments) {
        expect(segment.from).toBe(segmentEnd);
        expect(segment.durationInFrames).toBeGreaterThan(0);
        segmentEnd += segment.durationInFrames;
      }
      expect(segmentEnd).toBe(scene.durationInFrames);
      sceneEnd += scene.durationInFrames;
    }
    expect(sceneEnd).toBe(plan.fullDurationInFrames);
    const vtt = renderVtt(bundle.scenes, plan);
    const srt = renderSrt(bundle.scenes, plan);
    expect(vtt.startsWith("WEBVTT\n")).toBe(true);
    expect(vtt).toContain("字幕草稿");
    expect((vtt.match(/-->/g) ?? [])).toHaveLength(22);
    expect((srt.match(/-->/g) ?? [])).toHaveLength(22);
    expect(srt).toContain("00:00:00,000 -->");
  });

  it("字幕按纯文本转义，不把节点内容解释为标记", async () => {
    const bundle = await makeBundle();
    const scenes = clone(bundle.scenes);
    scenes.scenes[0]!.narrationSegments[0]!.text = "<b>合成&文本</b>";
    const plan = buildMediaPlan(scenes, scriptRevision(JSON.stringify(scenes), JSON.stringify(bundle.sourceMap)));
    const vtt = renderVtt(scenes, plan);
    expect(vtt).toContain("&lt;b&gt;合成&amp;文本&lt;/b&gt;");
    expect(vtt).not.toContain("\n<b>");
  });

  it("none 适配器无音频、无网络、无外部费用", async () => {
    const bundle = await makeBundle();
    const plan = buildMediaPlan(bundle.scenes, scriptRevision(JSON.stringify(bundle.scenes), JSON.stringify(bundle.sourceMap)));
    const adapter = getSpeechAdapter("none");
    expect(adapter).toBeInstanceOf(NoneSpeechAdapter);
    const result = await adapter.synthesize({document: bundle.scenes, plan});
    expect(result.status).toBe("disabled");
    expect(result.clips).toEqual([]);
    expect(result.externalCalls).toEqual({count: 0, apiFees: 0});
    await expectCode(() => Promise.resolve(getSpeechAdapter("paid")), "E_SPEECH_MODE");
  });

  it("媒体配置只开放已实现的 none 模式与安全渲染范围", async () => {
    expect(parseMediaConfig({schemaVersion: "0.2.0", speech: {mode: "none"}, render: {concurrency: 2, crf: 23, scale: 0.25}}).render.scale).toBe(0.25);
    await expectCode(() => Promise.resolve(parseMediaConfig({schemaVersion: "0.2.0", speech: {mode: "tts"}, render: {concurrency: 2, crf: 23, scale: 1}})), "E_SPEECH_MODE");
    await expectCode(() => Promise.resolve(parseMediaConfig({schemaVersion: "0.2.0", speech: {mode: "none"}, render: {concurrency: 2, crf: 23, scale: 0.3}})), "E_MEDIA_CONFIG");
    await expectCode(() => Promise.resolve(parseMediaConfig({schemaVersion: "0.2.0", speech: {mode: "none"}, render: {concurrency: 99, crf: 23, scale: 1}})), "E_MEDIA_CONFIG");
  });

  it("静帧与视频 API 拒绝混用帧参数", async () => {
    await expectCode(() => renderArtifact({project: "/not-read", kind: "still", frameRange: [0, 1]}), "E_RENDER");
    await expectCode(() => renderArtifact({project: "/not-read", kind: "video", frame: 0}), "E_RENDER");
  });
});
