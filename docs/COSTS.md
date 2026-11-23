# 成本记录语义（M3）

`cost.json` 保留 M1 顶层字段，并增加可选 `media`，避免把离线脚本、真实配音和本地渲染混为一谈。

## 顶层字段

1. `externalCalls.status=none`、`count=0`、`apiFees.amount=0`：只表示 M1 离线脚本生成没有外部 API 调用，不表示后续配音也为 0。
2. `optionalServicesPricing.status=unknown`：没有确认可选模型或配音服务的当前价格。未知不等于免费，也不构成报价。
3. `localCompute.status=measured`：累计本地脚本、配音处理与渲染耗时；机器时间、电力、存储和人工审校仍有成本，不折算成货币。
4. `retries` 仍是脚本阶段记录；配音重试单独放在 `media.speechRetries`。
5. `manualRevisionRounds` 只由人工根据实际情况更新。工具不会因为运行校验、物化或渲染而虚构人工修改轮次。

## `media` 字段

- `speechExternalCalls`：累计 Edge 实际请求次数；`fixture` 为 0。
- `speechRetries`：累计 Edge 失败后的重试次数，包括最终失败时已发生的尝试；不是把重试隐藏在错误日志里。
- `speechApiFees`：Edge 保持 `status=unknown`、`amount=null`、`currency=null`。无 API Key 不能推出免费。
- `generatedClipCount`：当前媒体计划的音频片段数，不是历史累计生成量。
- `manualAudioReplacements`、`manualSubtitleOverrides`：当前计划中实际识别到的人工音频替换与字幕覆盖数量。
- `renderCount`：成功 PNG／MP4 渲染次数。
- `localRebuildCount`：其中按单场景或帧区间进行的视频局部重建次数。
- `speechDurationMs`、`renderDurationMs`：本地实际耗时，不是货币费用。

渲染报告另在 `media/reports/` 保存组合、帧范围、输出尺寸、开始／结束时间、输入哈希和音轨信息。报告中的 `externalCalls.count=0` 表示该渲染步骤没有触发外部配音；历史 Edge 调用应查看 `cost.json`，两者口径不同。

## M3 合成样片快照

`examples/synthetic-node-m3/generated/cost.json` 记录了实际制作：8 次 Edge 调用、0 次配音重试、8 个片段、2 次完整 MP4 渲染；第二次全片渲染是因为抽帧发现结尾仍误写“M2 无声草稿”，修正后重渲染。外部金额仍为 `null/unknown`，人工修改轮次为 0，没有把 AI 起草或机器修正冒充人工审校。

任何后续运行都会在示例成本上继续累计。需要保存某次创作的真实成本时，应固定对应工程和记录，不用旧快照冒充新运行。任何外部服务都应保存实际账单、查询日期和官方价格来源；不得把历史作者估算或“没有 API Key”写成永久免费。
