# M3 真实配音合成候选工程

本目录是与 M2 无声示例分开保存的 M3 示例。输入仍是纯合成节点，不对应真实创业点子、真实证据或真实项目。

## 本次实际制作快照

- 8 个场景、8 段 `edge-tts 7.3.1` 中文候选配音；voice 为 `zh-CN-XiaoxiaoNeural`，rate 为 `+10%`。
- 实际外部配音调用 8 次，重试 0 次；外部费用为 `unknown/null`，不是“已确认免费”。
- 真实音频驱动完整时间轴 2557 帧，视频时长 85.233 秒，位于 M3 的 60—90 秒目标内。
- 完整 MP4 已实际渲染两次。第一次抽帧发现结尾误写“M2 程序化无声草稿”，修正为按配音模式显示后重新渲染；成本记录保留两次渲染，不隐藏返工。
- 最终技术检查为 1280×720、30fps、H.264＋AAC；音频流约 85.248 秒，标题与评论包含 AI 本地草稿声明。
- 已逐一抽取 8 个场景中点画面检查布局、来源、限定条件和 AI 标识。音频有非零电平，但这不等于人工听审通过。
- 整稿和逐句来源仍为 `unreviewed`；术语读音、可懂度、实际音画体验、声音权利和发布清单仍需人工完成。

完整 MP4、预览和渲染报告按 `.gitignore` 不作为仓库文件保存；这里保留脚本、来源、8 段 MP3、真实时间轴、字幕、发布材料、权利与成本记录，便于离线重渲染。

## 不重调 Edge 的短渲染

在仓库根目录执行：

```bash
npm run materialize -- --project examples/synthetic-node-m3/generated
npm run render -- \
  --project examples/synthetic-node-m3/generated \
  --scene scene-title \
  --frames 0-29 \
  --output /tmp/0014-m3-title.mp4
```

## 有意重新合成

需要自行准备 Python 3、`ffprobe` 和 `edge-tts==7.3.1`，然后显式执行：

```bash
npm run speech -- \
  --project examples/synthetic-node-m3/generated \
  --allow-synthetic-unreviewed
```

未变化片段会复用已有音频。重复合成和渲染会继续累计 `cost.json`，不要把后续值冒充上述首次制作快照。发布前请运行 `npm run publish-check -- --project examples/synthetic-node-m3/generated`，并由人实际完成所有审校和清单项目。
