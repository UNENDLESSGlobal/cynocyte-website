import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Mic, Play, Square, Waves } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { FACE_KEYPOINTS, distance, getBlendshapeScore, mapRange, toCanvasPoint } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function MouthSynth({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [mouthShape, setMouthShape] = useState('Neutral')
  const animRef = useRef<number>(0)
  const synthRef = useRef<Tone.Synth | null>(null)
  const filterRef = useRef<Tone.Filter | null>(null)

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.3 },
    }).toDestination()
    const filter = new Tone.Filter(200, 'lowpass').toDestination()
    synth.connect(filter)
    synthRef.current = synth
    filterRef.current = filter

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

      ctx.fillStyle = 'rgba(6, 6, 16, 0.45)'
      ctx.fillRect(0, 0, width, height)

      const result = detectFrame(performance.now())
      const face = result?.face?.faceLandmarks?.[0]
      const blendshapes = result?.face?.faceBlendshapes

      let shape = 'Neutral'
      let freq = 220
      let filterFreq = 800
      let color = '#6C63FF'
      let openness = 0.05

      if (face) {
        const mouthLeft = toCanvasPoint(face[FACE_KEYPOINTS.mouthLeft], width, height)
        const mouthRight = toCanvasPoint(face[FACE_KEYPOINTS.mouthRight], width, height)
        const mouthUpper = toCanvasPoint(face[FACE_KEYPOINTS.mouthUpper], width, height)
        const mouthLower = toCanvasPoint(face[FACE_KEYPOINTS.mouthLower], width, height)

        const mouthWidth = Math.max(1, distance(mouthLeft, mouthRight))
        const mouthHeight = distance(mouthUpper, mouthLower)
        openness = mouthHeight / mouthWidth

        const smile = (getBlendshapeScore(blendshapes, 'mouthSmileLeft') + getBlendshapeScore(blendshapes, 'mouthSmileRight')) / 2
        const pucker = getBlendshapeScore(blendshapes, 'mouthPucker')
        const jawOpen = getBlendshapeScore(blendshapes, 'jawOpen')

        const continuousPitch = mapRange(Math.max(openness, jawOpen), 0.04, 0.42, 110, 880)

        if (pucker > 0.42) {
          shape = 'Pursed'
          freq = Math.max(660, continuousPitch)
          filterFreq = 4200
          color = '#EC4899'
          synth.set({ oscillator: { type: 'sine' } })
        } else if (smile > 0.38) {
          shape = 'Smile (Eee)'
          freq = continuousPitch + 80
          filterFreq = 5000
          color = '#10B981'
          synth.set({ oscillator: { type: 'sawtooth' } })
        } else if (openness > 0.22) {
          shape = 'Wide Open (Ahh)'
          freq = continuousPitch
          filterFreq = 3000
          color = '#FF6B35'
          synth.set({ oscillator: { type: 'sine' } })
        } else if (openness > 0.1) {
          shape = 'Rounded (Ooo)'
          freq = Math.max(140, continuousPitch - 120)
          filterFreq = 1600
          color = '#3B82F6'
          synth.set({ oscillator: { type: 'triangle' } })
        }

        const volume = mapRange(Math.max(openness, jawOpen), 0.03, 0.42, -28, -2)
        synth.volume.rampTo(volume, 0.08)
        synth.triggerAttack(freq)
        filter.frequency.rampTo(filterFreq, 0.08)
      } else {
        synth.triggerRelease()
      }

      setMouthShape(shape)

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.shadowBlur = 20
      ctx.shadowColor = color

      ctx.beginPath()
      ctx.ellipse(0, 20, 42 * (1 - openness * 0.45), 36 * openness, 0, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(-36, 20)
      ctx.quadraticCurveTo(0, 20 - 18 * openness, 36, 20)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(-36, 20)
      ctx.quadraticCurveTo(0, 20 + 18 * openness, 36, 20)
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Open, round, smile, or purse your lips', width / 2, height - 20)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
      filter.dispose()
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
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white">
        <Waves className="h-4 w-4" />
        {mouthShape}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <Mic className="mx-auto mb-4 h-12 w-12 text-[var(--accent-color)]" />
            <p className="mb-2 text-lg font-semibold text-white">Mouth Synth</p>
            <p className="mb-4 text-sm text-white/70">Open wide for “Ahh”, round lips for “Ooo”, smile for “Eee”, or purse for a whistle tone.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
