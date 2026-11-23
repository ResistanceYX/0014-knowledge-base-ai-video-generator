import React from "react";
import {mediaPlan} from "../data";
import type {SceneProps} from "../types";
import {SceneFrame} from "./SceneFrame";
import {BodyLines} from "./BodyLines";

export const Outro: React.FC<SceneProps> = (props) => {
  const speechLabel = mediaPlan.speech.mode === "none"
    ? "M2 程序化无声草稿"
    : mediaPlan.speech.mode === "fixture"
      ? "M3 本地音调测试 · 非可懂语音"
      : "M3 Edge TTS 合成配音 · 未经人工听审";
  return (
    <SceneFrame {...props} kicker="PROVENANCE / 来源与纠错">
      <div style={{height: "100%", display: "flex", flexDirection: "column", gap: 10}}>
        <div style={{flex: 1, minHeight: 0}}><BodyLines lines={props.scene.visual.bodyLines} /></div>
        <div style={{textAlign: "center", color: "#93a8bf", fontSize: 15}}>{speechLabel} · 无外部素材 · 不自动发布</div>
      </div>
    </SceneFrame>
  );
};
