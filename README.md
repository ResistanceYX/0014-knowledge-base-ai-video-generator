# 0014-knowledge-base-ai-video-generator

`ResistanceYX/idea-tree` #0014「开源知识库节点AI视频生成器」的独立简易实现。

当前覆盖 **M1 脚本与来源映射**、**M2 程序化画面与可编辑工程**、**M3 配音、真实音频时间轴与发布前检查**。单个 idea-tree YAML 节点可生成保守旁白、逐句来源、六类 Remotion 场景、可人工修改的字幕与音轨、单场景或完整 MP4，以及 AI 声明和成本记录。M4 云端上传后复核与 M5 真实创作验证尚未由本仓库自动完成。

## 已有能力

- 本地 YAML，以及 `ResistanceYX/idea-tree` 的 GitHub 单节点 URL；`main` 会先固定为完整 commit，并在同一 commit 读取节点和 `LICENSE.md`。
- 按 M0 核实的 idea-tree 节点格式 v1.9 校验字段、枚举、日期、死法和证据链接结构。
- 无 API Key 的离线 `template` ScriptWriter；每条 factual 旁白保存 JSON Pointer、原文摘录、限定条件和审校状态。
- `Title`、`Idea`、`DeathReason`、`EvidenceAndLimits`、`ReusableParts`、`Outro` 六类实际参与渲染的可编辑组件。
- 场景级来源、审校状态、内容许可、未独立核验提示与显式“AI 生成 · 人工复核”标识。
- `none` 保留无声草稿；`fixture` 生成仅用于测试的本地音调；`edge-tts` 是唯一真实外部配音接口。
- 每段音频用 `ffprobe` 读取真实时长，驱动场景帧数和 VTT／SRT；字幕按音频片段对齐，不承诺词级对齐或唇形同步。
- 术语表只改变朗读文本；字幕文本、偏移和时长可人工覆盖；同名替换音频会重新探测时长并登记为人工替换。
- 完整组合与单场景组合；修改旁白、音频、字幕或组件后可局部重建。
- 画面 AI 标识、MP4 标准元数据、平台作者声明模板、权利记录和不会自动勾选的发布前人工清单。
- `cost.json` 分别记录脚本阶段、配音调用、重试、渲染、局部重建、耗时和人工修改轮次；未知价格不写成零。

## 环境与快速检查

必需：

- Node.js `24.22.3`（接受 `>=24.22.3 <25`）。
- 使用音频模式时，`ffprobe` 必须位于 `PATH`；`none` 的脚本和无声渲染不需要它。
- 首次真实渲染需要公开网络，让 Remotion 准备匹配的无头浏览器。

可选真实配音：

- Python 3，以及单独安装的 `edge-tts==7.3.1`。该可选依赖不分发在本仓库中，许可与服务边界见[权利说明](docs/RIGHTS_AND_AIGC.md)。

```bash
npm ci
npm run check          # 严格类型检查、单元／集成测试、构建
npm run test:render    # M2 无声回归＋M3 本地音调的真实音轨短渲染
npm run example        # 重建 M2 无声合成示例
```

自动测试不访问真实配音服务，不需要 API Key、模型账户、配音账户或素材账户。`fixture` 只是可闻音调，不是可懂语音；短渲染和低分辨率测试也不冒充完整全高清样片。

## 生成节点工程

本地节点：

```bash
npm run generate -- \
  --input /path/to/0014-knowledge-base-ai-video-generator.yaml \
  --output /path/to/generated-project
npm run materialize -- --project /path/to/generated-project
```

固定 commit 的远程节点：

```bash
npm run generate -- \
  --input https://github.com/ResistanceYX/idea-tree/blob/3ecc35b0c00e7bfa55ce5f890f11f28587de9581/nodes/0014-knowledge-base-ai-video-generator.yaml \
  --output /path/to/generated-project
npm run materialize -- --project /path/to/generated-project
```

`--output` 非空时必须显式添加 `--force`。合成 fixture 使用 `--synthetic`，许可记录为 `NOASSERTION`。默认配置仍是 `none`，不会因物化、预览或渲染而联网配音。

## 配置真实配音

把 `video/config.json` 改为以下结构；`render` 字段可按本机情况调整：

```json
{
  "schemaVersion": "0.3.0",
  "speech": {
    "mode": "edge-tts",
    "voice": "zh-CN-XiaoxiaoNeural",
    "rate": "+10%",
    "timeoutMs": 60000,
    "maxRetries": 1,
    "segmentPauseMs": 120,
    "scenePauseMs": 350
  },
  "render": {"concurrency": 2, "crf": 23, "scale": 1}
}
```

真实节点必须先把整稿和每条来源记录人工审校为 `approved`，再显式运行：

```bash
npm run speech -- --project /path/to/generated-project
npm run render -- --project /path/to/generated-project
```

合成测试节点可使用显式绕过参数：

```bash
npm run speech -- \
  --project examples/synthetic-node-m3/generated \
  --allow-synthetic-unreviewed
```

该参数只对 `sourceType=synthetic-fixture` 有效，不会绕过真实节点审校。`speech --scene <sceneId>` 只处理目标场景且复用其他可复用片段；`--force` 才强制重建。失败重试和外部调用会累计到 `cost.json`；Edge 外部费用保持 `unknown`，不写“免费”。

