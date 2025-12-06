import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, PhoneOff, Copy, Check, Users, Heart, Maximize, Settings, X, Wifi, WifiOff } from 'lucide-react';

const WatchParty = () => {
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [inputPeerId, setInputPeerId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoQuality, setVideoQuality] = useState('540p');
  const [frameRate, setFrameRate] = useState(15);
  const [networkQuality, setNetworkQuality] = useState('good');
  const [iceServers, setIceServers] = useState([]);
  const [localSdp, setLocalSdp] = useState('');
  const [remoteSdp, setRemoteSdp] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const fullscreenContainerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const statsIntervalRef = useRef(null);

  const names = {
    wyan: 'Wyandhanu Maulidan Nugraha',
    maha: "Maha Nur'Aeni"
  };

  const qualityPresets = {
    '480p': {
      width: 854,
      height: 480,
      label: '480p (Ultra Fast)',
      bitrate: 1000000,
      priority: 'very-low'
    },
    '540p': {
      width: 960,
      height: 540,
      label: '540p (Super Smooth)',
      bitrate: 1500000,
      priority: 'low'
    },
    '720p': {
      width: 1280,
      height: 720,
      label: '720p (Balanced)',
      bitrate: 2500000,
      priority: 'medium'
    }
  };

  // Get fast ICE servers
  const getFastIceServers = useCallback(() => {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ];
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(async (isOfferer = false) => {
    try {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      const servers = getFastIceServers();
      setIceServers(servers);

      const config = {
        iceServers: servers,
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 5,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate);
        }
      };

      // Handle connection state
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        switch (pc.iceConnectionState) {
          case 'connected':
          case 'completed':
            setCallActive(true);
            setConnectionStatus('✅ Connected (P2P)');
            setTimeout(() => setConnectionStatus(''), 3000);
            break;
          case 'disconnected':
          case 'failed':
            setCallActive(false);
            setConnectionStatus('⚠️ Connection lost');
            break;
        }
      };

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };

      // Handle data channel
      if (isOfferer) {
        const dc = pc.createDataChannel('watchparty');
        setupDataChannel(dc);
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };
      }

      return pc;
    } catch (err) {
      console.error('Error creating peer connection:', err);
      setError('Failed to create connection: ' + err.message);
      return null;
    }
  }, [getFastIceServers]);

  const setupDataChannel = (dc) => {
    dataChannelRef.current = dc;
    dc.onopen = () => {
      console.log('Data channel opened');
    };
    dc.onmessage = (event) => {
      console.log('Data channel message:', event.data);
    };
  };

  // Create offer
  const createOffer = useCallback(async () => {
    try {
      const pc = await createPeerConnection(true);
      if (!pc) return null;

      // Add local stream if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await pc.setLocalDescription(offer);

      // Optimize SDP for screen sharing
      const optimizedSdp = optimizeSdp(offer.sdp, isScreenSharing);
      const optimizedOffer = new RTCSessionDescription({
        type: 'offer',
        sdp: optimizedSdp
      });

      await pc.setLocalDescription(optimizedOffer);

      return pc.localDescription.sdp;
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create offer: ' + err.message);
      return null;
    }
  }, [createPeerConnection, isScreenSharing]);

  // Create answer
  const createAnswer = useCallback(async (offerSdp) => {
    try {
      const pc = await createPeerConnection(false);
      if (!pc) return null;

      // Add local stream if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp
      }));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Optimize SDP
      const optimizedSdp = optimizeSdp(answer.sdp, isScreenSharing);
      const optimizedAnswer = new RTCSessionDescription({
        type: 'answer',
        sdp: optimizedSdp
      });

      await pc.setLocalDescription(optimizedAnswer);

      return pc.localDescription.sdp;
    } catch (err) {
      console.error('Error creating answer:', err);
      setError('Failed to create answer: ' + err.message);
      return null;
    }
  }, [createPeerConnection, isScreenSharing]);

  // Optimize SDP for performance
  const optimizeSdp = (sdp, forScreenSharing = false) => {
    let modifiedSdp = sdp;

    // Set bandwidth limits
    const quality = qualityPresets[videoQuality];
    modifiedSdp = modifiedSdp.replace(/a=mid:video\r\n/g,
      `a=mid:video\r\nb=AS:${quality.bitrate}\r\nb=TIAS:${quality.bitrate}\r\n`);

    // Prioritize H.264 for screen sharing
    if (forScreenSharing) {
      modifiedSdp = modifiedSdp.replace(/a=rtpmap:(\d+) H264\/90000\r\n/g,
        (match, p1) => `a=rtpmap:${p1} H264/90000\r\na=fmtp:${p1} profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1\r\n`);
    }

    return modifiedSdp;
  };

  // Add ICE candidate
  const addIceCandidate = useCallback(async (candidate) => {
    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  }, []);

  // Initialize peer
  const initializePeer = useCallback(() => {
    if (!selectedName) {
      setError('Please select your name first!');
      return;
    }

    cleanup();
    setConnectionStatus('Setting up P2P connection...');
    setError('');

    const id = `watchparty-${selectedName}-${Date.now()}`;
    setPeerId(id);
    setUserName(names[selectedName]);

    // Create empty stream for connection
    localStreamRef.current = new MediaStream();

    setIsConnected(true);
    setConnectionStatus('✅ Ready to connect');
    setTimeout(() => setConnectionStatus(''), 2000);
  }, [selectedName]);

  // Connect using SDP exchange (copy-paste method)
  const connectViaSdp = useCallback(async () => {
    if (!inputPeerId) {
      setError('Please enter the offer SDP');
      return;
    }

    try {
      setConnectionStatus('Creating answer...');
      const answerSdp = await createAnswer(inputPeerId);
      if (answerSdp) {
        setLocalSdp(answerSdp);
        setConnectionStatus('✅ Answer created - Copy and send to partner');
      }
    } catch (err) {
      setError('Failed to create connection: ' + err.message);
    }
  }, [inputPeerId, createAnswer]);

  // Start call as offerer
  const startCall = useCallback(async () => {
    try {
      setConnectionStatus('Creating offer...');
      const offerSdp = await createOffer();
      if (offerSdp) {
        setLocalSdp(offerSdp);
        setConnectionStatus('✅ Offer created - Send to partner');
      }
    } catch (err) {
      setError('Failed to start call: ' + err.message);
    }
  }, [createOffer]);

  // Apply remote SDP
  const applyRemoteSdp = useCallback(async () => {
    if (!remoteSdp) {
      setError('Please enter remote SDP');
      return;
    }

    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({
          type: remoteSdp.includes('a=sendrecv') ? 'offer' : 'answer',
          sdp: remoteSdp
        }));
        setConnectionStatus('✅ Remote SDP applied');
      }
    } catch (err) {
      setError('Failed to apply remote SDP: ' + err.message);
    }
  }, [remoteSdp]);

  // Optimized screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      if (!peerConnectionRef.current) {
        setError('Please establish connection first!');
        return;
      }

      try {
        const quality = qualityPresets[videoQuality];

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: quality.width, max: quality.width },
            height: { ideal: quality.height, max: quality.height },
            frameRate: { ideal: frameRate, max: frameRate },
            displaySurface: 'monitor'
          },
          audio: false
        });

        const videoTrack = stream.getVideoTracks()[0];

        // Apply constraints for optimal performance
        await videoTrack.applyConstraints({
          width: { ideal: quality.width },
          height: { ideal: quality.height },
          frameRate: { ideal: frameRate },
          bitrate: quality.bitrate
        });

        // Replace video track in peer connection
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');

        if (videoSender) {
          videoSender.replaceTrack(videoTrack);
        } else {
          peerConnectionRef.current.addTrack(videoTrack, stream);
        }

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        // Optimize sender parameters
        if (videoSender) {
          const params = videoSender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          params.encodings[0] = {
            ...params.encodings[0],
            maxBitrate: quality.bitrate,
            priority: quality.priority,
            scaleResolutionDownBy: 1
          };
          videoSender.setParameters(params);
        }

        // Handle screen share stop
        videoTrack.onended = () => {
          toggleScreenShare();
        };

        screenStreamRef.current = stream;
        setIsScreenSharing(true);

        setConnectionStatus(`📺 Screen: ${videoQuality} @ ${frameRate}fps`);
        setTimeout(() => setConnectionStatus(''), 3000);

      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          console.error('Screen share error:', err);
          setError('Failed to start screen share: ' + err.message);
        }
        setIsScreenSharing(false);
      }
    } else {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      // Restore camera if available
      if (isCamOn && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack && peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          }
        }
      }

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }

      setIsScreenSharing(false);
    }
  }, [isScreenSharing, videoQuality, frameRate, isCamOn]);

  // Toggle camera
  const toggleCam = useCallback(async () => {
    try {
      if (!isCamOn) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 20 }
          }
        });

        const videoTrack = stream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          localStreamRef.current.removeTrack(track);
        });

        localStreamRef.current.addTrack(videoTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Update peer connection if active
        if (peerConnectionRef.current && !isScreenSharing) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');

          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          } else {
            peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);
          }
        }

        setIsCamOn(true);
      } else {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          localStreamRef.current.removeTrack(track);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }

        setIsCamOn(false);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera error: ' + err.message);
    }
  }, [isCamOn, isScreenSharing]);

  // Toggle microphone
  const toggleMic = useCallback(async () => {
    try {
      if (!isMicOn) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        const audioTrack = stream.getAudioTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        localStreamRef.current.getAudioTracks().forEach(track => {
          track.stop();
          localStreamRef.current.removeTrack(track);
        });

        localStreamRef.current.addTrack(audioTrack);

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio');

          if (audioSender) {
            audioSender.replaceTrack(audioTrack);
          } else {
            peerConnectionRef.current.addTrack(audioTrack, localStreamRef.current);
          }
        }

        setIsMicOn(true);
      } else {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.stop();
          localStreamRef.current.removeTrack(track);
        });
        setIsMicOn(false);
      }
    } catch (err) {
      console.error('Mic error:', err);
      setError('Mic error: ' + err.message);
    }
  }, [isMicOn]);

  // Cleanup
  const cleanup = useCallback(() => {
    console.log('Cleaning up...');

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    [localStreamRef.current, screenStreamRef.current].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });

    [localVideoRef.current, remoteVideoRef.current, screenVideoRef.current].forEach(video => {
      if (video) video.srcObject = null;
    });

    dataChannelRef.current = null;
    setCallActive(false);
    setIsScreenSharing(false);
    setIsCamOn(false);
    setIsMicOn(false);
    setLocalSdp('');
    setRemoteSdp('');
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setIsConnected(false);
    setPeerId('');
    setRemotePeerId('');
    setInputPeerId('');
    setSelectedName('');
    setUserName('');
    setConnectionStatus('');
    setError('');
  }, [cleanup]);

  // Copy SDP to clipboard
  const copySdp = useCallback((sdp) => {
    navigator.clipboard.writeText(sdp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Initial connection UI
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-700 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-2xl border border-white/20">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Users className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 animate-pulse">
                  <Heart className="w-10 h-10 text-red-400" />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">
              Watch Party VIP ✨
            </h1>
            <p className="text-blue-100 text-lg">
              Ultra-fast P2P screen sharing with WebRTC
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/40 rounded-xl backdrop-blur-sm">
              <p className="text-sm text-red-100 text-center">{error}</p>
            </div>
          )}

          <div className="mb-8">
            <label className="block text-sm font-medium text-blue-100 mb-4">
              Select Your Name
            </label>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(names).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => setSelectedName(key)}
                  className={`p-5 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${selectedName === key
                      ? key === 'wyan'
                        ? 'border-blue-400 bg-blue-500/30 shadow-lg shadow-blue-500/30'
                        : 'border-pink-400 bg-pink-500/30 shadow-lg shadow-pink-500/30'
                      : 'border-white/30 bg-white/5 hover:border-white/50'
                    }`}
                >
                  <div className="font-bold text-lg text-white">
                    {name.split(' ')[0]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={initializePeer}
            disabled={!selectedName}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${selectedName
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 hover:shadow-2xl hover:shadow-cyan-500/30'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
              }`}
          >
            🚀 Start P2P Connection
          </button>

          <div className="mt-10 p-5 bg-black/30 rounded-2xl border border-white/10">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center space-x-2">
                <Wifi className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-bold">Super Fast Setup:</span>
              </div>
            </div>
            <ol className="text-sm text-blue-100 space-y-3 list-decimal list-inside">
              <li>Select name and click "Start P2P Connection"</li>
              <li>Click "Create Offer" to generate SDP</li>
              <li>Copy the SDP and send to your partner</li>
              <li>Partner pastes it in "Remote SDP" field and clicks "Apply"</li>
              <li>Partner copies their SDP and sends it back to you</li>
              <li>Paste partner's SDP in "Remote SDP" and click "Apply"</li>
              <li>You're connected! Toggle screen share to start</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              {networkQuality === 'good' && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{userName}</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">P2P Mode: Direct</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`px-4 py-2 rounded-full flex items-center space-x-2 ${callActive
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : 'bg-gradient-to-r from-yellow-500 to-orange-600'
              }`}>
              <Wifi className="w-4 h-4 text-white" />
              <span className="text-white font-semibold text-sm">
                {callActive ? 'P2P LIVE' : 'READY'}
              </span>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold text-xl">⚡ Performance Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Screen Quality
                </label>
                <select
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value)}
                  disabled={isScreenSharing}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  {Object.entries(qualityPresets).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
                <p className="text-xs text-cyan-400 mt-2">
                  {videoQuality === '480p' ? '⚡ Ultra Fast - Recommended' : ''}
                  {videoQuality === '540p' ? '🚀 Super Smooth' : ''}
                  {videoQuality === '720p' ? '🎬 High Quality' : ''}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Frame Rate: {frameRate} FPS
                </label>
                <input
                  type="range"
                  min="10"
                  max="30"
                  step="5"
                  value={frameRate}
                  onChange={(e) => setFrameRate(parseInt(e.target.value))}
                  disabled={isScreenSharing}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>10</span>
                  <span>15</span>
                  <span>20</span>
                  <span>25</span>
                  <span>30</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {(connectionStatus || error) && (
        <div className="px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
          {connectionStatus && (
            <p className="text-center text-sm font-medium text-cyan-300">{connectionStatus}</p>
          )}
          {error && (
            <p className="text-center text-sm font-medium text-red-300">{error}</p>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" ref={fullscreenContainerRef}>
        {/* Screen Share Area */}
        <div className="flex-1 bg-black relative">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-contain bg-black"
          />

          {/* Fullscreen Button */}
          {screenStreamRef.current && (
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  fullscreenContainerRef.current.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }}
              className="absolute top-4 right-4 p-3 bg-gray-900/80 hover:bg-gray-900 rounded-xl transition z-50 backdrop-blur-sm"
            >
              <Maximize className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Empty State */}
          {!screenStreamRef.current && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black">
              <div className="text-center p-8">
                <div className="w-24 h-24 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-700">
                  <Monitor className="w-12 h-12 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-400 mb-3">No Screen Sharing</h3>
                <p className="text-gray-600 max-w-md">
                  Establish connection and click screen share button to start
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={`w-full bg-gradient-to-b from-gray-900 to-black flex flex-col border-l border-gray-800 ${isFullscreen ? 'hidden' : 'lg:w-96'
          }`}>
          <div className="flex-1 p-5 space-y-5 overflow-y-auto">
            {/* SDP Exchange Section */}
            <div className="space-y-4">
              {!callActive ? (
                <>
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-5 border border-gray-700">
                    <h3 className="text-white font-bold mb-3">🔗 SDP Exchange</h3>

                    <div className="space-y-4">
                      <button
                        onClick={startCall}
                        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-cyan-500/30 transition-all"
                      >
                        Create Offer
                      </button>

                      <button
                        onClick={connectViaSdp}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-700 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-500/30 transition-all"
                      >
                        Create Answer
                      </button>
                    </div>
                  </div>

                  {localSdp && (
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-5 border border-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-white font-bold">Your SDP:</h4>
                        <button
                          onClick={() => copySdp(localSdp)}
                          className="flex items-center space-x-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                        >
                          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
                          <span className="text-white text-sm">Copy</span>
                        </button>
                      </div>
                      <textarea
                        value={localSdp}
                        readOnly
                        className="w-full h-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-xs font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Send this to your partner
                      </p>
                    </div>
                  )}

                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-5 border border-gray-700">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-white font-bold">Remote SDP:</h4>
                      <button
                        onClick={applyRemoteSdp}
                        className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                      >
                        Apply
                      </button>
                    </div>
                    <textarea
                      value={remoteSdp}
                      onChange={(e) => setRemoteSdp(e.target.value)}
                      placeholder="Paste partner's SDP here..."
                      className="w-full h-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs font-mono placeholder-gray-500"
                    />
                  </div>
                </>
              ) : (
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-2xl p-5 border border-green-700">
                  <div className="flex items-center justify-center space-x-2">
                    <Wifi className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-bold">P2P Connected!</span>
                  </div>
                  <p className="text-sm text-gray-300 text-center mt-2">
                    Screen sharing is now available
                  </p>
                </div>
              )}
            </div>

            {/* Local Video */}
            <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden aspect-video border border-gray-800">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!isCamOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                  <VideoOff className="w-12 h-12 text-gray-700 mb-3" />
                  <span className="text-gray-600 text-sm">Camera Off</span>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <span className="text-xs text-white font-medium">
                  You {isMicOn ? '🎤' : '🔇'}
                </span>
              </div>
            </div>

            {/* Remote Video */}
            <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden aspect-video border border-gray-800">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!callActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                  <Users className="w-12 h-12 text-gray-700 mb-3" />
                  <span className="text-gray-600 text-sm">Waiting for connection...</span>
                </div>
              )}
              {callActive && (
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-white font-medium">
                    {selectedName === 'wyan' ? 'Maha 💕' : 'Wyandhanu 💕'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel */}
          <div className="p-5 bg-gradient-to-t from-gray-900 to-black border-t border-gray-800">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <button
                onClick={toggleMic}
                className={`p-4 rounded-xl transition-all ${isMicOn
                    ? 'bg-gradient-to-r from-green-600 to-emerald-700 shadow-lg shadow-green-500/20'
                    : 'bg-gradient-to-r from-gray-800 to-gray-900 hover:bg-gray-800 border border-gray-700'
                  }`}
              >
                {isMicOn ? (
                  <Mic className="w-5 h-5 text-white mx-auto" />
                ) : (
                  <MicOff className="w-5 h-5 text-white mx-auto" />
                )}
              </button>

              <button
                onClick={toggleCam}
                className={`p-4 rounded-xl transition-all ${isCamOn
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-700 shadow-lg shadow-blue-500/20'
                    : 'bg-gradient-to-r from-gray-800 to-gray-900 hover:bg-gray-800 border border-gray-700'
                  }`}
              >
                {isCamOn ? (
                  <Video className="w-5 h-5 text-white mx-auto" />
                ) : (
                  <VideoOff className="w-5 h-5 text-white mx-auto" />
                )}
              </button>

              <button
                onClick={toggleScreenShare}
                disabled={!callActive}
                className={`p-4 rounded-xl transition-all ${isScreenSharing
                    ? 'bg-gradient-to-r from-purple-600 to-pink-700 shadow-lg shadow-purple-500/20'
                    : callActive
                      ? 'bg-gradient-to-r from-gray-800 to-gray-900 hover:bg-gray-800 border border-gray-700'
                      : 'bg-gray-900 border border-gray-800 opacity-50 cursor-not-allowed'
                  }`}
              >
                {isScreenSharing ? (
                  <Monitor className="w-5 h-5 text-white mx-auto" />
                ) : (
                  <MonitorOff className="w-5 h-5 text-white mx-auto" />
                )}
              </button>

              <button
                onClick={disconnect}
                className="p-4 bg-gradient-to-r from-red-600 to-pink-700 hover:shadow-lg hover:shadow-red-500/20 rounded-xl transition-all"
              >
                <PhoneOff className="w-5 h-5 text-white mx-auto" />
              </button>
            </div>

            <div className="flex items-center justify-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${callActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                }`}></div>
              <p className="text-xs text-gray-400">
                {callActive
                  ? `P2P Connected • WebRTC Direct`
                  : 'Create/Apply SDP to connect'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchParty;