import {describe, expect, it} from "vitest";
import {fetchLimited, normalizeNodeUrl} from "../../src/ingest/input.js";
import {expectCode} from "../helpers.js";

const COMMIT = "3ecc35b0c00e7bfa55ce5f890f11f28587de9581";
const FILE = "0014-knowledge-base-ai-video-generator.yaml";

describe("GitHub 单节点 URL 白名单", () => {
  it("规范化 GitHub blob 与 raw 地址", () => {
    const blob = normalizeNodeUrl(`https://github.com/ResistanceYX/idea-tree/blob/main/nodes/${FILE}`);
    expect(blob.rawUrl).toBe(`https://raw.githubusercontent.com/ResistanceYX/idea-tree/main/nodes/${FILE}`);
    const raw = normalizeNodeUrl(`https://raw.githubusercontent.com/ResistanceYX/idea-tree/${COMMIT}/nodes/${FILE}`);
    expect(raw.ref).toBe(COMMIT);
  });

  it.each([
    ["E_INPUT_SCHEME", `http://github.com/ResistanceYX/idea-tree/blob/main/nodes/${FILE}`],
    ["E_INPUT_SCHEME", `file:///etc/passwd`],
    ["E_INPUT_HOST", `https://example.com/ResistanceYX/idea-tree/blob/main/nodes/${FILE}`],
    ["E_INPUT_HOST", `https://user:secret@github.com/ResistanceYX/idea-tree/blob/main/nodes/${FILE}`],
    ["E_INPUT_HOST", `https://github.com:444/ResistanceYX/idea-tree/blob/main/nodes/${FILE}`],
    ["E_INPUT_HOST", `https://github.com/other/idea-tree/blob/main/nodes/${FILE}`],
    ["E_INPUT_PATH", `https://github.com/ResistanceYX/idea-tree/blob/main/README.md`],
    ["E_INPUT_PATH", `https://github.com/ResistanceYX/idea-tree/blob/main/nodes/0000-reserved.yaml`],
    ["E_INPUT_VERSION", `https://github.com/ResistanceYX/idea-tree/blob/deadbeef/nodes/${FILE}`],
  ] as const)("拒绝恶意或越界地址：%s", async (code, url) => {
    await expectCode(() => normalizeNodeUrl(url), code);
  });
});

describe("受限远程读取", () => {
  it("拒绝重定向", async () => {
    const mock = async () => new Response(null, {status: 302, headers: {location: "https://example.com/"}});
    await expectCode(() => fetchLimited("https://raw.githubusercontent.com/node", {fetchImpl: mock as typeof fetch}), "E_INPUT_REDIRECT");
  });

  it("响应体超限时中止", async () => {
    const mock = async () => new Response(new Uint8Array(1024), {status: 200});
    await expectCode(() => fetchLimited("https://raw.githubusercontent.com/node", {maxBytes: 10, fetchImpl: mock as typeof fetch}), "E_INPUT_SIZE");
  });

  it("超时有独立错误码", async () => {
    const mock = async (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")));
    });
    await expectCode(() => fetchLimited("https://raw.githubusercontent.com/node", {timeoutMs: 5, fetchImpl: mock as typeof fetch}), "E_INPUT_TIMEOUT");
  });
});
