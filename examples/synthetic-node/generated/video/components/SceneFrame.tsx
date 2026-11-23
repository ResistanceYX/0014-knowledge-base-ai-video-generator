import React from "react";
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {mediaPlan, sceneDocument} from "../data";
import type {SceneProps} from "../types";

export const fontFamily = '"Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif';

export function fitFont(text: string, base = 30, minimum = 20): number {
  const length = Array.from(text).length;
  if (length > 180) return minimum;
  if (length > 100) return Math.max(minimum, base - 6);
  if (length > 60) return Math.max(minimum, base - 3);
  return base;
}

export const SceneFrame: React.FC<SceneProps & {kicker: string; children: React.ReactNode}> = ({scene, entries, timing, kicker, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const fadeInEnd = Math.min(10, Math.max(1, timing.durationInFrames - 2));
  const fadeIn = timing.durationInFrames === 1 ? 1 : interpolate(frame, [0, fadeInEnd], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const fadeOut = timing.durationInFrames > 12 ? interpolate(frame, [timing.durationInFrames - 8, timing.durationInFrames - 1], [1, 0.85], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}) : 1;
  const opacity = fadeIn * fadeOut;
  const accent = scene.visual.accentColor;
  const activeTiming = timing.segments.find((item) => {
    const from = item.from + Math.round((item.subtitleOffsetMs ?? 0) * fps / 1000);
    const duration = item.subtitleDurationMs === undefined ? item.durationInFrames : Math.max(1, Math.round(item.subtitleDurationMs * fps / 1000));
    return frame >= from && frame < from + duration;
  });
  const activeSegment = scene.narrationSegments.find((item) => item.segmentId === activeTiming?.segmentId);
  const sourcePointers = [...new Set(entries.flatMap((entry) => entry.sources.map((source) => source.jsonPointer)))];
  const qualifierCount = new Set(entries.flatMap((entry) => entry.qualifiers)).size;
  const needsEvidence = entries.some((entry) => entry.supportStatus === "needs-evidence");
  const reviewLabel = sceneDocument.scriptReview.status === "approved" ? "已人工审校 · 本地文件" : sceneDocument.scriptReview.status === "changes-requested" ? "审校要求修改 · 本地草稿" : "未人工审校 · 本地草稿";
  const subtitleLabel = mediaPlan.speech.mode === "none" ? "估算字幕草稿" : mediaPlan.speech.mode === "fixture" ? "音调测试 · 非语音" : "按音频片段对齐";
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, timing.durationInFrames - 1)));

  return (
    <AbsoluteFill style={{fontFamily, color: "#edf5ff", background: "radial-gradient(circle at 92% 5%, #172a46 0, #07111f 42%, #050c17 100%)", opacity}}>
      <div style={{position: "absolute", width: 420, height: 420, border: `1px solid ${accent}33`, borderRadius: "50%", right: -160, top: -170}} />
      <div style={{position: "absolute", left: 0, top: 0, bottom: 0, width: 7, background: accent}} />
      <div style={{height: "100%", boxSizing: "border-box", padding: "30px 46px 24px 52px", display: "flex", flexDirection: "column", gap: 12}}>
        <header style={{display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32, fontSize: 16, letterSpacing: 1.3, color: "#9eb2ca"}}>
          <div><b style={{color: accent}}>IDEA–TREE</b>&nbsp; / &nbsp;#{sceneDocument.node.number} &nbsp;·&nbsp; {scene.order}/{sceneDocument.scenes.length}</div>
          <div style={{display: "flex", gap: 10, alignItems: "center"}}>
            <span>{sceneDocument.node.archiveType} · {sceneDocument.node.revivalStatus}</span>
            <span style={{border: "1px solid #d6a84f", borderRadius: 5, padding: "4px 8px", color: "#ffe0a3", letterSpacing: 0, fontWeight: 700}}>AI 生成 · 人工复核</span>
            <span style={{border: "1px solid #42536a", borderRadius: 5, padding: "4px 8px", color: "#d6e1ee", letterSpacing: 0}}>{reviewLabel}</span>
          </div>
        </header>
        <div style={{transform: `translateY(${(1 - enter) * 14}px)`}}>
          <div style={{fontSize: 15, color: accent, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase"}}>{kicker}</div>
          <h1 style={{fontSize: fitFont(scene.visual.heading, 42, 30), lineHeight: 1.18, margin: "7px 0 0", maxHeight: 102, overflow: "hidden", overflowWrap: "anywhere"}}>{scene.visual.heading}</h1>
        </div>
        <main style={{flex: 1, minHeight: 0, transform: `translateY(${(1 - enter) * 20}px)`, opacity: enter, overflow: "hidden"}}>{children}</main>
        <section aria-label={subtitleLabel} style={{height: 60, flex: "0 0 60px", borderLeft: `3px solid ${accent}`, padding: "6px 14px", background: "#0b1829dd", boxSizing: "border-box", display: "grid", gridTemplateColumns: "132px 1fr", gap: 12, alignItems: "center"}}>
          <div style={{fontSize: 12, lineHeight: 1.35, color: "#9eb2ca"}}>{subtitleLabel}</div>
          <div style={{fontSize: 19, lineHeight: 1.42, color: "#f4f7fb", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere"}}>{activeTiming?.subtitleText ?? activeSegment?.text ?? "（无旁白停顿）"}</div>
        </section>
        <footer style={{height: 76, flex: "0 0 76px", borderTop: "1px solid #2a3a4e", paddingTop: 9, boxSizing: "border-box", display: "grid", gridTemplateColumns: "1fr 260px", gap: 20, color: "#a9bacd", fontSize: 14}}>
          <div style={{minWidth: 0}}>
            <b style={{color: needsEvidence ? "#ffca78" : "#83d7bd"}}>{needsEvidence ? "含待补证内容 · 不得当作事实发布" : "场景来源 · 节点字段（未独立核验）"}</b>
            <div style={{marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "monospace", fontSize: 13}}>
              {sourcePointers.length ? sourcePointers.slice(0, 2).join("   ·   ") : "编辑性说明／无节点字段来源"}{sourcePointers.length > 2 ? `   ·   另 ${sourcePointers.length - 2} 个字段` : ""}
            </div>
          </div>
          <div style={{textAlign: "right", lineHeight: 1.45}}>
            <div>{entries.length} 段来源记录 · {qualifierCount} 条限定</div>
            <div>完整摘录与审校见 source-map.json</div>
            <div>内容许可：{sceneDocument.sourceSnapshot.license.spdxId}</div>
          </div>
        </footer>
        <div style={{position: "absolute", left: 52, right: 46, bottom: 13, height: 3, background: "#1f3043"}}><div style={{height: 3, width: `${progress * 100}%`, background: accent}} /></div>
      </div>
    </AbsoluteFill>
  );
};
