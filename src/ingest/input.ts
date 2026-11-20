import {stat, readFile} from "node:fs/promises";
import path from "node:path";
import {MAX_INPUT_BYTES, INPUT_TIMEOUT_MS} from "../config.js";
import {AppError} from "../errors.js";

const OWNER = "ResistanceYX";
const REPOSITORY = "idea-tree";
const COMMIT_RE = /^[0-9a-f]{40}$/u;
const NODE_FILE_RE = /^(?!0000-)[0-9]{4}-[a-z0-9]+(?:[-_][a-z0-9]+)*\.yaml$/u;

export interface NormalizedNodeUrl {
  originalUrl: string;
  ref: string;
  nodePath: string;
  rawUrl: string;
}

export function normalizeNodeUrl(input: string): NormalizedNodeUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("E_INPUT_PATH", "远程节点输入不是有效 URL");
  }
  if (url.protocol !== "https:") {
    throw new AppError("E_INPUT_SCHEME", "远程节点只允许 HTTPS，不接受 file、http 或其他协议");
  }
  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new AppError("E_INPUT_HOST", "URL 不得包含用户名、密码、非默认端口、查询参数或片段");
  }
  if (!["github.com", "raw.githubusercontent.com"].includes(url.hostname)) {
    throw new AppError("E_INPUT_HOST", `默认只允许 GitHub 节点地址，拒绝主机 ${url.hostname}`);
  }
  if (/%[0-9a-f]{2}/iu.test(url.pathname) || url.pathname.includes("\\")) {
    throw new AppError("E_INPUT_PATH", "节点路径不接受百分号编码或反斜杠，避免路径歧义");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  let ref: string | undefined;
  let nodePath: string | undefined;
  if (url.hostname === "github.com" && parts.length === 6 && parts[2] === "blob") {
    if (parts[0] !== OWNER || parts[1] !== REPOSITORY || parts[4] !== "nodes") {
      throw new AppError("E_INPUT_HOST", "M1 只接受 ResistanceYX/idea-tree 的 nodes/ 单节点链接");
    }
    ref = parts[3];
    nodePath = parts.slice(4).join("/");
  } else if (url.hostname === "raw.githubusercontent.com" && parts.length === 5) {
    if (parts[0] !== OWNER || parts[1] !== REPOSITORY || parts[3] !== "nodes") {
      throw new AppError("E_INPUT_HOST", "M1 只接受 ResistanceYX/idea-tree 的 nodes/ 单节点链接");
    }
    ref = parts[2];
    nodePath = parts.slice(3).join("/");
  } else {
    throw new AppError("E_INPUT_PATH", "仅接受 github.com/.../blob/<ref>/nodes/<编号-id>.yaml 或对应 raw 链接");
  }
  const filename = nodePath?.split("/").at(-1) ?? "";
  if (!ref || !nodePath || !NODE_FILE_RE.test(filename)) {
    throw new AppError("E_INPUT_PATH", "节点文件名必须是 nodes/<四位编号>-<id>.yaml，且不能使用保留编号 0000");
  }
  if (ref !== "main" && !COMMIT_RE.test(ref)) {
    throw new AppError("E_INPUT_VERSION", "M1 只接受 main 或完整 40 位 commit；其他分支、标签和短哈希请先固定为 commit");
  }
  return {
    originalUrl: input,
    ref,
    nodePath,
    rawUrl: `https://raw.githubusercontent.com/${OWNER}/${REPOSITORY}/${ref}/${nodePath}`,
  };
}

export async function readLocalFileLimited(filename: string, maxBytes = MAX_INPUT_BYTES): Promise<Buffer> {
  const resolved = path.resolve(filename);
  let info;
  try {
    info = await stat(resolved);
  } catch {
    throw new AppError("E_INPUT_PATH", `本地输入不存在或不可访问：${filename}`);
  }
  if (!info.isFile()) throw new AppError("E_INPUT_PATH", "本地输入必须是普通 YAML 文件");
  if (info.size > maxBytes) {
    throw new AppError("E_INPUT_SIZE", `输入为 ${info.size} 字节，超过 ${maxBytes} 字节上限`);
  }
  const bytes = await readFile(resolved);
  if (bytes.byteLength > maxBytes) throw new AppError("E_INPUT_SIZE", "读取后输入超过大小上限");
  return bytes;
}

export async function fetchLimited(
  url: string,
  options: {maxBytes?: number; timeoutMs?: number; fetchImpl?: typeof fetch} = {},
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? MAX_INPUT_BYTES;
  const timeoutMs = options.timeoutMs ?? INPUT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {"user-agent": "0014-knowledge-base-ai-video-generator/0.1.0-m1", accept: "*/*"},
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new AppError("E_INPUT_TIMEOUT", `获取节点超过 ${timeoutMs}ms`, url);
    }
    throw new AppError("E_INPUT_NETWORK", `网络获取失败：${error instanceof Error ? error.message : String(error)}`, url);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new AppError("E_INPUT_REDIRECT", "默认不跟随远程重定向；请提供最终固定地址", url);
  }
  if (!response.ok) throw new AppError("E_INPUT_NETWORK", `远程服务器返回 HTTP ${response.status}`, url);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new AppError("E_INPUT_SIZE", "远程输入声明的大小超过上限", url);
  if (!response.body) throw new AppError("E_INPUT_NETWORK", "远程响应没有正文", url);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AppError("E_INPUT_SIZE", `远程输入超过 ${maxBytes} 字节上限`, url);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new AppError("E_INPUT_TIMEOUT", `读取远程正文超过 ${timeoutMs}ms`, url);
    }
    throw new AppError("E_INPUT_NETWORK", `读取远程正文失败：${error instanceof Error ? error.message : String(error)}`, url);
  }
  return Buffer.concat(chunks, total);
}

export async function resolveMainCommit(fetchImpl?: typeof fetch): Promise<string> {
  const url = `https://api.github.com/repos/${OWNER}/${REPOSITORY}/commits/main`;
  let bytes: Buffer;
  try {
    bytes = await fetchLimited(url, {maxBytes: 262_144, ...(fetchImpl ? {fetchImpl} : {})});
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("E_INPUT_NETWORK", "无法固定 main 的当前 commit", url);
  }
  let data: unknown;
  try {
    data = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new AppError("E_INPUT_NETWORK", "GitHub commit 响应不是有效 JSON", url);
  }
  const sha = typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>).sha
    : null;
  if (typeof sha !== "string" || !COMMIT_RE.test(sha)) {
    throw new AppError("E_INPUT_VERSION", "无法从 GitHub 响应取得唯一完整 commit；请改用固定 commit 的节点 URL", url);
  }
  return sha;
}

export function decodeUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  } catch {
    throw new AppError("E_YAML_PARSE", "输入不是有效 UTF-8 文本");
  }
}
