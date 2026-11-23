import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {afterEach, describe, expect, it} from "vitest";
import {generateProject} from "../../src/project.js";
import {materializeProject} from "../../src/media/materialize.js";
import {synthesizeSpeech} from "../../src/media/synthesize.js";
import {probeAudio, writeToneWav} from "../../src/media/audio.js";
import {checkPublishReadiness} from "../../src/media/publish.js";
import {validateJsonSchema} from "../../src/scenes/schema.js";
import type {CostRecord} from "../../src/types.js";
import {clone, expectCode, FIXTURE, FIXED_NOW} from "../helpers.js";

const temporaryDirectories: string[] = [];
async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "0014-m3-media-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

async function setup() {
  const output = await tempDirectory();
  const generated = await generateProject({input: FIXTURE, output, synthetic: true, now: FIXED_NOW});
  await materializeProject({project: output});
  return {output, generated};
}

async function writeConfig(output: string, speech: Record<string, unknown>) {
  const filename = path.join(output, "video", "config.json");
  const config = JSON.parse(await readFile(filename, "utf8")) as Record<string, unknown>;
  config.schemaVersion = "0.3.0";
  config.speech = speech;
  config.render = {concurrency: 1, crf: 28, scale: 0.25};
  await writeFile(filename, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

describe("M3 配音、人工覆盖与发布闸门", () => {
  it("fixture 生成可探测音频，术语只改朗读文本，字幕覆盖与人工替换音频生效", async () => {
    const {output, generated} = await setup();
    await writeConfig(output, {mode: "fixture", segmentDurationMs: 120, segmentPauseMs: 40, scenePauseMs: 60});
    const first = generated.scenes.scenes[0]!.narrationSegments[0]!;
    await writeFile(path.join(output, "speech", "terminology.json"), `${JSON.stringify({schemaVersion: "0.3.0", entries: [{term: "合成", replacement: "测试用合成"}]}, null, 2)}\n`, "utf8");
    await writeFile(path.join(output, "speech", "subtitle-overrides.json"), `${JSON.stringify({schemaVersion: "0.3.0", entries: [{segmentId: first.segmentId, text: "人工修改后的字幕", offsetMs: 40, durationMs: 100}]}, null, 2)}\n`, "utf8");
    const result = await synthesizeSpeech({project: output});
    expect(result.externalCalls).toBe(0);
    expect(result.manifest.clips).toHaveLength(22);
    expect(result.manifest.clips.some((clip) => clip.spokenText.includes("测试用合成"))).toBe(true);
    expect(result.manifest.clips.find((clip) => clip.segmentId === first.segmentId)?.spokenText).not.toBe(first.text);
    expect(generated.scenes.scenes[0]!.narrationSegments[0]!.text).toBe(first.text);
    expect(result.materialized.plan.speech).toMatchObject({mode: "fixture", clipCount: 22, subtitleOverrides: 1});
    expect(result.materialized.plan.fullDurationInFrames).not.toBe(7590);
    expect(await readFile(result.materialized.subtitles.vtt, "utf8")).toContain("人工修改后的字幕");
    const firstClip = result.manifest.clips.find((clip) => clip.segmentId === first.segmentId)!;
    expect((await probeAudio(path.join(output, firstClip.file))).durationMs).toBe(120);
    expect((await readFile(path.join(output, "video", "public", firstClip.publicFile))).equals(await readFile(path.join(output, firstClip.file)))).toBe(true);
    const cost = JSON.parse(await readFile(path.join(output, "cost.json"), "utf8")) as CostRecord;
    expect(cost.media).toMatchObject({speechMode: "fixture", speechExternalCalls: 0, generatedClipCount: 22, manualSubtitleOverrides: 1});
    expect(() => validateJsonSchema<CostRecord>("cost-schema.json", cost, "E_SCENE_SEMANTICS")).not.toThrow();
    const disclosure = JSON.parse(await readFile(path.join(output, "publish", "ai-disclosure.json"), "utf8"));
    expect(disclosure).toMatchObject({aiGenerated: true, automaticPublication: false, speechMode: "fixture"});
    expect((await checkPublishReadiness(output)).ready).toBe(false);

    const manualFile = path.join(output, firstClip.file);
    await writeToneWav(manualFile, 160, 99);
    const manualHash = createHash("sha256").update(await readFile(manualFile)).digest("hex");
    const rematerialized = await materializeProject({project: output});
    expect(rematerialized.plan.speech.manuallyReplacedClips).toBe(1);
    expect(rematerialized.plan.scenes[0]!.segments.find((segment) => segment.segmentId === first.segmentId)).toMatchObject({audioDurationMs: 160, manuallyReplaced: true});
    const reused = await synthesizeSpeech({project: output});
    const reusedClip = reused.manifest.clips.find((clip) => clip.segmentId === first.segmentId)!;
    expect(reusedClip.sha256).toBe(manualHash);
    expect(reusedClip.manuallyReplaced).toBe(true);
  });

  it("音频清单过期时停止，重跑 speech 后复用未变片段", async () => {
    const {output, generated} = await setup();
    await writeConfig(output, {mode: "fixture", segmentDurationMs: 80, segmentPauseMs: 0, scenePauseMs: 0});
    const first = await synthesizeSpeech({project: output});
    const scenes = clone(generated.scenes);
    scenes.scenes[0]!.durationSeconds += 1;
    await writeFile(generated.paths.scenes, `${JSON.stringify(scenes, null, 2)}\n`, "utf8");
    await expectCode(() => materializeProject({project: output, refreshDerived: true}), "E_DERIVED_STALE");
    const second = await synthesizeSpeech({project: output, refreshDerived: true});
    expect(second.manifest.sourceScriptSha256).not.toBe(first.manifest.sourceScriptSha256);
    expect(second.manifest.clips.map((clip) => clip.sha256)).toEqual(first.manifest.clips.map((clip) => clip.sha256));
  });

  it("真实服务必须先过人工审校闸门；物化不会隐式联网或伪造音频", async () => {
    const {output} = await setup();
    await writeConfig(output, {mode: "edge-tts", voice: "zh-CN-XiaoxiaoNeural", rate: "+0%", timeoutMs: 5000, maxRetries: 0, segmentPauseMs: 0, scenePauseMs: 0});
    await expectCode(() => materializeProject({project: output}), "E_AUDIO");
    await expectCode(() => synthesizeSpeech({project: output}), "E_REVIEW_REQUIRED");
    const cost = JSON.parse(await readFile(path.join(output, "cost.json"), "utf8")) as CostRecord;
    expect(cost.media).toBeUndefined();
    const checklist = path.join(output, "review", "publish-checklist.md");
    await writeFile(checklist, (await readFile(checklist, "utf8")).replaceAll("- [ ]", "- [x]"), "utf8");
    const status = await checkPublishReadiness(output);
    expect(status.checks.find((check) => check.id === "human-checklist")?.passed).toBe(true);
    expect(status.checks.find((check) => check.id === "script-approved")?.passed).toBe(false);
    expect(status.ready).toBe(false);
  });
});
