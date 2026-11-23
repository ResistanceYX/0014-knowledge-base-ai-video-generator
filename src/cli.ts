#!/usr/bin/env node
import {parseArgs} from "node:util";
import {AppError} from "./errors.js";
import {generateProject, validateProject} from "./project.js";
import {materializeProject} from "./media/materialize.js";
import {renderArtifact} from "./media/render.js";

const HELP = `0014-knowledge-base-ai-video-generator（M2，脚本＋程序化无声画面）

用法：
  npm run generate -- --input <本地YAML或idea-tree节点URL> --output <目录> [--synthetic] [--force]
  npm run validate-script -- --project <已生成目录> [--refresh-derived]
  npm run materialize -- --project <目录> [--refresh-derived] [--force-components]
  npm run preview -- --project <目录> [--scene <sceneId>] [--frame <帧号>] [--output <PNG>] [--refresh-derived]
  npm run render -- --project <目录> [--scene <sceneId>] [--frames <起-止>] [--output <MP4>] [--refresh-derived]

人工修改：
  1. 编辑 script/scenes.json 与 script/source-map.json 后重新校验。
  2. narration.md 与 source-map.md 是派生阅读视图；确认 JSON 修改后使用 --refresh-derived 重建。
  3. video/components/*.tsx 是实际参与渲染的可编辑组件；重复 materialize 默认保留修改。
     --force-components 会明确覆盖这些组件，但不会覆盖 video/config.json。
  4. 不提供 --scene 时渲染完整拼接；提供时只重建该场景。

M2 只有 SpeechAdapter 的 none 模式；字幕是按时长估算的草稿，不含真实配音、音画同步或自动发布。
`;

function requiredProject(value: string | undefined, command: string): string {
  if (!value) throw new AppError("E_INPUT_PATH", `${command} 必须提供 --project`);
  return value;
}

function frameNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new AppError("E_RENDER", "--frame 必须是非负整数", value);
  return Number(value);
}

function frameRange(value: string | undefined): [number, number] | undefined {
  if (value === undefined) return undefined;
  const match = /^(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/.exec(value);
  if (!match) throw new AppError("E_RENDER", "--frames 必须使用 <起-止>，例如 0-89", value);
  return [Number(match[1]), Number(match[2])];
}

async function main(): Promise<void> {
  const args = parseArgs({
    allowPositionals: true,
    options: {
      input: {type: "string"},
      output: {type: "string"},
      project: {type: "string"},
      scene: {type: "string"},
      frame: {type: "string"},
      frames: {type: "string"},
      synthetic: {type: "boolean", default: false},
      force: {type: "boolean", default: false},
      "force-components": {type: "boolean", default: false},
      "refresh-derived": {type: "boolean", default: false},
      help: {type: "boolean", short: "h", default: false},
    },
  });
  const command = args.positionals[0];
  if (args.values.help || !command) {
    console.log(HELP);
    return;
  }
  if (command === "generate") {
    if (!args.values.input || !args.values.output) throw new AppError("E_INPUT_PATH", "generate 必须提供 --input 与 --output");
    const result = await generateProject({
      input: args.values.input,
      output: args.values.output,
      synthetic: args.values.synthetic,
      force: args.values.force,
    });
    console.log(`生成完成（仅本地，未上传）：${result.paths.root}`);
    console.log(`场景 ${result.scenes.scenes.length} 个，逐句来源 ${result.sourceMap.entries.length} 条，整稿状态 ${result.scenes.scriptReview.status}。`);
    console.log(`外部 API 调用 0 次；可选服务价格 unknown；本地生成耗时 ${result.cost.localCompute.durationMs}ms。`);
    return;
  }
  if (command === "validate-script") {
    const result = await validateProject({project: requiredProject(args.values.project, command), refreshDerived: args.values["refresh-derived"]});
    console.log(`校验通过：${result.scenes.scenes.length} 个场景，${result.sourceMap.entries.length} 条逐句来源。`);
    console.log(`整稿状态：${result.scenes.scriptReview.status}；派生阅读视图${result.refreshedDerived ? "已重建" : "一致"}。未触发配音、付费 API、渲染或发布。`);
    return;
  }
  if (command === "materialize") {
    const result = await materializeProject({
      project: requiredProject(args.values.project, command),
      refreshDerived: args.values["refresh-derived"],
      forceComponents: args.values["force-components"],
    });
    console.log(`可编辑工程已物化（仅本地）：${result.project}/video`);
    console.log(`${result.plan.scenes.length} 个场景，完整时间轴 ${result.plan.fullDurationInFrames} 帧；组件${result.overwrittenComponents ? "已按显式要求覆盖" : "默认保留"}。`);
    console.log(`VTT／SRT 字幕草稿已更新；SpeechAdapter=none，外部调用 0 次，不生成音频。`);
    return;
  }
  if (command === "preview" || command === "render") {
    const kind = command === "preview" ? "still" : "video";
    if (command === "preview" && args.values.frames) throw new AppError("E_RENDER", "--frames 只用于 render；preview 请使用 --frame");
    const frame = command === "preview" ? frameNumber(args.values.frame) : undefined;
    const range = command === "render" ? frameRange(args.values.frames) : undefined;
    const report = await renderArtifact({
      project: requiredProject(args.values.project, command),
      kind,
      ...(args.values.scene ? {sceneId: args.values.scene} : {}),
      ...(args.values.output ? {output: args.values.output} : {}),
      ...(frame !== undefined ? {frame} : {}),
      ...(range ? {frameRange: range} : {}),
      refreshDerived: args.values["refresh-derived"],
    });
    console.log(`${kind === "video" ? "MP4" : "PNG 预览"}已完成（本地草稿，未上传）：${report.output}`);
    console.log(`组合 ${report.compositionId}；${report.width}×${report.height}；实际输出 ${report.renderedFrameCount} 帧（组合总长 ${report.durationInFrames} 帧）；本阶段耗时 ${report.durationMs}ms。`);
    console.log(`审校状态 ${report.reviewStatus}；SpeechAdapter=none；外部付费调用 0 次；未自动发布。`);
    return;
  }
  throw new AppError("E_INPUT_PATH", `未知命令：${command}`);
}

main().catch((error: unknown) => {
  if (error instanceof AppError) {
    console.error(`[${error.code}] ${error.message}`);
    for (const item of error.issues.slice(1)) console.error(`  - ${item.location}: ${item.message}`);
  } else {
    console.error(`[E_UNEXPECTED] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  }
  process.exitCode = 1;
});
