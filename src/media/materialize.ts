import path from "node:path";
import {lstat, mkdir, readdir, readFile, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {MEDIA_VERSION, PACKAGE_ROOT} from "../config.js";
import {AppError} from "../errors.js";
import {readLocalFileLimited} from "../ingest/input.js";
import {validateProject} from "../project.js";
import type {MaterializeResult, MediaConfig} from "../types.js";
import {DEFAULT_MEDIA_CONFIG, loadMediaConfig, mediaConfigPath, parseMediaConfig} from "./config.js";
import {getSpeechAdapter} from "./speech.js";
import {renderSrt, renderVtt} from "./subtitles.js";
import {buildMediaPlan, scriptRevision} from "./timeline.js";

export interface MaterializeOptions {
  project: string;
  refreshDerived?: boolean;
  forceComponents?: boolean;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function assertSafeOutput(root: string, relative: string): Promise<string> {
  const output = path.resolve(root, relative);
  if (!output.startsWith(`${path.resolve(root)}${path.sep}`)) throw new AppError("E_OUTPUT_EXISTS", "媒体输出路径越界", relative);
  let current = path.resolve(root);
  const rootInfo = await lstat(current);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new AppError("E_OUTPUT_EXISTS", "工程根目录必须是普通目录", root);
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new AppError("E_OUTPUT_EXISTS", "拒绝通过符号链接写入媒体工程", current);
      if (current !== output && !info.isDirectory()) throw new AppError("E_OUTPUT_EXISTS", "媒体输出的父路径不是目录", current);
      if (current === output && !info.isFile()) throw new AppError("E_OUTPUT_EXISTS", "媒体输出目标不是普通文件", current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }
  return output;
}

async function writeOutput(root: string, relative: string, contents: string | Uint8Array): Promise<string> {
  const output = await assertSafeOutput(root, relative);
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, contents);
  return output;
}

async function templateFiles(): Promise<string[]> {
  const base = path.join(PACKAGE_ROOT, "video-template");
  const files: string[] = [];
  async function visit(directory: string, prefix = ""): Promise<void> {
    const entries = await readdir(directory, {withFileTypes: true});
    for (const entry of entries) {
      const relative = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isSymbolicLink()) throw new AppError("E_OUTPUT_EXISTS", "内置视频模板不得包含符号链接", relative);
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), relative);
      else if (entry.isFile() && relative !== "data.ts") files.push(relative);
    }
  }
  await visit(base);
  return files.sort();
}

function dataModule(document: unknown, sourceMap: unknown, plan: unknown): string {
  return `// AUTO-GENERATED：由 script/*.json 与 media/plan.json 派生；请勿手改。\n` +
    `import type {MediaPlan, SceneDocument, SourceMapDocument} from "./types";\n\n` +
    `export const sceneDocument = ${JSON.stringify(document, null, 2)} as unknown as SceneDocument;\n\n` +
    `export const sourceMapDocument = ${JSON.stringify(sourceMap, null, 2)} as unknown as SourceMapDocument;\n\n` +
    `export const mediaPlan = ${JSON.stringify(plan, null, 2)} as unknown as MediaPlan;\n`;
}

export async function materializeProject(options: MaterializeOptions): Promise<MaterializeResult> {
  const project = path.resolve(options.project);
  const validated = await validateProject({project, refreshDerived: options.refreshDerived ?? false});
  const config = await loadMediaConfig(project) ?? parseMediaConfig(DEFAULT_MEDIA_CONFIG);
  const scenesPath = path.join(project, "script", "scenes.json");
  const sourceMapPath = path.join(project, "script", "source-map.json");
  const scenesText = (await readLocalFileLimited(scenesPath)).toString("utf8");
  const sourceMapText = (await readLocalFileLimited(sourceMapPath)).toString("utf8");
  const revision = scriptRevision(scenesText, sourceMapText);
  const plan = buildMediaPlan(validated.scenes, revision);
  const files = await templateFiles();
  const componentFiles: string[] = [];
  const templateHash = createHash("sha256");

  for (const relative of files) {
    const source = path.join(PACKAGE_ROOT, "video-template", relative);
    const sourceBytes = await readFile(source);
    templateHash.update(relative).update(sourceBytes);
    const targetRelative = path.join("video", relative);
    const target = await assertSafeOutput(project, targetRelative);
    let exists = true;
    try {
      await lstat(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") exists = false;
      else throw error;
    }
    if (exists && !options.forceComponents) {
      componentFiles.push(target);
      continue;
    }
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, sourceBytes);
    componentFiles.push(target);
  }

  const configFile = mediaConfigPath(project);
  if (!(await loadMediaConfig(project))) await writeOutput(project, path.join("video", "config.json"), json(config));
  await writeOutput(project, path.join("video", "data.ts"), dataModule(validated.scenes, validated.sourceMap, plan));
  await writeOutput(project, path.join("media", "plan.json"), json(plan));
  const vtt = await writeOutput(project, path.join("media", "subtitles", "draft.vtt"), renderVtt(validated.scenes, plan));
  const srt = await writeOutput(project, path.join("media", "subtitles", "draft.srt"), renderSrt(validated.scenes, plan));
  const speechAdapter = getSpeechAdapter(config.speech.mode);
  const speechResult = await speechAdapter.synthesize({document: validated.scenes, plan});
  const speech = await writeOutput(project, path.join("media", "speech", "none.json"), json(speechResult));
  await writeOutput(project, path.join("media", "materialization.json"), json({
    schemaVersion: "0.2.0",
    mediaVersion: MEDIA_VERSION,
    sourceScriptSha256: revision,
    componentsPreserved: !options.forceComponents,
    componentFiles: files.map((file) => `video/${file.split(path.sep).join("/")}`),
    templateSha256: templateHash.digest("hex"),
  }));

  return {
    project,
    plan,
    config,
    reviewStatus: validated.scenes.scriptReview.status,
    componentFiles: [...componentFiles, configFile],
    overwrittenComponents: options.forceComponents ?? false,
    subtitles: {vtt, srt},
    speech,
  };
}

export function defaultMediaConfig(): MediaConfig {
  return structuredClone(DEFAULT_MEDIA_CONFIG);
}
