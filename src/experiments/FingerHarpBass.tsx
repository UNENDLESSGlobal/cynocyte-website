import { useEffect, useRef, useState } from 'react'
import { Play, Square, Music } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

const NUM_STRINGS = 10
const BASS_NOTES = ['E1', 'G1', 'A1', 'B1', 'D2', 'E2', 'G2', 'A2', 'B2', 'D3']

export default function FingerHarpBass({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const synthRef = useRef<Tone.PolySynth | null>(null)
  const reverbRef = useRef<Tone.Reverb | null>(null)

  const stateRef = useRef({
    strings: Array.from({ length: NUM_STRINGS }, (_, i) => ({
      x: 0, 
      note: BASS_NOTES[i], 
      intensity: 0,
      hitY: 0
    })),
    prevFingertips: [] as { x: number, y: number }[],
    ripples: [] as { x: number, y: number, life: number }[]
  })

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      // Distribute strings
      const w = canvas.width
      const spacing = w / (NUM_STRINGS + 1)
      stateRef.current.strings.forEach((s, i) => {
        s.x = spacing * (i + 1)
      })
    }
    resize()
    window.addEventListener('resize', resize)

    const setupAudio = async () => {
      await Tone.start()
      reverbRef.current = new Tone.Reverb(6).toDestination()
      
      // FMSynth gives a nice deep plucked bass sound
      synthRef.current = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.05, decay: 1, sustain: 0.4, release: 2 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.5 }
      }).connect(reverbRef.current)
      
      synthRef.current.volume.value = -5
    }
    setupAudio()

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      // Fade background (darker for bass)
      ctx.fillStyle = 'rgba(2, 2, 8, 0.3)'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.1
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const hands = results?.hand?.landmarks ?? []

      const currentFingertips: {x: number, y: number}[] = []

      // Extract fingertips (4, 8, 12, 16, 20)
      hands.forEach(hand => {
        [4, 8, 12, 16, 20].forEach(idx => {
          if (hand[idx]) {
            currentFingertips.push({ x: (1 - hand[idx].x) * w, y: hand[idx].y * h })
          }
        })
      })

      // Check intersections
      if (s.prevFingertips.length > 0) {
        currentFingertips.forEach((tip, idx) => {
          const prev = s.prevFingertips[idx]
          if (!prev) return

          s.strings.forEach(string => {
            // Did finger cross the string X?
            if ((prev.x < string.x && tip.x >= string.x) || (prev.x >= string.x && tip.x < string.x)) {
              if (synthRef.current) {
                synthRef.current.triggerAttackRelease(string.note, '2n')
              }
              string.intensity = 1
              string.hitY = tip.y
              s.ripples.push({ x: string.x, y: tip.y, life: 1 })
            }
          })
        })
      }

      s.prevFingertips = currentFingertips

      // Draw Strings
      s.strings.forEach(string => {
        ctx.beginPath()
        ctx.moveTo(string.x, 0)
        
        // Wiggle effect if vibrating
        if (string.intensity > 0.05) {
          ctx.quadraticCurveTo(
            string.x + Math.sin(performance.now() * 0.05) * 40 * string.intensity, 
            string.hitY, 
            string.x, h
          )
        } else {
          ctx.lineTo(string.x, h)
        }
        
        // Thickness & Color
        ctx.lineWidth = 4 + (string.intensity * 8)
        ctx.strokeStyle = `rgba(147, 51, 234, ${0.3 + string.intensity * 0.7})` // Deep purple
        ctx.shadowBlur = string.intensity * 30
        ctx.shadowColor = '#9333ea'
        ctx.stroke()
        ctx.shadowBlur = 0

        string.intensity *= 0.95 // decay
      })

      // Draw Ripples
      s.ripples = s.ripples.filter(r => {
        ctx.beginPath()
        ctx.arc(r.x, r.y, (1 - r.life) * 150, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(147, 51, 234, ${r.life})`
        ctx.lineWidth = r.life * 10
        ctx.stroke()
        r.life -= 0.02
        return r.life > 0
      })

      // Draw Fingertips
      currentFingertips.forEach(tip => {
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#d8b4fe'
        ctx.fill()
      })

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (synthRef.current) synthRef.current.dispose()
      if (reverbRef.current) reverbRef.current.dispose()
    }
  }, [detectFrame, running])

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

  const launchError = visionError ?? error

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#020208]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start
          </button>
        ) : (
          <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Music className="w-4 h-4 text-purple-400 mr-2" />
          <span className="text-xs font-medium text-purple-200">Swipe through the strings for deep sub-bass resonance.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-purple-300">Finger Harp: Bass Edition</p>
            <p className="mb-4 text-sm text-white/70">A deep, resonant version of the Finger Harp tuned to the sub-bass frequencies with a massive 6-second reverb tail.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Play Bass
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
