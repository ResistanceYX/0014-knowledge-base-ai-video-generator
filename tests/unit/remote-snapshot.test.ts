import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";
import {loadNodeSnapshot} from "../../src/ingest/snapshot.js";
import {parseAndValidateNode} from "../../src/node-schema/validate.js";
import {FIXTURE, FIXTURE_SHA256, FIXED_NOW} from "../helpers.js";

const COMMIT = "3ecc35b0c00e7bfa55ce5f890f11f28587de9581";
const FILE = "0014-knowledge-base-ai-video-generator.yaml";

describe("远程节点快照（固定假响应）", () => {
  it("main 先固定 commit，再只获取指定节点", async () => {
    const yaml = await readFile(FIXTURE);
    const calls: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://api.github.com/repos/ResistanceYX/idea-tree/commits/main") {
        return new Response(JSON.stringify({sha: COMMIT}), {status: 200, headers: {"content-type": "application/json"}});
      }
      if (url === `https://raw.githubusercontent.com/ResistanceYX/idea-tree/${COMMIT}/nodes/${FILE}`) {
        return new Response(yaml, {status: 200});
      }
      if (url === `https://raw.githubusercontent.com/ResistanceYX/idea-tree/${COMMIT}/LICENSE.md`) {
        return new Response("Creative Commons Attribution-ShareAlike 4.0 International Public License\n", {status: 200});
      }
      throw new Error(`测试禁止未登记请求：${url}`);
    };
    const loaded = await loadNodeSnapshot({
      input: `https://github.com/ResistanceYX/idea-tree/blob/main/nodes/${FILE}`,
      now: FIXED_NOW,
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(loaded.snapshot.sourceType).toBe("github-public-node");
    expect(loaded.snapshot.commit).toBe(COMMIT);
    expect(loaded.snapshot.normalizedUrl).toContain(`/${COMMIT}/`);
    expect(loaded.snapshot.fileSha256).toBe(FIXTURE_SHA256);
    expect(loaded.snapshot.license.spdxId).toBe("CC-BY-SA-4.0");
    expect(parseAndValidateNode(loaded.yamlText).id).toBe("synthetic-evidence-video-node");
    expect(calls).toHaveLength(3);
    expect(calls.some((url) => url.includes("evidence-a"))).toBe(false);
  });
});
