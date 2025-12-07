import { useEffect, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';

const DRIFT_THRESHOLD = 0.5;

export const useSync = (
    isHost: boolean,
    sendData: (data: any) => void,
    playerRef: React.RefObject<ReactPlayer | null>,
    isPlaying: boolean
) => {
    const [url, setUrl] = useState<string>('');
    const [latencyMetrics, setLatencyMetrics] = useState({ rtt: 0, offset: 0 });

    const handleSyncMessage = useCallback((msg: any) => {
        console.log('📨 Received message:', msg.type, msg);

        if (msg.type === 'SYNC') {
            const now = performance.now();
            const rtt = now - msg.timestamp;
            const networkDelay = rtt / 2;

            setLatencyMetrics({ rtt, offset: networkDelay });

            // UPDATE URL jika berbeda (penting untuk viewer)
            if (msg.url && msg.url !== url) {
                console.log('📺 Received new URL from host:', msg.url);
                setUrl(msg.url);
            }

            // Sync time hanya jika player sudah ada
            const player = playerRef.current;
            if (player && player.getCurrentTime) {
                const targetTime = msg.time + (networkDelay / 1000);
                const currentTime = player.getCurrentTime();

                // Drift Correction Logic
                if (currentTime > 0 && Math.abs(targetTime - currentTime) > DRIFT_THRESHOLD) {
                    console.log(`🔄 Syncing: ${currentTime.toFixed(2)}s → ${targetTime.toFixed(2)}s`);
                    player.seekTo(targetTime, 'seconds');
                }
            }
        }

        // Command Control
        if (msg.type === 'CONTROL') {
            const player = playerRef.current;
            if (player && msg.action === 'seek' && typeof msg.time === 'number') {
                console.log('⏩ Seek command received:', msg.time);
                player.seekTo(msg.time, 'seconds');
            }
        }
    }, [url, playerRef]);

    // HOST: Kirim heartbeat setiap 1 detik (hanya jika ada URL)
    useEffect(() => {
        if (!isHost || !url) return;

        const interval = setInterval(() => {
            const player = playerRef.current;
            if (!player || !player.getCurrentTime) return;

            const currentTime = player.getCurrentTime();
            if (typeof currentTime !== 'number') return;

            // Kirim sync data
            sendData({
                type: 'SYNC',
                isPlaying: isPlaying,
                time: currentTime,
                timestamp: performance.now(),
                url: url
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isHost, url, isPlaying, sendData, playerRef]);

    return { url, setUrl, handleSyncMessage, latencyMetrics };
};