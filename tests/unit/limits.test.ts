import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {describe, it} from "vitest";
import {MAX_INPUT_BYTES} from "../../src/config.js";
import {readLocalFileLimited} from "../../src/ingest/input.js";
import {parseAndValidateNode} from "../../src/node-schema/validate.js";
import {expectCode} from "../helpers.js";

describe("输入资源限制", () => {
  it("拒绝超长本地输入", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "0014-limit-"));
    try {
      const filename = path.join(directory, "oversized.yaml");
      await writeFile(filename, Buffer.alloc(MAX_INPUT_BYTES + 1));
      await expectCode(() => readLocalFileLimited(filename), "E_INPUT_SIZE");
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
  });

  it("YAML 别名膨胀在字段处理前安全失败", async () => {
    const lines = [`a0: &a0 [${Array.from({length: 10}, () => '"x"').join(", ")}]`];
    for (let index = 1; index <= 6; index += 1) {
      lines.push(`a${index}: &a${index} [${Array.from({length: 10}, () => `*a${index - 1}`).join(", ")}]`);
    }
    await expectCode(() => parseAndValidateNode(`${lines.join("\n")}\n`), "E_YAML_PARSE");
  });
});
