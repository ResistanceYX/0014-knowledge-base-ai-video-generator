import path from "node:path";
import os from "node:os";
import {createHash} from "node:crypto";
import {lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile} from "node:fs/promises";
import {performance} from "node:perf_hooks";
import {bundle} from "@remotion/bundler";
import {ensureBrowser, renderMedia, renderStill, selectComposition} from "@remotion/renderer";
import {PACKAGE_ROOT} from "../config.js";
import {AppError} from "../errors.js";
import type {MediaPlan, RenderReport} from "../types.js";
import {materializeProject} from "./materialize.js";

export interface RenderArtifactOptions {
  project: string;
  kind: "still" | "video";
  sceneId?: string;
  output?: string;
  frame?: number;
  frameRange?: [number, number];
  refreshDerived?: boolean;
}

async function inputDigest(project: string): Promise<string> {
  const hash = createHash("sha256");
  const roots = [path.join(project, "script"), path.join(project, "video")];
  for (const root of roots) {
    async function visit(directory: string): Promise<void> {
      const entries = (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const filename = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new AppError("E_RENDER", "渲染输入不得包含符号链接", filename);
        if (entry.isDirectory()) await visit(filename);
        else if (entry.isFile() && (/\.(?:json|ts|tsx)$/.test(entry.name) || entry.name === "README.md")) {
          hash.update(path.relative(project, filename)).update(await readFile(filename));
        }
      }
    }
    await visit(root);
  }
  return hash.digest("hex");
}

async function makeBundle(project: string): Promise<{serveUrl: string; cleanup: () => Promise<void>}> {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "0014-remotion-bundle-"));
  try {
    const serveUrl = await bundle({
      entryPoint: path.join(project, "video", "index.tsx"),
      outDir,
      enableCaching: false,
      gitSource: null,
      publicDir: null,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          modules: [path.join(PACKAGE_ROOT, "node_modules"), ...(config.resolve?.modules ?? [])],
        },
      }),
    });
    return {serveUrl, cleanup: () => rm(outDir, {recursive: true, force: true})};
  } catch (error) {
    await rm(outDir, {recursive: true, force: true});
    throw error;
  }
}

async function outputFilename(project: string, options: RenderArtifactOptions, plan: MediaPlan): Promise<{output: string; compositionId: string; sceneId: string | null}> {
  const sceneId = options.sceneId ?? null;
  const timing = sceneId ? plan.scenes.find((scene) => scene.sceneId === sceneId || scene.compositionId === sceneId) : null;
  if (sceneId && !timing) throw new AppError("E_COMPOSITION", `找不到场景：${sceneId}`, sceneId);
  const compositionId = timing?.compositionId ?? plan.fullCompositionId;
  const extension = options.kind === "video" ? ".mp4" : ".png";
  const rangeSuffix = options.frameRange ? `-${options.frameRange[0]}-${options.frameRange[1]}` : "";
  const output = path.resolve(options.output ?? path.join(
    project,
    "media",
    options.kind === "video" ? "output" : "previews",
    `${timing?.sceneId ?? "full"}${rangeSuffix}${extension}`,
  ));
  if (path.extname(output).toLowerCase() !== extension) throw new AppError("E_RENDER", `${options.kind} 输出必须使用 ${extension} 扩展名`, output);
  try {
    const info = await lstat(output);
    if (!info.isFile() || info.isSymbolicLink()) throw new AppError("E_RENDER", "输出目标必须是普通文件，且不能是符号链接", output);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(output), {recursive: true});
  return {output, compositionId, sceneId: timing?.sceneId ?? null};
}

