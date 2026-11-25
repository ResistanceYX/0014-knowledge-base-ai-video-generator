import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {generateProject, validateProject} from "../../src/project.js";
import {sha256} from "../../src/provenance/pointer.js";
import {clone, expectCode, FIXTURE, FIXTURE_SHA256, FIXED_NOW, makeUpstreamValidation, UPSTREAM_TEST_COMMIT} from "../helpers.js";

const temporaryDirectories: string[] = [];
async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "0014-m1-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe("M1 只出脚本垂直切片", () => {
  it("无 API Key、无网络完成合成 YAML 到全部脚本产物", async () => {
    const output = await tempDirectory();
    let networkCalls = 0;
    const fetchImpl = async () => {
      networkCalls += 1;
      throw new Error("本地模式不得联网");
    };
    const generated = await generateProject({
      input: FIXTURE,
      output,
      synthetic: true,
      now: FIXED_NOW,
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(networkCalls).toBe(0);
    expect(generated.scenes.scenes).toHaveLength(8);
    expect(generated.sourceMap.entries).toHaveLength(22);
    expect(generated.scenes.scriptReview.status).toBe("unreviewed");
    expect(generated.cost.externalCalls.count).toBe(0);
    expect(generated.cost.optionalServicesPricing.status).toBe("unknown");
    const sourceBytes = await readFile(generated.paths.sourceYaml);
    expect(sha256(sourceBytes)).toBe(FIXTURE_SHA256);
    const validated = await validateProject({project: output});
    expect(validated.refreshedDerived).toBe(false);
  });

  it("非空输出目录必须显式 --force 对应选项", async () => {
    const output = await tempDirectory();
    await writeFile(path.join(output, "keep.txt"), "不要覆盖");
    await expectCode(() => generateProject({input: FIXTURE, output, synthetic: true}), "E_OUTPUT_EXISTS");
    expect(await readFile(path.join(output, "keep.txt"), "utf8")).toBe("不要覆盖");
  });

  it("人工修改 JSON 后重校验，并显式重建派生阅读视图", async () => {
    const output = await tempDirectory();
    const generated = await generateProject({input: FIXTURE, output, synthetic: true, now: FIXED_NOW});
    const scenes = clone(generated.scenes);
    const segment = scenes.scenes.flatMap((scene) => scene.narrationSegments).find((item) => item.segmentId === "seg-reusable-parts")!;
    segment.text = `${segment.text}本句仅复述节点字段，不声称实际效果。`;
    await writeFile(generated.paths.scenes, `${JSON.stringify(scenes, null, 2)}\n`, "utf8");
    await expectCode(() => validateProject({project: output}), "E_DERIVED_STALE");
    const validated = await validateProject({project: output, refreshDerived: true});
    expect(validated.refreshedDerived).toBe(true);
    expect(await readFile(generated.paths.narration, "utf8")).toContain("本句仅复述节点字段，不声称实际效果。");
    expect((await validateProject({project: output})).refreshedDerived).toBe(false);
  });

  it("节点快照变化后来源映射与成本记录失效", async () => {
    const output = await tempDirectory();
    const generated = await generateProject({input: FIXTURE, output, synthetic: true, now: FIXED_NOW});
    await writeFile(generated.paths.sourceYaml, `${await readFile(FIXTURE, "utf8")}\n`, "utf8");
    await expectCode(() => validateProject({project: output}), "E_SOURCE_SNAPSHOT");
  });

  it("合法上游证据保留关系，工程重校验会拒绝被篡改证据", async () => {
    const file = "0014-knowledge-base-ai-video-generator.yaml";
    const input = `https://github.com/ResistanceYX/idea-tree/blob/${UPSTREAM_TEST_COMMIT}/nodes/${file}`;
    const yaml = `${await readFile(FIXTURE, "utf8")}相关节点:\n  - 节点: 0001-other\n    关系: 同类\n`;
    const fetchImpl = async (request: string | URL | Request) => {
      const url = String(request);
      if (url === `https://raw.githubusercontent.com/ResistanceYX/idea-tree/${UPSTREAM_TEST_COMMIT}/nodes/${file}`) {
        return new Response(yaml, {status: 200});
      }
      if (url === `https://raw.githubusercontent.com/ResistanceYX/idea-tree/${UPSTREAM_TEST_COMMIT}/LICENSE.md`) {
        return new Response("Creative Commons Attribution-ShareAlike 4.0 International Public License\n", {status: 200});
      }
      throw new Error(`测试禁止未登记请求：${url}`);
    };
    const rejectedOutput = await tempDirectory();
    await expectCode(
      () => generateProject({input, output: rejectedOutput, now: FIXED_NOW, fetchImpl: fetchImpl as typeof fetch}),
      "E_NODE_SCOPE",
    );

    const output = await tempDirectory();
    const generated = await generateProject({
      input,
      output,
      now: FIXED_NOW,
      fetchImpl: fetchImpl as typeof fetch,
      upstreamValidation: makeUpstreamValidation(),
    });
    expect(generated.scenes.sourceSnapshot.upstreamValidation?.commit).toBe(UPSTREAM_TEST_COMMIT);
    expect(generated.scenes.scriptReview.status).toBe("unreviewed");
    expect((await validateProject({project: output})).refreshedDerived).toBe(false);

    const provenance = JSON.parse(await readFile(generated.paths.provenance, "utf8")) as {
      upstreamValidation: {log: string; logSha256: string};
    };
    provenance.upstreamValidation.log += "被篡改的一行\n";
    await writeFile(generated.paths.provenance, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
    await expectCode(() => validateProject({project: output}), "E_NODE_SCOPE");
  });
});
