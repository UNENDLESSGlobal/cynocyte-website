import { useRef, useEffect, useState, useCallback } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import { Play, Square, RefreshCw, SlidersHorizontal } from 'lucide-react'

interface Props { onClose: () => void }

interface Ball {
  x: number; y: number; vx: number; vy: number; r: number; color: string; hue: number
}

export default function GravityPainter({ onClose }: Props) {
  const { videoRef, start, stop } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [gravity, setGravity] = useState(1.5)
  const [maxBalls, setMaxBalls] = useState(25)
  const animRef = useRef<number>(0)
  const ballsRef = useRef<Ball[]>([])
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const frameCount = useRef(0)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = (e.clientX - rect.left) / rect.width
    mouseRef.current.y = (e.clientY - rect.top) / rect.height
  }, [])

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

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      frameCount.current++

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }

      // Darken slightly
      ctx.fillStyle = 'rgba(6, 6, 16, 0.3)'
      ctx.fillRect(0, 0, w, h)

      // Spawn balls
      if (frameCount.current % 15 === 0 && ballsRef.current.length < maxBalls) {
        const hue = (frameCount.current * 2) % 360
        ballsRef.current.push({
          x: Math.random() * w, y: -20,
          vx: (Math.random() - 0.5) * 2, vy: 0,
          r: 8 + Math.random() * 12,
          color: `hsl(${hue}, 80%, 60%)`, hue,
        })
      }

      // Body silhouette as paddle (mouse controlled for demo)
      const bodyX = mouseRef.current.x * w
      const bodyY = mouseRef.current.y * h

      // Update balls
      const balls = ballsRef.current
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]
        b.vy += gravity * 0.3
        b.x += b.vx
        b.y += b.vy

        // Bounce off walls
        if (b.x < b.r) { b.x = b.r; b.vx *= -0.6 }
        if (b.x > w - b.r) { b.x = w - b.r; b.vx *= -0.6 }

        // Bounce off body (mouse position acts as body silhouette)
        const dx = b.x - bodyX
        const dy = b.y - bodyY
        const dist = Math.hypot(dx, dy)
        if (dist < 80 + b.r && b.y < bodyY + 40) {
          const nx = dx / dist || 0
          const ny = dy / dist || -1
          b.vx += nx * 4
          b.vy = -Math.abs(b.vy) * 0.7 - 2
          b.vx *= 0.9
        }

        // Floor bounce
        if (b.y > h - b.r) {
          b.y = h - b.r
          b.vy *= -0.5
          if (Math.abs(b.vy) < 1) b.vy = 0
        }

        // Remove old balls
        if (b.y > h + 50 || b.life === -1) {
          if (balls.length > maxBalls) balls.splice(i, 1)
          else { b.y = h - b.r; b.vy = 0; }
        }

        // Draw ball
        ctx.save()
        ctx.fillStyle = b.color
        ctx.shadowBlur = 10
        ctx.shadowColor = b.color
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Draw body silhouette indicator
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(bodyX, bodyY, 80, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [running, gravity, maxBalls, videoRef])

  const handleStart = async () => { ballsRef.current = []; await start(); setRunning(true) }
  const handleStop = () => { setRunning(false); stop(); ballsRef.current = []; onClose() }
  const handleReset = () => { ballsRef.current = [] }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover"><Play className="w-4 h-4" /> Start</button>
        ) : (
          <>
            <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><Square className="w-4 h-4" /> Stop</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><RefreshCw className="w-4 h-4" /> Reset</button>
          </>
        )}
      </div>
      {running && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-xs text-[var(--text-secondary)]">Gravity</span>
            <input type="range" min="0.5" max="3" step="0.1" value={gravity} onChange={(e) => setGravity(parseFloat(e.target.value))} className="w-16 accent-[var(--accent-color)]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">Balls</span>
            <input type="range" min="10" max="50" step="5" value={maxBalls} onChange={(e) => setMaxBalls(parseInt(e.target.value))} className="w-16 accent-[var(--accent-color)]" />
          </div>
        </div>
      )}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" style={{ minHeight: '60vh' }} onMouseMove={handleMouseMove} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Gravity Painter</p>
            <p className="text-white/70 text-sm mb-4">Move mouse to act as body. Balls rain and bounce off you.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start Camera</button>
          </div>
        </div>
      )}
    </div>
  )
}
