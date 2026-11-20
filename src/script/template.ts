import {SCHEMA_VERSION} from "../config.js";
import type {
  IdeaTreeNode,
  NarrationSegment,
  NodeFieldSource,
  Review,
  Scene,
  SceneDocument,
  SceneType,
  ScriptBundle,
  SourceMapEntry,
  SourceSnapshot,
  SupportStatus,
} from "../types.js";
import {source} from "../provenance/pointer.js";
import {
  PARTS_QUALIFIER,
  boundaryQualifier,
  deathEvidenceQualifier,
  deathReasoningQualifier,
  noteQualifier,
  statusQualifier,
} from "../provenance/qualifiers.js";

export interface ScriptWriter {
  readonly mode: "template" | "model";
  write(node: IdeaTreeNode, snapshot: SourceSnapshot): Promise<ScriptBundle>;
}

interface SegmentDraft extends NarrationSegment {
  supportStatus: SupportStatus;
  sources: NodeFieldSource[];
  qualifiers: string[];
  openQuestion: string | null;
}

function unreviewed(): Review {
  return {status: "unreviewed", reviewer: null, reviewedAt: null};
}

function visualText(value: string, max = 240): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function sceneDuration(segments: NarrationSegment[]): number {
  const characters = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  return Math.min(120, Math.max(3, Math.ceil(characters / 4)));
}

function makeScene(
  order: number,
  sceneId: string,
  type: SceneType,
  heading: string,
  bodyLines: string[],
  drafts: SegmentDraft[],
): {scene: Scene; entries: SourceMapEntry[]} {
  const scene: Scene = {
    sceneId,
    order,
    type,
    durationSeconds: sceneDuration(drafts),
    narrationSegments: drafts.map(({segmentId, text, kind}) => ({segmentId, text, kind})),
    visual: {heading, bodyLines: bodyLines.slice(0, 8).map((line) => visualText(line)), accentColor: "#4F46E5"},
  };
  const entries = drafts.map((draft) => ({
    segmentId: draft.segmentId,
    sceneId,
    supportStatus: draft.supportStatus,
    sources: draft.sources,
    qualifiers: draft.qualifiers,
    openQuestion: draft.openQuestion,
    review: unreviewed(),
  }));
  return {scene, entries};
}

function factual(
  segmentId: string,
  text: string,
  sources: NodeFieldSource[],
  qualifiers: string[] = [],
): SegmentDraft {
  return {segmentId, text, kind: "factual", supportStatus: "supported", sources, qualifiers, openQuestion: null};
}

function placeholder(segmentId: string, text: string, openQuestion: string): SegmentDraft {
  return {
    segmentId,
    text: `待补证：${text}`,
    kind: "placeholder",
    supportStatus: "needs-evidence",
    sources: [],
    qualifiers: ["该句是待补证占位，不得作为已证实事实播报或发布。"],
    openQuestion,
  };
}

function editorial(segmentId: string, text: string, qualifiers: string[] = []): SegmentDraft {
  return {segmentId, text, kind: "editorial", supportStatus: "not-applicable", sources: [], qualifiers, openQuestion: null};
}

export class TemplateScriptWriter implements ScriptWriter {
  readonly mode = "template" as const;

