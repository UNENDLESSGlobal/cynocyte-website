import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Play, RotateCcw, Square, Timer } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { getFingerTips } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

interface Bubble {
  x: number
  y: number
  r: number
  vy: number
  vx: number
  hue: number
  life: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

export default function BubblePopper({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameOver, setGameOver] = useState(false)
  const bubblesRef = useRef<Bubble[]>([])
  const particlesRef = useRef<Particle[]>([])
  const fingerTipsRef = useRef<Array<{ x: number; y: number }>>([])
  const animRef = useRef<number>(0)
  const synthRef = useRef<Tone.Synth | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeLeftRef = useRef(30)

  const spawnBubble = (width: number, height: number) => {
    const hue = Math.random() * 360
    bubblesRef.current.push({
      x: Math.random() * width,
      y: height + 20,
      r: 15 + Math.random() * 35,
      vy: -(2 + Math.random() * 3),
      vx: (Math.random() - 0.5) * 0.5,
      hue,
      life: 1,
    })
  }

  useEffect(() => {
    if (!running || gameOver) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const synth = new Tone.Synth({
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
      oscillator: { type: 'sine' },
    }).toDestination()
    synthRef.current = synth

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    let frameCount = 0
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

      ctx.fillStyle = 'rgba(6, 6, 16, 0.22)'
      ctx.fillRect(0, 0, width, height)

      frameCount += 1
      if (frameCount % Math.max(20, 60 - Math.floor((30 - timeLeftRef.current) / 2) * 5) === 0) {
        spawnBubble(width, height)
      }

      const handResults = detectFrame(performance.now())?.hand?.landmarks ?? []
      fingerTipsRef.current = handResults.flatMap((landmarks) => getFingerTips(landmarks, width, height))

      const bubbles = bubblesRef.current
      for (let index = bubbles.length - 1; index >= 0; index -= 1) {
        const bubble = bubbles[index]
        bubble.y += bubble.vy
        bubble.x += bubble.vx

        const popped = fingerTipsRef.current.some((finger) => Math.hypot(bubble.x - finger.x, bubble.y - finger.y) < bubble.r)
        if (popped) {
          synth.triggerAttackRelease(800 + Math.random() * 400, '8n')
          for (let particleIndex = 0; particleIndex < 12; particleIndex += 1) {
            const angle = (Math.PI * 2 * particleIndex) / 12
            particlesRef.current.push({
              x: bubble.x,
              y: bubble.y,
              vx: Math.cos(angle) * 4,
              vy: Math.sin(angle) * 4,
              life: 1,
              color: `hsl(${bubble.hue}, 80%, 70%)`,
            })
          }
          bubbles.splice(index, 1)
          setScore((value) => value + 1)
          continue
        }

        if (bubble.y < -50) {
          bubbles.splice(index, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = 0.6
        ctx.fillStyle = `hsla(${bubble.hue}, 60%, 60%, 0.2)`
        ctx.strokeStyle = `hsla(${bubble.hue}, 60%, 70%, 0.6)`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = `hsla(${bubble.hue}, 80%, 80%, 0.5)`
        ctx.beginPath()
        ctx.arc(bubble.x - bubble.r * 0.3, bubble.y - bubble.r * 0.3, bubble.r * 0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      for (let index = particlesRef.current.length - 1; index >= 0; index -= 1) {
        const particle = particlesRef.current[index]
        particle.x += particle.vx
        particle.y += particle.vy
        particle.life -= 0.02
        if (particle.life <= 0) {
          particlesRef.current.splice(index, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = particle.life
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      for (const finger of fingerTipsRef.current) {
        ctx.save()
        ctx.fillStyle = '#7df9ff'
        ctx.shadowBlur = 18
        ctx.shadowColor = '#7df9ff'
        ctx.beginPath()
        ctx.arc(finger.x, finger.y, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
    }
  }, [detectFrame, gameOver, running, videoRef])

  useEffect(() => {
    if (!running || gameOver) return

    timerRef.current = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          setGameOver(true)
          timeLeftRef.current = 0
          return 0
        }
        timeLeftRef.current = value - 1
        return value - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameOver, running])

  const handleStart = async () => {
    await Tone.start()
    await startVision()
    setRunning(true)
    setGameOver(false)
    setScore(0)
    setTimeLeft(30)
    timeLeftRef.current = 30
    bubblesRef.current = []
    particlesRef.current = []
  }

  const handleStop = () => {
    setRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    synthRef.current?.dispose()
    stopVision()
    onClose()
  }

  const handleReset = () => {
    bubblesRef.current = []
    particlesRef.current = []
    setScore(0)
    setTimeLeft(30)
    timeLeftRef.current = 30
    setGameOver(false)
  }

  const launchError = visionError ?? error

  return (
    <div className="relative flex h-full w-full flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start Game
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
      <div className="absolute right-4 top-4 z-10 flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs text-white">
          <Timer className="h-3.5 w-3.5" /> {timeLeft}s
        </div>
        <div className="rounded-full glass px-3 py-1 text-xs font-semibold text-white">Score: {score}</div>
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/70">
          <div className="p-8 text-center">
            <p className="mb-2 text-2xl font-bold text-white">Time Up!</p>
            <p className="mb-4 text-lg text-white/70">Final Score: {score}</p>
            <button onClick={handleReset} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Play Again
            </button>
          </div>
        </div>
      )}

      {!running && !gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Bubble Popper</p>
            <p className="mb-4 text-sm text-white/70">Touch floating bubbles with your fingertips. Both hands can pop at once.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Game
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