## 人工修改与局部重建

`scenes.json` 和 `source-map.json` 是脚本主文件；`narration.md`、`source-map.md` 和 `video/data.ts` 是派生文件。

1. 修改旁白或视觉内容并同步检查来源表。新增实质事实必须有节点字段来源；无法定位时使用 `placeholder`＋`needs-evidence`。
2. 先校验，确认修改后再显式刷新派生视图：

```bash
npm run validate-script -- --project /path/to/generated-project
npm run validate-script -- --project /path/to/generated-project --refresh-derived
```

3. 编辑 `speech/terminology.json`，只调整朗读文本，不改原始旁白或来源。修改术语后重新运行 `speech`，未变化的片段会复用。
4. 编辑 `speech/subtitle-overrides.json`，按 `segmentId` 设置可选的 `text`、`offsetMs`、`durationMs`，再运行 `materialize`。
5. 用同名、同格式音频替换 `audio/clips/<sceneId>/<segmentId>/...`，再运行 `materialize`。工具会重新计算真实时长并标记人工替换；不会把音轨存在当作读音正确。
6. 直接编辑 `video/components/*.tsx`。重复物化默认保留组件；只有 `--force-components` 才覆盖，`video/config.json` 不会被该选项覆盖。
7. 只重建目标场景：

```bash
npm run render -- \
  --project /path/to/generated-project \
  --scene scene-outro \
  --refresh-derived
```

脚本或术语变化会使旧配音清单过期并安全停止；重跑 `speech` 后才生成新媒体计划。生成器始终输出 `unreviewed`，不会自审自批。

## 预览、MP4 与发布前检查

```bash
npm run preview -- --project /path/to/generated-project --scene scene-title --frame 60
npm run render -- --project /path/to/generated-project --scene scene-title
npm run render -- --project /path/to/generated-project
npm run render -- --project /path/to/generated-project --scene scene-title --frames 0-89
npm run publish-check -- --project /path/to/generated-project
```

默认输出到 `media/previews/` 或 `media/output/`。音频模式的 MP4 使用 H.264＋AAC 并写入标准标题、评论、来源和权利元数据；`none` 继续不伪造音轨。`publish-check` 只检查本地文件、审校记录和人工清单，`ready=true` 也不表示已经上传、发布、获得授权或完成 M4／M5。

## 输出结构

```text
generated-project/
├── source/{node.yaml,provenance.json}
├── script/{scenes.json,source-map.json,narration.md,source-map.md}
├── speech/{terminology.json,subtitle-overrides.json}
├── audio/
│   ├── clips/               # 原始生成或人工替换的音频
│   └── rights.json
├── review/{checklist.md,publish-checklist.md}
├── publish/{ai-disclosure.json,description.md}
├── video/                   # 可编辑且真实参与渲染的 Remotion 工程
├── media/
│   ├── plan.json            # 场景、音频与逐句帧时间轴
│   ├── metadata.json
│   ├── subtitles/draft.{vtt,srt}
│   ├── speech/{none,fixture,edge-tts}.json
│   ├── previews/            # 本地输出，不入库
│   ├── output/              # 本地输出，不入库
│   └── reports/             # 本地输出，不入库
└── cost.json
```

`examples/synthetic-node/generated` 保留 M2 无声示例；`examples/synthetic-node-m3/generated` 是真实配音合成候选工程。后者保留了实际音频、媒体计划、成本和发布材料，但仍是 `unreviewed`，人工听审与发布清单没有由工具代办。

## 明确边界

- 只读取节点本身，不访问外部证据链接，不抓取附件、论文、图片、音乐或视频；画面全部由程序化组件生成。
- 节点文本只作为数据，不执行其中的命令、脚本、React 代码、自定义 YAML 标签或模板表达式。
- `supported` 只表示来源指针可解析且摘录存在，不表示事实已被独立核验。
- 真实配音只在显式 `speech` 命令中发生；CI、物化、预览和渲染不会隐式联网合成。
- 字幕是音频片段级对齐；工具不能替代人工听审术语读音、可懂度和实际音画体验。
- 不含数字人、库存素材、WebUI、多语言、批量节点、自定义物理仿真或自动发布。
- 无 API Key 不等于确认免费、可商用、获得声音授权或服务可持续；公开 URL 也不等于改编授权。

详见[配音与人工修改](docs/SPEECH.md)、[边界](docs/BOUNDARIES.md)、[来源与审校](docs/PROVENANCE.md)、[权利与 AI 标识](docs/RIGHTS_AND_AIGC.md)、[成本](docs/COSTS.md)、[复现](docs/REPRODUCE.md)和 [M3 验证记录](docs/M3-VALIDATION.md)。上游归属见 [UPSTREAM.md](UPSTREAM.md)。

## 许可

本仓库自写代码采用 MIT。Remotion 使用其专用许可，不是 MIT 类依赖；可选 `edge-tts` Python 包、输入节点、衍生脚本、第三方依赖、浏览器和音频分别保留各自许可。一个 LICENSE 不覆盖全部内容。
