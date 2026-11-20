import type {IdeaTreeNode} from "../types.js";

export function statusQualifier(node: IdeaTreeNode): string {
  return `状态边界：档案类型=${node.档案类型}；复活状态=${node.复活状态}；不代表本项目独立验收、真实复活或商业闭环。`;
}

export function boundaryQualifier(value: string): string {
  return `限定条件（结论边界）：${value}`;
}

export function noteQualifier(value: string): string {
  return `限定条件（备注）：${value}`;
}

export function deathEvidenceQualifier(index: number, value: string): string {
  return `证据边界（第${index + 1}条死法，未经本项目独立核验）：${value}`;
}

export function deathReasoningQualifier(index: number, value: string): string {
  return `推理边界（第${index + 1}条死法，仅为节点记录）：${value}`;
}

export const PARTS_QUALIFIER = "可拆零件边界：仅复述节点字段，不证明已验证收入、效果、采用或商业闭环。";
