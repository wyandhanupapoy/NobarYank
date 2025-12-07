'use client';
import React from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = React.forwardRef((props: any, ref: any) => {
    console.log('📼 VideoPlayer rendering. URL:', props.url);
    if (!props.url) console.warn('⚠️ VideoPlayer received empty URL');
    return (
        <ReactPlayer
            ref={ref}
            {...props}
        />
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
