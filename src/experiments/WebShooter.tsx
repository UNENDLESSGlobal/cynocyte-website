import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { clamp, isPinching, toCanvasPoint, type Point } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

interface WebStrand {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  points: Point[]
}

export default function WebShooter({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const animRef = useRef<number>(0)
  const websRef = useRef<WebStrand[]>([])
  const lastTipsRef = useRef<Point[]>([])
  const pinchStateRef = useRef<boolean[]>([])

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

    const spawnWeb = (tip: Point, velocity: Point) => {
      websRef.current.push({
        x: tip.x,
        y: tip.y,
        vx: clamp(velocity.x * 0.25, -10, 10),
        vy: clamp(velocity.y * 0.25 - 6, -12, 6),
        life: 1,
        maxLife: 240,
        points: [{ x: tip.x, y: tip.y }],
      })
      setScore((value) => value + 1)
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
        ctx.fillStyle = '#0a0a1a'
        ctx.fillRect(0, 0, w, h)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.18)'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const hands = results?.hand?.landmarks ?? []

      hands.forEach((landmarks, handIndex) => {
        const tip = toCanvasPoint(landmarks[8], w, h)
        const thumb = toCanvasPoint(landmarks[4], w, h)
        const previousTip = lastTipsRef.current[handIndex] ?? tip
        const velocity = {
          x: tip.x - previousTip.x,
          y: tip.y - previousTip.y,
        }
        const pinching = isPinching(landmarks, 0.44)

        if (pinching && !pinchStateRef.current[handIndex]) {
          spawnWeb(tip, velocity)
        }

        pinchStateRef.current[handIndex] = pinching
        lastTipsRef.current[handIndex] = tip

        ctx.save()
        ctx.lineWidth = 3
        ctx.strokeStyle = pinching ? '#7df9ff' : 'rgba(255,255,255,0.55)'
        ctx.beginPath()
        ctx.moveTo(thumb.x, thumb.y)
        ctx.lineTo(tip.x, tip.y)
        ctx.stroke()

        ctx.fillStyle = '#00ffff'
        ctx.shadowBlur = 24
        ctx.shadowColor = '#00ffff'
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, pinching ? 10 : 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      const webs = websRef.current
      for (let index = webs.length - 1; index >= 0; index -= 1) {
        const web = webs[index]
        web.vy += 0.15
        web.x += web.vx
        web.y += web.vy

        if (web.x < 0 || web.x > w) {
          web.vx *= -0.6
          web.x = clamp(web.x, 0, w)
        }
        if (web.y > h) {
          web.vy *= -0.6
          web.y = h
        }

        web.points.push({ x: web.x, y: web.y })
        if (web.points.length > 24) web.points.shift()
        web.life -= 1 / web.maxLife

        if (web.life <= 0) {
          webs.splice(index, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = web.life
        ctx.strokeStyle = '#00ffff'
        ctx.lineWidth = 2
        ctx.shadowBlur = 14
        ctx.shadowColor = '#00ffff'
        ctx.beginPath()
        ctx.moveTo(web.points[0].x, web.points[0].y)
        for (let pointIndex = 1; pointIndex < web.points.length; pointIndex += 1) {
          ctx.lineTo(web.points[pointIndex].x, web.points[pointIndex].y)
        }
        ctx.stroke()
        ctx.restore()
      }

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
    websRef.current = []
    lastTipsRef.current = []
    pinchStateRef.current = []
    onClose()
  }

  const handleReset = () => {
    websRef.current = []
    setScore(0)
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

      <div className="absolute right-4 top-4 z-10 glass rounded-full px-3 py-1 text-xs text-[var(--text-secondary)]">
        Webs: {score}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Web Shooter</p>
            <p className="mb-4 text-sm text-white/70">Pinch thumb and index finger to fire webs. Move your hand while pinching to change the throw.</p>
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
