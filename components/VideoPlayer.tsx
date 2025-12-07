'use client';
import React from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = React.forwardRef((props: any, ref: any) => {
    return (
        <ReactPlayer
            ref={ref}
            {...props}
        />
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
