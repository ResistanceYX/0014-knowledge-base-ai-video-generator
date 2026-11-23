# 离线复现与真实短渲染

## 环境

- Node.js 24.22.3；npm 随该 Node 版本提供。
- Remotion／`@remotion/*` 4.0.545，React／React DOM 19.2.5；全部由 `package-lock.json` 固定。
- 不需要 API Key、模型账户、配音账户或素材账户。
- 首次 `test:render`／`preview`／`render` 会由 Remotion 准备匹配的无头浏览器，需要公开网络；浏览器不提交到仓库。后续可复用本地缓存。
- 不要求用户另外安装 Chrome 或系统 FFmpeg。渲染及元数据核验使用 Remotion 自身工具链。

## 干净安装与静态／单元／集成检查

```bash
npm ci
npm run check
```

`check` 依次执行核心 TypeScript 严格检查、视频模板 TypeScript 检查、Vitest 单元／集成测试和构建。当前 M2 基线为 10 个测试文件、43 项测试；该数字是本次验收快照，不是未来提交必须冻结的上限。

## 重建合成示例

```bash
npm run example
npm run validate-script -- --project examples/synthetic-node/generated
```

预期生成 8 个场景（3 条合成死法各占一个 DeathReason 场景）、22 条逐句来源、六类可编辑组件、完整帧时间轴、VTT／SRT 字幕草稿和 `speech/none.json`。节点 YAML 的 SHA-256 应保持为：

```text
23687ce6224e91463121eca1172ef2ca82cbc693f7287dd697aa03ca0ca9e1f0
```

获取时间与本地耗时是运行记录，不要求跨机器逐值相等。`npm run example` 为重建内置示例而显式使用 `--force-components`，会覆盖示例组件；不要把它当成保留人工修改的常规物化命令。

## 自动真实渲染验收

```bash
npm run test:render
```

该命令在系统临时目录新建合成工程，不修改仓库中的示例，并依次验证：

1. `Title` 与 `EvidenceAndLimits` 各输出前 30 帧；
2. 将 8 个场景显式设为各 3 秒，以 0.25 缩放输出 720 帧／24 秒完整拼接；
3. 修改 Outro 旁白和实际组件，只输出 Outro 前 30 帧；
4. 旧完整成片与无关 Title 组件哈希不变，VTT 包含新旁白；
5. 四段 MP4 均为 H.264、30fps、320×180，时长分别为 1、1、24、1 秒，`audioCodec=null`；
6. `none` 结果无音频片段、外部调用为 0。

这些输出是**短渲染测试**，不是原始估算时长的全高清成片，也不证明配音、音画同步、人工审校或发布已经实现。不同平台的二进制视频哈希不作为跨平台一致性要求；测试核验编码、尺寸、帧率、时长、无音轨和局部重建行为。

## 手工预览与完整场景

```bash
npm run preview -- --project examples/synthetic-node/generated --scene scene-title --frame 60
npm run render -- --project examples/synthetic-node/generated --scene scene-title --frames 0-89
npm run render -- --project examples/synthetic-node/generated --scene scene-title
npm run render -- --project examples/synthetic-node/generated
```

最后两条分别是完整单场景和原始时长完整拼接，可能耗时较长。`--frames` 只输出区间，渲染报告中的 `renderedFrameCount` 与 `durationInFrames` 不会混为一谈。

## 验证人工修改流程

1. 复制 `examples/synthetic-node/generated` 到临时目录。
2. 修改临时目录的主 JSON，并同步检查来源表；组件可直接编辑。
3. 默认校验若发现 Markdown 派生视图过期，会报 `E_DERIVED_STALE`；确认修改后使用 `--refresh-derived`。
4. 用 `--scene <sceneId>` 只渲染目标场景。重复 `materialize` 默认保留组件，`--force-components` 才会覆盖。
5. 检查 `media/reports/` 的输入哈希、组合、实际帧范围、审校状态和本地耗时。

不要将真实凭证写入输入、快照、环境示例、日志或生成工程。M2 没有读取 API Key 的代码路径，也不会自动上传或发布。
