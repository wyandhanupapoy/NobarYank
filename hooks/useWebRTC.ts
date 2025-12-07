import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, subscribeToRoom, sendSignal } from '../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export const useWebRTC = (roomId: string, isHost: boolean) => {
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const onDataReceive = useRef<(data: any) => void>(() => { });

    // Message queue untuk mengirim saat channel belum siap
    const messageQueue = useRef<any[]>([]);

    // Flag untuk mencegah race condition
    const isNegotiating = useRef(false);
    const makingOffer = useRef(false);

    // Fungsi untuk flush message queue
    const flushMessageQueue = useCallback(() => {
        if (dataChannelRef.current?.readyState === 'open' && messageQueue.current.length > 0) {
            console.log(`📤 Flushing ${messageQueue.current.length} queued messages`);
            messageQueue.current.forEach(msg => {
                try {
                    dataChannelRef.current?.send(JSON.stringify(msg));
                    console.log('✅ Sent queued message:', msg.type);
                } catch (err) {
                    console.error('❌ Failed to send queued message:', err);
                }
            });
            messageQueue.current = [];
        }
    }, []);

    const setupDataChannel = useCallback((dc: RTCDataChannel) => {
        dataChannelRef.current = dc;

        dc.onopen = () => {
            console.log('✅ Data channel opened');
            setStatus('connected');
            // Kirim semua pesan yang tertunda
            flushMessageQueue();
        };

        dc.onclose = () => {
            console.log('❌ Data channel closed');
            setStatus('disconnected');
        };

        dc.onerror = (error) => {
            console.error('Data channel error:', error);
        };

        dc.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                onDataReceive.current(msg);
            } catch (err) {
                console.error('Failed to parse message:', err);
            }
        };
    }, [flushMessageQueue]);

    const handleSignalMessage = useCallback(async (msg: any) => {
        const pc = peerRef.current;
        if (!pc) return;

        try {
            if (msg.type === 'offer' && !isHost) {
                const offerCollision =
                    pc.signalingState !== 'stable' || makingOffer.current;

                if (offerCollision) {
                    console.log('⚠️ Offer collision detected, ignoring');
                    return;
                }

                console.log('📩 Received offer, creating answer...');
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                if (channelRef.current) {
                    await sendSignal(channelRef.current, {
                        type: 'answer',
                        sdp: answer
                    });
                }
            }
            else if (msg.type === 'answer' && isHost) {
                if (pc.signalingState === 'have-local-offer') {
                    console.log('📨 Received answer, setting remote description');
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                    isNegotiating.current = false;
                } else {
                    console.warn('⚠️ Unexpected answer in state:', pc.signalingState);
                }
            }
            else if (msg.type === 'ice-candidate') {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
            }
            else if (msg.type === 'join' && isHost) {
                if (isNegotiating.current) {
                    console.log('⚠️ Already negotiating, ignoring join');
                    return;
                }

                console.log('👤 Peer joined, creating offer...');
                isNegotiating.current = true;
                makingOffer.current = true;

                // Tunggu ICE gathering
                await new Promise(resolve => setTimeout(resolve, 500));

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                makingOffer.current = false;

                if (channelRef.current) {
                    await sendSignal(channelRef.current, {
                        type: 'offer',
                        sdp: offer
                    });
                }
            }
        } catch (err: any) {
            console.error("❌ Signal Error:", err.message || err);
            isNegotiating.current = false;
            makingOffer.current = false;
        }
    }, [isHost]);

    useEffect(() => {
        setStatus('connecting');
        console.log(`🔄 Initializing WebRTC for room: ${roomId}`);

        channelRef.current = subscribeToRoom(roomId, handleSignalMessage);

        const pc = new RTCPeerConnection(STUN_SERVERS);
        peerRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate && channelRef.current) {
                sendSignal(channelRef.current, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('🧊 ICE State:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                console.error('❌ ICE connection failed, restarting...');
                pc.restartIce();
            }
        };

        pc.onicegatheringstatechange = () => {
            console.log('📡 ICE Gathering State:', pc.iceGatheringState);
        };

        pc.onconnectionstatechange = () => {
            console.log('🔗 Connection State:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                // Jangan set status connected di sini, tunggu data channel
                console.log('✅ WebRTC peer connected, waiting for data channel...');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setStatus('disconnected');
                isNegotiating.current = false;
            }
        };

        pc.onsignalingstatechange = () => {
            console.log('📶 Signaling State:', pc.signalingState);
        };

        if (isHost) {
            console.log('👑 Creating data channel (HOST)');
            const dc = pc.createDataChannel('sync-channel', {
                ordered: true,
                maxRetransmits: 3
            });
            setupDataChannel(dc);
        } else {
            console.log('👥 Waiting for data channel (PEER)');
            pc.ondatachannel = (event) => {
                console.log('📡 Data channel received');
                setupDataChannel(event.channel);
            };
        }

        return () => {
            console.log('🧹 Cleaning up WebRTC connection');
            isNegotiating.current = false;
            makingOffer.current = false;
            messageQueue.current = [];
            pc.close();
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [roomId, isHost, handleSignalMessage, setupDataChannel]);

    const sendData = useCallback((data: any) => {
        const dcState = dataChannelRef.current?.readyState;

        if (dcState === 'open') {
            // Channel ready, kirim langsung
            try {
                dataChannelRef.current?.send(JSON.stringify(data));
                console.log('✅ Sent immediately:', data.type);
            } catch (err) {
                console.error('❌ Failed to send data:', err);
            }
        } else {
            // Channel belum ready, queue message
            console.log(`📦 Queuing message (channel state: ${dcState}):`, data.type);
            messageQueue.current.push(data);

            // Coba flush setelah delay
            setTimeout(() => {
                flushMessageQueue();
            }, 1000);
        }
    }, [flushMessageQueue]);

    return { status, sendData, onDataReceive };
};