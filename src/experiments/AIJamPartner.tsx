import { useEffect, useRef, useState } from 'react'
import { Play, Square, Cpu, User } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

const SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5']

export default function AIJamPartner({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [turn, setTurn] = useState<'user' | 'ai'>('user')
  const animRef = useRef<number>(0)

  const synthRef = useRef<Tone.PolySynth | null>(null)
  const aiSynthRef = useRef<Tone.PolySynth | null>(null)

  const stateRef = useRef({
    turn: 'user',
    userNotes: [] as { note: string, time: number, duration: number }[],
    aiNotes: [] as { note: string, time: number, duration: number }[],
    startTime: 0,
    lastPlayTime: 0,
    activeNotes: new Set<string>(),
    visualNotes: [] as { note: string, y: number, color: string, life: number }[]
  })

  useEffect(() => {
    stateRef.current.turn = turn
    
    if (turn === 'ai') {
      // Generate AI response and play it
      const s = stateRef.current
      if (s.userNotes.length === 0) {
        setTimeout(() => setTurn('user'), 2000)
        return
      }

      // Simple AI Algorithm: Reverse rhythm, transpose up a 5th (7 semitones, roughly 4 steps in pentatonic)
      const aiResponse = s.userNotes.map((n, i) => {
        const scaleIdx = SCALE.indexOf(n.note)
        const newIdx = Math.min(SCALE.length - 1, scaleIdx + 2) // Up a third/fifth roughly
        
        // Time mirroring: last note played first in sequence
        const totalDuration = s.userNotes[s.userNotes.length - 1].time - s.userNotes[0].time
        const reversedTime = totalDuration - (n.time - s.userNotes[0].time)
        
        return {
          note: SCALE[newIdx],
          time: Tone.now() + 0.5 + reversedTime, // Start half a second from now
          duration: n.duration
        }
      })

      // Schedule playback
      const part = new Tone.Part((time, value) => {
        aiSynthRef.current?.triggerAttackRelease(value.note, 0.2, time)
        
        // Add to visuals
        const scaleIdx = SCALE.indexOf(value.note)
        s.visualNotes.push({
          note: value.note,
          y: (scaleIdx / SCALE.length) * (canvasRef.current?.height || 600),
          color: '#ff00ff', // AI color
          life: 1
        })
      }, aiResponse).start(0)

      // Schedule return to user
      const lastNoteTime = Math.max(...aiResponse.map(n => n.time))
      setTimeout(() => {
        part.dispose()
        s.userNotes = [] // Reset for next jam
        setTurn('user')
      }, (lastNoteTime - Tone.now() + 1) * 1000)
    }
  }, [turn])

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
    }
    resize()
    window.addEventListener('resize', resize)

    synthRef.current = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' } }).toDestination()
    aiSynthRef.current = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' } }).toDestination()

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      // Background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.2
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      // Draw Piano Pads
      const padHeight = h / SCALE.length
      SCALE.forEach((note, i) => {
        const y = i * padHeight
        const isActive = s.activeNotes.has(note)
        
        ctx.fillStyle = isActive ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)'
        ctx.strokeStyle = isActive ? '#00ffff' : 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 2
        
        ctx.fillRect(w - 150, y, 150, padHeight)
        ctx.strokeRect(w - 150, y, 150, padHeight)
        
        ctx.fillStyle = isActive ? '#00ffff' : '#fff'
        ctx.font = '16px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(note, w - 75, y + padHeight / 2 + 5)
      })

      // Draw Visual Notes (Piano Roll)
      s.visualNotes = s.visualNotes.filter(n => n.life > 0)
      s.visualNotes.forEach(n => {
        ctx.beginPath()
        ctx.fillStyle = n.color
        ctx.globalAlpha = n.life
        ctx.arc(w - 200 - (1 - n.life) * 500, n.y + padHeight / 2, 20 * n.life, 0, Math.PI * 2)
        ctx.fill()
        
        n.life -= 0.01 // Fade and move left
      })
      ctx.globalAlpha = 1

      // Track Hands if it's user's turn
      if (s.turn === 'user') {
        const results = detectFrame(performance.now())
        const hands = results?.hand?.landmarks ?? []
        
        const newActiveNotes = new Set<string>()

        hands.forEach((landmarks) => {
          // Index tip (8) and Middle tip (12)
          [8, 12].forEach(tipIdx => {
            const tip = landmarks[tipIdx]
            const px = (1 - tip.x) * w
            const py = tip.y * h

            // Draw finger
            ctx.beginPath()
            ctx.arc(px, py, 10, 0, Math.PI * 2)
            ctx.fillStyle = '#00ffff'
            ctx.fill()

            // Check collision with pads
            if (px > w - 150) {
              const padIdx = Math.floor(py / padHeight)
              if (padIdx >= 0 && padIdx < SCALE.length) {
                newActiveNotes.add(SCALE[padIdx])
              }
            }
          })
        })

        // Handle Note On/Off
        newActiveNotes.forEach(note => {
          if (!s.activeNotes.has(note)) {
            // Note On
            synthRef.current?.triggerAttack(note)
            if (s.userNotes.length === 0) s.startTime = Tone.now()
            s.userNotes.push({ note, time: Tone.now(), duration: 0.2 }) // Default duration for simple tracking
            s.lastPlayTime = performance.now()
            
            s.visualNotes.push({
              note,
              y: SCALE.indexOf(note) * padHeight,
              color: '#00ffff',
              life: 1
            })
          }
        })

        s.activeNotes.forEach(note => {
          if (!newActiveNotes.has(note)) {
            // Note Off
            synthRef.current?.triggerRelease(note)
          }
        })

        s.activeNotes = newActiveNotes

        // Auto pass turn if silent for 2.5 seconds after playing
        if (s.userNotes.length > 0 && performance.now() - s.lastPlayTime > 2500) {
          s.activeNotes.forEach(note => synthRef.current?.triggerRelease(note))
          s.activeNotes.clear()
          setTurn('ai')
        }
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (synthRef.current) synthRef.current.dispose()
      if (aiSynthRef.current) aiSynthRef.current.dispose()
      Tone.Transport.stop()
    }
  }, [detectFrame, running])

  const handleStart = async () => {
    await Tone.start()
    Tone.Transport.start()
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
          <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-full glass px-6 py-3 pointer-events-none">
          <div className={`flex items-center gap-2 transition-opacity ${turn === 'user' ? 'opacity-100 text-cyan-400' : 'opacity-50 text-white'}`}>
            <User className="w-5 h-5" />
            <span className="font-bold">YOUR TURN</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className={`flex items-center gap-2 transition-opacity ${turn === 'ai' ? 'opacity-100 text-fuchsia-400' : 'opacity-50 text-white'}`}>
            <Cpu className="w-5 h-5" />
            <span className="font-bold">AI'S TURN</span>
          </div>
        </div>
      )}

      {running && turn === 'user' && stateRef.current.userNotes.length === 0 && (
        <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <p className="text-xl font-bold text-white/50 animate-pulse text-center">
            Touch the pads on the right to play a melody.<br/>Stop for 2 seconds to pass your turn.
          </p>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">AI Jam Partner</p>
            <p className="mb-4 text-sm text-white/70">A musical call-and-response game. Play a melody using your hands, and the AI will listen and respond with a harmonizing algorithmic solo.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Jamming
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
