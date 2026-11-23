import React from "react";
import type {SceneProps} from "../types";
import {SceneFrame} from "./SceneFrame";
import {BodyLines} from "./BodyLines";

export const DeathReason: React.FC<SceneProps> = (props) => (
  <SceneFrame {...props} kicker="DEATH RECORD / 死法记录">
    <div style={{height: "100%", display: "flex", flexDirection: "column", gap: 10}}>
      <div style={{alignSelf: "flex-start", color: "#ffca78", background: "#3b2c17", border: "1px solid #76562c", borderRadius: 6, padding: "5px 11px", fontSize: 16}}>分类与置信度均为节点记录，不等于独立证明</div>
      <div style={{flex: 1, minHeight: 0}}><BodyLines lines={props.scene.visual.bodyLines} numbered /></div>
    </div>
  </SceneFrame>
);
