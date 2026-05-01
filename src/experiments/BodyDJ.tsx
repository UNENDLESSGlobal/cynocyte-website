import { useEffect, useRef, useState } from 'react'
import { Play, Square, Disc } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function BodyDJ({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const nodesRef = useRef<{
    crossFade: Tone.CrossFade | null,
    filter: Tone.Filter | null,
    loops: Tone.Loop[],
    synths: any[]
  }>({
    crossFade: null, filter: null, loops: [], synths: []
  })

  const stateRef = useRef({
    filterCutoff: 10000,
    bpm: 120,
    crossFade: 0.5,
    isScratching: false,
    recordRotationA: 0,
    recordRotationB: 0,
    prevShoulderDist: 0
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
      Tone.Transport.bpm.value = 120

      const filter = new Tone.Filter(10000, 'lowpass').toDestination()
      const crossFade = new Tone.CrossFade(0.5).connect(filter)

      // Track A: Bassline
      const synthA = new Tone.FMSynth({ modulationIndex: 5 }).connect(crossFade.a)
      synthA.volume.value = -5
      let stepA = 0
      const notesA = ['C2', 'E2', 'G2', 'C3', 'C2', 'G1', 'C2', 'E2']
      const loopA = new Tone.Loop((time) => {
        synthA.triggerAttackRelease(notesA[stepA], '16n', time)
        stepA = (stepA + 1) % notesA.length
      }, '8n')

      // Track B: Chords
      const synthB = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' } }).connect(crossFade.b)
      synthB.volume.value = -8
      let stepB = 0
      const chordsB = [['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['C3', 'E3', 'G3'], ['C3', 'E3', 'G3']]
      const loopB = new Tone.Loop((time) => {
        synthB.triggerAttackRelease(chordsB[stepB], '4n', time)
        stepB = (stepB + 1) % chordsB.length
      }, '2n')

      // Add a simple kick drum to crossfade output so there's always a beat
      const kick = new Tone.MembraneSynth().connect(filter)
      const loopKick = new Tone.Loop((time) => {
        kick.triggerAttackRelease('C1', '8n', time)
      }, '4n')

      loopA.start(0)
      loopB.start(0)
      loopKick.start(0)
      Tone.Transport.start()

      nodesRef.current = { crossFade, filter, loops: [loopA, loopB, loopKick], synths: [synthA, synthB, kick] }
    }
    setupAudio()

    const drawLoop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current
      const n = nodesRef.current

      // Background
      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.15
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const pose = results?.pose?.landmarks?.[0]

      if (pose) {
        // 1. Left Arm Height -> Low-pass Filter (Landmark 15)
        if (pose[15] && pose[15].visibility > 0.5) {
          const ratio = clamp(1 - pose[15].y, 0, 1) // 1 = top
          s.filterCutoff = 200 + (ratio * 19800) // 200Hz to 20kHz
          n.filter?.frequency.rampTo(s.filterCutoff, 0.1)
        }

        // 2. Right Arm Height -> BPM (Landmark 16)
        if (pose[16] && pose[16].visibility > 0.5) {
          const ratio = clamp(1 - pose[16].y, 0, 1)
          s.bpm = 80 + (ratio * 100) // 80 to 180 BPM
          Tone.Transport.bpm.rampTo(s.bpm, 0.1)
        }

        // 3. Head Tilt -> Crossfader (Ears 7, 8)
        if (pose[7] && pose[8] && pose[7].visibility > 0.5 && pose[8].visibility > 0.5) {
          // Normal tilt is roughly Y diff
          // We can map the difference to -1 to 1, then 0 to 1
          const tilt = clamp((pose[7].y - pose[8].y) * 5, -1, 1) // Left to Right
          s.crossFade = (tilt + 1) / 2 // 0 to 1
          n.crossFade?.fade.rampTo(s.crossFade, 0.1)
        }

        // 4. Scratch effect -> Sudden shoulder distance change (twist)
        if (pose[11] && pose[12] && pose[11].visibility > 0.5 && pose[12].visibility > 0.5) {
          const dist = Math.abs(pose[11].x - pose[12].x)
          // If shoulders get very close horizontally, user is turning sideways
          if (dist < 0.08 && s.prevShoulderDist >= 0.08) {
             s.isScratching = true
             Tone.Transport.bpm.value = s.bpm * 4 // scratch!
             setTimeout(() => { Tone.Transport.bpm.value = s.bpm; s.isScratching = false }, 100)
          }
          s.prevShoulderDist = dist
        }

        // Draw Skeleton feedback
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'
        ctx.lineWidth = 4
        if (pose[15]) {
           ctx.beginPath()
           ctx.arc((1-pose[15].x)*w, pose[15].y*h, 15, 0, Math.PI*2)
           ctx.fillStyle = '#00ffff'
           ctx.fill()
           ctx.stroke()
        }
        if (pose[16]) {
           ctx.beginPath()
           ctx.arc((1-pose[16].x)*w, pose[16].y*h, 15, 0, Math.PI*2)
           ctx.fillStyle = '#ff00ff'
           ctx.fill()
           ctx.stroke()
        }
        if (pose[0]) {
           ctx.beginPath()
           ctx.arc((1-pose[0].x)*w, pose[0].y*h, 10, 0, Math.PI*2)
           ctx.fillStyle = '#ffff00'
           ctx.fill()
        }
      }

      // Draw UI (DJ Deck)
      const deckY = h - 150
      const r = 80 // Record radius

      // Update Rotations based on BPM and Scratch
      const rotSpeed = (s.bpm / 60) * 0.05 + (s.isScratching ? 0.5 : 0)
      s.recordRotationA += rotSpeed * (1 - s.crossFade + 0.1)
      s.recordRotationB += rotSpeed * (s.crossFade + 0.1)

      const drawRecord = (x: number, y: number, rotation: number, color: string, active: number) => {
        ctx.save()
        ctx.translate(x, y)
        
        // Glow if active
        if (active > 0.5) {
           ctx.shadowBlur = 20
           ctx.shadowColor = color
        }

        ctx.rotate(rotation)
        
        // Vinyl
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fillStyle = '#111'
        ctx.fill()
        
        // Grooves
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(0, 0, r*0.8, 0, Math.PI*2); ctx.stroke()
        ctx.beginPath(); ctx.arc(0, 0, r*0.6, 0, Math.PI*2); ctx.stroke()
        
        // Label
        ctx.beginPath()
        ctx.arc(0, 0, r*0.3, 0, Math.PI*2)
        ctx.fillStyle = color
        ctx.fill()
        
        // Spindle
        ctx.beginPath()
        ctx.arc(0, 0, 5, 0, Math.PI*2)
        ctx.fillStyle = '#000'
        ctx.fill()

        ctx.restore()
      }

      drawRecord(w/2 - 150, deckY, s.recordRotationA, '#ff0055', 1 - s.crossFade) // Track A (Left)
      drawRecord(w/2 + 150, deckY, s.recordRotationB, '#00ffff', s.crossFade) // Track B (Right)

      // Draw Sliders
      // 1. Crossfader
      ctx.fillStyle = '#333'
      ctx.fillRect(w/2 - 100, deckY + 50, 200, 10)
      ctx.fillStyle = '#fff'
      ctx.fillRect(w/2 - 100 + (s.crossFade * 180), deckY + 40, 20, 30)

      // 2. Filter (Left)
      ctx.fillStyle = '#333'
      ctx.fillRect(40, deckY - 100, 10, 200)
      ctx.fillStyle = '#00ffff'
      const filterRatio = (s.filterCutoff - 200) / 19800
      ctx.fillRect(30, deckY + 100 - (filterRatio * 200) - 10, 30, 20)
      ctx.fillText('FILTER', 35, deckY + 130)

      // 3. BPM (Right)
      ctx.fillStyle = '#333'
      ctx.fillRect(w - 50, deckY - 100, 10, 200)
      ctx.fillStyle = '#ff00ff'
      const bpmRatio = (s.bpm - 80) / 100
      ctx.fillRect(w - 60, deckY + 100 - (bpmRatio * 200) - 10, 30, 20)
      ctx.fillText('TEMPO', w - 65, deckY + 130)

      // Values text
      ctx.fillStyle = '#fff'
      ctx.font = '16px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(s.filterCutoff)} Hz`, 35, deckY - 120)
      ctx.fillText(`${Math.round(s.bpm)} BPM`, w - 45, deckY - 120)
      ctx.fillText(s.isScratching ? 'SCRATCH!' : 'CROSSFADE', w/2, deckY + 90)

      animRef.current = requestAnimationFrame(drawLoop)
    }

    animRef.current = requestAnimationFrame(drawLoop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      Tone.Transport.stop()
      nodesRef.current.loops.forEach(l => l.dispose())
      nodesRef.current.synths.forEach(s => s.dispose())
      if (nodesRef.current.crossFade) nodesRef.current.crossFade.dispose()
      if (nodesRef.current.filter) nodesRef.current.filter.dispose()
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
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none w-max">
          <Disc className="w-4 h-4 text-white/50 mr-2 animate-spin" />
          <span className="text-xs font-medium text-white/80">L-Arm: Filter | R-Arm: Tempo | Head Tilt: Crossfader | Spin: Scratch</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Body DJ</p>
            <p className="mb-4 text-sm text-white/70">Become the DJ mixer. Raise arms to open filters and speed up tempo. Tilt head to crossfade. Spin around to scratch the record!</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Step to the Decks
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
