import { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Square, RotateCcw, Timer } from 'lucide-react'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

interface Bubble {
  x: number; y: number; r: number; vy: number; vx: number;
  hue: number; life: number
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string
}

export default function BubblePopper({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameOver, setGameOver] = useState(false)
  const bubblesRef = useRef<Bubble[]>([])
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: 0, y: 0 })
  const animRef = useRef<number>(0)
  const synthRef = useRef<Tone.Synth | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top
  }, [])

  const spawnBubble = (w: number, h: number) => {
    const hue = Math.random() * 360
    bubblesRef.current.push({
      x: Math.random() * w,
      y: h + 20,
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
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init audio
    const synth = new Tone.Synth({
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
      oscillator: { type: 'sine' },
    }).toDestination()
    synthRef.current = synth

    let frameCount = 0

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = 'rgba(6, 6, 16, 0.3)'
      ctx.fillRect(0, 0, w, h)

      frameCount++
      // Spawn bubbles
      if (frameCount % Math.max(20, 60 - Math.floor((30 - timeLeft) / 2) * 5) === 0) {
        spawnBubble(w, h)
      }

      // Update bubbles
      const bubbles = bubblesRef.current
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        b.y += b.vy
        b.x += b.vx

        // Check pop
        const dist = Math.hypot(b.x - mx, b.y - my)
        if (dist < b.r) {
          // Pop!
          synth.triggerAttackRelease(800 + Math.random() * 400, '8n')
          for (let j = 0; j < 12; j++) {
            const angle = (Math.PI * 2 * j) / 12
            particlesRef.current.push({
              x: b.x, y: b.y,
              vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
              life: 1, color: `hsl(${b.hue}, 80%, 70%)`,
            })
          }
          bubbles.splice(i, 1)
          setScore(s => s + 1)
          continue
        }

        // Remove if off top
        if (b.y < -50) {
          bubbles.splice(i, 1)
          continue
        }

        // Draw bubble
        ctx.save()
        ctx.globalAlpha = 0.6
        ctx.fillStyle = `hsla(${b.hue}, 60%, 60%, 0.2)`
        ctx.strokeStyle = `hsla(${b.hue}, 60%, 70%, 0.6)`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Specular highlight
        ctx.fillStyle = `hsla(${b.hue}, 80%, 80%, 0.5)`
        ctx.beginPath()
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Update particles
      const parts = particlesRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.02
        if (p.life <= 0) { parts.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
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
  }, [running, gameOver, timeLeft])

  useEffect(() => {
    if (!running || gameOver) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running, gameOver])

  const handleStart = async () => {
    await Tone.start()
    setRunning(true)
    setGameOver(false)
    setScore(0)
    setTimeLeft(30)
    bubblesRef.current = []
    particlesRef.current = []
  }

  const handleStop = () => {
    setRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (synthRef.current) synthRef.current.dispose()
    onClose()
  }

  const handleReset = () => {
    bubblesRef.current = []
    particlesRef.current = []
    setScore(0)
    setTimeLeft(30)
    setGameOver(false)
  }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover">
            <Play className="w-4 h-4" /> Start Game
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
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <div className="glass rounded-full px-3 py-1 flex items-center gap-1.5 text-white text-xs">
          <Timer className="w-3.5 h-3.5" /> {timeLeft}s
        </div>
        <div className="glass rounded-full px-3 py-1 text-white text-xs font-semibold">
          Score: {score}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ minHeight: '60vh' }}
        onMouseMove={handleMouseMove}
      />
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-2xl font-bold mb-2">Time Up!</p>
            <p className="text-white/70 text-lg mb-4">Final Score: {score}</p>
            <button onClick={handleReset} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">
              Play Again
            </button>
          </div>
        </div>
      )}
      {!running && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Bubble Popper</p>
            <p className="text-white/70 text-sm mb-4">Move your cursor to pop bubbles. 30 seconds!</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">
              Start Game
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
