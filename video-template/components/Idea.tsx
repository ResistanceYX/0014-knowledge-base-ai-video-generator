import React from "react";
import type {SceneProps} from "../types";
import {SceneFrame} from "./SceneFrame";

export const Idea: React.FC<SceneProps> = ({scene, entries, timing}) => {
  const [statement, ...notes] = scene.visual.bodyLines;
  return (
    <SceneFrame scene={scene} entries={entries} timing={timing} kicker="THE IDEA / 原始对象">
      <div style={{height: "100%", display: "flex", flexDirection: "column", gap: 12}}>
        <blockquote style={{flex: 1, minHeight: 0, margin: 0, boxSizing: "border-box", padding: "20px 26px", borderRadius: 12, background: "#10243bdd", border: `1px solid ${scene.visual.accentColor}66`, fontSize: 30, lineHeight: 1.48, overflow: "hidden", overflowWrap: "anywhere"}}>
          <span style={{color: scene.visual.accentColor, fontSize: 44, lineHeight: 0, verticalAlign: -8, marginRight: 8}}>“</span>{statement ?? "原节点未提供一句话描述"}
        </blockquote>
        {notes.map((note) => <div key={note} style={{padding: "10px 16px", color: "#aebfd2", background: "#0c1929", borderRadius: 8, fontSize: 19}}>{note}</div>)}
      </div>
    </SceneFrame>
  );
};
