import { useEffect, useRef, useState } from 'react'
import { Play, Square, Music } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function HeadConductor({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const nodesRef = useRef<{
    strings: Tone.PolySynth | null,
    brass: Tone.PolySynth | null,
    loops: Tone.Loop[]
  }>({ strings: null, brass: null, loops: [] })

  const stateRef = useRef({
    prevY: 0,
    bpm: 90,
    volume: -10,
    isMinor: false,
    trail: [] as { x: number, y: number, life: number }[]
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
    }
    resize()
    window.addEventListener('resize', resize)

    const setupAudio = async () => {
      await Tone.start()
      Tone.Transport.bpm.value = 90

      const reverb = new Tone.Reverb(4).toDestination()
      reverb.wet.value = 0.5

      const strings = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 1, decay: 1, sustain: 0.8, release: 2 }
      }).connect(reverb)
      strings.volume.value = -10

      const brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 1 }
      }).connect(reverb)
      brass.volume.value = -15

      const majorChords = [['C4', 'E4', 'G4'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['C4', 'E4', 'G4']]
      const minorChords = [['C4', 'Eb4', 'G4'], ['F4', 'Ab4', 'C5'], ['G4', 'Bb4', 'D5'], ['C4', 'Eb4', 'G4']]

      let step = 0
      const loop = new Tone.Loop((time) => {
        const chords = stateRef.current.isMinor ? minorChords : majorChords
        strings.triggerAttackRelease(chords[step % chords.length], '1n', time)
        if (step % 2 === 0) {
           // Brass hits on the 1 and 3
           const root = chords[step % chords.length][0].replace('4', '2')
           brass.triggerAttackRelease([root, root.replace('2', '3')], '2n', time)
        }
        step++
      }, '1m')

      loop.start(0)
      Tone.Transport.start()

      nodesRef.current = { strings, brass, loops: [loop] }
    }
    setupAudio()

    const drawLoop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current
      const n = nodesRef.current

      // Background fade
      ctx.fillStyle = s.isMinor ? 'rgba(5, 5, 15, 0.2)' : 'rgba(15, 10, 5, 0.2)'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.1
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const pose = results?.pose?.landmarks?.[0]

      if (pose && pose[0] && pose[0].visibility > 0.5) {
        const nose = pose[0]
        
        // 1. Dynamics (Volume) -> Head Height
        const heightRatio = clamp(1 - nose.y, 0, 1)
        s.volume = -30 + (heightRatio * 30) // -30dB to 0dB
        if (n.strings) n.strings.volume.rampTo(s.volume, 0.1)
        if (n.brass) n.brass.volume.rampTo(s.volume - 5, 0.1)

        // 2. Tempo -> Nodding Velocity
        const dy = Math.abs(nose.y - s.prevY)
        // Add a bit of the velocity to the BPM, then decay it back to 90
        s.bpm += dy * 500
        s.bpm += (90 - s.bpm) * 0.05
        s.bpm = clamp(s.bpm, 60, 180)
        Tone.Transport.bpm.rampTo(s.bpm, 0.5)

        // 3. Emotion -> Head Tilt (X position)
        s.isMinor = nose.x < 0.5 // Left side = minor, Right side = major

        s.prevY = nose.y

        // Add trail
        s.trail.push({ x: (1 - nose.x) * w, y: nose.y * h, life: 1 })
      }

      // Draw Trail
      ctx.beginPath()
      if (s.trail.length > 0) ctx.moveTo(s.trail[0].x, s.trail[0].y)
      s.trail = s.trail.filter(pt => {
        ctx.lineTo(pt.x, pt.y)
        pt.life -= 0.02
        return pt.life > 0
      })
      ctx.strokeStyle = s.isMinor ? '#0088ff' : '#ffcc00'
      ctx.lineWidth = 4
      ctx.shadowBlur = 20
      ctx.shadowColor = ctx.strokeStyle
      ctx.stroke()
      ctx.shadowBlur = 0

      // Draw Baton tip
      if (s.trail.length > 0) {
         const tip = s.trail[s.trail.length - 1]
         ctx.beginPath()
         ctx.arc(tip.x, tip.y, 8, 0, Math.PI*2)
         ctx.fillStyle = '#fff'
         ctx.fill()
      }

      // UI
      ctx.fillStyle = '#fff'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`TEMPO: ${Math.round(s.bpm)} BPM`, 20, 30)
      ctx.fillText(`DYNAMICS: ${Math.round(((s.volume + 30) / 30) * 100)}%`, 20, 60)
      
      ctx.textAlign = 'center'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillStyle = s.isMinor ? '#0088ff' : '#ffcc00'
      ctx.fillText(s.isMinor ? 'MINOR SCENE' : 'MAJOR SCENE', w/2, h - 30)

      animRef.current = requestAnimationFrame(drawLoop)
    }

    animRef.current = requestAnimationFrame(drawLoop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      Tone.Transport.stop()
      if (nodesRef.current.strings) nodesRef.current.strings.dispose()
      if (nodesRef.current.brass) nodesRef.current.brass.dispose()
      nodesRef.current.loops.forEach(l => l.dispose())
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#06060a]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start Conducting
          </button>
        ) : (
          <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none w-max">
          <Music className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Height = Volume | Nod Speed = Tempo | Move Left/Right = Minor/Major Shift</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Head Conductor</p>
            <p className="mb-4 text-sm text-white/70">Move your head to conduct the orchestra. Raise it for a crescendo. Nod faster to speed up the tempo. Shift left or right to change the emotional tone.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Take the Podium
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
