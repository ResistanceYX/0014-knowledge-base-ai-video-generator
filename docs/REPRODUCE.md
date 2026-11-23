# 离线复现与真实短渲染

## 环境

- Node.js 24.22.3；npm 随该 Node 版本提供。
- Remotion／`@remotion/*` 4.0.545，React／React DOM 19.2.5；全部由 `package-lock.json` 固定。
- 音频测试与音频工程需要系统 `ffprobe` 位于 `PATH`；真实重新合成另需 Python 3 和可选的 `edge-tts==7.3.1`。
- 离线检查、M2 无声渲染和 M3 fixture 音轨测试不需要 API Key、模型账户、配音账户或素材账户。
- 首次 `test:render`／`preview`／`render` 会由 Remotion 准备匹配的无头浏览器，需要公开网络；浏览器不提交到仓库。

## 干净安装与全部自动检查

```bash
npm ci
npm run check
npm run test:render
```

`check` 依次执行核心 TypeScript 严格检查、视频模板 TypeScript 检查、Vitest 单元／集成测试和构建。当前 M3 本地基线为 12 个测试文件、50 项测试；该数字是本次验收快照，不是未来提交必须冻结的上限。

`test:render` 在系统临时目录新建工程，不修改仓库中的示例，也不访问真实配音服务，依次验证：

1. M2 的 `Title` 与 `EvidenceAndLimits` 各输出前 30 帧；
2. M2 将 8 个场景显式设为各 3 秒，以 0.25 缩放输出 720 帧／24 秒完整短拼接；
3. 修改 Outro 旁白和实际组件，只输出 Outro 前 30 帧，旧完整成片与无关组件哈希不变；
4. M2 四段 MP4 均为 H.264、30fps、320×180，`audioCodec=null`，`none` 外部调用为 0；
5. M3 用 22 段本地音调生成 162 帧／5.4 秒完整 MP4，再局部重建 Title 的前 8 帧；
6. M3 两段 MP4 均为 H.264＋AAC，真实音轨存在，MP4 标准标题和评论包含 AI 声明，渲染与局部重建次数进入成本记录。

不同平台的二进制视频哈希不作为跨平台一致性要求。短渲染不冒充完整全高清样片，fixture 也不证明真实语音自然度或术语读音。

## 重建 M2 无声示例

```bash
npm run example
npm run validate-script -- --project examples/synthetic-node/generated
```

预期生成 8 个场景、22 条逐句来源、六类可编辑组件、VTT／SRT 字幕草稿和 `speech/none.json`。节点 YAML 的 SHA-256 为：

```text
23687ce6224e91463121eca1172ef2ca82cbc693f7287dd697aa03ca0ca9e1f0
```

`npm run example` 为重建内置示例而显式使用 `--force-components`，不要把它当成保留人工修改的常规物化命令。

## 复用 M3 示例音频离线渲染

`examples/synthetic-node-m3/generated` 保存了 8 段实际生成的 MP3、对应清单和真实音频时间轴。因此无需再次访问 Edge，即可验证真实音轨渲染：

```bash
npm run materialize -- --project examples/synthetic-node-m3/generated
npm run render -- \
  --project examples/synthetic-node-m3/generated \
  --scene scene-title \
  --frames 0-29 \
  --output /tmp/0014-m3-title.mp4
```

完整工程是 85.233 秒、1280×720、30fps 的合成候选样片；完整重渲染可能耗时较长。示例的 `cost.json` 是本次实际制作记录，重复运行会在其上继续累计，不应把后续累计值冒充首次样片成本。

如果要有意重新合成，先单独准备 `edge-tts==7.3.1`，再显式运行：

```bash
npm run speech -- \
  --project examples/synthetic-node-m3/generated \
  --allow-synthetic-unreviewed
```

外部服务的未来可用性和输出可能变化，不承诺跨时间生成相同音频字节。未变化的现有片段会优先复用；`--force` 是明确的重新生成操作。

## 验证人工修改流程

1. 复制示例到临时目录，修改主 JSON 并同步检查来源表；组件可直接编辑。
2. 默认校验若发现派生视图过期，会报 `E_DERIVED_STALE`；确认修改后使用 `--refresh-derived`。
3. 修改术语后重新运行 `speech`；修改字幕覆盖或替换音频后运行 `materialize`。
4. 用 `--scene <sceneId>` 只渲染目标场景。重复 `materialize` 默认保留组件，`--force-components` 才会覆盖。
5. 检查 `media/reports/` 的输入哈希、组合、实际帧范围、审校状态、音轨信息和本地耗时。
6. 运行 `publish-check` 查看未完成的审校与人工清单；不要把 `ready` 解释为已经发布。

不要将真实凭证写入输入、快照、环境示例、日志或生成工程。工具不会自动上传或发布。
