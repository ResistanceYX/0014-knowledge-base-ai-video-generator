import {describe, expect, it} from "vitest";
import {validateScriptBundle} from "../../src/provenance/validate.js";
import {TemplateScriptWriter, type ScriptWriter} from "../../src/script/template.js";
import type {IdeaTreeNode, ScriptBundle, SourceSnapshot} from "../../src/types.js";
import {clone, expectCode, makeContext} from "../helpers.js";

class FixedInvalidModelWriter implements ScriptWriter {
  readonly mode = "model" as const;
  async write(node: IdeaTreeNode, snapshot: SourceSnapshot): Promise<ScriptBundle> {
    const bundle = clone(await new TemplateScriptWriter().write(node, snapshot));
    bundle.scenes.scenes[1]!.narrationSegments[0]!.text = "固定假响应添加了一句无法定位的实质性陈述。";
    bundle.sourceMap.entries.find((entry) => entry.segmentId === "seg-idea")!.sources = [];
    return bundle;
  }
}

describe("ScriptWriter 固定响应契约", () => {
  it("假模型响应不联网，越界且无来源的陈述仍被拒绝", async () => {
    const {node, snapshot} = await makeContext();
    const writer = new FixedInvalidModelWriter();
    const bundle = await writer.write(node, snapshot);
    expect(writer.mode).toBe("model");
    await expectCode(() => validateScriptBundle(node, snapshot, bundle), "E_SOURCE_SCHEMA");
  });
});