export async function renderArtifact(options: RenderArtifactOptions): Promise<RenderReport> {
  if (options.kind === "still" && options.frameRange) throw new AppError("E_RENDER", "静帧渲染不接受 frameRange；请使用 frame");
  if (options.kind === "video" && options.frame !== undefined) throw new AppError("E_RENDER", "视频渲染不接受单帧 frame；请使用 frameRange");
  const project = path.resolve(options.project);
  const materialized = await materializeProject({project, refreshDerived: options.refreshDerived ?? false});
  const {output, compositionId, sceneId} = await outputFilename(project, options, materialized.plan);
  const inputSha256Before = await inputDigest(project);
  const startedAt = new Date();
  const started = performance.now();
  const bundled = await makeBundle(project).catch((error: unknown) => {
    throw new AppError("E_RENDER", `Remotion 工程打包失败：${error instanceof Error ? error.message : String(error)}`, path.join(project, "video", "index.tsx"));
  });
  try {
    const browser = await ensureBrowser();
    if (browser.type === "no-browser" || browser.type === "version-mismatch") {
      throw new AppError("E_BROWSER", `Remotion 浏览器不可用：${browser.type}`);
    }
    const composition = await selectComposition({serveUrl: bundled.serveUrl, id: compositionId});
    if (options.kind === "still") {
      const frame = options.frame ?? Math.floor(composition.durationInFrames / 2);
      if (!Number.isInteger(frame) || frame < 0 || frame >= composition.durationInFrames) {
        throw new AppError("E_RENDER", `静帧必须位于 0—${composition.durationInFrames - 1}`, String(frame));
      }
      await renderStill({
        serveUrl: bundled.serveUrl,
        composition,
        output,
        frame,
        imageFormat: "png",
        overwrite: true,
        scale: materialized.config.render.scale,
        isProduction: false,
      });
    } else {
      const frameRange = options.frameRange;
      if (frameRange && (!Number.isInteger(frameRange[0]) || !Number.isInteger(frameRange[1]) || frameRange[0] < 0 || frameRange[1] < frameRange[0] || frameRange[1] >= composition.durationInFrames)) {
        throw new AppError("E_RENDER", `帧区间必须位于 0—${composition.durationInFrames - 1}，且结束帧不早于开始帧`, frameRange?.join("-"));
      }
      await renderMedia({
        serveUrl: bundled.serveUrl,
        composition,
        outputLocation: output,
        ...(frameRange ? {frameRange} : {}),
        codec: "h264",
        crf: materialized.config.render.crf,
        concurrency: materialized.config.render.concurrency,
        scale: materialized.config.render.scale,
        muted: true,
        enforceAudioTrack: false,
        overwrite: true,
        x264Preset: "veryfast",
        timeoutInMilliseconds: 120_000,
        isProduction: false,
      });
    }
    const finishedAt = new Date();
    const inputSha256 = await inputDigest(project);
    if (inputSha256 !== inputSha256Before) throw new AppError("E_RENDER", "渲染期间脚本或组件发生变化；请固定输入后重试，本输出不作为可复现结果", output);
    const report: RenderReport = {
      schemaVersion: "0.2.0",
      kind: options.kind,
      compositionId,
      sceneId,
      output,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.round(performance.now() - started),
      frame: options.kind === "still" ? options.frame ?? Math.floor(composition.durationInFrames / 2) : null,
      durationInFrames: composition.durationInFrames,
      renderedFrameRange: options.kind === "video" ? options.frameRange ?? null : null,
      renderedFrameCount: options.kind === "video" ? (options.frameRange ? options.frameRange[1] - options.frameRange[0] + 1 : composition.durationInFrames) : 1,
      fps: composition.fps,
      width: Math.round(composition.width * materialized.config.render.scale),
      height: Math.round(composition.height * materialized.config.render.scale),
      scale: materialized.config.render.scale,
      reviewStatus: materialized.reviewStatus,
      speechMode: "none",
      externalCalls: {count: 0, apiFees: 0},
      inputSha256,
      localDraft: true,
    };
    const reportPath = path.join(project, "media", "reports", `${options.kind}-${compositionId}${options.frameRange ? `-${options.frameRange[0]}-${options.frameRange[1]}` : ""}.json`);
    await mkdir(path.dirname(reportPath), {recursive: true});
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return report;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("E_RENDER", `Remotion ${options.kind === "video" ? "视频" : "静帧"}渲染失败：${error instanceof Error ? error.message : String(error)}`, output);
  } finally {
    await bundled.cleanup();
  }
}
