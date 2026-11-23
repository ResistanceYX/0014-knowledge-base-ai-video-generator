# M2 本地验证记录（2026-11-20）

> 本记录是当前本地草案的验收快照，不表示用户已上传、GitHub Actions 已运行或 #0014 已完整实现。M1 上传前记录继续保留在 `M1-VALIDATION.md`；M2 云端状态须在用户上传后另做复核。

## 1. 实际基线

- Node.js 24.22.3；TypeScript 7.0.2；Vitest 5.1.1。
- `remotion`、`@remotion/bundler`、`@remotion/renderer` 均为 4.0.545；React／React DOM 19.2.5。
- 画面 1280×720、30fps；自动短拼接测试为控制资源使用 0.25 缩放，输出 320×180。
- 合成 fixture：8 个场景、22 条逐句来源；原始估算时间轴 7590 帧，即约 253 秒。

## 2. 两个短场景先行验收

在扩展完整测试前，先对原始合成工程执行：

```bash
npm run render -- --project examples/synthetic-node/generated --scene scene-title --frames 0-89
npm run render -- --project examples/synthetic-node/generated --scene scene-evidence-limits --frames 0-89
npm run preview -- --project examples/synthetic-node/generated --scene scene-title --frame 60
npm run preview -- --project examples/synthetic-node/generated --scene scene-evidence-limits --frame 120
```

实际结果：

| 场景 | 编码／画幅 | 实际输出 | 组合总长 | 抽帧检查 |
|---|---|---:|---:|---|
| Title | H.264，1280×720，30fps | 90 帧／3 秒 | 540 帧 | 标题、编号、预审／复活状态、结论边界、旁白和字段来源可读 |
| EvidenceAndLimits | H.264，1280×720，30fps | 90 帧／3 秒 | 2340 帧 | 证据与限定条件双栏可读；来源状态、额外条目计数、完整来源表指引存在 |

两段均只有视频流，无音频流。这里只输出各场景前 90 帧，不能称为完整 Title 或完整 EvidenceAndLimits 场景。

## 3. 六类模板与完整短拼接

- 对 Title、Idea、3 个 DeathReason、EvidenceAndLimits、ReusableParts、Outro 全部生成过 1280×720 PNG 检查帧。
- 人工查看未发现文字互相遮挡、来源页脚消失或限定条件栏被覆盖。画面只展示有限条摘要，并显示剩余数量及完整来源表位置；全部数据仍在 JSON 中。
- 另建临时短测试工程，将 8 个场景显式改为各 3 秒，以 0.25 缩放渲染完整组合。
- 实际输出：H.264、320×180、30fps、720 帧、24.000 秒，无音频流；文件大小 103562 字节，SHA-256：

```text
7448c497df372fceda7166a88da9869a733697df9c538494296452a18497af3d
```

- 在帧 45、135、225、315、405、495、585、675 抽帧，顺序与八场景计划一致。

该完整拼接是降低 CI 成本的短测试，**没有**声称完成原始 253 秒估算时间轴的全高清成片渲染。

## 4. 局部重建实测

在临时短测试工程中：

1. 仅修改 Outro 的 editorial 旁白，加入明确测试标记；
2. 将实际参与渲染的 `video/components/Outro.tsx` kicker 改为 `LOCAL REBUILD / 局部重建已生效`；
3. 只执行 `render --scene scene-outro --refresh-derived`；
4. 输出 90 帧／3 秒、1280×720 MP4，抽帧同时看到新组件文字和新旁白；
5. VTT 包含新旁白；旧完整 MP4 与无关 Title 组件的 SHA-256 均保持不变。

因此“可编辑组件”与“单场景局部重建”均经过真实画面验证，不是只复制源码或只更新 JSON。

## 5. 自动测试与 CI

`npm run check` 当前结果：10 个测试文件、43 项测试全部通过，随后构建成功。覆盖：

- M1 原有输入、Schema、来源、许可、成本和人工修改回归；
- 场景与逐句时间轴连续、非零、完整覆盖；
- VTT／SRT 各 22 条 cue，字幕标记转义；
- `none` 适配器无音频片段、零外部调用，其他配音模式拒绝；
- 媒体配置范围、静帧／视频帧参数互斥；
- 六类组件真实引用、重复物化默认保留组件、显式强制覆盖；
- 单场景旁白修改后来源修订哈希和字幕更新。

`npm run test:render` 自动在临时目录重复以下真实渲染：

- Title 与 EvidenceAndLimits 各 30 帧；
- 8 场景、720 帧／24 秒完整短拼接；
- Outro 旁白＋组件局部重建 30 帧；
- 四段视频均核验 H.264、30fps、320×180、无音轨，时长分别为 1、1、24、1 秒；
- 旧完整成片及无关组件哈希不变，新旁白进入 VTT。

`.github/workflows/ci.yml` 已改为 `m2-script-and-render`，除安装、检查和工程生成外，还显式准备无头浏览器并执行 `npm run test:render`。CI 使用合成数据，不访问外部付费服务；浏览器准备属于公开工具下载。

## 6. 依赖与权利检查

- 当前 `package-lock.json` 根版本为 0.2.0-m2，Remotion／React 版本与上述基线一致。
- 2026-11-20 对当前锁定依赖执行 `npm audit --json`：info／low／moderate／high／critical 均为 0，总已知漏洞 0。该结果只代表当次数据库与锁文件，不是永久安全保证。
- 自写代码 MIT；Remotion 专用许可、React 和其他依赖许可分别保留。浏览器与渲染二进制不进入上传草案。
- 画面不使用外部图片、字体文件、音频、视频或证据素材；字体使用系统字体族回退。
- 合成数据许可为 `NOASSERTION`，未冒充真实项目、证据、授权、发布或商业闭环。

## 7. 干净副本复现

从不含 `node_modules`、`dist` 和历史渲染输出的源文件副本重新执行：

- `npm ci` 成功，安装 201 个包；
- `npm run check` 成功，10 个测试文件、43 项测试全部通过；
- 首次 `npm run test:render` 在首次下载无头浏览器后出现 `Bus error`，该次不能记为通过；
- 不修改代码、不复制原目录依赖，在同一干净副本确认浏览器已准备后重试，两个短场景、完整短拼接、局部重建及全部元数据检查通过；
- 干净副本的 `npm run example`、脚本重校验和显式浏览器准备检查随后均成功。

首次总线错误的根因未完全确定，因此这里只声称“干净副本重试后通过”，不声称“首次运行绝对无环境问题”。保留失败记录，并将 CI 浏览器准备拆为独立步骤；这不等于已经证明该步骤能消除所有环境瞬态错误。

## 8. 仍未完成

- M3：真实配音、音画同步、AI 发布标识、发布检查和公开候选版。
- M4：用户上传 M2 后的云端逐文件与 Actions 复核。
- M5：真实节点创作、实际费用、人工时间、修改轮次与发布效果记录。
- 数字人、库存素材、WebUI、多语言、批量节点、自定义物理仿真均按 M2 冻结边界未实现。
