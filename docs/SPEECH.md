# 配音、术语、字幕与音轨人工修改（M3）

## 三种模式

| 模式 | 用途 | 外部调用 | 音轨与字幕 |
|---|---|---:|---|
| `none` | M2 无声草稿 | 0 | 不生成音频，不伪造静音轨；字幕仍按字符数估算 |
| `fixture` | CI 与本地同步测试 | 0 | 生成可闻但不可懂的音调 WAV，只验证真实音频驱动时间轴与 MP4 封装 |
| `edge-tts` | 真实中文候选配音 | 仅显式 `speech` | 每段生成 MP3，探测真实时长；字幕按音频片段对齐 |

`fixture` 不能用于评价自然度、术语读音或真实配音质量。`edge-tts` 是 M3 唯一真实外部服务，其他服务会被 `E_SPEECH_MODE` 拒绝。

`placeholder`＋`needs-evidence` 只在脚本与来源表中保留审校提示，三种模式都不会为它生成配音、字幕或媒体分段；缺失内容不会由工具补编。只有 placeholder 的场景会整个从媒体计划省略，画面组件也只读取可播放片段的来源记录。旧配音清单仍含 placeholder 片段，或字幕覆盖指向 placeholder 时，会安全停止。

## 显式调用与人工审校闸门

真实节点只有在整稿和每条 `source-map` 记录都为 `approved`，且审核人、审核时间完整时，才允许执行：

```bash
npm run speech -- --project /path/to/generated-project
```

合成 fixture 可显式使用 `--allow-synthetic-unreviewed`。这个例外只用于合成测试数据，不适用于本地真实 YAML 或远程节点。

`materialize`、`preview`、`render` 和 CI 不会隐式调用 Edge。音频配置开启但清单缺失时，它们会要求先运行 `speech`，而不是擅自联网。Edge 通过参数数组启动 `python3 -m edge_tts`，不经过 shell 拼接；单段有超时、最多两次重试和音频编码／时长检查。

## 术语表

`speech/terminology.json`：

```json
{
  "schemaVersion": "0.3.0",
  "entries": [
    {"term": "AI", "replacement": "人工智能"}
  ]
}
```

替换只作用于 `SpeechManifest.clips[].spokenText`，不会改写 `script/scenes.json`、原始来源或画面字幕。条目按术语长度降序做字面替换，不是智能注音，也不保证多音字、英文缩写或专有名词一定读对。修改后必须重新运行 `speech` 并由人实际听审。

## 字幕覆盖

`speech/subtitle-overrides.json`：

```json
{
  "schemaVersion": "0.3.0",
  "entries": [
    {
      "segmentId": "seg-title",
      "text": "人工确认后的字幕",
      "offsetMs": 100,
      "durationMs": 2400
    }
  ]
}
```

三个覆盖字段都可单独省略。偏移绝对值最多 2000ms，时长为 40—120000ms；孤立 `segmentId`、重复条目或完全移出场景的字幕会安全失败。覆盖同时进入画面字幕和 VTT／SRT。

音频模式只承诺**片段级**对齐：一段旁白对应一条真实音频。Edge 写出的 boundary SRT 被保留作辅助材料，但当前时间轴不把它当作可靠词级对齐，更不承诺唇形同步。

## 人工替换音轨

1. 保持 `audio/clips/<sceneId>/<segmentId>/` 下的文件名和扩展名不变。
2. 用人工确认的同格式音频替换文件。
3. 运行：

```bash
npm run materialize -- --project /path/to/generated-project
```

工具会比较当前 SHA-256 与最初生成 SHA-256，重新调用 `ffprobe`，登记 `manuallyReplaced=true`，并按新时长重建场景和字幕。替换文件必须是普通文件，不能是符号链接。再次运行未加 `--force` 的 `speech` 会保留可复用的人工替换；强制重建或文本变化可能覆盖旧音频，操作前应自行备份。

## 局部重建与成本

```bash
npm run speech -- --project /path/to/generated-project --scene scene-outro
npm run render -- --project /path/to/generated-project --scene scene-outro
```

只有目标场景需要重新合成时，其他片段必须能从现有清单和音频复用，否则命令会停止而不是生成不完整音轨。`cost.json` 的 `media` 分别累计外部配音调用、重试、配音处理耗时、渲染次数、局部重建次数和渲染耗时。人工修改轮次仍由人填写，工具不会猜测。

## 真实服务准备与边界

本次实测使用 `edge-tts==7.3.1`。安装是可选步骤，不属于离线测试：

```bash
python3 -m pip install edge-tts==7.3.1
python3 -m edge_tts --version
ffprobe -version
```

无 API Key 不等于确认免费、可商用、声音权利已获授权或服务可持续。发布者须另核在线服务条款、声音使用边界和实际账单。真实样片生成后仍必须人工听审术语读音、可懂度、停顿和音画体验；音频流存在、时长吻合或非零电平都不能替代这一步。
