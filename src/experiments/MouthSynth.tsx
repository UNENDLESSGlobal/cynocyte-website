import { useRef, useEffect, useState, useCallback } from 'react'
import { useAudioStream } from '@/hooks/useAudioStream'
import * as Tone from 'tone'
import { Play, Square, Mic, Waves } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function MouthSynth({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [mouthShape, setMouthShape] = useState('Neutral')
  const animRef = useRef<number>(0)
  const { start, stop, getFrequencyData } = useAudioStream()
  const synthRef = useRef<Tone.Synth | null>(null)
  const filterRef = useRef<Tone.Filter | null>(null)

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.3 },
    }).toDestination()
    const filter = new Tone.Filter(200, 'lowpass').toDestination()
    synth.connect(filter)
    synthRef.current = synth
    filterRef.current = filter

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const data = getFrequencyData()

      ctx.fillStyle = 'rgba(6, 6, 16, 0.3)'
      ctx.fillRect(0, 0, w, h)

      // Analyze audio characteristics
      let lowEnergy = 0, midEnergy = 0, highEnergy = 0
      if (data) {
        for (let i = 0; i < 20; i++) lowEnergy += data[i]
        for (let i = 20; i < 80; i++) midEnergy += data[i]
        for (let i = 80; i < 200; i++) highEnergy += data[i]
        lowEnergy /= 20; midEnergy /= 60; highEnergy /= 120
      }

      const totalEnergy = lowEnergy + midEnergy + highEnergy
      const isActive = totalEnergy > 30

      // Map to mouth shape and sound
      let shape = 'Neutral'
      let freq = 220
      let filterFreq = 800
      let color = '#6C63FF'

      if (isActive) {
        if (lowEnergy > midEnergy && lowEnergy > highEnergy && lowEnergy > 80) {
          shape = 'Wide Open (Ahh)'
          freq = 440
          filterFreq = 3000
          color = '#FF6B35'
          synth.set({ oscillator: { type: 'sine' } })
        } else if (highEnergy > midEnergy && highEnergy > 50) {
          shape = 'Smile (Eee)'
          freq = 660
          filterFreq = 5000
          color = '#10B981'
          synth.set({ oscillator: { type: 'sawtooth' } })
        } else if (midEnergy > 60) {
          shape = 'Rounded (Ooo)'
          freq = 200
          filterFreq = 1500
          color = '#3B82F6'
          synth.set({ oscillator: { type: 'triangle' } })
        } else {
          shape = 'Pursed'
          freq = 880
          filterFreq = 4000
          color = '#EC4899'
          synth.set({ oscillator: { type: 'sine' } })
        }

        const volume = Math.min(0, -30 + totalEnergy / 5)
        synth.volume.rampTo(volume, 0.1)
        synth.triggerAttack(freq)
        filter.frequency.rampTo(filterFreq, 0.1)
      } else {
        synth.triggerRelease()
      }

      setMouthShape(shape)

      // Draw spectrum
      if (data) {
        const bars = 64
        const barW = w / bars
        for (let i = 0; i < bars; i++) {
          const val = data[i * 4] || 0
          const barH = (val / 255) * h * 0.6
          ctx.fillStyle = `hsla(${240 + (val / 255) * 120}, 70%, 60%, 0.7)`
          ctx.fillRect(i * barW, h - barH, barW - 1, barH)
        }
      }

      // Mouth visualization
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.shadowBlur = 20
      ctx.shadowColor = color

      const openness = isActive ? 0.3 + (totalEnergy / 255) * 0.5 : 0.05
      ctx.beginPath()
      ctx.ellipse(0, 20, 40 * (1 - openness * 0.5), 30 * openness, 0, 0, Math.PI * 2)
      ctx.stroke()

      // Lips
      ctx.beginPath()
      ctx.moveTo(-35, 20)
      ctx.quadraticCurveTo(0, 20 - 15 * openness, 35, 20)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-35, 20)
      ctx.quadraticCurveTo(0, 20 + 15 * openness, 35, 20)
      ctx.stroke()
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
      filter.dispose()
    }
  }, [running, getFrequencyData])

  const handleStart = async () => {
    await Tone.start()
    await start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stop()
    onClose()
  }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover">
            <Play className="w-4 h-4" /> Start
          </button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover">
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10 glass rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm">
        <Waves className="w-4 h-4" />
        {mouthShape}
      </div>
      <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: '60vh' }} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <Mic className="w-12 h-12 text-[var(--accent-color)] mx-auto mb-4" />
            <p className="text-white text-lg font-semibold mb-2">Mouth Synth</p>
            <p className="text-white/70 text-sm mb-4">Make sounds into your mic. Different mouth shapes create different tones.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">
              Start Microphone
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
