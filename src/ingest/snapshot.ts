import {FORMAT_VERSION, PARSER_VERSION} from "../config.js";
import {AppError} from "../errors.js";
import type {SourceSnapshot} from "../types.js";
import {sha256} from "../provenance/pointer.js";
import {decodeUtf8, fetchLimited, normalizeNodeUrl, readLocalFileLimited, resolveMainCommit} from "./input.js";

export interface LoadedSnapshot {
  snapshot: SourceSnapshot;
  yamlText: string;
  bytes: Buffer;
}

export interface LoadSnapshotOptions {
  input: string;
  synthetic?: boolean;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export async function loadNodeSnapshot(options: LoadSnapshotOptions): Promise<LoadedSnapshot> {
  const retrievedAt = (options.now ?? new Date()).toISOString();
  const isRemote = /^[a-z][a-z0-9+.-]*:\/\//iu.test(options.input);
  if (!isRemote) {
    const bytes = await readLocalFileLimited(options.input);
    const snapshot: SourceSnapshot = {
      sourceType: options.synthetic ? "synthetic-fixture" : "local-yaml",
      originalUrl: null,
      normalizedUrl: null,
      commit: null,
      retrievedAt,
      fileSha256: sha256(bytes),
      nodeFormatVersion: FORMAT_VERSION,
      parserVersion: PARSER_VERSION,
      license: {
        spdxId: "NOASSERTION",
        referenceUrl: null,
        notice: options.synthetic
          ? "合成 fixture 仅用于离线测试；NOASSERTION 表示本工具不为测试数据声明许可。"
          : "本地文件不会自动继承某个仓库许可；NOASSERTION 表示许可尚未由用户核验登记。公开 URL 也不等于第三方材料改编授权。",
      },
    };
    return {snapshot, yamlText: decodeUtf8(bytes), bytes};
  }

  const normalized = normalizeNodeUrl(options.input);
  const commit = normalized.ref === "main" ? await resolveMainCommit(options.fetchImpl) : normalized.ref;
  const rawUrl = `https://raw.githubusercontent.com/ResistanceYX/idea-tree/${commit}/${normalized.nodePath}`;
  const licenseUrl = `https://raw.githubusercontent.com/ResistanceYX/idea-tree/${commit}/LICENSE.md`;
  const [bytes, licenseBytes] = await Promise.all([
    fetchLimited(rawUrl, options.fetchImpl ? {fetchImpl: options.fetchImpl} : {}),
    fetchLimited(licenseUrl, options.fetchImpl ? {fetchImpl: options.fetchImpl} : {}),
  ]);
  const licenseText = decodeUtf8(licenseBytes);
  if (!licenseText.includes("Creative Commons Attribution-ShareAlike 4.0 International Public")) {
    throw new AppError("E_LICENSE_MISMATCH", "同一 commit 的 LICENSE.md 未能确认为 CC BY-SA 4.0；停止生成而不是猜测许可", licenseUrl);
  }
  const snapshot: SourceSnapshot = {
    sourceType: "github-public-node",
    originalUrl: normalized.originalUrl,
    normalizedUrl: rawUrl,
    commit,
    retrievedAt,
    fileSha256: sha256(bytes),
    nodeFormatVersion: FORMAT_VERSION,
    parserVersion: PARSER_VERSION,
    license: {
      spdxId: "CC-BY-SA-4.0",
      referenceUrl: `https://github.com/ResistanceYX/idea-tree/blob/${commit}/LICENSE.md`,
      notice: "已读取同一 commit 的 LICENSE.md 并确认 CC BY-SA 4.0；署名与相同方式共享义务仍需发布者履行，节点引用的第三方材料不因此自动获得改编授权。",
    },
  };
  return {snapshot, yamlText: decodeUtf8(bytes), bytes};
}
