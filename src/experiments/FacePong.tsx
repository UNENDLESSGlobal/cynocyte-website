import { useEffect, useRef, useState } from 'react'
import { Play, Square, Trophy } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function FacePong({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const animRef = useRef<number>(0)
  
  const synthRef = useRef<Tone.PolySynth | null>(null)

  const stateRef = useRef({
    playerScore: 0,
    cpuScore: 0,
    ball: { x: 400, y: 300, vx: 0, vy: 0, speed: 8 },
    playerPaddle: { x: 400, w: 150 },
    cpuPaddle: { x: 400, w: 150 },
    state: 'serve', // 'serve' | 'playing' | 'gameover'
    trails: [] as {x: number, y: number, life: number}[],
    shake: 0
  })

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
      if (stateRef.current.state === 'serve') {
        stateRef.current.ball.x = canvas.width / 2
        stateRef.current.ball.y = canvas.height / 2
      }
    }
    resize()
    window.addEventListener('resize', resize)

    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
    }).toDestination()
    synthRef.current.volume.value = -10

    let smoothNoseX = 0.5

    const serve = (toPlayer: boolean) => {
      const s = stateRef.current
      s.state = 'playing'
      s.ball.x = canvas.width / 2
      s.ball.y = canvas.height / 2
      s.ball.speed = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 10 : 15
      s.ball.vx = (Math.random() > 0.5 ? 1 : -1) * (s.ball.speed * 0.5)
      s.ball.vy = (toPlayer ? 1 : -1) * s.ball.speed
    }

    const playSound = (note: string) => {
      if (synthRef.current) synthRef.current.triggerAttackRelease(note, "16n")
    }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      // Background with motion blur
      ctx.fillStyle = 'rgba(10, 10, 20, 0.3)'
      ctx.fillRect(0, 0, w, h)

      // Screen Shake
      ctx.save()
      if (s.shake > 0) {
        ctx.translate((Math.random()-0.5)*s.shake, (Math.random()-0.5)*s.shake)
        s.shake *= 0.9
        if (s.shake < 0.5) s.shake = 0
      }

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.15
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      // Track Face
      const results = detectFrame(performance.now())
      const face = results?.face?.faceLandmarks?.[0]

      if (face) {
        // Nose tip is landmark 1
        const nose = face[1]
        // Exponential smoothing for stability
        smoothNoseX += ((1 - nose.x) - smoothNoseX) * 0.2
        // Map 0-1 to screen width with slight over-extension
        s.playerPaddle.x = clamp((smoothNoseX - 0.5) * 1.5 + 0.5, 0, 1) * w
      }

      if (s.state === 'playing') {
        // CPU AI
        const cpuSpeed = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 8 : 14
        if (s.ball.x > s.cpuPaddle.x + 20) s.cpuPaddle.x += cpuSpeed
        else if (s.ball.x < s.cpuPaddle.x - 20) s.cpuPaddle.x -= cpuSpeed

        s.cpuPaddle.x = clamp(s.cpuPaddle.x, s.cpuPaddle.w/2, w - s.cpuPaddle.w/2)
        s.playerPaddle.x = clamp(s.playerPaddle.x, s.playerPaddle.w/2, w - s.playerPaddle.w/2)

        // Ball Physics
        s.ball.x += s.ball.vx
        s.ball.y += s.ball.vy

        // Wall collisions (Left/Right)
        if (s.ball.x <= 10 || s.ball.x >= w - 10) {
          s.ball.vx *= -1
          s.ball.x = clamp(s.ball.x, 10, w - 10)
          playSound('C3')
        }

        // Paddle collisions
        // Player (Bottom)
        if (s.ball.y >= h - 40 && s.ball.y <= h - 20 && s.ball.vy > 0) {
          if (Math.abs(s.ball.x - s.playerPaddle.x) < s.playerPaddle.w/2 + 10) {
            s.ball.vy *= -1
            // Angle reflection based on hit position
            const hitPos = (s.ball.x - s.playerPaddle.x) / (s.playerPaddle.w / 2)
            s.ball.vx = hitPos * s.ball.speed * 0.8
            s.ball.speed = Math.min(s.ball.speed * 1.05, 25) // Speed up
            playSound('G4')
            s.shake = 5
            
            // Add particles
            for(let i=0; i<5; i++) s.trails.push({x: s.ball.x, y: s.ball.y, life: 2})
          }
        }

        // CPU (Top)
        if (s.ball.y <= 40 && s.ball.y >= 20 && s.ball.vy < 0) {
          if (Math.abs(s.ball.x - s.cpuPaddle.x) < s.cpuPaddle.w/2 + 10) {
            s.ball.vy *= -1
            const hitPos = (s.ball.x - s.cpuPaddle.x) / (s.cpuPaddle.w / 2)
            s.ball.vx = hitPos * s.ball.speed * 0.8
            s.ball.speed = Math.min(s.ball.speed * 1.05, 25)
            playSound('E4')
            s.shake = 2
          }
        }

        // Scoring
        if (s.ball.y > h + 50) {
          s.cpuScore++
          playSound('A2')
          s.shake = 15
          if (s.cpuScore >= 5) s.state = 'gameover'
          else { s.state = 'serve'; setTimeout(() => serve(false), 1000) }
        } else if (s.ball.y < -50) {
          s.playerScore++
          playSound('C5')
          s.shake = 15
          if (s.playerScore >= 5) s.state = 'gameover'
          else { s.state = 'serve'; setTimeout(() => serve(true), 1000) }
        }

        // Add trail
        s.trails.push({x: s.ball.x, y: s.ball.y, life: 1})
      }

      // Draw Center Line
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(0, h/2)
      ctx.lineTo(w, h/2)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.setLineDash([])

      // Draw Scores
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.font = 'bold 120px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.cpuScore.toString(), w/2, h/4)
      ctx.fillText(s.playerScore.toString(), w/2, h * 0.75)

      // Draw Trails
      s.trails = s.trails.filter(t => t.life > 0)
      ctx.beginPath()
      if (s.trails.length > 0) ctx.moveTo(s.trails[0].x, s.trails[0].y)
      s.trails.forEach(t => {
        ctx.lineTo(t.x, t.y)
        t.life -= 0.05
      })
      ctx.strokeStyle = `rgba(0, 255, 255, 0.5)`
      ctx.lineWidth = 10
      ctx.shadowBlur = 20
      ctx.shadowColor = '#00ffff'
      ctx.stroke()

      // Draw Ball
      if (s.state !== 'gameover') {
        ctx.beginPath()
        ctx.arc(s.ball.x, s.ball.y, 10, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      }

      // Draw Paddles
      const drawPaddle = (x: number, y: number, color: string) => {
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 15
        ctx.beginPath()
        ctx.roundRect(x - s.playerPaddle.w/2, y - 10, s.playerPaddle.w, 20, 10)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      drawPaddle(s.cpuPaddle.x, 20, '#ff00ff') // CPU
      drawPaddle(s.playerPaddle.x, h - 20, '#00ffff') // Player

      if (s.state === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = s.playerScore >= 5 ? '#00ffff' : '#ff00ff'
        ctx.font = 'bold 64px sans-serif'
        ctx.fillText(s.playerScore >= 5 ? 'YOU WIN!' : 'CPU WINS', w/2, h/2)
        
        ctx.font = '24px sans-serif'
        ctx.fillStyle = '#fff'
        ctx.fillText('Move face to restart', w/2, h/2 + 60)
        
        // Restart condition
        if (Math.abs(s.playerPaddle.x - w/2) > 200) {
          s.playerScore = 0
          s.cpuScore = 0
          serve(true)
        }
      } else if (s.state === 'serve' && s.playerScore === 0 && s.cpuScore === 0) {
         ctx.fillStyle = '#fff'
         ctx.font = '24px sans-serif'
         ctx.fillText('Get ready...', w/2, h/2 + 50)
      }

      ctx.restore()
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    // Initial serve
    setTimeout(() => serve(true), 2000)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (synthRef.current) synthRef.current.dispose()
    }
  }, [detectFrame, running, difficulty])

  const handleStart = async () => {
    await Tone.start()
    await startVision()
    stateRef.current.playerScore = 0
    stateRef.current.cpuScore = 0
    stateRef.current.state = 'serve'
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    onClose()
  }

  const launchError = visionError ?? error

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#060610]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start
          </button>
        ) : (
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <div className="flex bg-black/40 rounded-full p-1 ml-4">
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    difficulty === d ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Trophy className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Move your face left and right to control the paddle. First to 5 wins.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Face Pong</p>
            <p className="mb-4 text-sm text-white/70">Classic Pong, but your nose controls the paddle. A fast-paced, neon-drenched arcade game.</p>
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
