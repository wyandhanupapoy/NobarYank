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

  const names = {
    wyan: 'Wyandhanu Maulidan Nugraha',
    maha: "Maha Nur'Aeni"
  };

  const qualityPresets = {
    '1080p': { width: 1920, height: 1080, label: '1080p (Recommended)', bitrate: 5000 },
    '720p': { width: 1280, height: 720, label: '720p (Smooth)', bitrate: 3000 },
    '480p': { width: 854, height: 480, label: '480p (Fast)', bitrate: 1500 }
  };

  useEffect(() => {
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

    setConnectionStatus('Menghubungkan...');
    setError('');

    const customId = `watchparty-${selectedName}-${Date.now().toString(36)}`;

    // Optimized peer configuration
    const peer = new Peer(customId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('open', (id) => {
      console.log('Connected with ID:', id);
      setPeerId(id);
      setUserName(names[selectedName]);
      setIsConnected(true);
      setConnectionStatus('✅ Siap!');
      setTimeout(() => setConnectionStatus(''), 2000);
    });

    peer.on('call', (call) => {
      console.log('Incoming call from:', call.peer);

      const stream = localStreamRef.current || new MediaStream();
      call.answer(stream);

      call.on('stream', (remoteStream) => {
        const isScreen = call.metadata?.type === 'screen';

        if (isScreen) {
          console.log('Received screen share');
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = remoteStream;
          }
          screenStreamRef.current = remoteStream;
          screenCallRef.current = call;
        } else {
          console.log('Received video call');
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
        if (call.metadata?.type === 'screen') {
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
          }
          screenStreamRef.current = null;
        } else {
          setCallActive(false);
        }
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'peer-unavailable') {
        setError('Peer tidak tersedia. Pastikan ID benar!');
      } else if (err.type === 'network') {
        setError('Network error. Coba lagi.');
      } else {
        setError('Error: ' + err.type);
      }
    });

    peerRef.current = peer;
  };

  const connectToPeer = () => {
    if (!inputPeerId.trim()) {
      setError('Masukkan Peer ID pasangan!');
      return;
    }

    if (!localStreamRef.current) {
      setError('Nyalakan camera atau mic dulu!');
      return;
    }

    setError('');
    setConnectionStatus('Menghubungi...');
    setRemotePeerId(inputPeerId);

    const call = peerRef.current.call(inputPeerId, localStreamRef.current);

    call.on('stream', (remoteStream) => {
      console.log('Connected to peer');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      setCallActive(true);
      setConnectionStatus('🎉 Terhubung!');
      setTimeout(() => setConnectionStatus(''), 2000);
    });

    call.on('error', (err) => {
      console.error('Call error:', err);
      setError('Gagal connect: ' + err.type);
    });

    callRef.current = call;
  };

  const toggleMic = async () => {
    if (!isMicOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
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

        setIsMicOn(true);
        setError('');
      } catch (err) {
        setError('Tidak bisa akses mic!');
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
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
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

        setIsCamOn(true);
        setError('');
      } catch (err) {
        setError('Tidak bisa akses camera!');
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(track => {
        track.stop();
        localStreamRef.current.removeTrack(track);
      });
      if (localVideoRef.current && !isMicOn) {
        localVideoRef.current.srcObject = null;
      }
      setIsCamOn(false);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      if (!remotePeerId && !callActive) {
        setError('Connect dengan pasangan dulu!');
        return;
      }

      try {
        const quality = qualityPresets[videoQuality];

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: quality.width },
            height: { ideal: quality.height },
            frameRate: { ideal: frameRate }
          },
          audio: true
        });

        const targetPeerId = remotePeerId || callRef.current?.peer;

        if (targetPeerId) {
          const call = peerRef.current.call(targetPeerId, stream, {
            metadata: { type: 'screen' }
          });

          screenCallRef.current = call;
        }

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        setConnectionStatus(`🖥️ Screen share: ${videoQuality} @ ${frameRate}fps`);
        setTimeout(() => setConnectionStatus(''), 3000);
      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          setError('Tidak bisa share screen');
        }
      }
    } else {
      if (screenCallRef.current) {
        screenCallRef.current.close();
      }
      if (screenVideoRef.current?.srcObject) {
        screenVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
        screenVideoRef.current.srcObject = null;
      }
      setIsScreenSharing(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await fullscreenContainerRef.current.requestFullscreen();
      } catch (err) {
        setError('Tidak bisa fullscreen');
      }
    } else {
      await document.exitFullscreen();
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
              1. Pilih nama → "Mulai Koneksi"<br />
              2. Copy Peer ID → Share ke pasangan<br />
              3. Nyalakan mic/cam → Paste ID → "Hubungkan"<br />
              4. Klik icon Settings untuk atur kualitas
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
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>15</span>
                  <span>30</span>
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

      {(connectionStatus || error) && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          {connectionStatus && <p className="text-sm text-blue-400 text-center">{connectionStatus}</p>}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" ref={fullscreenContainerRef}>
        {/* Screen Area */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="max-w-full max-h-full object-contain"
          />

          {/* Fullscreen PiP */}
          {isFullscreen && callActive && (
            <div className="absolute bottom-4 right-4 w-64 md:w-80 z-50">
              <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs text-white">
                  {selectedName === 'wyan' ? 'Maha' : 'Wyandhanu'}
                </div>
              </div>
            </div>
          )}

          {screenStreamRef.current && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 p-3 bg-gray-800 bg-opacity-80 hover:bg-opacity-100 rounded-lg z-40"
            >
              <Maximize className="w-5 h-5 text-white" />
            </button>
          )}

          {!screenStreamRef.current && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500 p-4">
                <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-base">Tidak ada screen share</p>
                <p className="text-xs mt-2 text-gray-600">Klik Settings → Atur kualitas → Share</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={`w-full bg-gray-800 flex flex-col ${isFullscreen ? 'hidden' : 'lg:w-80'}`}>
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {!callActive && (
              <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-300">Peer ID Pasangan:</label>
                <input
                  type="text"
                  placeholder="Paste ID di sini"
                  value={inputPeerId}
                  onChange={(e) => setInputPeerId(e.target.value.trim())}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={connectToPeer}
                  disabled={!inputPeerId || !localStreamRef.current}
                  className={`w-full py-2 rounded-lg font-semibold text-sm ${inputPeerId && localStreamRef.current
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  Hubungkan
                </button>
              </div>
            )}

            {/* Local Video */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
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
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
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
                className={`p-3 rounded-lg ${isMicOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {isMicOn ? <Mic className="w-5 h-5 text-white mx-auto" /> : <MicOff className="w-5 h-5 text-white mx-auto" />}
              </button>

              <button
                onClick={toggleCam}
                className={`p-3 rounded-lg ${isCamOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {isCamOn ? <Video className="w-5 h-5 text-white mx-auto" /> : <VideoOff className="w-5 h-5 text-white mx-auto" />}
              </button>

              <button
                onClick={toggleScreenShare}
                disabled={!callActive}
                className={`p-3 rounded-lg ${isScreenSharing ? 'bg-green-600 hover:bg-green-700' :
                    callActive ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 opacity-50 cursor-not-allowed'
                  }`}
              >
                {isScreenSharing ? <Monitor className="w-5 h-5 text-white mx-auto" /> : <MonitorOff className="w-5 h-5 text-white mx-auto" />}
              </button>

              <button onClick={disconnect} className="p-3 bg-red-600 hover:bg-red-700 rounded-lg">
                <PhoneOff className="w-5 h-5 text-white mx-auto" />
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              {callActive ? '✅ Connected' : '⚠️ Connect dulu'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchParty;