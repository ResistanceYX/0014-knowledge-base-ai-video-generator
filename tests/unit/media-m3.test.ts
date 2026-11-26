import {describe, expect, it} from "vitest";
import {buildMediaPlan, scriptRevision} from "../../src/media/timeline.js";
import {renderVtt} from "../../src/media/subtitles.js";
import {parseMediaConfig} from "../../src/media/config.js";
import {buildVideoMetadata} from "../../src/media/publish.js";
import {mediaSourceEntries} from "../../video-template/media.js";
import type {SpeechManifest} from "../../src/types.js";
import {clone, expectCode, makeBundle} from "../helpers.js";

async function audioFixture() {
  const bundle = await makeBundle();
  const revision = scriptRevision(JSON.stringify(bundle.scenes), JSON.stringify(bundle.sourceMap));
  const clips = bundle.scenes.scenes.flatMap((scene) => scene.narrationSegments.map((segment, index) => ({
    sceneId: scene.sceneId,
    segmentId: segment.segmentId,
    file: `audio/clips/${scene.sceneId}/${segment.segmentId}.wav`,
    publicFile: `audio/clips/${scene.sceneId}/${segment.segmentId}.wav`,
    durationMs: 1000 + index * 100,
    sha256: "current",
    generatedSha256: "current",
    manuallyReplaced: false,
    spokenText: segment.text,
  })));
  const manifest: SpeechManifest = {
    schemaVersion: "0.3.0",
    mode: "fixture",
    status: "ready",
    sourceScriptSha256: revision,
    terminologySha256: "terms",
    provider: {name: "local-tone-fixture", version: "0.3.0", voice: null, rate: null},
    externalCalls: {count: 0, retries: 0, apiFees: {status: "not-run", amount: null, currency: null, note: "fixture"}},
    segmentPauseMs: 500,
    scenePauseMs: 1000,
    clips,
    note: "unit fixture",
  };
  return {bundle, revision, manifest};
}

