# 来源映射与人工审校

## 三层校验

1. **JSON Schema**：检查字段、枚举、长度、画幅、来源数组和 approved 的审核人／时间。
2. **结构语义**：检查 sceneId／segmentId 唯一且连续，逐句映射恰好覆盖，scene 归属一致，快照哈希一致。
3. **节点回溯**：解析 JSON Pointer，确认摘录存在于目标标量字段，并检查结论边界、备注、证据边界和推理边界是否保留。

这三层仍不等于事实核验。`supported` 的准确含义是“有可供人工检查的定位与摘录”，不是“内容为真”或“外部证据已访问”。

## 支持状态与段落类型

| 段落 kind | 允许的 supportStatus | 含义 |
|---|---|---|
| `factual` | `supported`／`partially-supported` | 实质性陈述，必须有至少一个节点字段来源；部分支持还需开放问题 |
| `placeholder` | `needs-evidence` | 待补证占位，无来源，必须有开放问题，不得当成事实发布 |
| `transition`／`editorial` | `not-applicable` | 转场或制作过程说明，不承载节点事实 |

把 factual 的来源数组清空、给 factual 标 needs-evidence、给 placeholder 标 supported，都会失败。

## 限定条件

离线模板将以下字符串写入来源条目的 `qualifiers`，校验器按完整值检查：

- 档案类型与复活状态边界；
- 节点 `结论边界` 与 `备注`；
- 每条死法的证据原文边界和推理／分析边界；
- 可拆零件不等于已验证效果、收入、采用或商业闭环。

缺少结论边界时，模板不会补编，而是生成 needs-evidence 占位。删除该占位也会触发限定条件错误。

## 非空关系与上游校验证据

单节点解析器默认不验证跨节点双向关系，因此非空 `相关节点` 会触发 `E_NODE_SCOPE`。若固定 commit 的完整母仓库已经通过 G01／G02，可通过 `generate --upstream-validation <证据JSON>` 提供证据。证据必须绑定同一 repository 和 commit，完整记录两条命令、UTC 校验时间、原始日志、日志 SHA-256 和成功标记；生成工程时会把它写入 `source/provenance.json` 与 Scene 快照，后续 `validate-script` 会重新核对。

该机制只解除“关系尚未在完整仓库检查”的范围限制，其他节点字段校验不受影响。哈希只能发现记录内部不一致，不能证明日志由上游签名或外部事实为真；节点引用的事实和每句旁白仍需人工审校。

## 审校状态

- `unreviewed`：机器生成后的唯一默认状态。
- `changes-requested`：人工要求修改。
- `approved`：必须有非空 reviewer 和有效 reviewedAt；整稿 approved 时所有逐句条目也必须 approved。

生成器没有把自己设为 approved 的代码路径。外部阶段闸门还要求整稿和逐句审校都完成，但 M1 本身没有付费或发布命令。

## 人工编辑协议

主文件是 `script/scenes.json` 与 `script/source-map.json`。Markdown 文件是派生视图，不是第二套真相来源。修改 JSON 后运行默认校验；确认修改无误时使用 `--refresh-derived` 重建阅读视图。该选项只重建 Markdown，不修改来源、审校状态或审核人。
