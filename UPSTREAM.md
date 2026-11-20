# 上游参考与归属

本文件从 M1 第一批代码开始维护。下列 commit 是 2026-11-20 M0 本地复测快照，不是永久最新状态；M1 未整体 Fork 或拼接这些项目。

| 上游 | M0 核查基线 | 许可 | M1 使用方式 | 本地对应 |
|---|---|---|---|---|
| `ResistanceYX/idea-tree` | `main`，`3ecc35b0c00e7bfa55ce5f890f11f28587de9581` | 节点内容 CC BY-SA 4.0 | 读取 `README.md` 的节点格式 v1.9 与 `scripts/validate.py` 的实际校验规则；未逐行复制 Python，自写 TypeScript 单节点适配 | `src/node-schema/validate.ts`、合成 fixture、来源字段设计 |
| `znyupup/knowledge-explainer-skill` | `main`，`6ecae15fc8bbb589196c32ff3b726fc3e1764eac` | MIT | 只借鉴分页场景、保守画面和可编辑工程思想；M1 未复制其代码，未安装 Remotion | `Scene` 六类模板与视觉草稿 |
| `harry0703/MoneyPrinterTurbo` | `main`，`bdd8d328cc366fe70d9fa67ffd0443ba34b4a3e1` | MIT | 只借鉴任务接口、错误处理与成本记录思想；未 Fork，未移植素材、配音或 WebUI | `src/cost/`、`ScriptWriter` 接口 |
| `johnpsasser/repo-explainer` | `main`，`fab40e6802854f906de232b76afd82e9f7ab42f1` | MIT | 只借鉴“先审脚本，再决定是否进入外部阶段”的闸门；未调用 VEO 或其他付费服务 | `assertExternalStageGate`、人工审校清单 |

## 复制与修改记录

- M1 没有从上述三个相邻实现复制业务源代码，因此没有上游源文件到本地代码的逐行复制清单。
- idea-tree 的字段枚举和校验规则被转写为 TypeScript 单节点检查；省略了必须依赖完整仓库的文件名一致性、全局 ID 去重、双向关系和附件存在性检查，并对这些越界输入显式拒绝或要求上游先校验。
- 合成 fixture 是本项目的测试数据，不对应真实创业点子、真实证据或真实项目；其 `example.invalid` 链接不得访问或作为证据。
- M0 的 Remotion 4.0.545／React 19.2.5 仅是后续候选基线。M1 的 `package.json` 不含 Remotion、React、FFmpeg、浏览器或渲染二进制。
- 第三方 npm 依赖以其各自包内许可为准；精确版本由 `package-lock.json` 固定。

如后续复制任何上游代码、模板、字体、音频或其他素材，必须补充源仓库、源文件、完整 commit、版权行、许可证、修改内容和本地对应文件，不能仅写“参考”。
