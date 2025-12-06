import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, PhoneOff, Copy, Check, Users, Heart, Maximize, Settings, X } from 'lucide-react';
import Peer from 'peerjs';

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
  const [videoQuality, setVideoQuality] = useState('720p');
  const [frameRate, setFrameRate] = useState(30);

  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const fullscreenContainerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callRef = useRef(null);
  const screenCallRef = useRef(null);
  const dataConnectionRef = useRef(null);
  const pendingCallsRef = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);

  const names = {
    wyan: 'Wyandhanu Maulidan Nugraha',
    maha: "Maha Nur'Aeni"
  };

  const qualityPresets = {
    '1080p': {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      label: '1080p (HD)',
      bitrate: 4000000,
      priority: 'high'
    },
    '720p': {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      label: '720p (Balanced)',
      bitrate: 2500000,
      priority: 'balanced'
    },
    '540p': {
      width: { ideal: 960 },
      height: { ideal: 540 },
      label: '540p (Smooth)',
      bitrate: 1500000,
      priority: 'low'
    }
  };

  // Optimized PeerJS configuration
  const getPeerConfig = (customId = null) => ({
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
        }
      ],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 5,
      rtcpMuxPolicy: 'require',
      bundlePolicy: 'max-bundle',
      sdpSemantics: 'unified-plan'
    },
    iceCandidatePoolSize: 5,
    debug: 0
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up resources...');

    // Clear timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Stop all media tracks
    [localStreamRef.current, screenStreamRef.current].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
    });

    // Close connections
    [callRef.current, screenCallRef.current, dataConnectionRef.current].forEach(conn => {
      if (conn) {
        conn.close();
        conn.removeAllListeners();
      }
    });

    // Destroy peer
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }

    // Clear refs
    localStreamRef.current = null;
    screenStreamRef.current = null;
    callRef.current = null;
    screenCallRef.current = null;
    dataConnectionRef.current = null;
    pendingCallsRef.current.clear();

    // Reset video elements
    [localVideoRef.current, remoteVideoRef.current, screenVideoRef.current].forEach(video => {
      if (video) {
        video.srcObject = null;
      }
    });
  }, []);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      cleanup();
    };
  }, [cleanup]);

  // Initialize Peer with better error handling
  const initializePeer = useCallback(() => {
    if (!selectedName) {
      setError('Pilih nama kamu terlebih dahulu!');
      return;
    }

    cleanup(); // Clean any existing connections first

    setConnectionStatus('Menghubungkan...');
    setError('');

    const customId = `watchparty-${selectedName}-${Date.now().toString(36)}`;

    try {
      const peer = new Peer(customId, getPeerConfig());
      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log('Peer connected with ID:', id);
        setPeerId(id);
        setUserName(names[selectedName]);
        setIsConnected(true);
        setConnectionStatus('✅ Siap!');

        // Create empty media stream for connection without cam/mic
        localStreamRef.current = new MediaStream();

        setTimeout(() => setConnectionStatus(''), 2000);
      });

      peer.on('call', async (call) => {
        console.log('Incoming call from:', call.peer, 'Type:', call.metadata?.type);

        // Add to pending calls to prevent duplicate handling
        if (pendingCallsRef.current.has(call.peer + call.metadata?.type)) {
          call.close();
          return;
        }
        pendingCallsRef.current.add(call.peer + call.metadata?.type);

        try {
          const stream = call.metadata?.type === 'screen'
            ? screenStreamRef.current || new MediaStream()
            : localStreamRef.current;

          call.answer(stream);

          call.on('stream', (remoteStream) => {
            console.log('Received stream for:', call.metadata?.type || 'video');

            if (call.metadata?.type === 'screen') {
              if (screenVideoRef.current) {
                screenVideoRef.current.srcObject = remoteStream;
              }
              screenStreamRef.current = remoteStream;
              screenCallRef.current = call;
            } else {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
              callRef.current = call;
              setCallActive(true);
              setConnectionStatus('🎉 Terhubung!');
              setTimeout(() => setConnectionStatus(''), 2000);
            }
          });

          call.on('close', () => {
            console.log('Call closed:', call.metadata?.type || 'video');
            pendingCallsRef.current.delete(call.peer + call.metadata?.type);

            if (call.metadata?.type === 'screen') {
              if (screenVideoRef.current) {
                screenVideoRef.current.srcObject = null;
              }
              screenStreamRef.current = null;
              screenCallRef.current = null;
              setIsScreenSharing(false);
            } else {
              setCallActive(false);
              callRef.current = null;
            }
          });

          call.on('error', (err) => {
            console.error('Call error:', err);
            pendingCallsRef.current.delete(call.peer + call.metadata?.type);
          });

        } catch (err) {
          console.error('Error answering call:', err);
          pendingCallsRef.current.delete(call.peer + call.metadata?.type);
          call.close();
        }
      });

      peer.on('connection', (conn) => {
        dataConnectionRef.current = conn;

        conn.on('data', (data) => {
          console.log('Data received:', data);
          // Handle data channel messages if needed
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);

        let errorMsg = 'Koneksi error: ';
        switch (err.type) {
          case 'peer-unavailable':
            errorMsg = 'Peer tidak tersedia. Pastikan ID benar!';
            break;
          case 'network':
            errorMsg = 'Network error. Coba lagi.';
            break;
          case 'browser-incompatible':
            errorMsg = 'Browser tidak support WebRTC. Gunakan Chrome/Firefox terbaru.';
            break;
          default:
            errorMsg += err.type;
        }

        setError(errorMsg);
        setConnectionStatus('');

        // Attempt reconnection for non-fatal errors
        if (err.type !== 'browser-incompatible') {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (peerRef.current && peerRef.current.destroyed) {
              initializePeer();
            }
          }, 3000);
        }
      });

      peer.on('disconnected', () => {
        console.log('Peer disconnected, attempting reconnect...');
        peer.reconnect();
      });

    } catch (err) {
      console.error('Failed to initialize peer:', err);
      setError('Gagal membuat koneksi. Refresh halaman dan coba lagi.');
    }
  }, [selectedName, cleanup]);

  // Connect to peer with better error handling
  const connectToPeer = useCallback(async () => {
    if (!inputPeerId.trim()) {
      setError('Masukkan Peer ID pasangan!');
      return;
    }

    // Even without cam/mic, we have an empty stream for connection
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    setError('');
    setConnectionStatus('Menghubungi...');
    setRemotePeerId(inputPeerId);

    try {
      const call = peerRef.current.call(inputPeerId, localStreamRef.current, {
        metadata: { type: 'video' }
      });

      callRef.current = call;

      call.on('stream', (remoteStream) => {
        console.log('Connected to peer, stream received');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setCallActive(true);
        setConnectionStatus('🎉 Terhubung!');
        setTimeout(() => setConnectionStatus(''), 2000);
      });

      call.on('close', () => {
        console.log('Call closed');
        setCallActive(false);
        callRef.current = null;
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        setError('Gagal connect: ' + (err.message || err.type));
        setCallActive(false);
      });

    } catch (err) {
      console.error('Error creating call:', err);
      setError('Gagal membuat panggilan: ' + err.message);
    }
  }, [inputPeerId]);

  // Optimized toggle functions
  const toggleMic = useCallback(async () => {
    try {
      if (!isMicOn) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });

        const audioTrack = stream.getAudioTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        // Remove existing audio track if any
        localStreamRef.current.getAudioTracks().forEach(track => track.stop());

        // Add new audio track
        localStreamRef.current.addTrack(audioTrack);

        // Update existing call with new track if active
        if (callRef.current) {
          const sender = callRef.current.peerConnection
            .getSenders()
            .find(s => s.track && s.track.kind === 'audio');

          if (sender) {
            sender.replaceTrack(audioTrack);
          } else {
            callRef.current.peerConnection.addTrack(audioTrack, localStreamRef.current);
          }
        }

        setIsMicOn(true);
        setError('');
      } else {
        // Stop and remove audio track
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.stop();
          localStreamRef.current.removeTrack(track);
        });

        setIsMicOn(false);
      }
    } catch (err) {
      console.error('Mic error:', err);
      setError('Tidak bisa akses mic!');
    }
  }, [isMicOn]);

  const toggleCam = useCallback(async () => {
    try {
      if (!isCamOn) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 20 },
            facingMode: 'user'
          }
        });

        const videoTrack = stream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        // Remove existing video track if any
        localStreamRef.current.getVideoTracks().forEach(track => track.stop());

        // Add new video track
        localStreamRef.current.addTrack(videoTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Update existing call with new track if active
        if (callRef.current) {
          const sender = callRef.current.peerConnection
            .getSenders()
            .find(s => s.track && s.track.kind === 'video');

          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            callRef.current.peerConnection.addTrack(videoTrack, localStreamRef.current);
          }
        }

        setIsCamOn(true);
        setError('');
      } else {
        // Stop and remove video track
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          localStreamRef.current.removeTrack(track);
        });

        if (localVideoRef.current && !isMicOn) {
          localVideoRef.current.srcObject = null;
        }
        setIsCamOn(false);
      }
    } catch (err) {
      console.error('Cam error:', err);
      setError('Tidak bisa akses camera!');
    }
  }, [isCamOn, isMicOn]);

  // Optimized screen sharing with better quality control
  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      if (!callActive && !remotePeerId) {
        setError('Hubungkan dengan pasangan terlebih dahulu!');
        return;
      }

      try {
        const quality = qualityPresets[videoQuality];

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: quality.width,
            height: quality.height,
            frameRate: { ideal: frameRate, max: 60 },
            displaySurface: 'monitor'
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2
          }
        });

        const targetPeerId = remotePeerId || callRef.current?.peer;

        if (targetPeerId) {
          const call = peerRef.current.call(targetPeerId, stream, {
            metadata: { type: 'screen', quality: videoQuality, frameRate }
          });

          // Optimize screen share quality
          if (call.peerConnection) {
            const transceiver = call.peerConnection.getTransceivers?.().find(t =>
              t.sender.track?.kind === 'video'
            );

            if (transceiver) {
              const params = transceiver.sender.getParameters();
              params.encodings = [{
                rid: 'high',
                active: true,
                maxBitrate: quality.bitrate,
                priority: quality.priority,
                scaleResolutionDownBy: 1
              }];
              transceiver.sender.setParameters(params);
            }
          }

          screenCallRef.current = call;

          call.on('close', () => {
            if (screenVideoRef.current?.srcObject) {
              screenVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
              screenVideoRef.current.srcObject = null;
            }
            screenCallRef.current = null;
            setIsScreenSharing(false);
          });
        }

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        // Auto-stop when user stops sharing from browser
        stream.getVideoTracks()[0].onended = () => {
          if (screenCallRef.current) {
            screenCallRef.current.close();
          }
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
        setConnectionStatus(`🖥️ Screen share: ${videoQuality} @ ${frameRate}fps`);
        setTimeout(() => setConnectionStatus(''), 3000);

      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          console.error('Screen share error:', err);
          setError('Gagal memulai screen share');
        }
        setIsScreenSharing(false);
      }
    } else {
      // Stop screen sharing
      if (screenCallRef.current) {
        screenCallRef.current.close();
      }
      if (screenVideoRef.current?.srcObject) {
        screenVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        screenVideoRef.current.srcObject = null;
      }
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }
  }, [isScreenSharing, callActive, remotePeerId, videoQuality, frameRate]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await fullscreenContainerRef.current.requestFullscreen();
      } catch (err) {
        console.error('Fullscreen error:', err);
      }
    } else {
      await document.exitFullscreen();
    }
  }, []);

  const copyPeerId = useCallback(() => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [peerId]);

  const disconnect = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    cleanup();
    setIsConnected(false);
    setPeerId('');
    setRemotePeerId('');
    setInputPeerId('');
    setIsMicOn(false);
    setIsCamOn(false);
    setIsScreenSharing(false);
    setCallActive(false);
    setSelectedName('');
    setUserName('');
    setConnectionStatus('');
    setError('');
  }, [cleanup]);

  // Connection UI
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Users className="w-16 h-16 text-pink-500" />
                <Heart className="w-8 h-8 text-red-500 absolute -top-2 -right-2 animate-pulse" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              Watch Party Berdua 💕
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Nonton bareng dengan video call & screen share
            </p>
          </div>

          {connectionStatus && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 text-center">{connectionStatus}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Nama Kamu
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(names).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => setSelectedName(key)}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition ${selectedName === key
                      ? key === 'wyan'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                        : 'border-pink-500 bg-pink-50 text-pink-700 shadow-md'
                      : 'border-gray-300 hover:border-blue-300'
                    }`}
                >
                  <div className="font-semibold text-xs sm:text-sm">
                    {name.split(' ')[0]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={initializePeer}
            disabled={!selectedName}
            className={`w-full py-3 rounded-lg font-semibold transition ${selectedName
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            Mulai Koneksi
          </button>

          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-gray-700 leading-relaxed">
              <strong className="text-blue-700">💡 Tips untuk performa terbaik:</strong><br />
              1. Gunakan browser Chrome/Firefox terbaru<br />
              2. Pilih 720p untuk screen sharing yang smooth<br />
              3. Tidak perlu nyalakan cam/mic untuk terhubung<br />
              4. Gunakan koneksi internet stabil (min. 5 Mbps)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 sm:p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500" />
            <div>
              <h2 className="text-white font-semibold text-sm sm:text-base">{userName}</h2>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">ID: {peerId.slice(0, 20)}...</span>
                <button onClick={copyPeerId} className="text-gray-400 hover:text-white">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
            <div className={`px-3 py-1 rounded-full text-sm ${callActive ? 'bg-green-500' : 'bg-yellow-500'}`}>
              {callActive ? '🟢 Live' : '🟡 Siap'}
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Kualitas Screen Share</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Resolusi</label>
                <select
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value)}
                  disabled={isScreenSharing}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                >
                  {Object.entries(qualityPresets).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {videoQuality === '720p' ? '🎯 Rekomendasi untuk performa terbaik' : ''}
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Frame Rate: {frameRate} FPS
                </label>
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="15"
                  value={frameRate}
                  onChange={(e) => setFrameRate(parseInt(e.target.value))}
                  disabled={isScreenSharing}
                  className="w-full accent-pink-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>15</span>
                  <span>30</span>
                  <span>45</span>
                  <span>60</span>
                </div>
              </div>
            </div>

            {isScreenSharing && (
              <p className="text-xs text-yellow-400 mt-3">⚠️ Stop screen share untuk ubah settings</p>
            )}
          </div>
        </div>
      )}

      {/* Status Messages */}
      {(connectionStatus || error) && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          {connectionStatus && <p className="text-sm text-blue-400 text-center">{connectionStatus}</p>}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" ref={fullscreenContainerRef}>
        {/* Screen Share Area */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="max-w-full max-h-full object-contain"
            onError={(e) => console.error('Screen video error:', e)}
          />

          {/* Fullscreen PiP */}
          {isFullscreen && callActive && (
            <div className="absolute bottom-4 right-4 w-64 md:w-80 z-50">
              <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  onError={(e) => console.error('Remote video error:', e)}
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs text-white">
                  {selectedName === 'wyan' ? 'Maha' : 'Wyandhanu'}
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Button */}
          {screenStreamRef.current && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 p-3 bg-gray-800 bg-opacity-80 hover:bg-opacity-100 rounded-lg z-40 transition"
            >
              <Maximize className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Empty State */}
          {!screenStreamRef.current && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500 p-4">
                <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-base">Tidak ada screen share</p>
                <p className="text-xs mt-2 text-gray-600">
                  Hubungkan dengan pasangan → Settings → Share Screen
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={`w-full bg-gray-800 flex flex-col ${isFullscreen ? 'hidden' : 'lg:w-80'}`}>
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Connection Input */}
            {!callActive && (
              <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-300">Peer ID Pasangan:</label>
                <input
                  type="text"
                  placeholder="Paste ID pasangan di sini"
                  value={inputPeerId}
                  onChange={(e) => setInputPeerId(e.target.value.trim())}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={connectToPeer}
                  className={`w-full py-2 rounded-lg font-semibold text-sm ${inputPeerId
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  disabled={!inputPeerId}
                >
                  Hubungkan
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Tidak perlu nyalakan cam/mic untuk connect
                </p>
              </div>
            )}

            {/* Local Video */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={(e) => console.error('Local video error:', e)}
              />
              {!isCamOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <VideoOff className="w-8 h-8 text-gray-600" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs text-white">
                Kamu {isMicOn ? '🎤' : '🔇'}
              </div>
            </div>

            {/* Remote Video */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                onError={(e) => console.error('Remote video error:', e)}
              />
              {!callActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <Users className="w-8 h-8 text-gray-600" />
                </div>
              )}
              {callActive && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs text-white">
                  {selectedName === 'wyan' ? 'Maha' : 'Wyandhanu'}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="p-4 bg-gray-900 border-t border-gray-700">
            <div className="grid grid-cols-4 gap-2 mb-3">
              <button
                onClick={toggleMic}
                className={`p-3 rounded-lg transition ${isMicOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                title={isMicOn ? 'Matikan Mic' : 'Nyalakan Mic'}
              >
                {isMicOn ? (
                  <Mic className="w-5 h-5 text-white mx-auto" />
                ) : (
                  <MicOff className="w-5 h-5 text-white mx-auto" />
                )}
              </button>

              <button
                onClick={toggleCam}
                className={`p-3 rounded-lg transition ${isCamOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                title={isCamOn ? 'Matikan Camera' : 'Nyalakan Camera'}
              >
                {isCamOn ? (
                  <Video className="w-5 h-5 text-white mx-auto" />
                ) : (
                  <VideoOff className="w-5 h-5 text-white mx-auto" />
                )}
              </button>

              <button
                onClick={toggleScreenShare}
                disabled={!callActive && !remotePeerId}
                className={`p-3 rounded-lg transition ${isScreenSharing
                    ? 'bg-green-600 hover:bg-green-700'
                    : callActive || remotePeerId
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-800 opacity-50 cursor-not-allowed'
                  }`}
                title={callActive ? 'Share Screen' : 'Hubungkan dulu'}
              >
                {isScreenSharing ? (
                  <Monitor className="w-5 h-5 text-white mx-auto" />
                ) : (
                  <MonitorOff className="w-5 h-5 text-white mx-auto" />
                )}
              </button>

              <button
                onClick={disconnect}
                className="p-3 bg-red-600 hover:bg-red-700 rounded-lg transition"
                title="Putuskan Koneksi"
              >
                <PhoneOff className="w-5 h-5 text-white mx-auto" />
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              {callActive
                ? '✅ Connected - Screen share tersedia'
                : '⚠️ Paste ID pasangan dan klik Hubungkan'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchParty;