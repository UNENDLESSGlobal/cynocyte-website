import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Trophy } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { FACE_KEYPOINTS, clamp, toCanvasPoint } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

type Difficulty = 'easy' | 'medium' | 'hard'

export default function FacePong({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [playerScore, setPlayerScore] = useState(0)
  const [cpuScore, setCpuScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const animRef = useRef<number>(0)
  const noseTargetRef = useRef(0.5)
  const gameState = useRef({
    ballX: 0,
    ballY: 0,
    ballVX: 3,
    ballVY: -4,
    paddleX: 0,
    cpuX: 0,
  })

  useEffect(() => {
    if (!running || gameOver) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const settings = {
      easy: { cpuLag: 0.05, speed: 3.2 },
      medium: { cpuLag: 0.09, speed: 4.1 },
      hard: { cpuLag: 0.14, speed: 5.1 },
    }[difficulty]

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const state = gameState.current
    state.ballX = canvas.width / 2
    state.ballY = canvas.height / 2
    state.ballVX = settings.speed * (Math.random() > 0.5 ? 1 : -1)
    state.ballVY = -settings.speed

    const loop = () => {
      const width = canvas.width
      const height = canvas.height
      const paddleWidth = 120
      const paddleHeight = 12
      const ballRadius = 8

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -width, 0, width, height)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, width, height)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.78)'
      ctx.fillRect(0, 0, width, height)

      const face = detectFrame(performance.now())?.face?.faceLandmarks?.[0]
      if (face) {
        const nose = toCanvasPoint(face[FACE_KEYPOINTS.noseTip], width, height)
        noseTargetRef.current = clamp(nose.x / width, 0.05, 0.95)
      }

      state.paddleX += ((noseTargetRef.current * width - paddleWidth / 2) - state.paddleX) * 0.18
      state.paddleX = clamp(state.paddleX, 0, width - paddleWidth)

      const cpuTarget = state.ballX - paddleWidth / 2
      state.cpuX += (cpuTarget - state.cpuX) * settings.cpuLag
      state.cpuX = clamp(state.cpuX, 0, width - paddleWidth)

      state.ballX += state.ballVX
      state.ballY += state.ballVY

      if (state.ballX < ballRadius || state.ballX > width - ballRadius) state.ballVX *= -1

      if (
        state.ballY > height - paddleHeight - ballRadius &&
        state.ballX > state.paddleX &&
        state.ballX < state.paddleX + paddleWidth
      ) {
        state.ballVY = -Math.abs(state.ballVY) * 1.05
        state.ballVX += (state.ballX - (state.paddleX + paddleWidth / 2)) / 30
        state.ballVY = Math.max(-12, Math.min(-2, state.ballVY))
      }
      if (state.ballY < paddleHeight + ballRadius && state.ballX > state.cpuX && state.ballX < state.cpuX + paddleWidth) {
        state.ballVY = Math.abs(state.ballVY) * 1.05
      }

      if (state.ballY > height + 20) {
        setCpuScore((value) => {
          const next = value + 1
          if (next >= 5) setGameOver(true)
          return next
        })
        state.ballX = width / 2
        state.ballY = height / 2
        state.ballVX = settings.speed * (Math.random() > 0.5 ? 1 : -1)
        state.ballVY = -settings.speed
      }

      if (state.ballY < -20) {
        setPlayerScore((value) => {
          const next = value + 1
          if (next >= 5) setGameOver(true)
          return next
        })
        state.ballX = width / 2
        state.ballY = height / 2
        state.ballVX = settings.speed * (Math.random() > 0.5 ? 1 : -1)
        state.ballVY = settings.speed
      }

      ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)'
      ctx.lineWidth = 1
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)'
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.save()
      ctx.shadowBlur = 15
      ctx.shadowColor = '#00ffff'
      ctx.fillStyle = '#00ffff'
      ctx.fillRect(state.paddleX, height - paddleHeight - 4, paddleWidth, paddleHeight)
      ctx.shadowColor = '#ff4444'
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(state.cpuX, 4, paddleWidth, paddleHeight)
      ctx.restore()

      ctx.save()
      ctx.shadowBlur = 20
      ctx.shadowColor = '#00ffff'
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(state.ballX, state.ballY, ballRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.3
      for (let trail = 1; trail <= 6; trail += 1) {
        ctx.beginPath()
        ctx.arc(state.ballX - state.ballVX * trail * 2, state.ballY - state.ballVY * trail * 2, ballRadius - trail, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      ctx.fillStyle = 'rgba(0, 255, 255, 0.6)'
      ctx.font = 'bold 24px Space Grotesk, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(String(playerScore), 20, height - 20)
      ctx.fillStyle = 'rgba(255, 68, 68, 0.6)'
      ctx.textAlign = 'right'
      ctx.fillText(String(cpuScore), width - 20, 40)

      ctx.fillStyle = 'rgba(255,255,255,0.62)'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Move your nose left and right to control the paddle', width / 2, height - 20)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, difficulty, gameOver, playerScore, running, cpuScore, videoRef])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
    setGameOver(false)
    setPlayerScore(0)
    setCpuScore(0)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    onClose()
  }

  const handleReset = () => {
    setPlayerScore(0)
    setCpuScore(0)
    setGameOver(false)
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
          <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full glass px-3 py-2 text-xs text-white">
          {(['easy', 'medium', 'hard'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setDifficulty(level)}
              className={`rounded-full px-3 py-1 ${difficulty === level ? 'accent-gradient text-white' : 'text-white/70'}`}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/70">
          <div className="p-8 text-center">
            <Trophy className="mx-auto mb-4 h-12 w-12 text-[var(--accent-color)]" />
            <p className="mb-2 text-2xl font-bold text-white">Game Over!</p>
            <p className="mb-4 text-lg text-white/70">{playerScore >= 5 ? 'You Win!' : 'CPU Wins!'}</p>
            <p className="mb-4 text-sm text-white/50">
              {playerScore} - {cpuScore}
            </p>
            <button onClick={handleReset} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Play Again
            </button>
          </div>
        </div>
      )}

      {!running && !gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Face Pong</p>
            <p className="mb-4 text-sm text-white/70">Move your face left and right to steer the paddle. Choose difficulty after launch.</p>
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
