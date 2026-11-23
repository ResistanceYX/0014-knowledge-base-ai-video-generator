import React from "react";
import type {SceneProps} from "../types";
import {SceneFrame} from "./SceneFrame";
import {BodyLines} from "./BodyLines";

export const Title: React.FC<SceneProps> = (props) => (
  <SceneFrame {...props} kicker="NODE OPENING / 节点开场">
    <BodyLines lines={props.scene.visual.bodyLines} numbered />
  </SceneFrame>
);
