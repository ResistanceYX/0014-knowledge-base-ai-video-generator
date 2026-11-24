import React from "react";
import type {SceneProps} from "../types";
import {SceneFrame} from "./SceneFrame";

const panel: React.CSSProperties = {minWidth: 0, minHeight: 0, borderRadius: 11, border: "1px solid #2a4059", background: "#0e1d30dd", padding: 14, overflow: "hidden"};
const label: React.CSSProperties = {fontSize: 15, fontWeight: 700, letterSpacing: 1.4, marginBottom: 10};

export const EvidenceAndLimits: React.FC<SceneProps> = ({scene, entries, timing}) => {
  const qualifiers = [...new Set([...scene.visual.bodyLines, ...entries.flatMap((entry) => entry.qualifiers)])];
  const questions = entries.filter((entry) => entry.openQuestion).map((entry) => entry.openQuestion as string);
  return (
    <SceneFrame scene={scene} entries={entries} timing={timing} kicker="EVIDENCE ↔ LIMITS / 证据与边界">
      <div style={{height: "100%", display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 13}}>
        <section style={panel}>
          <div style={{...label, color: "#83d7bd"}}>证据与来源状态</div>
          <div style={{display: "flex", flexDirection: "column", gap: 8}}>
            {entries.slice(0, 3).map((entry) => (
              <article key={entry.segmentId} style={{padding: "9px 11px", borderRadius: 7, background: "#13263b", overflow: "hidden"}}>
                <div style={{display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, color: entry.supportStatus === "needs-evidence" ? "#ffca78" : "#9ddcc7"}}>
                  <span style={{fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{entry.sources[0]?.jsonPointer ?? entry.segmentId}</span>
                  <span style={{flexShrink: 0}}>{entry.supportStatus}</span>
                </div>
                <div style={{marginTop: 5, fontSize: 17, lineHeight: 1.38, color: "#d7e4f1", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere"}}>
                  {entry.sources[0]?.excerpt ?? entry.openQuestion ?? "编辑性说明；无节点字段来源。"}
                </div>
              </article>
            ))}
          </div>
          {entries.length > 3 ? <div style={{marginTop: 8, color: "#92a7bd", fontSize: 14}}>另有 {entries.length - 3} 段记录，完整摘录见来源表。</div> : null}
        </section>
        <section style={{...panel, borderColor: "#6d522d", background: "#241d16dd"}}>
          <div style={{...label, color: "#ffca78"}}>限定条件 · 不得省略</div>
          <div style={{display: "flex", flexDirection: "column", gap: 8}}>
            {qualifiers.slice(0, 3).map((qualifier, index) => (
              <div key={`${index}-${qualifier.slice(0, 20)}`} style={{display: "flex", gap: 9, padding: "8px 10px", borderRadius: 7, background: "#382b1a", color: "#ffe0ac", fontSize: 17, lineHeight: 1.4}}>
                <span style={{flexShrink: 0}}>!</span><span style={{display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere"}}>{qualifier}</span>
              </div>
            ))}
            {questions.slice(0, 1).map((question) => <div key={question} style={{padding: "8px 10px", border: "1px dashed #b98845", borderRadius: 7, color: "#ffd194", fontSize: 16, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"}}>待确认：{question}</div>)}
          </div>
          {qualifiers.length > 3 ? <div style={{marginTop: 8, color: "#d6b681", fontSize: 14}}>另有 {qualifiers.length - 3} 条限定；未被画面摘要替代或删除。</div> : null}
        </section>
      </div>
    </SceneFrame>
  );
};
