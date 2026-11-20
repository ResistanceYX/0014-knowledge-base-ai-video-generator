# 成本记录语义

M1 的 `cost.json` 固定区分三件事：

1. `externalCalls.status=none`、`count=0`、`apiFees.amount=0`：只表示本次离线生成没有外部 API 调用，因此本次外部 API 调用费用为 0。
2. `optionalServicesPricing.status=unknown`：没有查询可选模型或配音服务的当前价格。未知不等于免费，也不构成报价。
3. `localCompute.status=measured`：记录本地生成耗时；机器时间、电力和人工审校仍有成本。本阶段不把耗时折算成货币，因此 `monetaryCost=not-estimated`。

`retries` 与 `manualRevisionRounds` 在初次离线生成时为 0。M1 不猜测人工修改轮次，也不会仅因运行校验就自动增加；后续接入真实创作流程时应根据实际操作记录更新。

任何未来外部服务都必须另行保存查询日期、官方价格来源和实际账单。不得把历史作者估算、会员额度或“没有 API Key”写成外部服务永久免费。
