import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Play, SkipBack, SkipForward, Square, Volume2, Zap } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { clamp, getBlendshapeScore } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

type TrackConfig = {
  name: string
  bpm: number
  notes: string[]
  bass: string
}

const tracks: TrackConfig[] = [
  { name: 'Neon Nights', bpm: 104, notes: ['C4', 'G4', 'A4', 'G4', 'E4', 'G4', 'A4', 'D4'], bass: 'C2' },
  { name: 'Cyber Drift', bpm: 116, notes: ['D4', 'F4', 'A4', 'F4', 'G4', 'A4', 'C5', 'A4'], bass: 'D2' },
  { name: 'Digital Soul', bpm: 96, notes: ['A3', 'C4', 'E4', 'G4', 'E4', 'C4', 'D4', 'F4'], bass: 'A1' },
  { name: 'Future Bass', bpm: 124, notes: ['F4', 'A4', 'C5', 'A4', 'G4', 'A4', 'D5', 'A4'], bass: 'F2' },
]

export default function EyebrowDJ({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [track, setTrack] = useState(tracks[0].name)
  const [volume, setVolume] = useState(50)
  const animRef = useRef<number>(0)
  const eqBarsRef = useRef<number[]>(Array(16).fill(0))
  const trackIndexRef = useRef(0)
  const transportEventRef = useRef<number | null>(null)
  const stepRef = useRef(0)
  const gestureCooldownRef = useRef(0)
  const leftBrowRef = useRef(0)
  const rightBrowRef = useRef(0)
  const bassDropPulseRef = useRef(0)
  const gainRef = useRef<Tone.Gain | null>(null)
  const leadRef = useRef<Tone.PolySynth | null>(null)
  const bassRef = useRef<Tone.MonoSynth | null>(null)
  const impactRef = useRef<Tone.NoiseSynth | null>(null)

  const syncTrack = (index: number) => {
    const next = tracks[index]
    trackIndexRef.current = index
    stepRef.current = 0
    setTrack(next.name)
    Tone.Transport.bpm.rampTo(next.bpm, 0.2)
  }

  const nextTrack = () => {
    syncTrack((trackIndexRef.current + 1) % tracks.length)
  }

  const prevTrack = () => {
    syncTrack((trackIndexRef.current - 1 + tracks.length) % tracks.length)
  }

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.rampTo(volume / 100, 0.12)
    }
  }, [volume])

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gain = new Tone.Gain(volume / 100).toDestination()
    const lead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.35 },
    }).connect(gain)
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.6 },
      filterEnvelope: { attack: 0.001, decay: 0.25, sustain: 0.2, release: 0.6, baseFrequency: 120, octaves: 2.6 },
    }).connect(gain)
    const impact = new Tone.NoiseSynth({
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.08 },
    }).connect(gain)

    gainRef.current = gain
    leadRef.current = lead
    bassRef.current = bass
    impactRef.current = impact

    Tone.Transport.stop()
    Tone.Transport.cancel()
    syncTrack(trackIndexRef.current)
    transportEventRef.current = Tone.Transport.scheduleRepeat((time) => {
      const activeTrack = tracks[trackIndexRef.current]
      const step = stepRef.current
      const note = activeTrack.notes[step % activeTrack.notes.length]
      lead.triggerAttackRelease(note, '16n', time)
      if (step % 4 === 0) bass.triggerAttackRelease(activeTrack.bass, '8n', time)
      stepRef.current += 1
    }, '8n')
    Tone.Transport.start()

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

      ctx.fillStyle = 'rgba(6, 6, 16, 0.68)'
      ctx.fillRect(0, 0, width, height)

      const blendshapes = detectFrame(performance.now())?.face?.faceBlendshapes
      const leftUp = getBlendshapeScore(blendshapes, 'browOuterUpLeft') + getBlendshapeScore(blendshapes, 'browInnerUp') * 0.35
      const rightUp = getBlendshapeScore(blendshapes, 'browOuterUpRight') + getBlendshapeScore(blendshapes, 'browInnerUp') * 0.35
      const leftDown = getBlendshapeScore(blendshapes, 'browDownLeft')

      leftBrowRef.current += (leftUp - leftBrowRef.current) * 0.2
      rightBrowRef.current += (rightUp - rightBrowRef.current) * 0.2

      if (gestureCooldownRef.current <= 0) {
        if (leftUp > 0.34 && rightUp > 0.34) {
          bass.triggerAttackRelease(tracks[trackIndexRef.current].bass, '2n')
          impact.triggerAttackRelease('16n')
          bassDropPulseRef.current = 1
          gestureCooldownRef.current = 22
        } else if (leftDown > 0.28 && rightUp < 0.25) {
          prevTrack()
          gestureCooldownRef.current = 18
        } else if (leftUp > 0.34 && rightUp < 0.28) {
          nextTrack()
          gestureCooldownRef.current = 18
        } else if (rightUp > 0.34 && leftUp < 0.28) {
          setVolume((value) => {
            const next = clamp(value + 10, 20, 100)
            gain.gain.rampTo(next / 100, 0.12)
            return next
          })
          gestureCooldownRef.current = 12
        }
      }

      gestureCooldownRef.current = Math.max(0, gestureCooldownRef.current - 1)
      bassDropPulseRef.current *= 0.92

      const energy = 0.4 + bassDropPulseRef.current

      for (let index = 0; index < 16; index += 1) {
        const target =
          ((Math.sin(Date.now() * 0.003 + index * 0.4) + 1) / 2) * 0.25 +
          (index % 4 === stepRef.current % 4 ? 0.45 : 0) +
          energy * (index % 3 === 0 ? 0.25 : 0.1)
        eqBarsRef.current[index] = eqBarsRef.current[index] * 0.82 + target * 0.18
        const barHeight = eqBarsRef.current[index] * height * 0.4
        ctx.fillStyle = `hsl(${240 + index * 10}, 70%, 60%)`
        ctx.fillRect(width * 0.2 + index * (width * 0.6 / 16), height * 0.7 - barHeight, width * 0.6 / 16 - 2, barHeight)
      }

      ctx.save()
      ctx.translate(width * 0.15, height * 0.4)
      ctx.rotate(Date.now() * 0.003 * (0.3 + leftBrowRef.current * 1.8))
      ctx.fillStyle = 'rgba(108, 99, 255, 0.3)'
      ctx.beginPath()
      ctx.arc(0, 0, 40, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#6C63FF'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, 40, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#6C63FF'
      ctx.fillRect(-2, -35, 4, 20)
      ctx.restore()

      ctx.save()
      ctx.translate(width * 0.85, height * 0.4)
      ctx.rotate(Date.now() * 0.003 * (0.3 + rightBrowRef.current * 1.8))
      ctx.fillStyle = 'rgba(236, 72, 153, 0.3)'
      ctx.beginPath()
      ctx.arc(0, 0, 40, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#EC4899'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, 40, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#EC4899'
      ctx.fillRect(-2, -35, 4, 20)
      ctx.restore()

      ctx.save()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px Space Grotesk, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(track, width / 2, height * 0.25)
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(`${Math.round(Tone.Transport.bpm.value)} BPM`, width / 2, height * 0.3)
      ctx.restore()

      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(width / 2 - 52, height * 0.85, 104, 8)
      ctx.fillStyle = '#6C63FF'
      ctx.fillRect(width / 2 - 52, height * 0.85, volume, 8)

      ctx.fillStyle = 'rgba(255,255,255,0.62)'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Left brow: next, right brow: volume, both: bass drop, left furrow: previous', width / 2, height - 18)

      if (bassDropPulseRef.current > 0.05) {
        ctx.save()
        ctx.globalAlpha = bassDropPulseRef.current * 0.4
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, 100 + bassDropPulseRef.current * 180, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (transportEventRef.current !== null) Tone.Transport.clear(transportEventRef.current)
      Tone.Transport.stop()
      Tone.Transport.cancel()
      impact.dispose()
      bass.dispose()
      lead.dispose()
      gain.dispose()
    }
  }, [detectFrame, running, videoRef])

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
    <div className="relative flex h-full w-full flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
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
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button onClick={prevTrack} className="flex h-8 w-8 items-center justify-center rounded-full glass text-white">
          <SkipBack className="h-4 w-4" />
        </button>
        <button onClick={nextTrack} className="flex h-8 w-8 items-center justify-center rounded-full glass text-white">
          <SkipForward className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1 rounded-full glass px-3 py-1 text-xs text-white">
          <Volume2 className="h-3.5 w-3.5" /> {Math.round(volume)}%
        </div>
        <div className="flex items-center gap-1 rounded-full glass px-3 py-1 text-xs text-white">
          <Zap className="h-3.5 w-3.5" /> Brow DJ
        </div>
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Eyebrow DJ</p>
            <p className="mb-4 text-sm text-white/70">Raise the left brow to skip, the right brow for volume, both for a bass drop, and furrow left to go back.</p>
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
