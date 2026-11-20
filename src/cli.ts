#!/usr/bin/env node
import {parseArgs} from "node:util";
import {AppError} from "./errors.js";
import {generateProject, validateProject} from "./project.js";

const HELP = `0014-knowledge-base-ai-video-generator（M1，只出脚本）

用法：
  npm run generate -- --input <本地YAML或idea-tree节点URL> --output <目录> [--synthetic] [--force]
  npm run validate-script -- --project <已生成目录> [--refresh-derived]

人工修改：
  编辑 script/scenes.json 与 script/source-map.json 后重新校验。
  narration.md 与 source-map.md 是派生阅读视图；确认 JSON 修改后使用 --refresh-derived 重建。

M1 不包含配音、完整渲染、WebUI、批量生成、外部证据遍历或自动发布。
`;

async function main(): Promise<void> {
  const args = parseArgs({
    allowPositionals: true,
    options: {
      input: {type: "string"},
      output: {type: "string"},
      project: {type: "string"},
      synthetic: {type: "boolean", default: false},
      force: {type: "boolean", default: false},
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
    const segments = result.sourceMap.entries.length;
    console.log(`生成完成（仅本地，未上传）：${result.paths.root}`);
    console.log(`场景 ${result.scenes.scenes.length} 个，逐句来源 ${segments} 条，整稿状态 ${result.scenes.scriptReview.status}。`);
    console.log(`外部 API 调用 0 次；可选服务价格 unknown；本地生成耗时 ${result.cost.localCompute.durationMs}ms。`);
    return;
  }
  if (command === "validate-script") {
    if (!args.values.project) throw new AppError("E_INPUT_PATH", "validate-script 必须提供 --project");
    const result = await validateProject({project: args.values.project, refreshDerived: args.values["refresh-derived"]});
    console.log(`校验通过：${result.scenes.scenes.length} 个场景，${result.sourceMap.entries.length} 条逐句来源。`);
    console.log(`整稿状态：${result.scenes.scriptReview.status}；派生阅读视图${result.refreshedDerived ? "已重建" : "一致"}。未触发配音、付费 API、渲染或发布。`);
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
