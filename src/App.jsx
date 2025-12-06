import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, PhoneOff, Copy, Check, Users, Heart } from 'lucide-react';
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

  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callRef = useRef(null);
  const screenCallRef = useRef(null);

  const names = {
    wyan: 'Wyandhanu Maulidan Nugraha',
    maha: "Maha Nur'Aeni"
  };

  useEffect(() => {
    return () => {
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
      alert('Pilih nama kamu terlebih dahulu!');
      return;
    }

    const peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('open', (id) => {
      setPeerId(id);
      setUserName(names[selectedName]);
      setIsConnected(true);
    });

    peer.on('call', (call) => {
      call.answer(localStreamRef.current);

      call.on('stream', (remoteStream) => {
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
        }
      });

      call.on('close', () => {
        if (call.metadata?.type === 'screen') {
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
          }
          screenStreamRef.current = null;
        }
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      alert('Terjadi error: ' + err.type);
    });

    peerRef.current = peer;
  };

  const connectToPeer = () => {
    if (!inputPeerId) {
      alert('Masukkan Peer ID pasangan kamu!');
      return;
    }

    setRemotePeerId(inputPeerId);

    if (localStreamRef.current) {
      const call = peerRef.current.call(inputPeerId, localStreamRef.current);

      call.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setCallActive(true);
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        alert('Gagal terhubung. Pastikan Peer ID benar!');
      });

      callRef.current = call;
    } else {
      alert('Nyalakan kamera atau mic terlebih dahulu!');
    }
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

        if (localVideoRef.current && localStreamRef.current.getVideoTracks().length > 0) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsMicOn(true);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Tidak bisa mengakses mikrofon. Pastikan izin diberikan!');
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

        setIsCamOn(true);
      } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Tidak bisa mengakses kamera. Pastikan izin diberikan!');
      }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(track => {
        track.stop();
        localStreamRef.current.removeTrack(track);
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current.getAudioTracks().length > 0 ? localStreamRef.current : null;
      }
      setIsCamOn(false);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      if (!remotePeerId) {
        alert('Hubungkan dengan pasangan terlebih dahulu!');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true
        });

        const call = peerRef.current.call(remotePeerId, stream, {
          metadata: { type: 'screen' }
        });

        screenCallRef.current = call;

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Error sharing screen:', err);
        if (err.name !== 'NotAllowedError') {
          alert('Tidak bisa share screen');
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
    }
  };

  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const disconnect = () => {
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
              3. Share ke pasangan kamu<br />
              4. Nyalakan mic/cam, lalu "Hubungkan"
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
                <span className="text-xs text-gray-400 break-all">ID: {peerId.slice(0, 8)}...</span>
                <button
                  onClick={copyPeerId}
                  className="text-gray-400 hover:text-white transition"
                  title="Copy Peer ID"
                >
                  {copied ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${callActive ? 'bg-green-500' : 'bg-yellow-500'}`}>
            {callActive ? '🟢 Terhubung' : '🟡 Siap'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Screen Share Area */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain"
          />
          {!screenStreamRef.current && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500 p-4">
                <Monitor className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">Tidak ada screen share aktif</p>
                <p className="text-xs mt-2 text-gray-600">Klik tombol screen share untuk mulai</p>
              </div>
            </div>
          )}
        </div>

        {/* Video Call Sidebar */}
        <div className="w-full lg:w-80 bg-gray-800 flex flex-col">
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
                  onChange={(e) => setInputPeerId(e.target.value)}
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
                disabled={!callActive}
                className={`p-2 sm:p-3 rounded-lg transition ${isScreenSharing
                    ? 'bg-green-600 hover:bg-green-700'
                    : callActive
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