# 0014-knowledge-base-ai-video-generator

`ResistanceYX/idea-tree` #0014「开源知识库节点AI视频生成器」的独立简易实现。

当前只覆盖 **M1：规格冻结与“只出脚本”垂直切片**。它把单个 idea-tree YAML 节点转换为可编辑、可重新校验的保守旁白、分镜和逐句来源表；不包含配音、完整渲染、WebUI、批量生成或自动发布，也不代表 #0014 已完整实现。

## M1 已有能力

- 本地 YAML，以及 `ResistanceYX/idea-tree` 的 GitHub 单节点 URL；`main` 会先通过 GitHub 公开元数据固定为完整 commit。
- 保存原始／规范化 URL、commit、获取时间、SHA-256、格式版本、解析器版本与许可记录。
- 按 M0 核实的 idea-tree 节点格式 v1.9 做字段、枚举、日期、死法和证据链接结构检查；未知字段不会静默忽略。
- 无 API Key 的离线 `template` ScriptWriter，生成 `Title`、`Idea`、`DeathReason`、`EvidenceAndLimits`、`ReusableParts`、`Outro` 六类场景。
- 逐句 `segmentId`、JSON Pointer、原文摘录、限定条件、待补证问题与人工审校状态。
- 人工修改 JSON 主文件后重新校验；可显式重建 Markdown 阅读视图。
- 成本记录区分零外部 API 调用、可选服务价格未知和本地计算耗时。

## 环境与运行

要求 Node.js `24.22.3`（接受 `>=24.22.3 <25`），依赖版本见 `package.json` 与 `package-lock.json`。

```bash
npm ci
npm run check
npm run example
npm run validate-script -- --project examples/synthetic-node/generated
```

生成其他本地节点：

```bash
npm run generate -- \
  --input /path/to/0014-knowledge-base-ai-video-generator.yaml \
  --output /path/to/generated-project
```

生成固定 commit 的远程节点：

```bash
npm run generate -- \
  --input https://github.com/ResistanceYX/idea-tree/blob/3ecc35b0c00e7bfa55ce5f890f11f28587de9581/nodes/0014-knowledge-base-ai-video-generator.yaml \
  --output /path/to/generated-project
```

`--output` 非空时必须显式添加 `--force`。它只覆盖本工具已知的产物文件，不删除目录中的其他文件。合成 fixture 使用 `--synthetic`，其许可记录为 `NOASSERTION`，不会被误写成真实项目或许可证明。

## 人工修改与重校验

`scenes.json` 和 `source-map.json` 是主文件；`narration.md` 和 `source-map.md` 是派生阅读视图。

1. 人工修改 `script/scenes.json` 中的旁白或视觉草稿。
2. 同步检查 `script/source-map.json` 的来源、限定条件和审校状态。新增实质事实必须提供节点字段来源；无法定位时使用 `placeholder`＋`needs-evidence`，不得伪装成事实。
3. 先运行默认校验；若仅派生视图过期，确认 JSON 修改后再重建：

```bash
npm run validate-script -- --project /path/to/generated-project
npm run validate-script -- --project /path/to/generated-project --refresh-derived
```

生成器始终输出 `unreviewed`，不会自审自批。`approved` 必须由人工填写审核人和时间，且整稿 approved 时逐句记录也必须一致。M1 没有付费执行或发布入口。

## 输出结构

```text
generated-project/
├── source/
│   ├── node.yaml
│   └── provenance.json
├── script/
│   ├── scenes.json
│   ├── source-map.json
│   ├── narration.md
│   └── source-map.md
├── review/checklist.md
└── cost.json
```

`video` 字段只是后续渲染配置草稿，不表示 M1 已有渲染器。建议时长由文本长度估算，不是配音时长或 60—90 秒成片承诺。

## 明确边界

- M1 只读取节点本身，不访问节点内的外部证据链接，不抓取附件、论文、图片、音乐或视频。
- 含本地证据附件或非空跨节点关系的输入会被隔离；请先在完整 idea-tree 仓库做关系与附件校验。M1 不声称替代完整仓库校验。
- 远程输入只允许 HTTPS、指定 GitHub 主机和指定仓库路径；默认拒绝重定向、非默认端口、凭据、模糊版本和超限正文。
- 节点文本只作为数据解析，不执行命令、脚本、React 代码、自定义 YAML 标签或模板表达式。
- `supported` 只表示来源指针可解析且摘录存在，不表示事实已被独立核验；语义是否足以支持改写后的句子仍由人工判断。
- 本地文件默认记录 `NOASSERTION`，不会根据路径猜测许可。公开 URL 不等于第三方材料改编授权。

详见 [边界](docs/BOUNDARIES.md)、[来源与审校](docs/PROVENANCE.md)、[权利与 AI 标识](docs/RIGHTS_AND_AIGC.md)、[成本](docs/COSTS.md)、[错误码](docs/ERROR-CODES.md) 和 [复现](docs/REPRODUCE.md)。实际验证证据与未确认边界见 [M1 本地验证记录](docs/M1-VALIDATION.md)，上游参考与归属见 [UPSTREAM.md](UPSTREAM.md)。

## 许可

本仓库自写代码采用 MIT。输入节点、改编脚本、第三方依赖和未来渲染／音频素材分别保留各自许可；一个 LICENSE 不覆盖全部内容。
