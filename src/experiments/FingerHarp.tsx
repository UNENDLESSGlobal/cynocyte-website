import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Music, Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { getFingerTips } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

const notes = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4']
const noteColors = ['#6C63FF', '#7C5DFF', '#8D57FF', '#9E50FF', '#AF4AFF', '#C044FF', '#D13DFF', '#E237FF', '#F330FF', '#FF2AE8']
const variants = ['harp', 'guitar', 'guqin'] as const
type Variant = (typeof variants)[number]

export default function FingerHarp({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [lastNote, setLastNote] = useState('--')
  const [variant, setVariant] = useState<Variant>('harp')
  const animRef = useRef<number>(0)
  const synthRef = useRef<Tone.PolySynth | null>(null)
  const stringsRef = useRef<Array<{ vibrating: number; amplitude: number }>>(notes.map(() => ({ vibrating: 0, amplitude: 0 })))
  const tipHistoryRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const presets: Record<Variant, Tone.ToneOscillatorType> = {
      harp: 'triangle',
      guitar: 'sawtooth',
      guqin: 'sine',
    }

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: presets[variant] },
      envelope: {
        attack: 0.005,
        decay: variant === 'guitar' ? 0.2 : 0.35,
        sustain: variant === 'guqin' ? 0.22 : 0.1,
        release: variant === 'guqin' ? 2.2 : variant === 'guitar' ? 1 : 1.5,
      },
    }).toDestination()
    const reverb = new Tone.Reverb({ decay: variant === 'guqin' ? 5 : 3.5, wet: variant === 'guitar' ? 0.25 : 0.5 }).toDestination()
    synth.connect(reverb)
    synthRef.current = synth

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const width = canvas.width
      const height = canvas.height

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -width, 0, width, height)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, width, height)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.65)'
      ctx.fillRect(0, 0, width, height)

      const stringPositions = notes.map((_, index) => (width / (notes.length + 1)) * (index + 1))
      const hands = detectFrame(performance.now())?.hand?.landmarks ?? []

      hands.forEach((landmarks, handIndex) => {
        const tips = getFingerTips(landmarks, width, height)
        tips.forEach((tip, tipIndex) => {
          const key = `${handIndex}-${tipIndex}`
          const previousX = tipHistoryRef.current[key]

          for (let stringIndex = 0; stringIndex < stringPositions.length; stringIndex += 1) {
            const stringX = stringPositions[stringIndex]
            const crossed =
              typeof previousX === 'number' &&
              ((previousX < stringX && tip.x >= stringX) || (previousX >= stringX && tip.x < stringX))

            if (crossed) {
              synth.triggerAttackRelease(notes[stringIndex], '8n')
              stringsRef.current[stringIndex].vibrating = 1
              stringsRef.current[stringIndex].amplitude = 10
              setLastNote(notes[stringIndex])
            }
          }

          tipHistoryRef.current[key] = tip.x

          ctx.save()
          ctx.fillStyle = '#9efcff'
          ctx.shadowBlur = 18
          ctx.shadowColor = '#9efcff'
          ctx.beginPath()
          ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        })
      })

      for (let index = 0; index < notes.length; index += 1) {
        const stringX = stringPositions[index]
        const state = stringsRef.current[index]

        if (state.vibrating > 0) {
          state.vibrating *= 0.98
          state.amplitude *= 0.97
          if (state.vibrating < 0.01) state.vibrating = 0
        }

        ctx.save()
        ctx.strokeStyle = noteColors[index]
        ctx.lineWidth = state.vibrating > 0 ? 3 : 1
        ctx.globalAlpha = state.vibrating > 0 ? 1 : 0.4
        ctx.shadowBlur = state.vibrating > 0 ? 15 : 0
        ctx.shadowColor = noteColors[index]

        ctx.beginPath()
        for (let y = 0; y < height; y += 2) {
          const offset = state.vibrating > 0 ? Math.sin(y * 0.1 + Date.now() * 0.02) * state.amplitude * state.vibrating : 0
          if (y === 0) ctx.moveTo(stringX + offset, y)
          else ctx.lineTo(stringX + offset, y)
        }
        ctx.stroke()

        if (state.vibrating > 0.5) {
          ctx.globalAlpha = state.vibrating * 0.3
          ctx.beginPath()
          ctx.arc(stringX, height / 2, (1 - state.vibrating) * 60, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.restore()

        ctx.fillStyle = 'rgba(255,255,255,0.36)'
        ctx.font = '10px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(notes[index], stringX, height - 10)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
      reverb.dispose()
    }
  }, [detectFrame, running, variant, videoRef])

  const handleStart = async () => {
    await Tone.start()
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    onClose()
  }

  const cycleVariant = () => {
    setVariant((value) => variants[(variants.indexOf(value) + 1) % variants.length])
  }

  const launchError = visionError ?? error

  return (
    <div className="relative flex h-full w-full flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start
          </button>
        ) : (
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <button onClick={cycleVariant} className="btn-hover rounded-full glass px-4 py-2 text-sm font-medium text-white">
              {variant}
            </button>
          </>
        )}
      </div>
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white">
        <Music className="h-4 w-4" /> {lastNote}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Finger Harp</p>
            <p className="mb-4 text-sm text-white/70">Sweep your fingertips through the strings to pluck notes. Use the button to swap sound variants.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
