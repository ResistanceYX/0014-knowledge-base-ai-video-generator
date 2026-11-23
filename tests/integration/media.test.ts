import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {generateProject} from "../../src/project.js";
import {materializeProject} from "../../src/media/materialize.js";
import {clone, expectCode, FIXTURE, FIXED_NOW} from "../helpers.js";

const temporaryDirectories: string[] = [];
async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "0014-m2-media-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe("M2 可编辑工程物化", () => {
  it("生成六类真实引用组件、字幕草稿和 none 结果，并默认保留人工组件修改", async () => {
    const output = await tempDirectory();
    await generateProject({input: FIXTURE, output, synthetic: true, now: FIXED_NOW});
    const result = await materializeProject({project: output});
    expect(result.plan.scenes).toHaveLength(8);
    expect(result.reviewStatus).toBe("unreviewed");
    expect(result.config.speech.mode).toBe("none");
    const videoEntry = await readFile(path.join(output, "video", "Video.tsx"), "utf8");
    for (const type of ["Title", "Idea", "DeathReason", "EvidenceAndLimits", "ReusableParts", "Outro"]) {
      expect(await readFile(path.join(output, "video", "components", `${type}.tsx`), "utf8")).toContain(`export const ${type}`);
      expect(videoEntry).toContain(`./components/${type}`);
    }
    expect(await readFile(path.join(output, "video", "index.tsx"), "utf8")).toContain("registerRoot(VideoRoot)");
    expect(await readFile(result.subtitles.vtt, "utf8")).toContain("WEBVTT");
    expect(await readFile(result.subtitles.srt, "utf8")).toContain("00:00:00,000 -->");
    const speech = JSON.parse(await readFile(result.speech, "utf8"));
    expect(speech).toMatchObject({mode: "none", status: "disabled", clips: [], externalCalls: {count: 0, apiFees: 0}});

    const titlePath = path.join(output, "video", "components", "Title.tsx");
    const edited = `${await readFile(titlePath, "utf8")}\n// 人工组件修改保留标记\n`;
    await writeFile(titlePath, edited, "utf8");
    await materializeProject({project: output});
    expect(await readFile(titlePath, "utf8")).toBe(edited);
    await materializeProject({project: output, forceComponents: true});
    expect(await readFile(titlePath, "utf8")).not.toContain("人工组件修改保留标记");
  });

  it("修改单个场景旁白后只刷新其派生数据与全片字幕，不覆盖组件", async () => {
    const output = await tempDirectory();
    const generated = await generateProject({input: FIXTURE, output, synthetic: true, now: FIXED_NOW});
    const first = await materializeProject({project: output});
    const scenes = clone(generated.scenes);
    const outro = scenes.scenes.find((scene) => scene.sceneId === "scene-outro")!;
    outro.narrationSegments[0]!.text = `局部重建集成测试。${outro.narrationSegments[0]!.text}`;
    await writeFile(generated.paths.scenes, `${JSON.stringify(scenes, null, 2)}\n`, "utf8");
    await expectCode(() => materializeProject({project: output}), "E_DERIVED_STALE");
    const second = await materializeProject({project: output, refreshDerived: true});
    expect(second.plan.sourceScriptSha256).not.toBe(first.plan.sourceScriptSha256);
    expect(second.plan.fullDurationInFrames).toBe(first.plan.fullDurationInFrames);
    expect(await readFile(path.join(output, "video", "data.ts"), "utf8")).toContain("局部重建集成测试");
    expect(await readFile(second.subtitles.vtt, "utf8")).toContain("局部重建集成测试");
    expect(await readFile(path.join(output, "video", "components", "Title.tsx"), "utf8")).toContain("export const Title");
    expect(JSON.parse(await readFile(second.speech, "utf8")).externalCalls.count).toBe(0);
  });
});
