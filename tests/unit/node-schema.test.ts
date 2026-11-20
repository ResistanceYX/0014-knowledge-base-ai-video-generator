import {readFile} from "node:fs/promises";
import {parse} from "yaml";
import {describe, expect, it} from "vitest";
import {loadNodeSnapshot} from "../../src/ingest/snapshot.js";
import {parseAndValidateNode} from "../../src/node-schema/validate.js";
import {FIXTURE, FIXTURE_SHA256, FIXED_NOW, clone, expectCode} from "../helpers.js";

describe("idea-tree v1.9 单节点校验", () => {
  it("读取合法合成 fixture，并固定快照哈希", async () => {
    const loaded = await loadNodeSnapshot({input: FIXTURE, synthetic: true, now: FIXED_NOW});
    const node = parseAndValidateNode(loaded.yamlText);
    expect(node.编号).toBe("9999");
    expect(node.死法).toHaveLength(3);
    expect(loaded.snapshot.fileSha256).toBe(FIXTURE_SHA256);
    expect(loaded.snapshot.retrievedAt).toBe(FIXED_NOW.toISOString());
    expect(loaded.snapshot.license.spdxId).toBe("NOASSERTION");
  });

  it("缺少必选字段时不自动补写", async () => {
    const data = parse(await readFile(FIXTURE, "utf8")) as Record<string, unknown>;
    delete data.标题;
    const {stringify} = await import("yaml");
    const error = await expectCode(() => parseAndValidateNode(stringify(data)), "E_NODE_SCHEMA");
    expect(error.issues.some((item) => item.message.includes("标题"))).toBe(true);
  });

  it("拒绝未知状态与未知顶层字段", async () => {
    const text = await readFile(FIXTURE, "utf8");
    const error = await expectCode(() => parseAndValidateNode(`${text}\n未知字段: 值\n`), "E_NODE_SCHEMA");
    expect(error.issues.some((item) => item.location === "/未知字段")).toBe(true);
    const data = parse(text) as Record<string, unknown>;
    data.复活状态 = "大概复活";
    const {stringify} = await import("yaml");
    await expectCode(() => parseAndValidateNode(stringify(data)), "E_NODE_SCHEMA");
  });

  it("YAML 非映射、重复键与自定义标签安全失败", async () => {
    await expectCode(() => parseAndValidateNode("- a\n- b\n"), "E_NODE_SCHEMA");
    await expectCode(() => parseAndValidateNode("编号: \"9999\"\n编号: \"9998\"\n"), "E_YAML_PARSE");
    await expectCode(() => parseAndValidateNode("!execute/dangerous {}\n"), "E_YAML_PARSE");
  });

  it("不读取附件或非空跨节点关系", async () => {
    const text = await readFile(FIXTURE, "utf8");
    const data = parse(text) as Record<string, unknown>;
    data.需求证据 = {类型: "测试", 附件: "evidence/private.txt"};
    const {stringify} = await import("yaml");
    await expectCode(() => parseAndValidateNode(stringify(data)), "E_NODE_SCOPE");
    const related = clone(data);
    delete (related.需求证据 as Record<string, unknown>).附件;
    related.相关节点 = [{节点: "0001-other", 关系: "同类"}];
    await expectCode(() => parseAndValidateNode(stringify(related)), "E_NODE_SCOPE");
  });
});
