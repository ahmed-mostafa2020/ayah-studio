import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Reel, ReelProps} from './Reel';

const Root: React.FC = () =>
  React.createElement(Composition, {
    id: 'Reel',
    component: Reel as React.FC<any>,
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 300,
    defaultProps: {storyboard: null, sacred: []} as unknown as ReelProps,
    calculateMetadata: ({props}: {props: ReelProps}) => ({
      durationInFrames: Math.max(1, Math.round((props.storyboard?.meta.duration ?? 10) * 30)),
    }),
  });

registerRoot(Root);
