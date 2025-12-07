//components/PlayerWrapper.tsx
'use client'
import dynamic from 'next/dynamic'

// PERBAIKAN: Gunakan 'react-player' biasa, bukan 'react-player/lazy'
// Ini lebih stabil untuk dideteksi oleh Next.js
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false })

export default ReactPlayer