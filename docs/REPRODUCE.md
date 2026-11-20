# 离线复现

## 环境

- Node.js 24.22.3；npm 随该 Node 版本提供。
- 不需要 API Key、模型账户、配音账户、FFmpeg、Chrome 或 Remotion。
- 合成示例和全部测试不访问真实外部服务。远程 URL 功能有独立假响应测试。

## 干净安装与检查

```bash
npm ci
npm run check
```

`check` 依次执行严格 TypeScript 类型检查、Vitest 单元／集成测试和构建。CI 使用同一锁定版本，不调用付费服务。

## 重建合成示例

```bash
npm run example
npm run validate-script -- --project examples/synthetic-node/generated
```

预期生成 8 个场景（3 条合成死法各占一个 DeathReason 场景）和 22 条逐句来源。获取时间与本地耗时是运行记录，不要求跨机器逐值相等；节点 YAML 的 SHA-256 应保持为：

```text
23687ce6224e91463121eca1172ef2ca82cbc693f7287dd697aa03ca0ca9e1f0
```

## 验证人工修改流程

1. 复制 `examples/synthetic-node/generated` 到临时目录。
2. 修改临时目录的 `script/scenes.json`，并同步检查 `script/source-map.json`。
3. 运行 `validate-script`；若 Markdown 阅读视图过期，会报 `E_DERIVED_STALE`。
4. 确认 JSON 修改后添加 `--refresh-derived`，再运行一次默认校验。

不要将真实凭证写入输入、快照、环境示例、日志或生成工程。M1 没有读取 API Key 的代码路径。
