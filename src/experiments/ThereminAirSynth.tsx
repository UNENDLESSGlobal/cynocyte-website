import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Play, Square, Volume2 } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { mapRange, toCanvasPoint } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function ThereminAirSynth({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState('--')
  const synthRef = useRef<Tone.Synth | null>(null)
  const reverbRef = useRef<Tone.Reverb | null>(null)
  const chorusRef = useRef<Tone.Chorus | null>(null)
  const animRef = useRef<number>(0)

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

    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.4 }).toDestination()
    const chorus = new Tone.Chorus({ frequency: 1.5, depth: 0.7, wet: 0.3 }).connect(reverb)
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.5 },
    }).connect(chorus)
    synthRef.current = synth
    reverbRef.current = reverb
    chorusRef.current = chorus

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.72)'
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(108, 99, 255, 0.15)'
      ctx.lineWidth = 1
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillStyle = 'rgba(108, 99, 255, 0.45)'

      const freqs = [110, 220, 330, 440, 550, 660, 770, 880]
      for (const freq of freqs) {
        const y = h - mapRange(Math.log2(freq), Math.log2(110), Math.log2(880), 0, h)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
        ctx.fillText(`${freq}Hz`, 8, y - 4)
      }

      const results = detectFrame(performance.now())
      const hand = results?.hand?.landmarks?.[0]

      if (hand) {
        const wrist = toCanvasPoint(hand[0], w, h)
        const normalizedX = wrist.x / w
        const normalizedY = wrist.y / h
        const freq = 110 * Math.pow(2, (1 - normalizedY) * 3)
        const volume = -38 + normalizedX * 34

        synth.triggerAttack(freq)
        synth.volume.rampTo(volume, 0.05)
        setNote(Tone.Frequency(freq).toNote())

        const hue = 240 + (1 - normalizedY) * 120
        ctx.save()
        ctx.fillStyle = `hsl(${hue}, 80%, 60%)`
        ctx.shadowBlur = 28
        ctx.shadowColor = `hsl(${hue}, 80%, 60%)`
        ctx.beginPath()
        ctx.arc(wrist.x, wrist.y, 10, 0, Math.PI * 2)
        ctx.fill()

        ctx.globalAlpha = 0.35
        ctx.beginPath()
        ctx.arc(wrist.x, wrist.y, 28, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.7)`
        ctx.lineWidth = 2
        ctx.shadowBlur = 12
        ctx.shadowColor = `hsl(${hue}, 80%, 60%)`
        ctx.beginPath()
        for (let x = 0; x < w; x += 2) {
          const amplitude = 18 + normalizedX * 40
          const y = h / 2 + Math.sin(x * 0.018 + Date.now() * 0.004) * amplitude * Math.sin(Date.now() * 0.002)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      } else {
        synth.triggerRelease()
        setNote('--')

        ctx.fillStyle = 'rgba(255,255,255,0.65)'
        ctx.font = '600 15px Space Grotesk, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Show one hand to play the theremin', w / 2, h / 2)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
      chorus.dispose()
      reverb.dispose()
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
    synthRef.current?.dispose()
    reverbRef.current?.dispose()
    chorusRef.current?.dispose()
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
        <Volume2 className="h-4 w-4" />
        {note}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/80">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Theremin Air Synth</p>
            <p className="mb-4 text-sm text-white/70">Move one hand up and down for pitch. Move left and right for volume.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Synth
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
