import { useRef, useEffect, useState, useCallback } from 'react'
import * as Tone from 'tone'
import { Play, Square, Palette } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function FingerLightsaber({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [colorMode, setColorMode] = useState<'blue' | 'red' | 'green'>('blue')
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const animRef = useRef<number>(0)
  const humOscRef = useRef<Tone.Oscillator | null>(null)
  const clashSynthRef = useRef<Tone.NoiseSynth | null>(null)
  const sparksRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number }>>([])

  const colors = {
    blue: { core: '#ffffff', glow: '#4488ff', outer: '#2266cc' },
    red: { core: '#ffffff', glow: '#ff4444', outer: '#cc2222' },
    green: { core: '#ffffff', glow: '#44ff88', outer: '#22cc66' },
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top
  }, [])

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const humOsc = new Tone.Oscillator(60, 'sawtooth').toDestination()
    humOsc.volume.value = -25
    humOsc.start()
    humOscRef.current = humOsc

    const clashSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    }).toDestination()
    clashSynth.volume.value = -10
    clashSynthRef.current = clashSynth

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = 'rgba(6, 6, 16, 0.4)'
      ctx.fillRect(0, 0, w, h)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const c = colors[colorMode]

      // Blade direction (pointing up from mouse)
      const bladeLen = h * 0.5
      const tipX = mx
      const tipY = my - bladeLen

      // Hum modulation
      const humWidth = 2 + Math.sin(Date.now() * 0.1) * 2
      humOsc.frequency.value = 60 + Math.sin(Date.now() * 0.05) * 2

      // Draw blade layers
      // Outer glow
      ctx.save()
      ctx.strokeStyle = c.outer
      ctx.lineWidth = 24 + humWidth
      ctx.globalAlpha = 0.2
      ctx.shadowBlur = 40
      ctx.shadowColor = c.glow
      ctx.beginPath()
      ctx.moveTo(mx, my + 20)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()

      // Mid glow
      ctx.strokeStyle = c.glow
      ctx.lineWidth = 12
      ctx.globalAlpha = 0.6
      ctx.shadowBlur = 25
      ctx.beginPath()
      ctx.moveTo(mx, my + 20)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()

      // Core
      ctx.strokeStyle = c.core
      ctx.lineWidth = 4 + humWidth * 0.3
      ctx.globalAlpha = 1
      ctx.shadowBlur = 15
      ctx.shadowColor = c.glow
      ctx.beginPath()
      ctx.moveTo(mx, my + 20)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      ctx.restore()

      // Hilt (simplified)
      ctx.save()
      ctx.fillStyle = '#888'
      ctx.fillRect(mx - 6, my, 12, 30)
      ctx.fillStyle = '#aaa'
      ctx.fillRect(mx - 8, my + 5, 16, 4)
      ctx.fillRect(mx - 8, my + 18, 16, 4)
      ctx.restore()

      // Sparks
      const sparks = sparksRef.current
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.x += s.vx; s.y += s.vy
        s.life -= 0.02
        if (s.life <= 0) { sparks.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = s.life
        ctx.fillStyle = '#ffdd44'
        ctx.shadowBlur = 6
        ctx.shadowColor = '#ffdd44'
        ctx.beginPath()
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Clash flash center
      if (Math.hypot(mx - w / 2, my - h / 2) < 100 && Math.random() > 0.95) {
        clashSynth.triggerAttackRelease('16n')
        for (let i = 0; i < 20; i++) {
          sparks.push({
            x: w / 2, y: h / 2,
            vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
            life: 1,
          })
        }
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      humOsc.stop(); humOsc.dispose()
      clashSynth.dispose()
    }
  }, [running, colorMode])

  const handleStart = async () => {
    await Tone.start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    onClose()
  }

  const cycleColor = () => {
    setColorMode(c => c === 'blue' ? 'red' : c === 'red' ? 'green' : 'blue')
  }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover">
            <Play className="w-4 h-4" /> Start
          </button>
        ) : (
          <>
            <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover">
              <Square className="w-4 h-4" /> Stop
            </button>
            <button onClick={cycleColor} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover">
              <Palette className="w-4 h-4" /> {colorMode}
            </button>
          </>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ minHeight: '60vh' }}
        onMouseMove={handleMouseMove}
      />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Finger Lightsaber</p>
            <p className="text-white/70 text-sm mb-4">Move your mouse to wield the saber. Approach center for clash!</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">
              Activate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
