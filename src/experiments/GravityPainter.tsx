import { useEffect, useRef, useState } from 'react'
import { Play, RefreshCw, SlidersHorizontal, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { POSE_SEGMENTS, clamp, getPosePoint, pointToSegmentDistance, type Point } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  hue: number
}

export default function GravityPainter({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [gravity, setGravity] = useState(1.5)
  const [maxBalls, setMaxBalls] = useState(25)
  const [ballSize, setBallSize] = useState(1)
  const animRef = useRef<number>(0)
  const ballsRef = useRef<Ball[]>([])
  const frameCountRef = useRef(0)

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

    const nearestPointOnSegment = (point: Point, start: Point, end: Point) => {
      const dx = end.x - start.x
      const dy = end.y - start.y
      const lengthSquared = dx * dx + dy * dy
      if (lengthSquared === 0) return start
      const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
      return { x: start.x + dx * t, y: start.y + dy * t }
    }

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const width = canvas.width
      const height = canvas.height
      frameCountRef.current += 1

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -width, 0, width, height)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, width, height)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.28)'
      ctx.fillRect(0, 0, width, height)

      if (frameCountRef.current % 15 === 0 && ballsRef.current.length < maxBalls) {
        const hue = (frameCountRef.current * 2) % 360
        const size = (8 + Math.random() * 12) * ballSize
        ballsRef.current.push({
          x: Math.random() * width,
          y: -20,
          vx: (Math.random() - 0.5) * 2,
          vy: 0,
          r: size,
          color: `hsl(${hue}, 80%, 60%)`,
          hue,
        })
      }

      const poseLandmarks = detectFrame(performance.now())?.pose?.landmarks?.[0]
      const segments = POSE_SEGMENTS.flatMap(([startIndex, endIndex]) => {
        const start = getPosePoint(poseLandmarks, startIndex, width, height)
        const end = getPosePoint(poseLandmarks, endIndex, width, height)
        return start && end ? [{ start, end }] : []
      })

      for (let index = ballsRef.current.length - 1; index >= 0; index -= 1) {
        const ball = ballsRef.current[index]
        ball.vy += gravity * 0.3
        ball.x += ball.vx
        ball.y += ball.vy

        if (ball.x < ball.r) {
          ball.x = ball.r
          ball.vx *= -0.6
        }
        if (ball.x > width - ball.r) {
          ball.x = width - ball.r
          ball.vx *= -0.6
        }

        for (const segment of segments) {
          const distanceToSegment = pointToSegmentDistance(ball, segment.start, segment.end)
          if (distanceToSegment > ball.r + 18) continue

          const nearest = nearestPointOnSegment(ball, segment.start, segment.end)
          const normalX = ball.x - nearest.x
          const normalY = ball.y - nearest.y
          const magnitude = Math.max(1, Math.hypot(normalX, normalY))
          const nx = normalX / magnitude
          const ny = normalY / magnitude
          const approach = ball.vx * nx + ball.vy * ny

          if (approach < 0) {
            ball.x = nearest.x + nx * (ball.r + 18)
            ball.y = nearest.y + ny * (ball.r + 18)
            ball.vx -= 1.8 * approach * nx
            ball.vy -= 1.8 * approach * ny
            ball.vx *= 0.94
          }
        }

        if (ball.y > height - ball.r) {
          ball.y = height - ball.r
          ball.vy *= -0.5
          if (Math.abs(ball.vy) < 1) ball.vy = 0
        }

        ctx.save()
        ctx.fillStyle = ball.color
        ctx.shadowBlur = 10
        ctx.shadowColor = ball.color
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      if (segments.length) {
        ctx.save()
        ctx.strokeStyle = 'rgba(255,255,255,0.42)'
        ctx.lineWidth = 18
        ctx.lineCap = 'round'
        for (const segment of segments) {
          ctx.beginPath()
          ctx.moveTo(segment.start.x, segment.start.y)
          ctx.lineTo(segment.end.x, segment.end.y)
          ctx.stroke()
        }
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.62)'
        ctx.font = '600 15px Space Grotesk, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Step back so your upper body stays in frame', width / 2, height / 2)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [ballSize, detectFrame, gravity, maxBalls, running, videoRef])

  const handleStart = async () => {
    ballsRef.current = []
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    ballsRef.current = []
    onClose()
  }

  const handleReset = () => {
    ballsRef.current = []
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
              <RefreshCw className="h-4 w-4" /> Reset
            </button>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-full glass px-4 py-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-xs text-[var(--text-secondary)]">Gravity</span>
            <input type="range" min="0.5" max="3" step="0.1" value={gravity} onChange={(event) => setGravity(parseFloat(event.target.value))} className="w-16 accent-[var(--accent-color)]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">Balls</span>
            <input type="range" min="10" max="50" step="5" value={maxBalls} onChange={(event) => setMaxBalls(parseInt(event.target.value, 10))} className="w-16 accent-[var(--accent-color)]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">Size</span>
            <input type="range" min="0.7" max="1.6" step="0.1" value={ballSize} onChange={(event) => setBallSize(parseFloat(event.target.value))} className="w-16 accent-[var(--accent-color)]" />
          </div>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Gravity Painter</p>
            <p className="mb-4 text-sm text-white/70">Use your body as a moving Plinko board. Raise your arms into ramps and crouch to catch the falling balls.</p>
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
