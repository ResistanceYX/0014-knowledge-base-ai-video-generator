# 可编辑视频工程

本目录是实际 Remotion 打包入口，不是仅供查看的源码副本。

- `index.tsx`、`Root.tsx`、`Video.tsx`：注册完整组合与每个单场景组合。
- `components/`：六类场景模板及共用版式，可直接编辑；修改会进入后续预览或 MP4。
- `data.ts`：由主 JSON 和时间轴自动派生，请勿手改；每次 `materialize`／`render` 会重建。
- `config.json`：只开放 M2 已实现的 `speech.mode=none` 以及本地渲染并发、CRF、缩放。重复物化不会覆盖它。

在工具仓库根目录执行：

```bash
npm run preview -- --project /path/to/generated-project --scene scene-title --frame 60
npm run render -- --project /path/to/generated-project --scene scene-title
npm run render -- --project /path/to/generated-project
```

不传 `--scene` 时渲染完整拼接。`--frames 0-89` 只输出指定帧区间，用于短测试，不能当成完整场景。

重复 `materialize` 默认保留组件修改；只有显式 `--force-components` 才用内置模板覆盖。修改 `script/scenes.json` 或 `source-map.json` 后，应先校验，再按需要使用 `--refresh-derived`。

M2 字幕按字符数分配时间，只是草稿。无真实配音、音画同步、外部素材或自动发布；完整来源摘录、限定条件和审校状态仍以 `script/` 主文件为准。
