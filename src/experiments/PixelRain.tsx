import { useRef, useEffect, useState } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import { Play, Square } from 'lucide-react'

interface Props { onClose: () => void }

export default function PixelRain({ onClose }: Props) {
  const { videoRef, start, stop } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  const particlesRef = useRef<Array<{
    targetX: number; targetY: number; x: number; y: number;
    color: string; size: number; state: 'forming' | 'holding' | 'dissolving'
    life: number; vy: number; vx: number
  }>>([])
  const cycleRef = useRef(0)
  const cycleTimer = useRef(0)

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const cols = 40, rows = 30
    const total = cols * rows

    // Init particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < total; i++) {
        particlesRef.current.push({
          targetX: 0, targetY: 0, x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          color: '#6C63FF', size: 4 + Math.random() * 4, state: 'forming',
          life: 1, vy: 0, vx: 0,
        })
      }
    }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const cellW = w / cols
      const cellH = h / rows

      ctx.fillStyle = 'rgba(6, 6, 16, 0.3)'
      ctx.fillRect(0, 0, w, h)

      // Capture frame colors
      if (video.readyState >= 2) {
        const temp = document.createElement('canvas')
        temp.width = cols; temp.height = rows
        const tCtx = temp.getContext('2d')
        if (tCtx) {
          tCtx.drawImage(video, 0, 0, cols, rows)
          const data = tCtx.getImageData(0, 0, cols, rows).data

          cycleTimer.current++
          if (cycleTimer.current > 180) {
            cycleRef.current = (cycleRef.current + 1) % 3
            cycleTimer.current = 0
          }

          const cycle = cycleRef.current

          for (let i = 0; i < total; i++) {
            const col = i % cols
            const row = Math.floor(i / cols)
            const p = particlesRef.current[i]
            const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
            p.color = `rgb(${r},${g},${b})`
            p.targetX = col * cellW + cellW / 2
            p.targetY = row * cellH + cellH / 2

            if (cycle === 0) {
              p.state = 'forming'
              p.x += (p.targetX - p.x) * 0.08
              p.y += (p.targetY - p.y) * 0.08
            } else if (cycle === 1) {
              p.state = 'holding'
              p.x += (p.targetX - p.x) * 0.02
              p.y += (p.targetY - p.y) * 0.02
            } else {
              p.state = 'dissolving'
              p.x += p.vx; p.y += p.vy
              p.vy += 0.1 // gravity
              if (Math.random() > 0.95) {
                p.vx = (Math.random() - 0.5) * 4
                p.vy = -Math.random() * 6
              }
            }
          }
        }
      }

      // Draw particles
      for (const p of particlesRef.current) {
        ctx.save()
        ctx.globalAlpha = p.state === 'dissolving' ? 0.6 : 0.9
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
        ctx.restore()
      }

      // Cycle indicator
      const labels = ['Assembling', 'Holding', 'Dissolving']
      ctx.fillStyle = '#fff'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(labels[cycleRef.current], w / 2, 20)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [running, videoRef])

  const handleStart = async () => { await start(); setRunning(true) }
  const handleStop = () => { setRunning(false); stop(); particlesRef.current = []; onClose() }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover"><Play className="w-4 h-4" /> Start</button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><Square className="w-4 h-4" /> Stop</button>
        )}
      </div>
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: '60vh' }} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Pixel Rain</p>
            <p className="text-white/70 text-sm mb-4">Your face assembles from thousands of pixels, then shatters.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start Camera</button>
          </div>
        </div>
      )}
    </div>
  )
}
