import React from "react";
import type {SceneProps} from "../types";
import {SceneFrame} from "./SceneFrame";
import {BodyLines} from "./BodyLines";

export const Outro: React.FC<SceneProps> = (props) => (
  <SceneFrame {...props} kicker="PROVENANCE / 来源与纠错">
    <div style={{height: "100%", display: "flex", flexDirection: "column", gap: 10}}>
      <div style={{flex: 1, minHeight: 0}}><BodyLines lines={props.scene.visual.bodyLines} /></div>
      <div style={{textAlign: "center", color: "#93a8bf", fontSize: 15}}>M2 程序化无声草稿 · 无外部素材 · 不自动发布</div>
    </div>
  </SceneFrame>
);