  async write(node: IdeaTreeNode, snapshot: SourceSnapshot): Promise<ScriptBundle> {
    const scenes: Scene[] = [];
    const entries: SourceMapEntry[] = [];
    const add = (result: {scene: Scene; entries: SourceMapEntry[]}): void => {
      scenes.push(result.scene);
      entries.push(...result.entries);
    };
    const boundary = typeof node.结论边界 === "string" ? node.结论边界 : null;
    const note = typeof node.备注 === "string" ? node.备注 : null;
    const stateQualifiers = [statusQualifier(node)];

    add(makeScene(1, "scene-title", "Title", node.标题, [
      `#${node.编号} · ${node.领域}／${node.子领域}`,
      `${node.档案类型} · ${node.复活状态}`,
      ...(boundary ? [boundaryQualifier(boundary)] : ["原节点未填写结论边界"]),
    ], [factual(
      "seg-title",
      `这是第 ${node.编号} 号节点《${node.标题}》。节点档案类型为${node.档案类型}，记录的复活状态为${node.复活状态}；领域为${node.领域}，子领域为${node.子领域}。`,
      [source(node, "/编号", "metadata"), source(node, "/标题", "metadata"), source(node, "/档案类型", "metadata"), source(node, "/复活状态", "metadata"), source(node, "/领域", "metadata"), source(node, "/子领域", "metadata")],
      stateQualifiers,
    )]));

    add(makeScene(2, "scene-idea", "Idea", "点子是什么", [node.一句话, "保持原始对象，不根据标题望文生义。"], [factual(
      "seg-idea",
      `节点的一句话描述是如下（原文）：${node.一句话}`,
      [source(node, "/一句话", "metadata")],
      stateQualifiers,
    )]));

    node.死法.forEach((death, index) => {
      const order = scenes.length + 1;
      const suffix = String(index + 1).padStart(2, "0");
      const reasoningPointer = typeof death.推理 === "string" ? `/死法/${index}/推理` : `/死法/${index}/分析`;
      const reasoning = death.推理 ?? death.分析 ?? "";
      const drafts: SegmentDraft[] = [
        factual(
          `seg-death-${suffix}-label`,
          `第 ${index + 1} 条死法被节点归类为${death.类型}，节点标注的置信度为${death.置信度}。`,
          [source(node, `/死法/${index}/类型`, "metadata"), source(node, `/死法/${index}/置信度`, "metadata")],
          ["分类标签和置信度均为节点记录，不把标签本身当作事实证明。"],
        ),
        factual(
          `seg-death-${suffix}-evidence`,
          `该条死法记录的证据原文是如下（原文）：${death.证据}`,
          [source(node, `/死法/${index}/证据`, "evidence")],
          [deathEvidenceQualifier(index, death.证据)],
        ),
        factual(
          `seg-death-${suffix}-reasoning`,
          `该条死法记录的推理或分析原文是如下（原文）：${reasoning}`,
          [source(node, reasoningPointer, "reasoning")],
          [deathReasoningQualifier(index, reasoning)],
        ),
      ];
      if (typeof death.案例 === "string" && death.案例.trim()) {
        drafts.push(factual(
          `seg-death-${suffix}-case`,
          `该条死法记录的案例原文是如下（原文）：${death.案例}`,
          [source(node, `/死法/${index}/案例`, "other")],
          ["案例仅按节点原文复述，未经本项目独立核验。"],
        ));
      }
      add(makeScene(order, `scene-death-${suffix}`, "DeathReason", `死法 ${index + 1}：${death.类型}`, [
        `置信度：${death.置信度}`,
        `证据：${death.证据}`,
        `推理：${reasoning}`,
        "外部证据链接未被本阶段访问；证据与推理边界见来源表。",
      ], drafts));
    });

    const evidenceDrafts: SegmentDraft[] = [];
    if (node.需求证据 && typeof node.需求证据.类型 === "string") {
      evidenceDrafts.push(factual(
        "seg-demand-type",
        `节点记录的需求证据类型是如下（原文）：${node.需求证据.类型}`,
        [source(node, "/需求证据/类型", "evidence")],
      ));
      if (typeof node.需求证据.说明 === "string" && node.需求证据.说明.trim()) {
        evidenceDrafts.push(factual(
          "seg-demand-note",
          `需求证据说明原文是如下（原文）：${node.需求证据.说明}`,
          [source(node, "/需求证据/说明", "evidence")],
        ));
      }
    } else {
      evidenceDrafts.push(placeholder("seg-demand-missing", "原节点没有可映射的需求证据类型。", "需要人工确认是否补充需求证据，或明确保留“暂无需求证据”的边界。"));
    }
    if (typeof node.商业及社会价值评估 === "string") {
      evidenceDrafts.push(factual(
        "seg-value-assessment",
        `节点的商业及社会价值评估原文是如下（原文）：${node.商业及社会价值评估}`,
        [source(node, "/商业及社会价值评估", "limit")],
        ["评估原文不等于本项目已验证商业闭环。"],
      ));
    }
    if (boundary) {
      evidenceDrafts.push(factual(
        "seg-conclusion-boundary",
        `必须保留的结论边界是如下（原文）：${boundary}`,
        [source(node, "/结论边界", "limit")],
        [boundaryQualifier(boundary), ...stateQualifiers],
      ));
    } else {
      evidenceDrafts.push(placeholder("seg-conclusion-boundary-missing", "原节点未填写结论边界，本工具不自行补写复活或结论范围。", "需要人工确认该节点是否需要补充结论边界；缺失本身不能被改写成无限定结论。"));
    }
    if (note) {
      evidenceDrafts.push(factual(
        "seg-node-note",
        `节点备注原文是如下（原文）：${note}`,
        [source(node, "/备注", "limit")],
        [noteQualifier(note)],
      ));
    }
    evidenceDrafts.push(editorial(
      "seg-evidence-scope",
      "本阶段只读取节点文本，没有访问其中的外部证据链接，也没有独立核验其真实性。",
      ["证据链接的公开可访问不等于内容真实，也不等于获得改编授权。"],
    ));
    add(makeScene(scenes.length + 1, "scene-evidence-limits", "EvidenceAndLimits", "证据与限定条件", [
      ...(boundary ? [boundaryQualifier(boundary)] : ["结论边界缺失：保留待补证标记"]),
      ...(note ? [noteQualifier(note)] : []),
      "只读取节点本身；未遍历外部证据链接。",
    ], evidenceDrafts));

    const partsDrafts: SegmentDraft[] = node.可拆零件.length > 0
      ? [factual(
          "seg-reusable-parts",
          `节点列出的可拆零件是：${node.可拆零件.join("；")}。`,
          node.可拆零件.map((_, index) => source(node, `/可拆零件/${index}`, "reusable-part")),
          [PARTS_QUALIFIER],
        )]
      : [placeholder("seg-reusable-parts-missing", "原节点的可拆零件列表为空。", "需要人工确认是否补充可拆零件，不能用工具编造零件或效果。")];
    add(makeScene(scenes.length + 1, "scene-reusable-parts", "ReusableParts", "可拆零件", [
      ...node.可拆零件,
      PARTS_QUALIFIER,
    ], partsDrafts));

    add(makeScene(scenes.length + 1, "scene-outro", "Outro", "来源、审校与纠错", [
      snapshot.normalizedUrl ?? "本地输入；无远程节点 URL",
      `快照 SHA-256：${snapshot.fileSha256}`,
      "离线模板生成 · 未经人工审核 · 不自动发布",
    ], [editorial(
      "seg-outro",
      "本脚本由离线保守模板生成，当前未经人工审核。发布前请核对原节点、逐句来源、许可和 AI 标识；本工具不自动发布。",
      ["审核状态只是记录，不能由生成器自行改为 approved。"],
    )]));

    const projectId = `${node.编号}-${node.id}`;
    const scenesDocument: SceneDocument = {
      schemaVersion: SCHEMA_VERSION,
      projectId,
      sourceSnapshot: snapshot,
      node: {
        number: node.编号,
        id: node.id,
        title: node.标题,
        archiveType: node.档案类型,
        revivalStatus: node.复活状态,
        conclusionBoundary: boundary,
      },
      video: {fps: 30, width: 1280, height: 720, aspectRatio: "16:9"},
      scenes,
      scriptReview: unreviewed(),
    };
    return {
      scenes: scenesDocument,
      sourceMap: {
        schemaVersion: SCHEMA_VERSION,
        projectId,
        sourceSnapshotSha256: snapshot.fileSha256,
        entries,
      },
    };
  }
}
