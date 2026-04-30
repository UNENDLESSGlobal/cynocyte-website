import { useRef, useEffect, useState, useCallback } from 'react'
import * as Tone from 'tone'
import { Play, Square, Music } from 'lucide-react'

interface Props { onClose: () => void }

const notes = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4']
const noteColors = ['#6C63FF', '#7C5DFF', '#8D57FF', '#9E50FF', '#AF4AFF', '#C044FF', '#D13DFF', '#E237FF', '#F330FF', '#FF2AE8']

export default function FingerHarp({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [lastNote, setLastNote] = useState('--')
  const animRef = useRef<number>(0)
  const synthRef = useRef<Tone.PolySynth | null>(null)
  const stringsRef = useRef<Array<{ vibrating: number; amplitude: number }>>(notes.map(() => ({ vibrating: 0, amplitude: 0 })))
  const mouseRef = useRef({ x: 0, y: 0, prevX: 0 })

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.prevX = mouseRef.current.x
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top

    // Check string crossing
    const w = canvas.offsetWidth
    const stringXPositions = notes.map((_, i) => (w / (notes.length + 1)) * (i + 1))
    for (let i = 0; i < stringXPositions.length; i++) {
      const sx = stringXPositions[i]
      const prevInLeft = mouseRef.current.prevX < sx
      const nowInRight = mouseRef.current.x >= sx
      const nowInLeft = mouseRef.current.x < sx
      const prevInRight = mouseRef.current.prevX >= sx

      if ((prevInLeft && nowInRight) || (prevInRight && nowInLeft)) {
        // Plucked!
        if (synthRef.current) {
          synthRef.current.triggerAttackRelease(notes[i], '8n')
        }
        stringsRef.current[i].vibrating = 1
        stringsRef.current[i].amplitude = 8
        setLastNote(notes[i])
      }
    }
  }, [])

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 1.5 },
    }).toDestination()
    const reverb = new Tone.Reverb({ decay: 4, wet: 0.5 }).toDestination()
    synth.connect(reverb)
    synthRef.current = synth

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, w, h)

      const stringXPositions = notes.map((_, i) => (w / (notes.length + 1)) * (i + 1))

      for (let i = 0; i < notes.length; i++) {
        const sx = stringXPositions[i]
        const str = stringsRef.current[i]

        // Decay vibration
        if (str.vibrating > 0) {
          str.vibrating *= 0.98
          str.amplitude *= 0.97
          if (str.vibrating < 0.01) str.vibrating = 0
        }

        ctx.save()
        ctx.strokeStyle = noteColors[i]
        ctx.lineWidth = str.vibrating > 0 ? 3 : 1
        ctx.globalAlpha = str.vibrating > 0 ? 1 : 0.4
        ctx.shadowBlur = str.vibrating > 0 ? 15 : 0
        ctx.shadowColor = noteColors[i]

        // Draw vibrating string as sine wave
        ctx.beginPath()
        for (let y = 0; y < h; y += 2) {
          const offset = str.vibrating > 0 ? Math.sin(y * 0.1 + Date.now() * 0.02) * str.amplitude * str.vibrating : 0
          if (y === 0) ctx.moveTo(sx + offset, y)
          else ctx.lineTo(sx + offset, y)
        }
        ctx.stroke()

        // Ripple ring on pluck
        if (str.vibrating > 0.5) {
          ctx.globalAlpha = str.vibrating * 0.3
          ctx.beginPath()
          ctx.arc(sx, h / 2, (1 - str.vibrating) * 60, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.restore()

        // Note label
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = '10px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(notes[i], sx, h - 10)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); synth.dispose(); reverb.dispose() }
  }, [running])

  const handleStart = async () => { await Tone.start(); setRunning(true) }
  const handleStop = () => { setRunning(false); onClose() }

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
        <Music className="w-4 h-4" /> {lastNote}
      </div>
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" style={{ minHeight: '60vh' }} onMouseMove={handleMouseMove} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Finger Harp</p>
            <p className="text-white/70 text-sm mb-4">Move mouse across the strings to pluck them.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start</button>
          </div>
        </div>
      )}
    </div>
  )
}
