import { useEffect, useRef, useState } from 'react'
import { Play, Square, Music } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

const SCALE = ['C', 'D', 'E', 'G', 'A']

function getNote(ratio: number, octaves: number[]) {
  const noteIdx = Math.floor(ratio * SCALE.length * octaves.length)
  const clampedIdx = clamp(noteIdx, 0, SCALE.length * octaves.length - 1)
  const octave = octaves[Math.floor(clampedIdx / SCALE.length)]
  const note = SCALE[clampedIdx % SCALE.length]
  return `${note}${octave}`
}

export default function InvisibleInstrumentOrchestra({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const nodesRef = useRef<{
    strings: Tone.PolySynth | null,
    brass: Tone.PolySynth | null,
    woodwind: Tone.FMSynth | null,
    perc: Tone.MembraneSynth | null,
    reverb: Tone.Reverb | null
  }>({
    strings: null, brass: null, woodwind: null, perc: null, reverb: null
  })

  const stateRef = useRef({
    prevPose: null as any,
    activeStrings: '',
    activeBrass: '',
    activeWoodwind: '',
    visuals: [] as { x: number, y: number, color: string, life: number }[]
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
      const reverb = new Tone.Reverb(4).toDestination()
      reverb.wet.value = 0.4

      const strings = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.5, release: 1 }
      }).connect(reverb)
      strings.volume.value = -5

      const brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 }
      }).connect(reverb)
      brass.volume.value = -8

      const woodwind = new Tone.FMSynth({
        harmonicity: 2,
        modulationIndex: 3,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.2, release: 0.5 }
      }).connect(reverb)
      woodwind.volume.value = -10

      const perc = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
      }).connect(reverb)
      perc.volume.value = 0

      nodesRef.current = { strings, brass, woodwind, perc, reverb }
    }
    setupAudio()

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current
      const n = nodesRef.current

      // Fade background
      ctx.fillStyle = 'rgba(6, 6, 16, 0.2)'
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

      if (pose && n.strings && n.brass && n.woodwind && n.perc) {
        
        // --- 1. Left Hand (Strings) -> Landmark 15
        if (pose[15] && pose[15].visibility > 0.5) {
          const ratio = clamp(1 - pose[15].y, 0, 1)
          // Require hand to be raised above hip (landmark 23)
          if (pose[15].y < pose[23].y) {
            const note = getNote(ratio, [4, 5])
            if (note !== s.activeStrings) {
              n.strings.releaseAll()
              n.strings.triggerAttack(note)
              s.activeStrings = note
            }
            // Add visual
            s.visuals.push({ x: (1-pose[15].x)*w, y: pose[15].y*h, color: '#00ffff', life: 1 })
          } else if (s.activeStrings) {
            n.strings.releaseAll()
            s.activeStrings = ''
          }
        }

        // --- 2. Right Hand (Brass) -> Landmark 16
        if (pose[16] && pose[16].visibility > 0.5) {
          const ratio = clamp(1 - pose[16].y, 0, 1)
          if (pose[16].y < pose[24].y) {
            const note = getNote(ratio, [2, 3])
            if (note !== s.activeBrass) {
              n.brass.releaseAll()
              n.brass.triggerAttack(note)
              s.activeBrass = note
            }
            s.visuals.push({ x: (1-pose[16].x)*w, y: pose[16].y*h, color: '#ffaa00', life: 1 })
            
            // Volume by spread (distance from shoulder 12)
            const spread = Math.abs(pose[16].x - pose[12].x)
            n.brass.volume.rampTo(clamp(spread * 20 - 20, -30, 0), 0.1)
          } else if (s.activeBrass) {
            n.brass.releaseAll()
            s.activeBrass = ''
          }
        }

        // --- 3. Head (Woodwind) -> Nose 0
        if (pose[0] && pose[0].visibility > 0.5) {
          // If head is tilted heavily (ear 7 and 8 Y diff) play woodwind
          const tilt = Math.abs(pose[7].y - pose[8].y)
          if (tilt > 0.05) {
            const ratio = clamp(1 - pose[0].y, 0, 1)
            const note = getNote(ratio, [5, 6])
            if (note !== s.activeWoodwind) {
               n.woodwind.triggerAttack(note)
               s.activeWoodwind = note
            }
            n.woodwind.modulationIndex.rampTo(tilt * 50, 0.1)
            s.visuals.push({ x: (1-pose[0].x)*w, y: pose[0].y*h, color: '#4ade80', life: 1 })
          } else if (s.activeWoodwind) {
             n.woodwind.triggerRelease()
             s.activeWoodwind = ''
          }
        }

        // --- 4. Feet (Percussion) -> Ankles 27, 28
        if (s.prevPose) {
          const checkStomp = (idx: number, prev: any) => {
             if (pose[idx] && prev[idx] && pose[idx].visibility > 0.5) {
                const dy = pose[idx].y - prev[idx].y
                if (dy > 0.05) { // moving down quickly
                   n.perc?.triggerAttackRelease('C1', '8n')
                   s.visuals.push({ x: (1-pose[idx].x)*w, y: pose[idx].y*h, color: '#ff0055', life: 1 })
                   // Draw massive ring
                   for(let i=0; i<8; i++) s.visuals.push({ x: (1-pose[idx].x)*w, y: pose[idx].y*h, color: '#ff0055', life: 2 })
                }
             }
          }
          checkStomp(27, s.prevPose) // Left Ankle
          checkStomp(28, s.prevPose) // Right Ankle
        }

        s.prevPose = pose

        // Draw Skeleton lines lightly
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.lineWidth = 1
        const drawBone = (p1: number, p2: number) => {
          if (pose[p1] && pose[p2] && pose[p1].visibility > 0.5 && pose[p2].visibility > 0.5) {
            ctx.beginPath()
            ctx.moveTo((1 - pose[p1].x) * w, pose[p1].y * h)
            ctx.lineTo((1 - pose[p2].x) * w, pose[p2].y * h)
            ctx.stroke()
          }
        }
        drawBone(11, 12); drawBone(11, 13); drawBone(13, 15); drawBone(12, 14); drawBone(14, 16)
        drawBone(11, 23); drawBone(12, 24); drawBone(23, 24)
        drawBone(23, 25); drawBone(25, 27); drawBone(24, 26); drawBone(26, 28)
      } else {
        if (s.activeStrings) { n.strings?.releaseAll(); s.activeStrings = '' }
        if (s.activeBrass) { n.brass?.releaseAll(); s.activeBrass = '' }
        if (s.activeWoodwind) { n.woodwind?.triggerRelease(); s.activeWoodwind = '' }
        s.prevPose = null
      }

      // Draw Visuals
      s.visuals = s.visuals.filter(v => {
        ctx.beginPath()
        ctx.arc(v.x, v.y, (2 - v.life) * 30, 0, Math.PI * 2)
        ctx.strokeStyle = v.color
        ctx.globalAlpha = v.life
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.globalAlpha = 1
        
        v.life -= 0.05
        v.y -= 2 // float up slightly
        return v.life > 0
      })

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (nodesRef.current.strings) {
        Object.values(nodesRef.current).forEach(n => {
          if (n) n.dispose()
        })
      }
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
          <Music className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">L-Hand: Strings | R-Hand: Brass | Head Tilt: Woodwind | Stomp: Drums</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Invisible Orchestra</p>
            <p className="mb-4 text-sm text-white/70">Assign different instruments to each limb. Raise hands to play strings and brass, tilt your head for woodwinds, and stomp for percussion!</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Conducting
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
