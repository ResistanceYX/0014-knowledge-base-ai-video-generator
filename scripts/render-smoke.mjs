import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {getVideoMetadata} from "@remotion/renderer";
import {generateProject, materializeProject, renderArtifact} from "../dist/index.js";

const fixture = fileURLToPath(new URL("../examples/synthetic-node/source.yaml", import.meta.url));
const output = await mkdtemp(path.join(tmpdir(), "0014-m2-render-smoke-"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const metadataChecks = [];

async function checkVideo(filename, expectedSeconds) {
  const metadata = await getVideoMetadata(filename);
  assert.equal(metadata.codec, "h264");
  assert.equal(metadata.audioCodec, null, "M2 none 模式不得伪造音轨");
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 180);
  assert.equal(metadata.fps, 30);
  assert.ok(metadata.durationInSeconds !== null && Math.abs(metadata.durationInSeconds - expectedSeconds) < 0.05);
  metadataChecks.push({file: path.basename(filename), durationInSeconds: metadata.durationInSeconds, codec: metadata.codec, audioCodec: metadata.audioCodec});
}

try {
  await generateProject({input: fixture, output, synthetic: true, now: new Date("2026-11-20T00:00:00.000Z")});
  const scenesPath = path.join(output, "script", "scenes.json");
  const scenes = JSON.parse(await readFile(scenesPath, "utf8"));
  for (const scene of scenes.scenes) scene.durationSeconds = 3;
  await writeFile(scenesPath, `${JSON.stringify(scenes, null, 2)}\n`, "utf8");
  await materializeProject({project: output, refreshDerived: true});
  const configPath = path.join(output, "video", "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.render = {concurrency: 2, crf: 28, scale: 0.25};
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  console.log("M2 smoke：渲染 Title 与 EvidenceAndLimits 各 30 帧……");
  const title = await renderArtifact({project: output, kind: "video", sceneId: "scene-title", frameRange: [0, 29]});
  const evidence = await renderArtifact({project: output, kind: "video", sceneId: "scene-evidence-limits", frameRange: [0, 29]});
  assert.equal(title.renderedFrameCount, 30);
  assert.equal(evidence.renderedFrameCount, 30);
  await checkVideo(title.output, 1);
  await checkVideo(evidence.output, 1);

  console.log("M2 smoke：渲染 8 场景、720 帧完整短拼接……");
  const full = await renderArtifact({project: output, kind: "video"});
  assert.equal(full.durationInFrames, 720);
  assert.equal(full.renderedFrameCount, 720);
  await checkVideo(full.output, 24);
  const fullHashBefore = hash(await readFile(full.output));
  const unrelatedComponent = path.join(output, "video", "components", "Title.tsx");
  const unrelatedHashBefore = hash(await readFile(unrelatedComponent));

  console.log("M2 smoke：修改 Outro 旁白与实际组件，只重建 Outro……");
  const editedScenes = JSON.parse(await readFile(scenesPath, "utf8"));
  const outro = editedScenes.scenes.find((scene) => scene.sceneId === "scene-outro");
  outro.narrationSegments[0].text = `CI 局部重建标记。${outro.narrationSegments[0].text}`;
  await writeFile(scenesPath, `${JSON.stringify(editedScenes, null, 2)}\n`, "utf8");
  const outroComponent = path.join(output, "video", "components", "Outro.tsx");
  const originalComponent = await readFile(outroComponent, "utf8");
  assert.ok(originalComponent.includes('kicker="PROVENANCE / 来源与纠错"'));
  await writeFile(outroComponent, originalComponent.replace('kicker="PROVENANCE / 来源与纠错"', 'kicker="CI LOCAL REBUILD / 局部重建"'), "utf8");
  const rebuilt = await renderArtifact({project: output, kind: "video", sceneId: "scene-outro", frameRange: [0, 29], refreshDerived: true});
  await checkVideo(rebuilt.output, 1);
  assert.equal(rebuilt.sceneId, "scene-outro");
  assert.equal(hash(await readFile(full.output)), fullHashBefore, "局部重建不得改写旧完整成片");
  assert.equal(hash(await readFile(unrelatedComponent)), unrelatedHashBefore, "局部重建不得覆盖其他组件");
  assert.match(await readFile(path.join(output, "media", "subtitles", "draft.vtt"), "utf8"), /CI 局部重建标记/);
  assert.match(await readFile(outroComponent, "utf8"), /CI LOCAL REBUILD/);
  const speech = JSON.parse(await readFile(path.join(output, "media", "speech", "none.json"), "utf8"));
  assert.deepEqual(speech.externalCalls, {count: 0, apiFees: 0});
  assert.deepEqual(speech.clips, []);

  console.log(JSON.stringify({
    status: "passed",
    scenes: 8,
    fullFrames: 720,
    fullSeconds: 24,
    shortScenes: ["Title", "EvidenceAndLimits"],
    localRebuild: "Outro only; prior full video and unrelated component unchanged",
    speechMode: "none",
    externalPaidCalls: 0,
    videos: metadataChecks,
  }, null, 2));
} finally {
  await rm(output, {recursive: true, force: true});
}
