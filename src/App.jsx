import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, PhoneOff, Copy, Check, Users, Heart, RefreshCw, Maximize, Settings, X } from 'lucide-react';
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
  const [videoQuality, setVideoQuality] = useState('1080p');
  const [frameRate, setFrameRate] = useState(60);
  const [bitrate, setBitrate] = useState(8000);

  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const fullscreenContainerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callRef = useRef(null);
  const screenCallRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const names = {
    wyan: 'Wyandhanu Maulidan Nugraha',
    maha: "Maha Nur'Aeni"
  };

  const qualityPresets = {
    '4K': { width: 3840, height: 2160, label: '4K (3840x2160)' },
    '1440p': { width: 2560, height: 1440, label: '1440p (2K)' },
    '1080p': { width: 1920, height: 1080, label: '1080p (Full HD)' },
    '720p': { width: 1280, height: 720, label: '720p (HD)' },
    '480p': { width: 854, height: 480, label: '480p (SD)' }
  };

  useEffect(() => {
    // Fullscreen change listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (callRef.current) {
      callRef.current.close();
    }
    if (screenCallRef.current) {
      screenCallRef.current.close();
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
  };

  const initializePeer = () => {
    if (!selectedName) {
      setError('Pilih nama kamu terlebih dahulu!');
      return;
    }

    setConnectionStatus('Menghubungkan ke server...');
    setError('');

    const customId = `${selectedName}-${Date.now().toString(36)}`;

    const peer = new Peer(customId, {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all',
        sdpSemantics: 'unified-plan'
      },
      debug: 2
    });

    peer.on('open', (id) => {
      console.log('Peer connection opened with ID:', id);
      setPeerId(id);
      setUserName(names[selectedName]);
      setIsConnected(true);
      setConnectionStatus('✅ Koneksi berhasil!');
      setTimeout(() => setConnectionStatus(''), 3000);
    });

    peer.on('call', (call) => {
      console.log('Receiving call from:', call.peer);

      const stream = localStreamRef.current || new MediaStream();
      call.answer(stream);

      // Set up bandwidth constraints for received stream
      if (call.peerConnection) {
        setupBandwidthConstraints(call.peerConnection);
      }

      call.on('stream', (remoteStream) => {
        console.log('Received remote stream');
        const isScreen = call.metadata?.type === 'screen';

        if (isScreen) {
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
          setConnectionStatus('🎉 Terhubung dengan pasangan!');
        }
      });

      call.on('close', () => {
        console.log('Call closed');
        if (call.metadata?.type === 'screen') {
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
          }
          screenStreamRef.current = null;
        } else {
          setCallActive(false);
          setConnectionStatus('⚠️ Call terputus');
        }
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        setError('Error pada call: ' + err.type);
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);

      if (err.type === 'peer-unavailable') {
        setError('Peer tidak tersedia. Pastikan ID benar dan pasangan sudah online!');
      } else if (err.type === 'network') {
        setError('Error jaringan. Coba refresh halaman.');
      } else if (err.type === 'server-error') {
        setError('Server error. Coba lagi dalam beberapa detik.');
      } else {
        setError(`Error: ${err.type}. Coba refresh dan ulangi.`);
      }
    });

    peer.on('disconnected', () => {
      console.log('Peer disconnected, attempting reconnect...');
      setConnectionStatus('🔄 Koneksi terputus, mencoba reconnect...');

      reconnectTimeoutRef.current = setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.reconnect();
        }
      }, 2000);
    });

    peer.on('close', () => {
      console.log('Peer connection closed');
      setConnectionStatus('❌ Koneksi ditutup');
    });

    peerRef.current = peer;
  };

  const setupBandwidthConstraints = (peerConnection) => {
    if (!peerConnection) return;

    const senders = peerConnection.getSenders();
    senders.forEach(sender => {
      if (sender.track && sender.track.kind === 'video') {
        const parameters = sender.getParameters();
        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }

        // Set maximum bitrate in kbps (converted from our state which is in kbps)
        parameters.encodings[0].maxBitrate = bitrate * 1000;

        sender.setParameters(parameters)
          .then(() => console.log('Bitrate set to:', bitrate, 'kbps'))
          .catch(err => console.error('Error setting bitrate:', err));
      }
    });
  };

  const connectToPeer = () => {
    if (!inputPeerId.trim()) {
      setError('Masukkan Peer ID pasangan kamu!');
      return;
    }

    if (!localStreamRef.current || localStreamRef.current.getTracks().length === 0) {
      setError('Nyalakan kamera atau mic terlebih dahulu!');
      return;
    }

    setError('');
    setConnectionStatus('📞 Memanggil pasangan...');
    setRemotePeerId(inputPeerId);

    try {
      const call = peerRef.current.call(inputPeerId, localStreamRef.current, {
        metadata: { type: 'video' }
      });

      // Set up bandwidth constraints for outgoing stream
      if (call.peerConnection) {
        setupBandwidthConstraints(call.peerConnection);
      }

      call.on('stream', (remoteStream) => {
        console.log('Received stream from peer');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setCallActive(true);
        setConnectionStatus('🎉 Terhubung dengan pasangan!');
        setTimeout(() => setConnectionStatus(''), 3000);
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        setError('Gagal terhubung: ' + err.type);
        setCallActive(false);
      });

      call.on('close', () => {
        console.log('Call ended');
        setCallActive(false);
        setConnectionStatus('Call berakhir');
      });

      callRef.current = call;
    } catch (err) {
      console.error('Error making call:', err);
      setError('Gagal memanggil. Coba lagi!');
    }
  };

  const toggleMic = async () => {
    if (!isMicOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2
          }
        });

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        stream.getAudioTracks().forEach(track => {
          localStreamRef.current.addTrack(track);
        });

        if (isCamOn && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        if (callRef.current && callRef.current.peerConnection) {
          stream.getAudioTracks().forEach(track => {
            callRef.current.peerConnection.addTrack(track, localStreamRef.current);
          });
        }

        setIsMicOn(true);
        setError('');
      } catch (err) {
        console.error('Error accessing microphone:', err);
        setError('Tidak bisa mengakses mikrofon. Cek permission browser!');
      }
    } else {
      localStreamRef.current?.getAudioTracks().forEach(track => {
        track.stop();
        localStreamRef.current.removeTrack(track);
      });
      setIsMicOn(false);
    }
  };

  const toggleCam = async () => {
    if (!isCamOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            facingMode: 'user'
          }
        });

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        stream.getVideoTracks().forEach(track => {
          localStreamRef.current.addTrack(track);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        if (callRef.current && callRef.current.peerConnection) {
          stream.getVideoTracks().forEach(track => {
            callRef.current.peerConnection.addTrack(track, localStreamRef.current);
          });
        }

        setIsCamOn(true);
        setError('');
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Tidak bisa mengakses kamera. Cek permission browser!');
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(track => {
        track.stop();
        localStreamRef.current.removeTrack(track);
      });
      if (localVideoRef.current && !isMicOn) {
        localVideoRef.current.srcObject = null;
      } else if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsCamOn(false);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      if (!remotePeerId && !callActive) {
        setError('Hubungkan dengan pasangan terlebih dahulu!');
        return;
      }

      try {
        const quality = qualityPresets[videoQuality];

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: quality.width, max: quality.width },
            height: { ideal: quality.height, max: quality.height },
            frameRate: { ideal: frameRate, max: frameRate },
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000
          }
        });

        const targetPeerId = remotePeerId || callRef.current?.peer;

        if (targetPeerId) {
          const call = peerRef.current.call(targetPeerId, stream, {
            metadata: { type: 'screen' }
          });

          // Apply bitrate constraint for screen share
          if (call.peerConnection) {
            setTimeout(() => {
              const senders = call.peerConnection.getSenders();
              senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                  const parameters = sender.getParameters();
                  if (!parameters.encodings) {
                    parameters.encodings = [{}];
                  }

                  parameters.encodings[0].maxBitrate = bitrate * 1000;
                  parameters.encodings[0].maxFramerate = frameRate;

                  sender.setParameters(parameters)
                    .then(() => console.log('Screen share quality set:', videoQuality, frameRate + 'fps', bitrate + 'kbps'))
                    .catch(err => console.error('Error setting quality:', err));
                }
              });
            }, 100);
          }

          screenCallRef.current = call;
        }

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        setError('');
        setConnectionStatus(`🖥️ Screen share aktif: ${videoQuality} @ ${frameRate}fps`);
        setTimeout(() => setConnectionStatus(''), 3000);
      } catch (err) {
        console.error('Error sharing screen:', err);
        if (err.name !== 'NotAllowedError') {
          setError('Tidak bisa share screen');
        }
      }
    } else {
      if (screenCallRef.current) {
        screenCallRef.current.close();
      }
      if (screenVideoRef.current && screenVideoRef.current.srcObject) {
        screenVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        screenVideoRef.current.srcObject = null;
      }
      setIsScreenSharing(false);
      setConnectionStatus('');
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await fullscreenContainerRef.current.requestFullscreen();
      } catch (err) {
        console.error('Error entering fullscreen:', err);
        setError('Tidak bisa masuk fullscreen mode');
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Error exiting fullscreen:', err);
      }
    }
  };

  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const disconnect = () => {
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
  };

  const retryConnection = () => {
    setError('');
    setConnectionStatus('');
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    initializePeer();
  };

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
              <button
                onClick={retryConnection}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline mx-auto block"
              >
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Coba Lagi
              </button>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Nama Kamu
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedName('wyan')}
                className={`p-3 sm:p-4 rounded-lg border-2 transition ${selectedName === 'wyan'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                    : 'border-gray-300 hover:border-blue-300'
                  }`}
              >
                <div className="font-semibold text-xs sm:text-sm">Wyandhanu</div>
              </button>
              <button
                onClick={() => setSelectedName('maha')}
                className={`p-3 sm:p-4 rounded-lg border-2 transition ${selectedName === 'maha'
                    ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-md'
                    : 'border-gray-300 hover:border-pink-300'
                  }`}
              >
                <div className="font-semibold text-xs sm:text-sm">Maha</div>
              </button>
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
              <strong className="text-blue-700">💡 Cara pakai:</strong><br />
              1. Pilih nama → Klik "Mulai Koneksi"<br />
              2. Copy Peer ID yang muncul<br />
              3. Share ke pasangan via WA/Telegram<br />
              4. Nyalakan mic/cam → Paste ID pasangan → "Hubungkan"
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                <span className="text-xs text-gray-400 break-all">ID: {peerId}</span>
                <button
                  onClick={copyPeerId}
                  className="text-gray-400 hover:text-white transition"
                  title="Copy Peer ID"
                >
                  {copied ? <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              title="Settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
            <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${callActive ? 'bg-green-500' : 'bg-yellow-500'}`}>
              {callActive ? '🟢 Terhubung' : '🟡 Siap'}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Pengaturan Kualitas Screen Share
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Video Quality */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resolusi Video
                </label>
                <select
                  value={videoQuality}
                  onChange={(e) => setVideoQuality(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
                  disabled={isScreenSharing}
                >
                  {Object.entries(qualityPresets).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>

              {/* Frame Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Frame Rate: {frameRate} FPS
                </label>
                <input
                  type="range"
                  min="24"
                  max="60"
                  step="6"
                  value={frameRate}
                  onChange={(e) => setFrameRate(parseInt(e.target.value))}
                  className="w-full"
                  disabled={isScreenSharing}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>24</span>
                  <span>30</span>
                  <span>60</span>
                </div>
              </div>

              {/* Bitrate */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bitrate: {bitrate} kbps
                </label>
                <input
                  type="range"
                  min="2000"
                  max="15000"
                  step="1000"
                  value={bitrate}
                  onChange={(e) => setBitrate(parseInt(e.target.value))}
                  className="w-full"
                  disabled={isScreenSharing}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>2 Mbps</span>
                  <span>8 Mbps</span>
                  <span>15 Mbps</span>
                </div>
              </div>
            </div>

            {isScreenSharing && (
              <p className="text-xs text-yellow-400 mt-3">
                ⚠️ Stop screen share untuk mengubah pengaturan
              </p>
            )}

            <div className="mt-4 p-3 bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-400">
                <strong className="text-gray-300">💡 Rekomendasi untuk jaringan bagus:</strong><br />
                • 1080p @ 60fps dengan bitrate 8-10 Mbps untuk gaming/video smooth<br />
                • 1440p @ 60fps dengan bitrate 10-15 Mbps untuk kualitas maksimal<br />
                • 4K hanya jika internet &gt;50 Mbps dan perangkat powerful
              </p>
            </div>
          </div>
        </div>
      )}

      {(connectionStatus || error) && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          {connectionStatus && (
            <p className="text-sm text-blue-400 text-center">{connectionStatus}</p>
          )}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" ref={fullscreenContainerRef}>
        {/* Screen Share Area */}
        <div className={`flex-1 bg-black flex items-center justify-center relative ${isFullscreen ? 'h-screen' : ''}`}>
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain"
          />

          {/* Fullscreen Floating Video */}
          {isFullscreen && callActive && (
            <div className="absolute bottom-4 right-4 w-48 sm:w-64 md:w-80 z-50">
              <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
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
              className="absolute top-4 right-4 p-3 bg-gray-800 bg-opacity-80 hover:bg-opacity-100 rounded-lg transition z-40"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <Maximize className="w-5 h-5 text-white" />
            </button>
          )}

          {!screenStreamRef.current && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500 p-4">
                <Monitor className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">Tidak ada screen share aktif</p>
                <p className="text-xs mt-2 text-gray-600">Atur kualitas di Settings → Klik tombol screen share</p>
              </div>
            </div>
          )}
        </div>

        {/* Video Call Sidebar */}
        <div className={`w-full bg-gray-800 flex flex-col ${isFullscreen ? 'hidden' : 'lg:w-80'}`}>
          <div className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto">
            {/* Connection Box */}
            {!callActive && (
              <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Peer ID Pasangan:
                </label>
                <input
                  type="text"
                  placeholder="Paste Peer ID di sini"
                  value={inputPeerId}
                  onChange={(e) => setInputPeerId(e.target.value.trim())}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <button
                  onClick={connectToPeer}
                  disabled={!inputPeerId || !localStreamRef.current}
                  className={`w-full py-2 rounded-lg font-semibold text-sm transition ${inputPeerId && localStreamRef.current
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  Hubungkan
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Nyalakan mic/cam dulu sebelum hubungkan
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
              />
              {!isCamOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <VideoOff className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-gray-500">Kamera Mati</p>
                  </div>
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
              />
              {!callActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-gray-500">Menunggu pasangan...</p>
                  </div>
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
          <div className="p-3 sm:p-4 bg-gray-900 border-t border-gray-700">
            <div className="grid grid-cols-4 gap-2 mb-3">
              <button
                onClick={toggleMic}
                className={`p-2 sm:p-3 rounded-lg transition ${isMicOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                title="Toggle Microphone"
              >
                {isMicOn ?
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white mx-auto" /> :
                  <MicOff className="w-4 h-4 sm:w-5 sm:h-5 text-white mx-auto" />
                }
              </button>

              <button
                onClick={toggleCam}
                className={`p-2 sm:p-3 rounded-lg transition ${isCamOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                title="Toggle Camera"
              >
                {isCamOn ?
                  <Video className="w-4 h-4 sm:w-5 sm:h-5 text-white mx-auto" /> :
                  <VideoOff className="w-4 h-4 sm:w-5 sm:h-5 text-white mx-auto" />
                }
              </button>

              <button
                onClick={toggleScreenShare}
                disabled={!callActive && !remotePeerId}
                className={`p-2 sm:p-3 rounded-lg transition ${isScreenSharing
                    ? 'bg-green-600 hover:bg-green-700'
                    : (callActive || remotePeerId)
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-800 cursor-not-allowed opacity-50'
                  }`}
                title="Toggle Screen Share"
              >
                {isScreenSharing ?
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-white mx-auto" /> :
                  <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5 text-white mx-auto" />
                }
              </button>

              <button
                onClick={disconnect}
                className="p-2 sm:p-3 bg-red-600 hover:bg-red-700 rounded-lg transition"
                title="Disconnect"
              >
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 text-white mx-auto" />
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              {callActive ? '✅ Sudah terhubung' : '⚠️ Hubungkan dulu dengan pasangan'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchParty;