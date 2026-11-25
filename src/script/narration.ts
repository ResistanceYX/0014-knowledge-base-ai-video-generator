import type {SceneDocument, SourceMapDocument} from "../types.js";

function inline(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\r\n", "<br>").replaceAll("\n", "<br>");
}

export function renderNarration(scenes: SceneDocument): string {
  const lines = [
    `# ${scenes.node.title}：离线旁白与分镜`,
    "",
    `> 项目：${scenes.projectId}`,
    `> 快照 SHA-256：${scenes.sourceSnapshot.fileSha256}`,
    `> 审核状态：${scenes.scriptReview.status}。本文件是派生阅读视图；人工修改请编辑 scenes.json 与 source-map.json。`,
    "> 本地生成器不调用配音、外部模型或完整渲染；AI 辅助改写与人工操作另见审校记录。",
    "",
  ];
  for (const scene of scenes.scenes) {
    lines.push(`## ${scene.order}. ${scene.visual.heading}`, "");
    lines.push(`- 场景：\`${scene.sceneId}\`（${scene.type}）`, `- 建议时长：${scene.durationSeconds} 秒`, "");
    for (const segment of scene.narrationSegments) {
      lines.push(`### \`${segment.segmentId}\` · ${segment.kind}`, "", segment.text, "");
    }
    lines.push("**画面草稿**", "");
    scene.visual.bodyLines.forEach((line) => lines.push(`- ${line}`));
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderSourceTable(scenes: SceneDocument, sourceMap: SourceMapDocument): string {
  const segmentText = new Map<string, string>();
  scenes.scenes.forEach((scene) => scene.narrationSegments.forEach((segment) => segmentText.set(segment.segmentId, segment.text)));
  const lines = [
    `# ${scenes.node.title}：逐句来源表`,
    "",
    `> 快照 SHA-256：${sourceMap.sourceSnapshotSha256}`,
    "> supported 只表示存在可解析的节点字段与原文摘录，不代表工具已经独立核验事实。",
    "",
    "| segmentId | 旁白 | 支持状态 | 节点字段与原文摘录 | 限定条件 | 待补证问题 | 审校 |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const entry of sourceMap.entries) {
    const sources = entry.sources.map((item) => `\`${item.jsonPointer}\`：“${item.excerpt}”`).join("<br>") || "无";
    lines.push(`| \`${entry.segmentId}\` | ${inline(segmentText.get(entry.segmentId) ?? "")} | ${entry.supportStatus} | ${inline(sources)} | ${inline(entry.qualifiers.join("<br>")) || "无"} | ${inline(entry.openQuestion ?? "无")} | ${entry.review.status} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderReviewChecklist(scenes: SceneDocument): string {
  return `# 人工审校清单（M1）\n\n` +
    `- [ ] 已打开原节点并核对编号、标题、档案类型与复活状态。\n` +
    `- [ ] 每条 factual 旁白都能由 source-map.json 的指针与原文摘录支持。\n` +
    `- [ ] 所有 needs-evidence 占位均未被当成事实播报。\n` +
    `- [ ] 结论边界、备注、证据边界和推理边界完整保留。\n` +
    `- [ ] 未把预审写成真实失败，未把复活候选或已复活写成商业闭环。\n` +
    `- [ ] 已核对节点许可、署名和相同方式共享要求；未把公开 URL 当成第三方素材授权。\n` +
    `- [ ] 已核对 AI 辅助生成说明；第三方水印不替代发布者自己的声明。\n` +
    `- [ ] 已阅读成本记录：零外部 API 调用不等于本地计算无成本，价格未知不等于免费。\n` +
    `- [ ] 如修改 scenes.json，已同步检查 source-map.json，并运行 validate-script。\n\n` +
    `当前机器记录的整稿状态：\`${scenes.scriptReview.status}\`。生成器不会自行把状态改为 approved。\n`;
}
