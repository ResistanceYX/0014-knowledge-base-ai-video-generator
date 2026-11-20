import {mkdir, readdir, readFile, writeFile, lstat} from "node:fs/promises";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {MAX_JSON_BYTES} from "./config.js";
import {AppError} from "./errors.js";
import {loadNodeSnapshot} from "./ingest/snapshot.js";
import {readLocalFileLimited} from "./ingest/input.js";
import {parseAndValidateNode} from "./node-schema/validate.js";
import {TemplateScriptWriter} from "./script/template.js";
import {renderNarration, renderReviewChecklist, renderSourceTable} from "./script/narration.js";
import {validateScriptBundle} from "./provenance/validate.js";
import {sha256} from "./provenance/pointer.js";
import {validateJsonSchema} from "./scenes/schema.js";
import {createCostRecord} from "./cost/record.js";
import type {CostRecord, GeneratedProjectPaths, SceneDocument, ScriptBundle, SourceMapDocument, SourceSnapshot} from "./types.js";

export interface GenerateOptions {
  input: string;
  output: string;
  synthetic?: boolean;
  force?: boolean;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export interface GenerateResult extends ScriptBundle {
  paths: GeneratedProjectPaths;
  cost: CostRecord;
}

export interface ValidateProjectOptions {
  project: string;
  refreshDerived?: boolean;
}

function projectPaths(root: string): GeneratedProjectPaths {
  return {
    root,
    sourceYaml: path.join(root, "source", "node.yaml"),
    provenance: path.join(root, "source", "provenance.json"),
    scenes: path.join(root, "script", "scenes.json"),
    sourceMap: path.join(root, "script", "source-map.json"),
    narration: path.join(root, "script", "narration.md"),
    sourceTable: path.join(root, "script", "source-map.md"),
    checklist: path.join(root, "review", "checklist.md"),
    cost: path.join(root, "cost.json"),
  };
}

async function prepareOutput(root: string, force: boolean): Promise<GeneratedProjectPaths> {
  const resolved = path.resolve(root);
  if (resolved === path.parse(resolved).root) throw new AppError("E_OUTPUT_EXISTS", "输出目录不能是文件系统根目录");
  try {
    const info = await lstat(resolved);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new AppError("E_OUTPUT_EXISTS", "输出路径必须是普通目录，不能是文件或符号链接");
    if (!force && (await readdir(resolved)).length > 0) {
      throw new AppError("E_OUTPUT_EXISTS", "输出目录非空；如确认覆盖本项目已知产物，请显式使用 --force");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const paths = projectPaths(resolved);
  await Promise.all([
    mkdir(path.dirname(paths.sourceYaml), {recursive: true}),
    mkdir(path.dirname(paths.scenes), {recursive: true}),
    mkdir(path.dirname(paths.checklist), {recursive: true}),
  ]);
  return paths;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function generateProject(options: GenerateOptions): Promise<GenerateResult> {
  const started = performance.now();
  const {snapshot, yamlText, bytes} = await loadNodeSnapshot(options);
  const node = parseAndValidateNode(yamlText);
  const writer = new TemplateScriptWriter();
  const bundle = await writer.write(node, snapshot);
  validateScriptBundle(node, snapshot, bundle);
  const paths = await prepareOutput(options.output, options.force ?? false);
  const cost = createCostRecord(snapshot.fileSha256, performance.now() - started);
  await Promise.all([
    writeFile(paths.sourceYaml, bytes),
    writeFile(paths.provenance, json(snapshot), "utf8"),
    writeFile(paths.scenes, json(bundle.scenes), "utf8"),
    writeFile(paths.sourceMap, json(bundle.sourceMap), "utf8"),
    writeFile(paths.narration, renderNarration(bundle.scenes), "utf8"),
    writeFile(paths.sourceTable, renderSourceTable(bundle.scenes, bundle.sourceMap), "utf8"),
    writeFile(paths.checklist, renderReviewChecklist(bundle.scenes), "utf8"),
    writeFile(paths.cost, json(cost), "utf8"),
  ]);
  return {...bundle, paths, cost};
}

async function readJson(filename: string): Promise<unknown> {
  const bytes = await readLocalFileLimited(filename, MAX_JSON_BYTES);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new AppError("E_JSON_PARSE", `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`, filename);
  }
}

async function readDerived(filename: string): Promise<string> {
  const bytes = await readLocalFileLimited(filename, MAX_JSON_BYTES);
  return bytes.toString("utf8");
}

export async function validateProject(options: ValidateProjectOptions): Promise<{
  scenes: SceneDocument;
  sourceMap: SourceMapDocument;
  cost: CostRecord;
  refreshedDerived: boolean;
}> {
  const paths = projectPaths(path.resolve(options.project));
  const yamlBytes = await readLocalFileLimited(paths.sourceYaml);
  const yamlText = yamlBytes.toString("utf8");
  const actualHash = sha256(yamlBytes);
  const node = parseAndValidateNode(yamlText);
  const provenance = await readJson(paths.provenance) as SourceSnapshot;
  if (provenance.fileSha256 !== actualHash) {
    throw new AppError("E_SOURCE_SNAPSHOT", "source/node.yaml 已变化，provenance.json 中的哈希已失效", paths.sourceYaml);
  }
  const scenes = await readJson(paths.scenes) as SceneDocument;
  const sourceMap = await readJson(paths.sourceMap) as SourceMapDocument;
  const validated = validateScriptBundle(node, provenance, {scenes, sourceMap});
  const cost = validateJsonSchema<CostRecord>("cost-schema.json", await readJson(paths.cost), "E_SCENE_SEMANTICS");
  if (cost.sourceSnapshotSha256 !== actualHash) {
    throw new AppError("E_SOURCE_SNAPSHOT", "cost.json 对应的节点快照哈希与当前输入不一致", paths.cost);
  }

  const expectedNarration = renderNarration(validated.scenes);
  const expectedSourceTable = renderSourceTable(validated.scenes, validated.sourceMap);
  let derivedStale = false;
  try {
    derivedStale = (await readDerived(paths.narration)) !== expectedNarration || (await readDerived(paths.sourceTable)) !== expectedSourceTable;
  } catch (error) {
    if (error instanceof AppError && error.code === "E_INPUT_PATH") derivedStale = true;
    else throw error;
  }
  if (derivedStale && !options.refreshDerived) {
    throw new AppError(
      "E_DERIVED_STALE",
      "narration.md 或 source-map.md 与 JSON 主文件不一致；若 JSON 已完成人工修改，请用 --refresh-derived 重建派生阅读视图",
      paths.narration,
    );
  }
  if (derivedStale && options.refreshDerived) {
    await Promise.all([
      writeFile(paths.narration, expectedNarration, "utf8"),
      writeFile(paths.sourceTable, expectedSourceTable, "utf8"),
    ]);
  }
  return {scenes: validated.scenes, sourceMap: validated.sourceMap, cost, refreshedDerived: derivedStale};
}
