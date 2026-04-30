import { useRef, useEffect, useState, useCallback } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import { Play, Square, RotateCcw } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function WebShooter({ onClose }: Props) {
  const { videoRef, start, stop } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const animRef = useRef<number>(0)
  const websRef = useRef<Array<{
    x: number, y: number, vx: number, vy: number, life: number, maxLife: number,
    points: Array<{ x: number, y: number }>
  }>>([])
  const mouseRef = useRef({ x: 0, y: 0, down: false })

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top
  }, [])

  const handleMouseDown = useCallback(() => {
    mouseRef.current.down = true
    const canvas = canvasRef.current
    if (!canvas) return
    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    // Spawn web
    websRef.current.push({
      x: mx, y: my,
      vx: (Math.random() - 0.5) * 8,
      vy: -6 - Math.random() * 6,
      life: 1,
      maxLife: 240,
      points: [{ x: mx, y: my }]
    })
    setScore(s => s + 1)
  }, [])

  const handleMouseUp = useCallback(() => {
    mouseRef.current.down = false
  }, [])

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

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      // Draw video
      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#0a0a1a'
        ctx.fillRect(0, 0, w, h)
      }

      // Physics and draw webs
      const webs = websRef.current
      for (let i = webs.length - 1; i >= 0; i--) {
        const web = webs[i]
        web.vy += 0.15 // gravity
        web.x += web.vx
        web.y += web.vy

        // Bounce off edges
        if (web.x < 0 || web.x > w) { web.vx *= -0.6; web.x = Math.max(0, Math.min(w, web.x)) }
        if (web.y > h) { web.vy *= -0.6; web.y = h }

        web.points.push({ x: web.x, y: web.y })
        if (web.points.length > 20) web.points.shift()

        web.life -= 1 / web.maxLife
        if (web.life <= 0) {
          webs.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = web.life
        ctx.strokeStyle = '#00ffff'
        ctx.lineWidth = 2
        ctx.shadowBlur = 12
        ctx.shadowColor = '#00ffff'
        ctx.beginPath()
        if (web.points.length > 1) {
          ctx.moveTo(web.points[0].x, web.points[0].y)
          for (let j = 1; j < web.points.length; j++) {
            ctx.lineTo(web.points[j].x, web.points[j].y)
          }
        }
        ctx.stroke()
        ctx.restore()
      }

      // Draw cursor glow
      ctx.save()
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#00ffff'
      ctx.shadowBlur = 20
      ctx.shadowColor = '#00ffff'
      ctx.beginPath()
      ctx.arc(mouseRef.current.x, mouseRef.current.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [running, videoRef])

  const handleStart = async () => {
    await start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stop()
    websRef.current = []
    onClose()
  }

  const handleReset = () => {
    websRef.current = []
    setScore(0)
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
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 glass rounded-full px-3 py-1 text-xs text-[var(--text-secondary)]">
        Webs: {score}
      </div>

      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ minHeight: '60vh' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />

      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Web Shooter</p>
            <p className="text-white/70 text-sm mb-4">Click to shoot webs. Gravity and bounce physics apply.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