describe("M3 真实音频时间轴与发布元数据", () => {
  it("以每段音频真实毫秒数、段间停顿和场景停顿计算帧数", async () => {
    const {bundle, revision, manifest} = await audioFixture();
    const firstSegment = bundle.scenes.scenes[0]!.narrationSegments[0]!;
    const plan = buildMediaPlan(bundle.scenes, revision, {
      manifest,
      overrides: [{segmentId: firstSegment.segmentId, text: "人工字幕", offsetMs: 100, durationMs: 500}],
    });
    expect(plan.schemaVersion).toBe("0.3.0");
    expect(plan.speech).toMatchObject({mode: "fixture", alignment: "audio-segment", clipCount: 22, subtitleOverrides: 1});
    const expected = bundle.scenes.scenes.reduce((total, scene) => {
      const clips = scene.narrationSegments.map((segment) => manifest.clips.find((clip) => clip.segmentId === segment.segmentId)!);
      const audioFrames = clips.reduce((sum, clip) => sum + Math.ceil(clip.durationMs * 30 / 1000), 0);
      return total + audioFrames + (clips.length - 1) * 15 + 30;
    }, 0);
    expect(plan.fullDurationInFrames).toBe(expected);
    for (const scene of plan.scenes) {
      const last = scene.segments.at(-1)!;
      expect(last.from + last.durationInFrames + 30).toBe(scene.durationInFrames);
      expect(scene.segments.every((segment) => segment.audioFile && segment.audioDurationMs)).toBe(true);
    }
    expect(plan.scenes[0]!.segments[0]).toMatchObject({subtitleText: "人工字幕", subtitleOffsetMs: 100, subtitleDurationMs: 500});
    const vtt = renderVtt(bundle.scenes, plan);
    expect(vtt).toContain("人工字幕");
    expect(vtt).toContain("00:00:00.100 --> 00:00:00.600");
    expect(vtt).toContain("不承诺词级对齐或唇形同步");
  });

  it("拒绝孤立字幕覆盖和与脚本不一致的音频清单", async () => {
    const {bundle, revision, manifest} = await audioFixture();
    await expectCode(() => Promise.resolve(buildMediaPlan(bundle.scenes, revision, {manifest, overrides: [{segmentId: "missing", text: "x"}]})), "E_AUDIO");
    const incomplete = {...manifest, clips: manifest.clips.slice(1)};
    await expectCode(() => Promise.resolve(buildMediaPlan(bundle.scenes, revision, {manifest: incomplete, overrides: []})), "E_AUDIO");
  });

  it("全占位场景不进媒体计划，旧片段清单与孤立覆盖会停止", async () => {
    const {bundle, revision, manifest} = await audioFixture();
    const scenes = clone(bundle.scenes);
    const target = scenes.scenes[1]!;
    target.narrationSegments.forEach((segment) => {
      segment.kind = "placeholder";
    });

    const silent = buildMediaPlan(scenes, revision);
    expect(silent.scenes.some((scene) => scene.sceneId === target.sceneId)).toBe(false);
    expect(silent.scenes).toHaveLength(bundle.scenes.scenes.length - 1);
    expect(silent.fullDurationInFrames).toBeGreaterThan(0);
    const vtt = renderVtt(scenes, silent);
    target.narrationSegments.forEach((segment) => expect(vtt).not.toContain(segment.text));

    const reducedManifest = {
      ...manifest,
      clips: manifest.clips.filter((clip) => clip.sceneId !== target.sceneId),
    };
    const audioPlan = buildMediaPlan(scenes, revision, {manifest: reducedManifest, overrides: []});
    expect(audioPlan.scenes.some((scene) => scene.sceneId === target.sceneId)).toBe(false);
    expect(audioPlan.speech.clipCount).toBe(manifest.clips.length - target.narrationSegments.length);
    await expectCode(() => Promise.resolve(buildMediaPlan(scenes, revision, {manifest, overrides: []})), "E_AUDIO");
    await expectCode(() => Promise.resolve(buildMediaPlan(scenes, revision, {
      manifest: reducedManifest,
      overrides: [{segmentId: target.narrationSegments[0]!.segmentId, text: "不应出现的占位字幕"}],
    })), "E_AUDIO");
  });

  it("画面来源摘要只接收实际可播放片段", async () => {
    const {bundle, revision, manifest} = await audioFixture();
    const scenes = clone(bundle.scenes);
    const targetScene = scenes.scenes.find((scene) => scene.sceneId === "scene-death-01")!;
    const target = targetScene.narrationSegments[0]!;
    target.kind = "placeholder";
    const reducedManifest = {...manifest, clips: manifest.clips.filter((clip) => clip.segmentId !== target.segmentId)};
    const plan = buildMediaPlan(scenes, revision, {manifest: reducedManifest, overrides: []});
    const timing = plan.scenes.find((scene) => scene.sceneId === targetScene.sceneId)!;
    const entries = mediaSourceEntries(bundle.sourceMap.entries, targetScene.sceneId, timing);
    expect(entries).toHaveLength(targetScene.narrationSegments.length - 1);
    expect(entries.some((entry) => entry.segmentId === target.segmentId)).toBe(false);
    expect(new Set(entries.map((entry) => entry.segmentId))).toEqual(new Set(timing.segments.map((segment) => segment.segmentId)));
  });

  it("配置只开放 fixture 与一种真实服务，并限制声音、语速和重试", async () => {
    const fixture = parseMediaConfig({schemaVersion: "0.3.0", speech: {mode: "fixture", segmentDurationMs: 100, segmentPauseMs: 20, scenePauseMs: 40}, render: {concurrency: 1, crf: 25, scale: 0.5}});
    expect(fixture.speech.mode).toBe("fixture");
    const edge = parseMediaConfig({schemaVersion: "0.3.0", speech: {mode: "edge-tts", voice: "zh-CN-XiaoxiaoNeural", rate: "+10%", timeoutMs: 30000, maxRetries: 1, segmentPauseMs: 100, scenePauseMs: 200}, render: {concurrency: 1, crf: 25, scale: 1}});
    expect(edge.speech.mode).toBe("edge-tts");
    await expectCode(() => Promise.resolve(parseMediaConfig({schemaVersion: "0.3.0", speech: {mode: "edge-tts", voice: "bad voice", rate: "+0%", timeoutMs: 30000, maxRetries: 1, segmentPauseMs: 0, scenePauseMs: 0}, render: {concurrency: 1, crf: 25, scale: 1}})), "E_MEDIA_CONFIG");
    await expectCode(() => Promise.resolve(parseMediaConfig({schemaVersion: "0.3.0", speech: {mode: "edge-tts", voice: "zh-CN-XiaoxiaoNeural", rate: "+51%", timeoutMs: 30000, maxRetries: 1, segmentPauseMs: 0, scenePauseMs: 0}, render: {concurrency: 1, crf: 25, scale: 1}})), "E_MEDIA_CONFIG");
    await expectCode(() => Promise.resolve(parseMediaConfig({schemaVersion: "0.3.0", speech: {mode: "another-service"}, render: {concurrency: 1, crf: 25, scale: 1}})), "E_SPEECH_MODE");
  });

  it("AI 标识、来源快照和禁止自动发布同时进入 MP4 元数据", async () => {
    const {bundle, revision, manifest} = await audioFixture();
    const plan = buildMediaPlan(bundle.scenes, revision, {manifest, overrides: []});
    const metadata = buildVideoMetadata(bundle.scenes, plan);
    expect(metadata.ai_generated).toBe("true");
    expect(metadata.automatic_publication).toBe("false");
    expect(metadata.title).toContain("AI 本地候选草稿");
    expect(metadata.comment).toContain("Speech=fixture");
    expect(metadata.description).toContain(bundle.scenes.sourceSnapshot.fileSha256);
  });
});
