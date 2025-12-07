'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSync } from '@/hooks/useSync';
import { sendSignal, subscribeToRoom } from '@/lib/supabaseClient';

// Dynamic import ReactPlayer dengan SSR disabled
// Dynamic import VideoPlayer dengan SSR disabled
const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
    )
}) as any;

export default function RoomPage() {
    const params = useParams();
    const roomId = params?.id as string;

    const [isHost, setIsHost] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [inputUrl, setInputUrl] = useState('');
    const [playerReady, setPlayerReady] = useState(false);
    const [playerError, setPlayerError] = useState<string>('');
    const [isClient, setIsClient] = useState(false);

    const playerRef = useRef<any>(null);
    const isChangingState = useRef(false);

    // Ensure client-side rendering
    useEffect(() => {
        setIsClient(true);
        setIsHost(window.location.hash === '#host');
    }, []);

    const { status, sendData, onDataReceive } = useWebRTC(roomId, isHost);

    const { url, setUrl, handleSyncMessage, latencyMetrics } = useSync(
        isHost,
        sendData,
        playerRef,
        playing
    );

    useEffect(() => {
        onDataReceive.current = (msg) => {
            console.log('📩 Viewer received:', msg);

            if (msg.type === 'CONTROL') {
                if (msg.action === 'play') {
                    console.log('▶️ Play command received');
                    setPlaying(true);
                }
                if (msg.action === 'pause') {
                    console.log('⏸️ Pause command received');
                    setPlaying(false);
                }
            }
            handleSyncMessage(msg);
        };
    }, [handleSyncMessage]);

    // Initial Join Signal
    useEffect(() => {
        if (!roomId) return;
        const channel = subscribeToRoom(roomId, () => { });

        const timer = setTimeout(() => {
            sendSignal(channel, {
                type: 'join',
                identity: isHost ? 'host' : 'peer'
            });
        }, 1500);

        return () => clearTimeout(timer);
    }, [roomId, isHost]);

    const handlePlay = () => {
        if (isChangingState.current) return;
        isChangingState.current = true;

        if (!playing) {
            setPlaying(true);
            if (isHost && status === 'connected') {
                sendData({ type: 'CONTROL', action: 'play' });
            }
        }

        setTimeout(() => {
            isChangingState.current = false;
        }, 100);
    };

    const handlePause = () => {
        if (isChangingState.current) return;
        isChangingState.current = true;

        if (playing) {
            setPlaying(false);
            if (isHost && status === 'connected') {
                sendData({ type: 'CONTROL', action: 'pause' });
            }
        }

        setTimeout(() => {
            isChangingState.current = false;
        }, 100);
    };

    const handleLoadUrl = () => {
        if (!inputUrl.trim()) return;

        const newUrl = inputUrl.trim();
        console.log('🎬 Loading URL:', newUrl);

        // Set URL lokal dulu
        setUrl(newUrl);
        setPlaying(false);
        setPlayerReady(false);
        setPlayerError('');

        // Kirim ke viewer (baik connected atau tidak)
        if (isHost) {
            console.log('📤 Sending URL to peer, status:', status);

            // Kirim immediate sync message
            sendData({
                type: 'SYNC',
                url: newUrl,
                time: 0,
                isPlaying: false,
                timestamp: performance.now()
            });

            // Kirim lagi setelah delay untuk memastikan
            setTimeout(() => {
                sendData({
                    type: 'SYNC',
                    url: newUrl,
                    time: 0,
                    isPlaying: false,
                    timestamp: performance.now()
                });
                console.log('📤 Re-sent URL to ensure delivery');
            }, 1000);
        }
    };

    const handleTogglePlay = () => {
        if (playing) {
            handlePause();
        } else {
            handlePlay();
        }
    };

    const handleSeek = (seconds: number) => {
        const player = playerRef.current;
        if (player && player.getCurrentTime) {
            const currentTime = player.getCurrentTime();
            const newTime = Math.max(0, currentTime + seconds);
            player.seekTo(newTime, 'seconds');

            if (isHost && status === 'connected') {
                sendData({ type: 'CONTROL', action: 'seek', time: newTime });
            }
        }
    };

    // Player Event Handlers
    const handlePlayerReady = () => {
        console.log('✅ Player ready');
        setPlayerReady(true);
        setPlayerError('');
    };

    const handlePlayerError = (error: any) => {
        console.error('❌ Player error:', error);
        setPlayerError('Failed to load video. Check if URL is valid and video is available.');
        setPlayerReady(false);
    };

    const handleBuffer = () => {
        console.log('⏳ Buffering...');
    };

    const handleBufferEnd = () => {
        console.log('✅ Buffer end');
        if (!playerReady) {
            setPlayerReady(true);
        }
    };

    if (!roomId || !isClient) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
            <div className="w-full max-w-5xl space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg">
                    <div>
                        <h1 className="text-xl font-bold">
                            Room: <span className="text-blue-400">{roomId}</span>
                        </h1>
                        <p className="text-sm text-gray-400">
                            You are: {isHost ? '👑 HOST (Controller)' : '👥 VIEWER'}
                        </p>
                    </div>
                    <div className={`px-4 py-2 rounded font-bold text-sm flex items-center gap-2 ${status === 'connected'
                        ? 'bg-green-600'
                        : status === 'connecting'
                            ? 'bg-yellow-600 animate-pulse'
                            : 'bg-red-600'
                        }`}>
                        {status === 'connected' && '✓ READY'}
                        {status === 'connecting' && '⟳ CONNECTING...'}
                        {status === 'disconnected' && '✗ DISCONNECTED'}
                    </div>
                </div>

                {/* Host Controls */}
                {isHost && (
                    <div className="bg-gray-800 p-4 rounded-lg space-y-3">
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-gray-900 border border-gray-600 p-3 rounded text-white focus:outline-none focus:border-blue-500"
                                placeholder="Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleLoadUrl()}
                            />
                            <button
                                onClick={handleLoadUrl}
                                className="bg-blue-600 hover:bg-blue-700 px-6 rounded font-bold transition disabled:opacity-50"
                                disabled={!inputUrl.trim()}
                            >
                                Load Video
                            </button>
                        </div>

                        {/* Manual Sync Button untuk Testing */}
                        {url && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        console.log('🔄 Manual sync triggered');
                                        sendData({
                                            type: 'SYNC',
                                            url: url,
                                            time: playerRef.current?.getCurrentTime() || 0,
                                            isPlaying: playing,
                                            timestamp: performance.now()
                                        });
                                    }}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm transition disabled:opacity-50"
                                    disabled={status !== 'connected'}
                                >
                                    🔄 Force Sync to Viewer
                                </button>
                                {status !== 'connected' && (
                                    <span className="text-yellow-400 text-xs self-center">
                                        (Wait for connection)
                                    </span>
                                )}
                            </div>
                        )}

                        {url && (
                            <div className="flex gap-2 items-center justify-center">
                                <button
                                    onClick={() => handleSeek(-10)}
                                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition disabled:opacity-50"
                                    disabled={!playerReady}
                                >
                                    ⏪ -10s
                                </button>
                                <button
                                    onClick={handleTogglePlay}
                                    className="bg-green-600 hover:bg-green-700 px-8 py-2 rounded font-bold transition disabled:opacity-50"
                                    disabled={!playerReady}
                                >
                                    {playing ? '⏸ PAUSE' : '▶ PLAY'}
                                </button>
                                <button
                                    onClick={() => handleSeek(10)}
                                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition disabled:opacity-50"
                                    disabled={!playerReady}
                                >
                                    +10s ⏩
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Video Player */}
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
                    {url ? (
                        <div className="w-full h-full">
                            <div className="absolute top-0 left-0 bg-red-500 text-white text-xs z-50 p-1">
                                DEBUG: Rendering Player. URL: {url}
                            </div>
                            <VideoPlayer
                                ref={playerRef}
                                url={url}
                                width="100%"
                                height="100%"
                                playing={playing}
                                controls={!isHost}
                                onReady={handlePlayerReady}
                                onError={handlePlayerError}
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onBuffer={handleBuffer}
                                onBufferEnd={handleBufferEnd}
                                config={{
                                    youtube: {
                                        playerVars: {
                                            autoplay: 0,
                                            controls: isHost ? 0 : 1,
                                            modestbranding: 1,
                                            rel: 0,
                                            showinfo: 0,
                                            // origin: typeof window !== 'undefined' ? window.location.origin : undefined
                                        }
                                    }
                                }}
                            />
                            {/* Error State */}
                            {playerError && (
                                <div className="absolute inset-0 bg-red-900/90 flex items-center justify-center z-30">
                                    <div className="text-center bg-red-800 p-6 rounded-lg max-w-md">
                                        <p className="text-white font-bold mb-2">❌ Error</p>
                                        <p className="text-red-200 text-sm mb-4">{playerError}</p>
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                onClick={() => {
                                                    setPlayerError('');
                                                    setPlayerReady(false);
                                                    const currentUrl = url;
                                                    setUrl('');
                                                    setTimeout(() => setUrl(currentUrl), 100);
                                                }}
                                                className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded"
                                            >
                                                Retry
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setUrl('');
                                                    setInputUrl('');
                                                    setPlayerError('');
                                                }}
                                                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center max-w-md">
                                <div className="text-6xl mb-4">🎬</div>
                                <p className="text-gray-400 text-lg mb-2">
                                    {isHost
                                        ? 'Paste a YouTube URL above to start'
                                        : 'Waiting for host to load video...'}
                                </p>
                                {isHost && (
                                    <p className="text-gray-600 text-sm">
                                        Try: https://www.youtube.com/watch?v=dQw4w9WgXcQ
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {status !== 'connected' && !isHost && url && !playerError && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3"></div>
                                <p className="text-white mb-2">
                                    Waiting for peer connection...
                                </p>
                                <p className="text-gray-400 text-sm">
                                    Make sure both users join the same room
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Viewer Metrics */}
                {!isHost && status === 'connected' && url && (
                    <div className="bg-gray-950 p-3 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm font-mono text-green-400">
                            <div>
                                <span className="text-gray-500">Ping:</span> {latencyMetrics.rtt.toFixed(0)} ms
                            </div>
                            <div>
                                <span className="text-gray-500">Sync Offset:</span> {latencyMetrics.offset.toFixed(3)} s
                            </div>
                        </div>
                    </div>
                )}

                {/* Debug Panel */}
                <div className="bg-gray-950 p-4 rounded-lg text-xs font-mono space-y-2">
                    <div className="text-green-400">🔍 Debug Info:</div>
                    <div className="text-gray-400 space-y-1">
                        <div>WebRTC Status: <span className={status === 'connected' ? 'text-green-400' : 'text-red-400'}>{status}</span></div>
                        <div>URL Loaded: <span className="text-white">{url ? 'Yes' : 'No'}</span></div>
                        <div>Player Ready: <span className={playerReady ? 'text-green-400' : 'text-yellow-400'}>{playerReady ? 'Yes' : 'No'}</span></div>
                        <div>Playing: <span className="text-white">{playing ? 'Yes' : 'No'}</span></div>
                        {url && <div className="break-all text-blue-400">{url}</div>}
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-gray-800/50 p-3 rounded text-xs text-gray-400 text-center">
                    💡 {isHost ? 'You control the playback. Viewers will sync automatically.' : 'Video is controlled by the host. Enjoy!'}
                </div>
            </div>
        </div>
    );
}