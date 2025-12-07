//app/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');

  const createRoom = () => {
    const newRoomId = uuidv4().slice(0, 8); // UUID pendek
    router.push(`/room/${newRoomId}#host`);
  };

  const joinRoom = () => {
    if (roomCode) router.push(`/room/${roomCode}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-24">
      <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
        SyncWatch
      </h1>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <button
          onClick={createRoom}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition"
        >
          Create New Room (As Host)
        </button>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="flex-shrink mx-4 text-gray-400">OR</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter Room Code"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
          <button
            onClick={joinRoom}
            className="bg-green-600 hover:bg-green-700 px-6 rounded font-bold transition"
          >
            Join
          </button>
        </div>
      </div>
    </main>
  );
}