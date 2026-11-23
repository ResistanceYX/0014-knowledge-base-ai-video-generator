import React from "react";
import type {SceneProps} from "../types";
import {SceneFrame} from "./SceneFrame";
import {BodyLines} from "./BodyLines";

export const ReusableParts: React.FC<SceneProps> = (props) => {
  const lines = props.scene.visual.bodyLines;
  const qualifier = lines.at(-1) ?? "可拆零件不代表商业闭环。";
  return (
    <SceneFrame {...props} kicker="REUSABLE PARTS / 可复用拆解">
      <div style={{height: "100%", display: "flex", flexDirection: "column", gap: 10}}>
        <div style={{flex: 1, minHeight: 0}}><BodyLines lines={lines.slice(0, -1)} columns={2} numbered /></div>
        <div style={{padding: "10px 15px", borderRadius: 8, color: "#ffdaa0", background: "#322615", fontSize: 18, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{qualifier}</div>
      </div>
    </SceneFrame>
  );
};
