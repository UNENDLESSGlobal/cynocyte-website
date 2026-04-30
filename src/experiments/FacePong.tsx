import { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Square, RotateCcw, Trophy } from 'lucide-react'

interface Props { onClose: () => void }

export default function FacePong({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [playerScore, setPlayerScore] = useState(0)
  const [cpuScore, setCpuScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const animRef = useRef<number>(0)
  const mouseRef = useRef({ x: 0.5 })
  const gameState = useRef({
    ballX: 0, ballY: 0, ballVX: 3, ballVY: -4,
    paddleX: 0, cpuX: 0,
  })

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = (e.clientX - rect.left) / rect.width
  }, [])

  useEffect(() => {
    if (!running || gameOver) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const gs = gameState.current
    gs.ballX = canvas.width / 2
    gs.ballY = canvas.height / 2

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const paddleW = 120
      const paddleH = 12
      const ballR = 8

      // Update
      gs.paddleX = mouseRef.current.x * w - paddleW / 2
      gs.paddleX = Math.max(0, Math.min(w - paddleW, gs.paddleX))

      // CPU follows ball with lag
      const cpuTarget = gs.ballX - paddleW / 2
      gs.cpuX += (cpuTarget - gs.cpuX) * 0.08
      gs.cpuX = Math.max(0, Math.min(w - paddleW, gs.cpuX))

      gs.ballX += gs.ballVX
      gs.ballY += gs.ballVY

      // Wall bounce
      if (gs.ballX < ballR || gs.ballX > w - ballR) gs.ballVX *= -1

      // Paddle hits
      if (gs.ballY > h - paddleH - ballR && gs.ballX > gs.paddleX && gs.ballX < gs.paddleX + paddleW) {
        gs.ballVY = -Math.abs(gs.ballVY) * 1.05
        gs.ballVX += (gs.ballX - (gs.paddleX + paddleW / 2)) / 30
        gs.ballVY = Math.max(-12, Math.min(-2, gs.ballVY))
      }
      if (gs.ballY < paddleH + ballR && gs.ballX > gs.cpuX && gs.ballX < gs.cpuX + paddleW) {
        gs.ballVY = Math.abs(gs.ballVY) * 1.05
      }

      // Score
      if (gs.ballY > h + 20) {
        setCpuScore(s => { const ns = s + 1; if (ns >= 5) setGameOver(true); return ns })
        gs.ballX = w / 2; gs.ballY = h / 2
        gs.ballVX = 3 * (Math.random() > 0.5 ? 1 : -1)
        gs.ballVY = -4
      }
      if (gs.ballY < -20) {
        setPlayerScore(s => { const ns = s + 1; if (ns >= 5) setGameOver(true); return ns })
        gs.ballX = w / 2; gs.ballY = h / 2
        gs.ballVX = 3 * (Math.random() > 0.5 ? 1 : -1)
        gs.ballVY = 4
      }

      // Draw
      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, w, h)

      // Grid
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)'
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // Center line
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)'
      ctx.setLineDash([10, 10])
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
      ctx.setLineDash([])

      // Paddles (neon)
      ctx.save()
      ctx.shadowBlur = 15
      ctx.shadowColor = '#00ffff'
      ctx.fillStyle = '#00ffff'
      ctx.fillRect(gs.paddleX, h - paddleH - 4, paddleW, paddleH)
      ctx.shadowColor = '#ff4444'
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(gs.cpuX, 4, paddleW, paddleH)
      ctx.restore()

      // Ball (glow)
      ctx.save()
      ctx.shadowBlur = 20
      ctx.shadowColor = '#00ffff'
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(gs.ballX, gs.ballY, ballR, 0, Math.PI * 2); ctx.fill()
      // Trail
      ctx.globalAlpha = 0.3
      for (let i = 1; i <= 6; i++) {
        ctx.beginPath(); ctx.arc(gs.ballX - gs.ballVX * i * 2, gs.ballY - gs.ballVY * i * 2, ballR - i, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()

      // Scores
      ctx.fillStyle = 'rgba(0, 255, 255, 0.6)'
      ctx.font = 'bold 24px Space Grotesk, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(String(playerScore), 20, h - 20)
      ctx.fillStyle = 'rgba(255, 68, 68, 0.6)'
      ctx.textAlign = 'right'
      ctx.fillText(String(cpuScore), w - 20, 40)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [running, gameOver])

  const handleStart = () => { setRunning(true); setGameOver(false); setPlayerScore(0); setCpuScore(0) }
  const handleStop = () => { setRunning(false); onClose() }
  const handleReset = () => { setPlayerScore(0); setCpuScore(0); setGameOver(false); gameState.current.ballX = 0; gameState.current.ballY = 0 }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover"><Play className="w-4 h-4" /> Start</button>
        ) : (
          <>
            <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><Square className="w-4 h-4" /> Stop</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><RotateCcw className="w-4 h-4" /> Reset</button>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="w-full h-full cursor-none" style={{ minHeight: '60vh' }} onMouseMove={handleMouseMove} />
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20 rounded-2xl">
          <div className="text-center p-8">
            <Trophy className="w-12 h-12 text-[var(--accent-color)] mx-auto mb-4" />
            <p className="text-white text-2xl font-bold mb-2">Game Over!</p>
            <p className="text-white/70 text-lg mb-4">{playerScore >= 5 ? 'You Win!' : 'CPU Wins!'}</p>
            <p className="text-white/50 text-sm mb-4">{playerScore} - {cpuScore}</p>
            <button onClick={handleReset} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Play Again</button>
          </div>
        </div>
      )}
      {!running && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Face Pong</p>
            <p className="text-white/70 text-sm mb-4">Move mouse left/right to control paddle. First to 5 wins!</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start Game</button>
          </div>
        </div>
      )}
    </div>
  )
}
