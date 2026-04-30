import { useRef, useEffect, useState, useCallback } from 'react'
import * as Tone from 'tone'
import { Play, Square, Volume2 } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function ThereminAirSynth({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState('--')
  const mouseRef = useRef({ x: 0.5, y: 0.5, active: false })
  const synthRef = useRef<Tone.Synth | null>(null)
  const reverbRef = useRef<Tone.Reverb | null>(null)
  const chorusRef = useRef<Tone.Chorus | null>(null)
  const animRef = useRef<number>(0)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = (e.clientX - rect.left) / rect.width
    mouseRef.current.y = (e.clientY - rect.top) / rect.height
    mouseRef.current.active = true
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.active = false
    if (synthRef.current) {
      synthRef.current.triggerRelease()
    }
    setNote('--')
  }, [])

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init audio
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.4 }).toDestination()
    const chorus = new Tone.Chorus({ frequency: 1.5, depth: 0.7, wet: 0.3 }).connect(reverb)
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.5 },
    }).connect(chorus)
    synthRef.current = synth
    reverbRef.current = reverb
    chorusRef.current = chorus

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // Dark background with grid
      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, w, h)

      // Grid lines with frequency labels
      ctx.strokeStyle = 'rgba(108, 99, 255, 0.1)'
      ctx.lineWidth = 1
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = 'rgba(108, 99, 255, 0.4)'

      const freqs = [110, 220, 330, 440, 550, 660, 770, 880]
      for (const f of freqs) {
        const fy = h - ((Math.log2(f) - Math.log2(110)) / (Math.log2(880) - Math.log2(110))) * h
        ctx.beginPath()
        ctx.moveTo(0, fy)
        ctx.lineTo(w, fy)
        ctx.stroke()
        ctx.fillText(`${f}Hz`, 8, fy - 4)
      }

      if (mouseRef.current.active) {
        const freq = 110 * Math.pow(2, (1 - my) * 3)
        const vol = -40 + mx * 37
        synth.triggerAttack(freq)
        synth.volume.rampTo(vol, 0.05)

        const noteName = Tone.Frequency(freq).toNote()
        setNote(noteName)

        // Glowing dot
        ctx.save()
        ctx.fillStyle = `hsl(${240 + (1 - my) * 120}, 80%, 60%)`
        ctx.shadowBlur = 30
        ctx.shadowColor = `hsl(${240 + (1 - my) * 120}, 80%, 60%)`
        ctx.beginPath()
        ctx.arc(mx * w, my * h, 8, 0, Math.PI * 2)
        ctx.fill()

        // Trail
        ctx.globalAlpha = 0.3
        ctx.beginPath()
        ctx.arc(mx * w, my * h, 20, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Waveform visualization
        ctx.strokeStyle = `hsla(${240 + (1 - my) * 120}, 80%, 60%, 0.6)`
        ctx.lineWidth = 2
        ctx.shadowBlur = 10
        ctx.shadowColor = `hsl(${240 + (1 - my) * 120}, 80%, 60%)`
        ctx.beginPath()
        for (let i = 0; i < w; i += 2) {
          const amp = 20 * (1 - my)
          const y = h / 2 + Math.sin(i * 0.02 + Date.now() * 0.005) * amp * Math.sin(Date.now() * 0.002)
          if (i === 0) ctx.moveTo(i, y)
          else ctx.lineTo(i, y)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      } else {
        synth.triggerRelease()
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
      chorus.dispose()
      reverb.dispose()
    }
  }, [running])

  const handleStart = async () => {
    await Tone.start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    if (synthRef.current) synthRef.current.dispose()
    if (reverbRef.current) reverbRef.current.dispose()
    if (chorusRef.current) chorusRef.current.dispose()
    onClose()
  }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover">
            <Play className="w-4 h-4" /> Start
          </button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover">
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10 glass rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm">
        <Volume2 className="w-4 h-4" />
        {note}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ minHeight: '60vh' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Theremin Air Synth</p>
            <p className="text-white/70 text-sm mb-4">Move mouse up/down for pitch, left/right for volume.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">
              Start Synth
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
