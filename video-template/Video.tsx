import React from "react";
import {AbsoluteFill, Audio, Sequence, Series, staticFile} from "remotion";
import {mediaPlan, sceneDocument, sourceMapDocument} from "./data";
import {mediaSourceEntries} from "./media";
import type {SceneProps, SceneType} from "./types";
import {Title} from "./components/Title";
import {Idea} from "./components/Idea";
import {DeathReason} from "./components/DeathReason";
import {EvidenceAndLimits} from "./components/EvidenceAndLimits";
import {ReusableParts} from "./components/ReusableParts";
import {Outro} from "./components/Outro";

const templates: Record<SceneType, React.ComponentType<SceneProps>> = {
  Title,
  Idea,
  DeathReason,
  EvidenceAndLimits,
  ReusableParts,
  Outro,
};

const SceneAudio: React.FC<{sceneId: string}> = ({sceneId}) => {
  const timing = mediaPlan.scenes.find((item) => item.sceneId === sceneId);
  if (!timing) return null;
  return (
    <>
      {timing.segments.map((segment) => segment.audioFile ? (
        <Sequence key={segment.segmentId} from={segment.from} durationInFrames={segment.durationInFrames}>
          <Audio src={staticFile(segment.audioFile)} />
        </Sequence>
      ) : null)}
    </>
  );
};

const SceneContent: React.FC<{sceneId: string}> = ({sceneId}) => {
  const scene = sceneDocument.scenes.find((item) => item.sceneId === sceneId);
  const timing = mediaPlan.scenes.find((item) => item.sceneId === sceneId);
  if (!scene || !timing) return <AbsoluteFill style={{background: "#07111f", color: "white", padding: 80}}>未知场景：{sceneId}</AbsoluteFill>;
  const Template = templates[scene.type];
  const entries = mediaSourceEntries(sourceMapDocument.entries, sceneId, timing);
  return (
    <>
      <Template scene={scene} entries={entries} timing={timing} />
      <SceneAudio sceneId={sceneId} />
    </>
  );
};

export const FullVideo: React.FC = () => (
  <AbsoluteFill style={{background: "#07111f"}}>
    <Series>
      {sceneDocument.scenes.map((scene) => {
        const timing = mediaPlan.scenes.find((item) => item.sceneId === scene.sceneId);
        if (!timing) return null;
        return (
          <Series.Sequence key={scene.sceneId} durationInFrames={timing.durationInFrames}>
            <SceneContent sceneId={scene.sceneId} />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);

export const SingleSceneVideo: React.FC<{sceneId: string}> = ({sceneId}) => (
  <AbsoluteFill style={{background: "#07111f"}}>
    <SceneContent sceneId={sceneId} />
  </AbsoluteFill>
);
