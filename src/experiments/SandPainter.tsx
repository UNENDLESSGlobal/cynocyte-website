import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { clamp, toCanvasPoint, type Point } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
}

export default function SandPainter({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const dunesRef = useRef<number[]>([])
  const lastTipsRef = useRef<Point[]>([])
  const hueRef = useRef(0)

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
      dunesRef.current = new Array(Math.ceil(canvas.width / 4)).fill(canvas.height)
    }

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

      ctx.fillStyle = 'rgba(6, 6, 16, 0.4)'
      ctx.fillRect(0, 0, w, h)

      hueRef.current = (hueRef.current + 0.5) % 360

      const results = detectFrame(performance.now())
      const hands = results?.hand?.landmarks ?? []

      hands.forEach((landmarks, handIndex) => {
        const tip = toCanvasPoint(landmarks[8], w, h)
        const previousTip = lastTipsRef.current[handIndex] ?? tip
        const velocity = Math.hypot(tip.x - previousTip.x, tip.y - previousTip.y)

        lastTipsRef.current[handIndex] = tip

        if (tip.y > 0 && tip.x > 0) {
          const isExplosion = velocity > 15
          const count = isExplosion ? 15 : 3

          for (let i = 0; i < count; i++) {
            particlesRef.current.push({
              x: tip.x + (Math.random() - 0.5) * 10,
              y: tip.y + (Math.random() - 0.5) * 10,
              vx: isExplosion ? (Math.random() - 0.5) * velocity * 0.4 : (Math.random() - 0.5) * 2,
              vy: isExplosion ? (Math.random() - 0.5) * velocity * 0.4 : Math.random() * 2,
              life: 1,
              hue: hueRef.current + (Math.random() - 0.5) * 20,
            })
          }

          ctx.save()
          ctx.fillStyle = `hsl(${hueRef.current}, 80%, 60%)`
          ctx.shadowBlur = 15
          ctx.shadowColor = `hsl(${hueRef.current}, 80%, 60%)`
          ctx.beginPath()
          ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      })

      const dunes = dunesRef.current
      const duneWidth = 4

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]
        p.vy += 0.2 // gravity
        p.x += p.vx
        p.y += p.vy

        const duneIndex = Math.floor(clamp(p.x / duneWidth, 0, dunes.length - 1))
        
        if (p.y >= dunes[duneIndex]) {
          // Hit dune, increase dune height
          dunes[duneIndex] -= 1
          // Smooth adjacent dunes to create slopes
          if (duneIndex > 0 && dunes[duneIndex - 1] > dunes[duneIndex] + 2) dunes[duneIndex - 1] -= 0.5
          if (duneIndex < dunes.length - 1 && dunes[duneIndex + 1] > dunes[duneIndex] + 2) dunes[duneIndex + 1] -= 0.5
          
          particlesRef.current.splice(i, 1)
          continue
        }

        ctx.fillStyle = `hsl(${p.hue}, 100%, 70%)`
        ctx.shadowBlur = 10
        ctx.shadowColor = ctx.fillStyle
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2, 0, Math.PI*2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Draw dunes with extra glow
      ctx.fillStyle = '#ffb347' // Base sand color
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let i = 0; i < dunes.length; i++) {
        ctx.lineTo(i * duneWidth, dunes[i])
      }
      ctx.lineTo(w, h)
      
      ctx.shadowBlur = 30
      ctx.shadowColor = '#ffb347'
      ctx.fill()
      ctx.shadowBlur = 0
      
      // Dune gradient
      const gradient = ctx.createLinearGradient(0, h - 100, 0, h)
      gradient.addColorStop(0, 'rgba(255, 179, 71, 0.1)')
      gradient.addColorStop(1, 'rgba(255, 179, 71, 0.8)')
      ctx.fillStyle = gradient
      ctx.fill()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, running, videoRef])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    particlesRef.current = []
    lastTipsRef.current = []
    onClose()
  }

  const handleReset = () => {
    particlesRef.current = []
    if (canvasRef.current) {
      dunesRef.current = new Array(Math.ceil(canvasRef.current.width / 4)).fill(canvasRef.current.height)
    }
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
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <button onClick={handleReset} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </>
        )}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Sand Painter</p>
            <p className="mb-4 text-sm text-white/70">Create flowing sand art. Fast movements for explosions, slow for flow.</p>
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
