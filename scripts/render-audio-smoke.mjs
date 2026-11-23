import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {getVideoMetadata} from "@remotion/renderer";
import {generateProject, materializeProject, renderArtifact, synthesizeSpeech} from "../dist/index.js";

const execFileAsync = promisify(execFile);
const fixture = fileURLToPath(new URL("../examples/synthetic-node/source.yaml", import.meta.url));
const output = await mkdtemp(path.join(tmpdir(), "0014-m3-audio-smoke-"));

async function checkAudioVideo(filename, expectedSeconds) {
  const metadata = await getVideoMetadata(filename);
  assert.equal(metadata.codec, "h264");
  assert.notEqual(metadata.audioCodec, null, "M3 fixture 必须输出真实音轨");
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 180);
  assert.equal(metadata.fps, 30);
  assert.ok(metadata.durationInSeconds !== null && Math.abs(metadata.durationInSeconds - expectedSeconds) < 0.12);
  const {stdout} = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format_tags", "-of", "json", filename]);
  const tags = JSON.parse(stdout).format?.tags ?? {};
  assert.match(tags.title ?? "", /AI/);
  assert.match(tags.comment ?? "", /AI-generated local draft/);
  return {durationInSeconds: metadata.durationInSeconds, codec: metadata.codec, audioCodec: metadata.audioCodec, tags};
}

try {
  await generateProject({input: fixture, output, synthetic: true, now: new Date("2026-11-20T00:00:00.000Z")});
  await materializeProject({project: output});
  const configPath = path.join(output, "video", "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.schemaVersion = "0.3.0";
  config.speech = {mode: "fixture", segmentDurationMs: 160, segmentPauseMs: 80, scenePauseMs: 100};
  config.render = {concurrency: 2, crf: 28, scale: 0.25};
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const synthesized = await synthesizeSpeech({project: output});
  assert.equal(synthesized.externalCalls, 0);
  assert.equal(synthesized.manifest.clips.length, 22);
  const expectedSeconds = synthesized.materialized.plan.fullDurationInFrames / 30;
  assert.ok(expectedSeconds > 3 && expectedSeconds < 12);

  console.log(`M3 smoke：渲染 ${synthesized.materialized.plan.fullDurationInFrames} 帧真实音轨全片（本地音调，非语音）……`);
  const full = await renderArtifact({project: output, kind: "video"});
  assert.equal(full.speechMode, "fixture");
  assert.deepEqual(full.audio, {hasAudio: true, clipCount: 22, manuallyReplacedClips: 0});
  const declaredMetadata = JSON.parse(await readFile(path.join(output, "media", "metadata.json"), "utf8"));
  assert.equal(declaredMetadata.values.ai_generated, "true");
  assert.equal(declaredMetadata.values.automatic_publication, "false");
  const fullMetadata = await checkAudioVideo(full.output, expectedSeconds);

  const titleTiming = synthesized.materialized.plan.scenes.find((scene) => scene.sceneId === "scene-title");
  assert.ok(titleTiming);
  const lastFrame = Math.min(29, titleTiming.durationInFrames - 1);
  console.log("M3 smoke：只重建 Title 的短区间，验证单场景音频与局部成本……");
  const partial = await renderArtifact({project: output, kind: "video", sceneId: "scene-title", frameRange: [0, lastFrame]});
  assert.equal(partial.sceneId, "scene-title");
  assert.equal(partial.audio.hasAudio, true);
  await checkAudioVideo(partial.output, (lastFrame + 1) / 30);
  const cost = JSON.parse(await readFile(path.join(output, "cost.json"), "utf8"));
  assert.equal(cost.media.renderCount, 2);
  assert.equal(cost.media.localRebuildCount, 1);
  assert.equal(cost.media.speechExternalCalls, 0);

  console.log(JSON.stringify({
    status: "passed",
    speechMode: "fixture",
    speechExternalCalls: 0,
    clips: 22,
    fullFrames: full.durationInFrames,
    fullSeconds: expectedSeconds,
    partialFrames: partial.renderedFrameCount,
    renderCount: cost.media.renderCount,
    localRebuildCount: cost.media.localRebuildCount,
    video: fullMetadata,
  }, null, 2));
} finally {
  await rm(output, {recursive: true, force: true});
}
