# 可编辑视频工程

本目录是实际 Remotion 打包入口，不是仅供查看的源码副本。

- `index.tsx`、`Root.tsx`、`Video.tsx`：注册完整组合与每个单场景组合，并按媒体计划在对应片段帧区间播放音频。
- `components/`：六类场景模板及共用版式，可直接编辑；页眉包含 AI 标识，字幕使用人工覆盖后的文本与时间。
- `data.ts`：由主 JSON 和时间轴自动派生，请勿手改；每次 `materialize`／`render` 会重建。
- `public/audio/`：由原始 `audio/clips` 复制而来的打包输入，请勿把它当作人工音频主文件。
- `config.json`：开放 `none`、`fixture`、`edge-tts` 与受限渲染参数。重复物化不会覆盖它；真实配音只能由根目录显式 `speech` 命令准备。

在工具仓库根目录执行：

```bash
npm run preview -- --project /path/to/generated-project --scene scene-title --frame 60
npm run render -- --project /path/to/generated-project --scene scene-title
npm run render -- --project /path/to/generated-project
```

不传 `--scene` 时渲染完整拼接。`--frames 0-89` 只输出指定帧区间，用于短测试，不能当成完整场景。

重复 `materialize` 默认保留组件修改；只有显式 `--force-components` 才用内置模板覆盖。修改 `script/scenes.json` 或 `source-map.json` 后，应先校验，再按需要使用 `--refresh-derived`。

`none` 字幕仍按字符数估算；音频模式按真实音频片段对齐并应用人工字幕覆盖，但不承诺词级对齐或唇形同步。完整来源摘录、限定条件和审校状态始终以 `script/` 主文件为准，工具不自动发布。
