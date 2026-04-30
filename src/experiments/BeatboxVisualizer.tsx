import { useRef, useEffect, useState, useCallback } from 'react'
import { useAudioStream } from '@/hooks/useAudioStream'
import { Play, Square, Mic } from 'lucide-react'

interface Props { onClose: () => void }

interface Shockwave { x: number; y: number; r: number; life: number; type: string }

export default function BeatboxVisualizer({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [lastBeat, setLastBeat] = useState('Silence')
  const animRef = useRef<number>(0)
  const { start, stop, getFrequencyData } = useAudioStream()
  const wavesRef = useRef<Shockwave[]>([])
  const beatGridRef = useRef<string[]>(Array(16).fill(''))
  const debounceRef = useRef(0)

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

      ctx.fillStyle = 'rgba(6, 6, 16, 0.25)'
      ctx.fillRect(0, 0, w, h)

      if (data) {
        // Analyze frequency bands
        let kick = 0, snare = 0, hihat = 0, bass = 0
        for (let i = 0; i < 10; i++) kick += data[i]
        for (let i = 10; i < 40; i++) snare += data[i]
        for (let i = 40; i < 100; i++) bass += data[i]
        for (let i = 100; i < 200; i++) hihat += data[i]

        const now = Date.now()
        if (now - debounceRef.current > 100) {
          let detected = ''
          if (kick > 1800) detected = 'Kick'
          else if (snare > 2000) detected = 'Snare'
          else if (hihat > 4000) detected = 'Hi-Hat'
          else if (bass > 3000) detected = 'Bass'

          if (detected) {
            debounceRef.current = now
            setLastBeat(detected)
            beatGridRef.current.shift()
            beatGridRef.current.push(detected)

            const colors: Record<string, string> = { Kick: '#FF6B35', Snare: '#ffffff', 'Hi-Hat': '#00ffff', Bass: '#6C63FF' }
            wavesRef.current.push({ x: w / 2, y: h / 2, r: 10, life: 1, type: detected })
          }
        }

        // Waveform
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.6)'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < w; i += 2) {
          const idx = Math.floor((i / w) * data.length)
          const val = data[idx] / 255
          const y = h / 2 + (val - 0.5) * h * 0.3
          if (i === 0) ctx.moveTo(i, y)
          else ctx.lineTo(i, y)
        }
        ctx.stroke()

        // Frequency bars
        const bars = 32
        const barW = w / bars
        for (let i = 0; i < bars; i++) {
          const val = data[i * 4] / 255
          const barH = val * h * 0.35
          const hue = 240 + (i / bars) * 120
          ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.6)`
          ctx.fillRect(i * barW, h * 0.65 - barH, barW - 1, barH)
        }
      }

      // Shockwaves
      const waves = wavesRef.current
      for (let i = waves.length - 1; i >= 0; i--) {
        const wave = waves[i]
        wave.r += 5
        wave.life -= 0.015
        if (wave.life <= 0) { waves.splice(i, 1); continue }

        const colors: Record<string, string> = { Kick: '#FF6B35', Snare: '#ffffff', 'Hi-Hat': '#00ffff', Bass: '#6C63FF' }
        ctx.save()
        ctx.globalAlpha = wave.life * 0.5
        ctx.strokeStyle = colors[wave.type] || '#fff'
        ctx.lineWidth = 3
        ctx.shadowBlur = 20
        ctx.shadowColor = colors[wave.type] || '#fff'
        ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2); ctx.stroke()
        ctx.restore()
      }

      // Beat grid
      const gridSize = 4
      const cellSize = 30
      const gridX = w / 2 - (gridSize * cellSize) / 2
      const gridY = h * 0.82
      for (let i = 0; i < 16; i++) {
        const row = Math.floor(i / gridSize)
        const col = i % gridSize
        const beat = beatGridRef.current[i]
        const colors: Record<string, string> = { Kick: '#FF6B35', Snare: '#ffffff', 'Hi-Hat': '#00ffff', Bass: '#6C63FF' }
        ctx.fillStyle = beat ? colors[beat] + '60' : 'rgba(255,255,255,0.05)'
        ctx.fillRect(gridX + col * cellSize, gridY + row * cellSize, cellSize - 2, cellSize - 2)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [running, getFrequencyData])

  const handleStart = async () => { await start(); setRunning(true) }
  const handleStop = () => { setRunning(false); stop(); onClose() }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover"><Play className="w-4 h-4" /> Start</button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><Square className="w-4 h-4" /> Stop</button>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10 glass rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm">
        <Mic className="w-4 h-4" /> {lastBeat}
      </div>
      <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: '60vh' }} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Beatbox Visualizer</p>
            <p className="text-white/70 text-sm mb-4">Make beatbox sounds into your mic to trigger visuals.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start Microphone</button>
          </div>
        </div>
      )}
    </div>
  )
}
