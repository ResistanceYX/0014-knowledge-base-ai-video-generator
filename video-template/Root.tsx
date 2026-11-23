import React from "react";
import {Composition} from "remotion";
import {mediaPlan, sceneDocument} from "./data";
import {FullVideo, SingleSceneVideo} from "./Video";

export const VideoRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="IdeaTreeFull"
        component={FullVideo}
        durationInFrames={mediaPlan.fullDurationInFrames}
        fps={sceneDocument.video.fps}
        width={sceneDocument.video.width}
        height={sceneDocument.video.height}
      />
      {sceneDocument.scenes.map((scene) => {
        const timing = mediaPlan.scenes.find((item) => item.sceneId === scene.sceneId);
        if (!timing) return null;
        const SceneComponent: React.FC = () => <SingleSceneVideo sceneId={scene.sceneId} />;
        return (
          <Composition
            key={scene.sceneId}
            id={timing.compositionId}
            component={SceneComponent}
            durationInFrames={timing.durationInFrames}
            fps={sceneDocument.video.fps}
            width={sceneDocument.video.width}
            height={sceneDocument.video.height}
          />
        );
      })}
    </>
  );
};
