import {parseDocument} from "yaml";
import {AppError, issue, type ValidationIssue} from "../errors.js";
import type {IdeaTreeNode} from "../types.js";

const DEATH_TYPES = new Set(["伪需求", "钱算不平", "巨头碾压", "政策风险", "季节魔咒", "冷启动死锁", "信任成本", "条件已死", "执行人限制", "理论证伪"]);
const REVIVAL_STATUSES = new Set(["死透", "复活候选", "已复活"]);
const INNOVATION_TYPES = new Set(["渐进式", "突破式", "破坏式", "技术应用", "理论创新"]);
const ARCHIVE_TYPES = new Set(["预审", "验尸"]);
const BUDGETS = new Set(["低", "中", "高"]);
const CONFIDENCE_LEVELS = new Set(["高", "中", "低"]);
const REQUIRED_TOP_FIELDS = ["编号", "id", "标题", "档案类型", "一句话", "复活状态", "创新类型", "领域", "子领域", "死法", "可拆零件", "死因保质期", "起草AI", "审核人", "审核日期"] as const;
const ALLOWED_TOP_FIELDS = new Set<string>([...REQUIRED_TOP_FIELDS, "重启预算", "需求证据", "商业及社会价值评估", "相关节点", "备注", "结论边界"]);
const ALLOWED_DEATH_FIELDS = new Set(["类型", "证据", "推理", "分析", "案例", "证据链接", "置信度", "备注"]);
const NORMAL_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DERIVED_ID_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/u;
const PURE_INTERNAL_EVIDENCE = new Set(["创始人自我分析", "内部推演", "内部推理", "逻辑推理", "纯内部推演"]);
const EVIDENCE_PATH_RE = /evidence\/[A-Za-z0-9._-]+/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || value.startsWith("0000-")) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  const month = result.getUTCMonth();
  result.setUTCFullYear(result.getUTCFullYear() + years);
  if (result.getUTCMonth() !== month) result.setUTCDate(0);
  return result;
}

function push(issues: ValidationIssue[], location: string, message: string, code: "E_NODE_SCHEMA" | "E_NODE_SCOPE" | "E_NODE_LIMIT" = "E_NODE_SCHEMA"): void {
  issues.push(issue(code, location, message));
}

