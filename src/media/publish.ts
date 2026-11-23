import path from "node:path";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import type {MediaPlan, SceneDocument} from "../types.js";

export interface PublishCheck {
  id: string;
  passed: boolean;
  detail: string;
}
export interface PublishStatus {
  schemaVersion: "0.3.0";
  ready: boolean;
  checks: PublishCheck[];
  note: string;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function write(project: string, relative: string, contents: string): Promise<void> {
  const filename = path.join(path.resolve(project), relative);
  await mkdir(path.dirname(filename), {recursive: true});
  await writeFile(filename, contents, "utf8");
}

async function writeIfMissing(project: string, relative: string, contents: string): Promise<void> {
  const filename = path.join(path.resolve(project), relative);
  await mkdir(path.dirname(filename), {recursive: true});
  try {
    await writeFile(filename, contents, {encoding: "utf8", flag: "wx"});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export function buildVideoMetadata(document: SceneDocument, plan: MediaPlan): Record<string, string> {
  return {
    title: `#${document.node.number} ${document.node.title}（AI 本地候选草稿）`,
    artist: "idea-tree #0014 evidence-video tool; human review required",
    comment: `AI-generated local draft. Review=${document.scriptReview.status}. Speech=${plan.speech.mode}. No automatic publication.`,
    description: `Source node=${document.sourceSnapshot.normalizedUrl ?? document.sourceSnapshot.sourceType}; snapshot=${document.sourceSnapshot.fileSha256}; evidence and limits remain subject to human review.`,
    copyright: `Node license=${document.sourceSnapshot.license.spdxId}; voice and service rights are separately recorded; NOASSERTION where applicable.`,
    genre: "Knowledge-base evidence explainer draft",
    ai_generated: "true",
    automatic_publication: "false",
  };
}

export async function writePublishArtifacts(options: {project: string; document: SceneDocument; plan: MediaPlan}): Promise<void> {
  const {project, document, plan} = options;
  const metadata = buildVideoMetadata(document, plan);
  const source = document.sourceSnapshot.normalizedUrl ?? `本地／合成输入：${document.sourceSnapshot.sourceType}`;
  await write(project, "media/metadata.json", json({schemaVersion: "0.3.0", container: "mp4", values: metadata}));
  await write(project, "publish/ai-disclosure.json", json({
    schemaVersion: "0.3.0",
    aiGenerated: true,
    aiSystems: ["离线模板脚本", "程序化 Remotion 画面", plan.speech.mode === "edge-tts" ? "Edge TTS 配音" : plan.speech.mode === "fixture" ? "本地音调 fixture（非真实配音）" : "无配音"],
    humanReview: document.scriptReview,
    sourceNode: source,
    sourceSnapshotSha256: document.sourceSnapshot.fileSha256,
    speechMode: plan.speech.mode,
    voiceRightsStatus: plan.speech.mode === "edge-tts" ? "unknown" : "not-applicable",
    automaticPublication: false,
    note: "画面标识、MP4 元数据与平台作者声明分别提供；第三方服务已有标识不等于完成本项目全部审校或权利义务。",
  }));
  await write(project, "publish/description.md", `# #${document.node.number} ${document.node.title}\n\n` +
    `本视频由 idea-tree #0014 独立简易实现生成，包含 AI／程序化生成内容，当前审校状态为 **${document.scriptReview.status}**。\n\n` +
    `- 原节点：${source}\n` +
    `- 节点快照 SHA-256：\`${document.sourceSnapshot.fileSha256}\`\n` +
    `- 配音模式：\`${plan.speech.mode}\`\n` +
    `- 来源与限定条件：见工程 \`script/source-map.json\` 与各场景画面。\n` +
    `- 权利边界：节点许可为 \`${document.sourceSnapshot.license.spdxId}\`；声音与在线服务条款另见 \`audio/rights.json\`，不作已获商用授权的承诺。\n` +
    `- 纠错入口：请在原 idea-tree 项目中指出具体节点字段、时间点和理由；本工具不会自动发布或自动修改公开记录。\n`);
  await write(project, "audio/rights.json", json({
    schemaVersion: "0.3.0",
    speechMode: plan.speech.mode,
    voice: plan.speech.mode === "edge-tts" ? "由 video/config.json 选择的 Edge TTS 预设声音" : null,
    dependency: plan.speech.mode === "edge-tts" ? {name: "edge-tts", version: "7.3.1", license: "LGPL-3.0", distribution: "optional Python dependency; not bundled in this repository"} : null,
    serviceTerms: plan.speech.mode === "edge-tts" ? {status: "unknown", commercialUseApproved: false, note: "Edge 在线朗读接口不是本项目自有服务；无 API Key 不等于确认免费、可商用或可持续使用。发布者须另行核对微软服务条款与声音使用边界。"} : {status: "not-applicable", commercialUseApproved: false, note: "无真实在线声音服务。"},
    thirdPartyMusic: [],
    thirdPartyFootage: [],
    note: "示例仅使用合成文本、程序化画面和明确登记的音频；不自动抓取第三方素材。",
  }));
  await writeIfMissing(project, "review/publish-checklist.md", "# 发布前人工检查清单\n\n" +
    "以下项目不会由工具替人勾选。全部完成前，`publish-check` 不得给出 ready。\n\n" +
    "- [ ] 已人工完整审校旁白和每条 source-map 记录，保留证据边界与限定条件。\n" +
    "- [ ] 已实际看过候选画面，检查文字遮挡、画幅、事实限定和场景顺序。\n" +
    "- [ ] 已实际听过配音，检查术语读音、可懂度、音画场景同步；none／fixture 不得冒充真实配音验收。\n" +
    "- [ ] 已核对代码、模板、字体、声音、在线服务条款和第三方素材权利。\n" +
    "- [ ] 已核对画面 AI 标识、MP4 元数据、平台作者声明和原节点链接。\n" +
    "- [ ] 已核对 cost.json 中的外部调用、未知价格、重试、局部重建、耗时和人工修改轮次。\n" +
    "- [ ] 已确认发布账号、平台要求与纠错入口，并由人类自行决定是否发布。\n");
}

async function exists(project: string, relative: string): Promise<boolean> {
  try {
    await readFile(path.join(path.resolve(project), relative));
    return true;
  } catch {
    return false;
  }
}

export async function checkPublishReadiness(projectInput: string): Promise<PublishStatus & {statusPath: string}> {
  const project = path.resolve(projectInput);
  const document = JSON.parse(await readFile(path.join(project, "script", "scenes.json"), "utf8")) as SceneDocument;
  const sourceMap = JSON.parse(await readFile(path.join(project, "script", "source-map.json"), "utf8")) as {entries: Array<{review: {status: string; reviewer: string | null; reviewedAt: string | null}}>};
  const checklist = await readFile(path.join(project, "review", "publish-checklist.md"), "utf8").catch(() => "");
  const cost = JSON.parse(await readFile(path.join(project, "cost.json"), "utf8")) as {media?: unknown};
  const plan = JSON.parse(await readFile(path.join(project, "media", "plan.json"), "utf8")) as MediaPlan;
  const approved = document.scriptReview.status === "approved" && Boolean(document.scriptReview.reviewer && document.scriptReview.reviewedAt);
  const entriesApproved = sourceMap.entries.every((entry) => entry.review.status === "approved" && entry.review.reviewer && entry.review.reviewedAt);
  const unchecked = (checklist.match(/- \[ \]/g) ?? []).length;
  const checked = (checklist.match(/- \[[xX]\]/g) ?? []).length;
  const checklistComplete = checklist.length > 0 && unchecked === 0 && checked >= 7;
  const checks: PublishCheck[] = [
    {id: "script-approved", passed: approved, detail: approved ? "整稿已由人工批准" : "整稿尚未由人工完整批准"},
    {id: "source-entries-approved", passed: entriesApproved, detail: entriesApproved ? "逐句来源均已批准" : "仍有逐句来源未批准"},
    {id: "human-checklist", passed: checklistComplete, detail: checklistComplete ? "人工清单的 7 项均已勾选" : checklist.length === 0 ? "人工清单缺失" : `清单未完整：${unchecked} 项未勾选，${checked} 项已勾选`},
    {id: "ai-disclosure", passed: await exists(project, "publish/ai-disclosure.json"), detail: "AI 显式声明文件"},
    {id: "metadata", passed: await exists(project, "media/metadata.json"), detail: "MP4 元数据映射"},
    {id: "description", passed: await exists(project, "publish/description.md"), detail: "平台作者声明模板"},
    {id: "rights", passed: await exists(project, "audio/rights.json"), detail: "声音与素材权利记录"},
    {id: "media-cost", passed: plan.speech.mode === "none" || cost.media !== undefined, detail: "媒体成本记录"},
  ];
  const status: PublishStatus = {
    schemaVersion: "0.3.0",
    ready: checks.every((check) => check.passed),
    checks,
    note: "ready 只表示本地发布前检查通过，不代表已经上传、发布、获得授权或完成 M4／M5。",
  };
  const statusPath = path.join(project, "review", "publish-status.json");
  await mkdir(path.dirname(statusPath), {recursive: true});
  await writeFile(statusPath, json(status), "utf8");
  return {...status, statusPath};
}
