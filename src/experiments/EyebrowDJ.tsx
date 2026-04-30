import { useRef, useEffect, useState, useCallback } from 'react'
import { useAudioStream } from '@/hooks/useAudioStream'
import { Play, Square, SkipForward, SkipBack, Volume2 } from 'lucide-react'

interface Props { onClose: () => void }

export default function EyebrowDJ({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [track, setTrack] = useState('Track 1')
  const [volume, setVolume] = useState(50)
  const animRef = useRef<number>(0)
  const { start, stop, getFrequencyData } = useAudioStream()
  const eqBarsRef = useRef<number[]>(Array(16).fill(0))
  const trackNames = ['Neon Nights', 'Cyber Drift', 'Digital Soul', 'Future Bass']
  const trackIdx = useRef(0)

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const data = getFrequencyData()

      ctx.fillStyle = 'rgba(6, 6, 16, 0.4)'
      ctx.fillRect(0, 0, w, h)

      // Draw DJ mixer UI
      const energy = data ? data.slice(0, 50).reduce((a, b) => a + b, 0) / 50 : 0

      // EQ bars
      const bars = eqBarsRef.current
      for (let i = 0; i < 16; i++) {
        const target = data ? data[i * 8] / 255 : 0
        bars[i] = bars[i] * 0.85 + target * 0.15
        const barH = bars[i] * h * 0.4
        ctx.fillStyle = `hsl(${240 + i * 10}, 70%, 60%)`
        ctx.fillRect(w * 0.2 + i * (w * 0.6 / 16), h * 0.7 - barH, (w * 0.6 / 16) - 2, barH)
      }

      // Turntable left (brow indicator)
      ctx.save()
      ctx.translate(w * 0.15, h * 0.4)
      ctx.rotate(Date.now() * 0.003 * (energy / 128))
      ctx.fillStyle = 'rgba(108, 99, 255, 0.3)'
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#6C63FF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#6C63FF'; ctx.fillRect(-2, -35, 4, 20)
      ctx.restore()

      // Turntable right
      ctx.save()
      ctx.translate(w * 0.85, h * 0.4)
      ctx.rotate(Date.now() * 0.003 * (energy / 128) * 0.8)
      ctx.fillStyle = 'rgba(236, 72, 153, 0.3)'
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#EC4899'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = '#EC4899'; ctx.fillRect(-2, -35, 4, 20)
      ctx.restore()

      // Track name display
      ctx.save()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px Space Grotesk, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(track, w / 2, h * 0.25)
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(`${Math.floor(energy)} BPM`, w / 2, h * 0.3)
      ctx.restore()

      // Volume bar
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(w / 2 - 50, h * 0.85, 100, 8)
      ctx.fillStyle = '#6C63FF'
      ctx.fillRect(w / 2 - 50, h * 0.85, volume, 8)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [running, getFrequencyData, track, volume])

  const handleStart = async () => { await start(); setRunning(true) }
  const handleStop = () => { setRunning(false); stop(); onClose() }
  const nextTrack = () => { trackIdx.current = (trackIdx.current + 1) % trackNames.length; setTrack(trackNames[trackIdx.current]); setVolume(30 + Math.random() * 70) }
  const prevTrack = () => { trackIdx.current = (trackIdx.current - 1 + trackNames.length) % trackNames.length; setTrack(trackNames[trackIdx.current]) }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover"><Play className="w-4 h-4" /> Start</button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><Square className="w-4 h-4" /> Stop</button>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button onClick={prevTrack} className="w-8 h-8 rounded-full glass flex items-center justify-center text-white"><SkipBack className="w-4 h-4" /></button>
        <button onClick={nextTrack} className="w-8 h-8 rounded-full glass flex items-center justify-center text-white"><SkipForward className="w-4 h-4" /></button>
        <div className="glass rounded-full px-3 py-1 flex items-center gap-1 text-white text-xs">
          <Volume2 className="w-3.5 h-3.5" /> {Math.round(volume)}%
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: '60vh' }} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Eyebrow DJ</p>
            <p className="text-white/70 text-sm mb-4">Simulated DJ mixer. Use controls to change tracks.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start</button>
          </div>
        </div>
      )}
    </div>
  )
}