export function parseAndValidateNode(yamlText: string): IdeaTreeNode {
  let data: unknown;
  try {
    const document = parseDocument(yamlText, {schema: "core", strict: true, uniqueKeys: true});
    if (document.errors.length > 0 || document.warnings.length > 0) {
      const diagnostic = [...document.errors, ...document.warnings][0]!;
      throw new Error(diagnostic.message);
    }
    data = document.toJS({maxAliasCount: 100});
  } catch (error) {
    throw new AppError("E_YAML_PARSE", `YAML 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(data)) throw new AppError("E_NODE_SCHEMA", "节点顶层必须是映射", "/");

  const issues: ValidationIssue[] = [];
  for (const field of REQUIRED_TOP_FIELDS) {
    if (!Object.hasOwn(data, field)) push(issues, "/", `缺少必选字段 ${field}`);
  }
  for (const field of Object.keys(data)) {
    if (!ALLOWED_TOP_FIELDS.has(field)) push(issues, `/${field}`, `存在节点格式未定义的顶层字段 ${field}`);
  }

  if (typeof data.编号 !== "string" || !/^[0-9]{4}$/u.test(data.编号) || data.编号 === "0000") {
    push(issues, "/编号", "编号必须是四位数字字符串，且 0000 永久保留");
  }
  if (!nonempty(data.id) || !DERIVED_ID_RE.test(data.id) || (!data.id.includes("_") && !NORMAL_ID_RE.test(data.id))) {
    push(issues, "/id", "id 必须使用小写英文、数字、连字符及合法派生下划线");
  }
  for (const field of ["标题", "一句话", "领域", "子领域", "起草AI", "审核人"] as const) {
    if (Object.hasOwn(data, field) && !nonempty(data[field])) push(issues, `/${field}`, `${field} 必须是非空字符串`);
  }
  if (typeof data.档案类型 !== "string" || !ARCHIVE_TYPES.has(data.档案类型)) push(issues, "/档案类型", "档案类型必须是预审或验尸");
  const status = data.复活状态;
  if (typeof status !== "string" || !REVIVAL_STATUSES.has(status)) push(issues, "/复活状态", "复活状态枚举错误");
  if (Object.hasOwn(data, "重启预算") && (typeof data.重启预算 !== "string" || !BUDGETS.has(data.重启预算))) {
    push(issues, "/重启预算", "重启预算必须是低、中或高");
  }
  if (!Array.isArray(data.创新类型) || data.创新类型.length === 0 || data.创新类型.some((item) => typeof item !== "string" || !INNOVATION_TYPES.has(item))) {
    push(issues, "/创新类型", "创新类型必须是非空合法字符串数组");
  }
  if (!Array.isArray(data.可拆零件) || data.可拆零件.some((item) => !nonempty(item))) {
    push(issues, "/可拆零件", "可拆零件必须是字符串数组，且条目非空");
  }
  const assessment = data.商业及社会价值评估;
  if ((status === "复活候选" || status === "已复活") && !nonempty(assessment)) {
    push(issues, "/商业及社会价值评估", "复活候选与已复活节点必须填写商业及社会价值评估");
  }
  if (assessment !== undefined && !nonempty(assessment)) push(issues, "/商业及社会价值评估", "如填写则必须是非空字符串");
  if (data.结论边界 !== undefined && !nonempty(data.结论边界)) push(issues, "/结论边界", "如填写则必须是非空字符串");

  if (data.需求证据 !== undefined) {
    if (!isRecord(data.需求证据) || !nonempty(data.需求证据.类型)) {
      push(issues, "/需求证据", "需求证据必须是映射，并包含非空类型");
    } else if (Object.hasOwn(data.需求证据, "附件") && data.需求证据.附件 !== "无") {
      push(issues, "/需求证据/附件", "M1 不读取附件；含附件的节点请先在完整 idea-tree 仓库校验，再提供无附件快照", "E_NODE_SCOPE");
    }
  }
  const relations = data.相关节点;
  if (relations !== undefined && relations !== null && (!Array.isArray(relations) || relations.length > 0)) {
    push(issues, "/相关节点", "M1 单节点模式不验证跨节点双向关系；非空相关节点需先在完整 idea-tree 仓库校验", "E_NODE_SCOPE");
  }

  const review = parseDate(data.审核日期);
  const expiry = parseDate(data.死因保质期);
  if (!review) push(issues, "/审核日期", "审核日期必须是有效的 YYYY-MM-DD 日期");
  if (!expiry) push(issues, "/死因保质期", "死因保质期必须是有效的 YYYY-MM-DD 日期");
  if (review && expiry) {
    if (expiry < review) push(issues, "/死因保质期", "死因保质期不得早于审核日期");
    if (expiry > addYears(review, 5)) push(issues, "/死因保质期", "死因保质期不得晚于审核日期起五年");
    if (expiry > addYears(review, 3) && !nonempty(data.备注)) push(issues, "/备注", "死因保质期晚于审核日期起三年时必须备注原因");
  }

  const deaths = data.死法;
  if (!Array.isArray(deaths) || deaths.length === 0) {
    push(issues, "/死法", "死法必须是非空数组");
  } else {
    if (deaths.length > 27) push(issues, "/死法", "M1 Scene Schema 最多容纳 27 条死法；更大节点需后续拆场实现", "E_NODE_LIMIT");
    const linkCounts = new Map<string, number>();
    deaths.forEach((death, index) => {
      const location = `/死法/${index}`;
      if (!isRecord(death)) {
        push(issues, location, "死法条目必须是映射");
        return;
      }
      for (const field of Object.keys(death)) {
        if (!ALLOWED_DEATH_FIELDS.has(field)) push(issues, `${location}/${field}`, `存在未定义字段 ${field}`);
      }
      if (typeof death.类型 !== "string" || !DEATH_TYPES.has(death.类型)) push(issues, `${location}/类型`, "死法类型不在分类法中");
      const evidence = death.证据;
      if (!nonempty(evidence)) push(issues, `${location}/证据`, "缺少非空证据");
      if (typeof death.置信度 !== "string" || !CONFIDENCE_LEVELS.has(death.置信度)) push(issues, `${location}/置信度`, "置信度必须是高、中或低");
      if (evidence === "创始人自我分析") {
        if (!nonempty(death.推理) && !nonempty(death.分析)) push(issues, location, "创始人自我分析必须包含推理或分析");
      } else if (!nonempty(death.推理)) {
        push(issues, `${location}/推理`, "非创始人自我分析的死法必须包含推理");
      }
      const rawLinks: unknown = death.证据链接;
      let links: unknown[] = [];
      if (rawLinks !== undefined && rawLinks !== null) {
        if (!Array.isArray(rawLinks) || rawLinks.some((item) => !nonempty(item))) {
          push(issues, `${location}/证据链接`, "证据链接必须是字符串数组");
        } else {
          links = rawLinks;
        }
      }
      if (links.length > 16) push(issues, `${location}/证据链接`, "单条死法的证据链接不得超过 16 个");
      if (links.length > 8 && !nonempty(death.备注)) push(issues, `${location}/备注`, "超过 8 个证据链接时必须备注原因");
      if (death.置信度 === "高") {
        if (new Set(links).size < 2) push(issues, `${location}/证据链接`, "高置信度至少需要两个不同证据链接");
        if (typeof evidence === "string" && PURE_INTERNAL_EVIDENCE.has(evidence)) push(issues, `${location}/证据`, "纯内部推演不得标为高置信度");
      }
      if (links.length === 0 && typeof evidence === "string" && (evidence.includes("公开") || evidence.includes("过往案例"))) {
        push(issues, `${location}/证据链接`, "声明公开案例或公开证据时必须挂证据链接");
      }
      for (const link of links) {
        if (typeof link !== "string") continue;
        linkCounts.set(link, (linkCounts.get(link) ?? 0) + 1);
        try {
          const parsed = new URL(link);
          if (!["http:", "https:"].includes(parsed.protocol) || !parsed.host) throw new Error("invalid");
          const lowered = `${parsed.pathname}?${parsed.search}`.toLowerCase();
          if (lowered.endsWith(".pdf") || lowered.includes("/download/") || lowered.includes("download=")) {
            push(issues, `${location}/证据链接`, `不得使用 PDF 直链或下载接口：${link}`);
          }
        } catch {
          push(issues, `${location}/证据链接`, `证据链接格式异常：${link}`);
        }
      }
    });
    const reuseLimit = deaths.length - 2;
    for (const [link, count] of linkCounts) {
      if (count > reuseLimit) push(issues, "/死法", `链接 ${link} 复用 ${count} 次，超过 n-2=${reuseLimit}`);
    }
  }

  for (const match of yamlText.matchAll(EVIDENCE_PATH_RE)) {
    push(issues, "/", `正文引用本地证据 ${match[0]}；M1 不读取附件，请先在完整 idea-tree 仓库校验`, "E_NODE_SCOPE");
  }
  if (issues.length > 0) {
    const first = issues[0]!;
    throw new AppError(first.code, `节点校验发现 ${issues.length} 个问题；首项：${first.message}`, first.location, issues);
  }
  return data as IdeaTreeNode;
}
