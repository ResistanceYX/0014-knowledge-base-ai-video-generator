# 错误码（M2 0.2.0）

CLI 以非零退出状态表示失败，并输出首要错误码；节点校验可附带多个字段级问题。

| 类别 | 错误码 | 含义 |
|---|---|---|
| 输入协议与路径 | `E_INPUT_SCHEME` | 非 HTTPS 或不允许的协议 |
| 输入主机 | `E_INPUT_HOST` | 非白名单主机／仓库、URL 凭据、非默认端口等 |
| 输入路径 | `E_INPUT_PATH` | 本地文件不可读、节点路径或文件名不符合范围、CLI 参数缺失 |
| 输入版本 | `E_INPUT_VERSION` | 版本不是 main 或完整 commit，或无法固定 commit |
| 重定向 | `E_INPUT_REDIRECT` | 默认拒绝远程重定向 |
| 大小 | `E_INPUT_SIZE` | 本地或远程输入超过限制 |
| 超时 | `E_INPUT_TIMEOUT` | 请求或正文读取超时 |
| 网络 | `E_INPUT_NETWORK` | HTTP、网络或响应正文错误；不等于目标资源不存在 |
| 许可 | `E_LICENSE_MISMATCH` | 同 commit 的 LICENSE.md 不能确认为预期许可 |
| 输出 | `E_OUTPUT_EXISTS` | 非空目录未显式允许覆盖，或输出路径不安全 |
| YAML | `E_YAML_PARSE` | 语法、重复键、自定义标签、UTF-8 或别名展开问题 |
| 节点结构 | `E_NODE_SCHEMA` | v1.9 必填字段、枚举、日期、死法或链接规则失败 |
| 节点范围 | `E_NODE_SCOPE` | 附件、本地证据或非空关系超出单节点范围 |
| 节点规模 | `E_NODE_LIMIT` | 超过当前场景容量等实现限制，不等于上游格式无效 |
| JSON | `E_JSON_PARSE` | 生成工程中的 JSON 无法解析 |
| Scene 结构 | `E_SCENE_SCHEMA` | Scene JSON Schema 失败 |
| Scene 语义 | `E_SCENE_SEMANTICS` | ID、顺序、项目或节点摘要不一致 |
| 来源结构 | `E_SOURCE_SCHEMA` | SourceMap JSON Schema 失败 |
| 来源悬空 | `E_SOURCE_ORPHAN` | segmentId 不存在或 scene 归属不一致 |
| 来源覆盖 | `E_SOURCE_COVERAGE` | 漏句、重复映射或 kind／支持状态冲突 |
| 来源指针 | `E_SOURCE_POINTER` | JSON Pointer 非法或目标不存在 |
| 来源摘录 | `E_SOURCE_EXCERPT` | 目标非标量，或摘录不在原文中 |
| 快照 | `E_SOURCE_SNAPSHOT` | YAML、Scene、SourceMap、成本或许可快照不一致 |
| 限定条件 | `E_LIMIT_DROPPED` | 结论边界、备注、证据／推理边界等被删除 |
| 审校闸门 | `E_REVIEW_REQUIRED` | approved 缺逐句一致性，或外部阶段前审校不完整 |
| 付费闸门 | `E_PAID_GATE` | 预留给显式付费边界；M2 没有付费执行入口 |
| 派生视图 | `E_DERIVED_STALE` | Markdown 阅读视图与 JSON 主文件不一致 |
| 媒体配置 | `E_MEDIA_CONFIG` | 媒体配置字段、版本、并发、CRF、缩放或时间轴无效 |
| 配音模式 | `E_SPEECH_MODE` | 请求了 M2 尚未实现的配音模式；当前只允许 none |
| 组合选择 | `E_COMPOSITION` | 指定 sceneId／compositionId 不在当前媒体计划中 |
| 浏览器 | `E_BROWSER` | Remotion 无头浏览器缺失或版本不匹配 |
| 渲染 | `E_RENDER` | 帧号／帧区间、输出路径、打包或 Remotion 实际渲染失败 |
