# 0014-knowledge-base-ai-video-generator

`ResistanceYX/idea-tree` #0014「开源知识库节点AI视频生成器」的独立简易实现。

当前覆盖 **M1 脚本与来源映射**、**M2 程序化画面与可编辑工程**：单个 idea-tree YAML 节点可生成保守旁白、逐句来源、六类 Remotion 场景、VTT／SRT 字幕草稿、单场景或完整无声 MP4。它不代表 #0014 已完整实现；真实配音、音画同步、发布检查和真实创作验证仍属于后续阶段。

## 已有能力

- 本地 YAML，以及 `ResistanceYX/idea-tree` 的 GitHub 单节点 URL；`main` 会先固定为完整 commit，并在同一 commit 读取节点和 `LICENSE.md`。
- 按 M0 核实的 idea-tree 节点格式 v1.9 校验字段、枚举、日期、死法和证据链接结构。
- 无 API Key 的离线 `template` ScriptWriter；每条 factual 旁白保存 JSON Pointer、原文摘录、限定条件和审校状态。
- `Title`、`Idea`、`DeathReason`、`EvidenceAndLimits`、`ReusableParts`、`Outro` 六类实际参与渲染的可编辑组件。
- 场景级节点字段来源、审校状态、内容许可和“未独立核验”提示；证据／限定条件双栏版式。
- 完整组合与每个单场景组合；修改旁白或组件后可只重建目标场景，不必重渲染其他场景。
- VTT／SRT 字幕草稿和 `SpeechAdapter=none`；无配音不会阻塞无声预览，也不会伪造音轨。
- 成本记录区分零外部 API 调用、可选服务价格未知和本地计算耗时。

## 环境与快速检查

要求 Node.js `24.22.3`（接受 `>=24.22.3 <25`）。Remotion 与全部 `@remotion/*` 固定为 `4.0.545`，React／React DOM 固定为 `19.2.5`，详见锁文件。

```bash
npm ci
npm run check          # 严格类型检查、单元／集成测试、构建
npm run test:render    # 真实短渲染、完整短拼接、局部重建；首次会准备无头浏览器
npm run example        # 重建合成脚本、可编辑组件和字幕草稿
```

`test:render` 只使用合成 fixture，不调用外部付费服务。短测试会显式把场景改为 3 秒并以 0.25 缩放输出，不能当成完整时长或全高清质量样片。首次浏览器准备需要网络；运行本工具不需要模型、配音或素材账户。

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

`--output` 非空时必须显式添加 `--force`。它只覆盖本工具已知产物，不删除目录中的其他文件。合成 fixture 使用 `--synthetic`，许可记录为 `NOASSERTION`。

## 人工修改与局部重建

`scenes.json` 和 `source-map.json` 是主文件；`narration.md`、`source-map.md` 和 `video/data.ts` 是派生文件。

1. 修改 `script/scenes.json` 中的旁白或视觉内容，并同步检查 `source-map.json`。新增实质事实必须有节点字段来源；无法定位时使用 `placeholder`＋`needs-evidence`。
2. 先默认校验；确认 JSON 修改后再显式刷新派生视图：

```bash
npm run validate-script -- --project /path/to/generated-project
npm run validate-script -- --project /path/to/generated-project --refresh-derived
```

3. 直接编辑 `video/components/*.tsx`。这些文件由 `video/Video.tsx` 实际引用，不是装饰性源码。重复 `materialize` 默认保留组件修改；只有显式 `--force-components` 才覆盖组件，`video/config.json` 不会被该选项覆盖。
4. 只重建目标场景：

```bash
npm run render -- \
  --project /path/to/generated-project \
  --scene scene-outro \
  --refresh-derived
```

不传 `--scene` 时才重建完整拼接。旧 MP4 不会被隐式当作最新成片；渲染报告记录输入哈希、组合、帧范围和审校状态。

生成器始终输出 `unreviewed`，不会自审自批。`approved` 必须由人工填写审核人和时间，且整稿与逐句状态一致。未审校内容可以做带草稿标识的本地预览，但不能据此自动发布。

## 预览与 MP4

```bash
# 单场景 PNG；不指定 --scene 时取完整组合的中间帧
npm run preview -- --project /path/to/generated-project --scene scene-title --frame 60

# 单场景完整 MP4
npm run render -- --project /path/to/generated-project --scene scene-title

# 完整拼接 MP4
npm run render -- --project /path/to/generated-project

# 仅前 90 帧的短测试，不是完整 Title 场景
npm run render -- --project /path/to/generated-project --scene scene-title --frames 0-89
```

默认输出到 `media/previews/` 或 `media/output/`，可用 `--output` 显式指定 PNG／MP4 路径。`video/config.json` 允许 `concurrency` 1—4、`crf` 18—35、`scale` 0.25／0.5／0.75／1；这些设置实际进入渲染器。

## 输出结构

```text
generated-project/
├── source/{node.yaml,provenance.json}
├── script/{scenes.json,source-map.json,narration.md,source-map.md}
├── review/checklist.md
├── video/
│   ├── index.tsx / Root.tsx / Video.tsx
│   ├── components/          # 可编辑且真实参与渲染
│   ├── config.json
│   └── data.ts              # 自动派生，勿手改
├── media/
│   ├── plan.json            # 场景与逐句帧时间轴
│   ├── subtitles/draft.{vtt,srt}
│   ├── speech/none.json
│   ├── previews/            # 本地输出，不入库
│   ├── output/              # 本地输出，不入库
│   └── reports/             # 本地输出，不入库
└── cost.json
```

建议场景时长由文本长度估算，不是配音时长或 60—90 秒成片承诺；字幕分配同样不是音画同步。

## 明确边界

- M2 只读取节点本身，不访问外部证据链接，不抓取附件、论文、图片、音乐或视频；画面全部由程序化组件生成。
- 节点文本只作为数据，不执行其中的命令、脚本、React 代码、自定义 YAML 标签或模板表达式。
- `supported` 只表示来源指针可解析且摘录存在，不表示事实已被独立核验；画面中的来源状态不能替代人工语义审校。
- 画面是摘要，完整原文、所有限定条件和待补证问题仍以 JSON／来源表为准；摘要不得被当成删除这些边界的理由。
- 本地文件默认记录 `NOASSERTION`；公开 URL 不等于第三方材料改编授权。
- 不含真实配音、数字人、库存素材、WebUI、多语言、批量节点、自定义物理仿真、发布检查或自动发布。

详见 [边界](docs/BOUNDARIES.md)、[来源与审校](docs/PROVENANCE.md)、[权利与 AI 标识](docs/RIGHTS_AND_AIGC.md)、[成本](docs/COSTS.md)、[错误码](docs/ERROR-CODES.md)、[复现](docs/REPRODUCE.md) 和 [M2 验证记录](docs/M2-VALIDATION.md)。[M1 记录](docs/M1-VALIDATION.md)保留为上传前历史快照；上游归属见 [UPSTREAM.md](UPSTREAM.md)。

## 许可

本仓库自写代码采用 MIT。Remotion 使用其专用许可，不是 MIT 类依赖；输入节点、衍生脚本、第三方依赖、浏览器和未来音频素材分别保留各自许可。一个 LICENSE 不覆盖全部内容。
