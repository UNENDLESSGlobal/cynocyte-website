import { useEffect, useRef, useState } from 'react'
import { Play, Square, Music } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

const NOTES = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5']

export default function FingerHarp({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [instrument, setInstrument] = useState<'harp' | 'guitar'>('harp')
  const animRef = useRef<number>(0)

  // Audio setup
  const synthRef = useRef<Tone.PluckSynth | Tone.PolySynth | null>(null)
  
  // Physics/Visuals state
  const stringsRef = useRef(NOTES.map((note, i) => ({
    note,
    x: 0, // Set dynamically
    vibration: 0, // Amplitude of sine wave
    pluckY: 0,
    active: false
  })))

  const lastTipsRef = useRef<Record<number, { x: number, y: number }>>({})
  const ripplesRef = useRef<{x: number, y: number, radius: number, life: number}[]>([])

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
      // Recalculate string positions
      const spacing = canvas.width / (NOTES.length + 1)
      stringsRef.current.forEach((s, i) => {
        s.x = spacing * (i + 1)
      })
    }
    resize()
    window.addEventListener('resize', resize)

    // Synthesizer Configuration
    if (synthRef.current) synthRef.current.dispose()

    if (instrument === 'harp') {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 1, sustain: 0.1, release: 2 }
      }).toDestination()
      synthRef.current.volume.value = -5
    } else {
      synthRef.current = new Tone.PluckSynth({
        attackNoise: 1,
        dampening: 4000,
        resonance: 0.9
      }).toDestination()
      synthRef.current.volume.value = 5
    }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      // Background with motion blur trail
      ctx.fillStyle = 'rgba(6, 6, 16, 0.4)'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.1
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      // Draw Ripples
      ripplesRef.current = ripplesRef.current.filter(r => r.life > 0)
      ripplesRef.current.forEach(r => {
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0, 255, 255, ${r.life})`
        ctx.lineWidth = 2
        ctx.stroke()
        r.radius += 5
        r.life -= 0.05
      })

      // Draw Strings
      stringsRef.current.forEach(s => {
        ctx.beginPath()
        ctx.strokeStyle = s.active ? '#00ffff' : 'rgba(0, 255, 255, 0.2)'
        ctx.lineWidth = s.active ? 4 : 2
        ctx.shadowBlur = s.active ? 15 : 0
        ctx.shadowColor = '#00ffff'

        if (s.vibration > 0.1) {
          // Draw sine wave
          ctx.moveTo(s.x, 0)
          for (let y = 0; y < h; y += 10) {
            // Envelope so ends don't move
            const env = Math.sin((y / h) * Math.PI)
            // The wave
            const wave = Math.sin(y * 0.05 + performance.now() * 0.05) * s.vibration * env
            ctx.lineTo(s.x + wave, y)
          }
          ctx.stroke()
          s.vibration *= 0.92 // dampen
          if (s.vibration < 0.1) s.active = false
        } else {
          // Straight line
          ctx.moveTo(s.x, 0)
          ctx.lineTo(s.x, h)
          ctx.stroke()
        }
      })
      ctx.shadowBlur = 0 // Reset

      const results = detectFrame(performance.now())
      const hands = results?.hand?.landmarks ?? []

      hands.forEach((landmarks, handIdx) => {
        // Track all 5 fingertips: 4=Thumb, 8=Index, 12=Middle, 16=Ring, 20=Pinky
        [4, 8, 12, 16, 20].forEach((tipIdx) => {
          const tip = landmarks[tipIdx]
          // Mirror mapping
          const px = (1 - tip.x) * w
          const py = tip.y * h

          // Draw tracking dot
          ctx.beginPath()
          ctx.arc(px, py, 5, 0, Math.PI * 2)
          ctx.fillStyle = '#ff00ff'
          ctx.fill()

          const id = handIdx * 100 + tipIdx
          const lastTip = lastTipsRef.current[id]

          if (lastTip) {
            // Check collision with any string
            stringsRef.current.forEach(s => {
              // Did we cross the string line?
              if ((lastTip.x <= s.x && px >= s.x) || (lastTip.x >= s.x && px <= s.x)) {
                // Ignore if it's too fast or a jitter (distance > w/2)
                if (Math.abs(lastTip.x - px) < w/4) {
                  // Pluck!
                  s.active = true
                  s.vibration = Math.min(50, Math.abs(lastTip.x - px) * 2) // Velocity affects amplitude
                  s.pluckY = py
                  
                  // Trigger sound
                  if (synthRef.current) {
                    if (synthRef.current instanceof Tone.PolySynth) {
                      synthRef.current.triggerAttackRelease(s.note, "8n")
                    } else {
                      synthRef.current.triggerAttack(s.note)
                    }
                  }

                  // Spawn ripple
                  ripplesRef.current.push({ x: s.x, y: py, radius: 10, life: 1 })
                }
              }
            })
          }
          lastTipsRef.current[id] = { x: px, y: py }
        })
      })

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (synthRef.current) synthRef.current.dispose()
    }
  }, [detectFrame, running, instrument])

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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#060610]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start
          </button>
        ) : (
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <div className="flex bg-black/40 rounded-full p-1 ml-4">
              {(['harp', 'guitar'] as const).map(inst => (
                <button
                  key={inst}
                  onClick={() => setInstrument(inst)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    instrument === inst ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Music className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Sweep your fingers across the glowing strings to play.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Finger Harp</p>
            <p className="mb-4 text-sm text-white/70">Sweep your fingertips across glowing laser strings to play beautiful music in thin air.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Playing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
