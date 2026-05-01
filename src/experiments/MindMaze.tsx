import { useEffect, useRef, useState } from 'react'
import { Play, Square, Eye } from 'lucide-react'
import { useVision } from '@/hooks/useVision'

interface Props {
  onClose: () => void
}

type Mode = 'classic' | 'torch' | 'moving'

// Helper for Recursive Backtracking Maze
function generateMaze(cols: number, rows: number) {
  const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(1)) // 1 = wall, 0 = path
  
  // Directions: [dx, dy]
  const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]]
  
  function carve(r: number, c: number) {
    grid[r][c] = 0
    // Shuffle directions
    dirs.sort(() => Math.random() - 0.5)
    for (let [dc, dr] of dirs) {
      const nr = r + dr, nc = c + dc
      if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
        grid[r + dr/2][c + dc/2] = 0 // carve wall between
        carve(nr, nc)
      }
    }
  }
  
  carve(1, 1)
  
  // Ensure start and end are open
  grid[0][1] = 0 // Entrance
  grid[rows-1][cols-2] = 0 // Exit
  
  return grid
}

export default function MindMaze({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<Mode>('classic')
  const animRef = useRef<number>(0)

  // Calibrated centers
  const baselineRef = useRef({ lx: 0.5, ly: 0.5, set: false })
  
  const stateRef = useRef({
    ball: { x: 0, y: 0, vx: 0, vy: 0, radius: 6 },
    maze: [] as number[][],
    cols: 15,
    rows: 15,
    cellSize: 0,
    mazeX: 0,
    mazeY: 0,
    isJumping: false,
    jumpZ: 0,
    level: 1,
    movingWall: { x: 0, y: 0, dir: 1 }
  })

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Offscreen canvas for collision detection
    const colCanvas = document.createElement('canvas')
    const colCtx = colCanvas.getContext('2d')
    if (!colCtx) return

    const initMaze = () => {
      const s = stateRef.current
      s.cols = 11 + (s.level * 4) // gets bigger
      s.rows = 11 + (s.level * 4)
      s.maze = generateMaze(s.cols, s.rows)
      
      const w = canvas.width
      const h = canvas.height
      s.cellSize = Math.min((w - 100) / s.cols, (h - 100) / s.rows)
      s.mazeX = (w - s.cols * s.cellSize) / 2
      s.mazeY = (h - s.rows * s.cellSize) / 2
      
      // Start position
      s.ball.x = s.mazeX + 1.5 * s.cellSize
      s.ball.y = s.mazeY + 0.5 * s.cellSize
      s.ball.vx = 0
      s.ball.vy = 0

      // Init moving wall
      s.movingWall.x = Math.floor(s.cols/2)
      s.movingWall.y = Math.floor(s.rows/2)

      // Draw collision map
      colCanvas.width = canvas.width
      colCanvas.height = canvas.height
      colCtx.fillStyle = '#000'
      colCtx.fillRect(0, 0, colCanvas.width, colCanvas.height) // black background
      
      colCtx.fillStyle = '#fff' // white walls
      for(let r=0; r<s.rows; r++) {
        for(let c=0; c<s.cols; c++) {
          if (s.maze[r][c] === 1) {
            colCtx.fillRect(s.mazeX + c * s.cellSize, s.mazeY + r * s.cellSize, s.cellSize, s.cellSize)
          }
        }
      }
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      if (stateRef.current.maze.length > 0) initMaze()
    }
    resize()
    window.addEventListener('resize', resize)

    if (stateRef.current.maze.length === 0) initMaze()

    let blinkHold = 0
    const modeRefVal = { current: mode }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current
      modeRefVal.current = mode

      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const face = results?.face?.faceLandmarks?.[0]

      if (face) {
        // Iris: Left eye center is 468. Eye bounds: left=33, right=133, top=159, bottom=145
        const iris = face[468]
        const eyeL = face[33]
        const eyeR = face[133]
        const eyeT = face[159]
        const eyeB = face[145]

        // Eye Aspect Ratio (EAR) for blinking
        const ear = Math.hypot(eyeT.x - eyeB.x, eyeT.y - eyeB.y) / Math.hypot(eyeL.x - eyeR.x, eyeL.y - eyeR.y)
        
        if (ear < 0.2) { // Blink threshold
          blinkHold++
          if (blinkHold > 5 && !s.isJumping) {
            s.isJumping = true
            s.jumpZ = 1
          }
        } else {
          blinkHold = 0
        }

        // Relative iris position
        const relX = (iris.x - eyeL.x) / (eyeR.x - eyeL.x)
        const relY = (iris.y - eyeT.y) / (eyeB.y - eyeT.y)

        // Auto-calibrate center on first frames
        if (!baselineRef.current.set && results.face.faceBlendshapes) {
          // ensure not looking away wildly
          baselineRef.current.lx = relX
          baselineRef.current.ly = relY
          baselineRef.current.set = true
        }

        // Velocity vector from offset
        const dx = relX - baselineRef.current.lx
        const dy = relY - baselineRef.current.ly
        
        // Deadzone & scaling
        if (Math.abs(dx) > 0.1) s.ball.vx += dx * 0.5
        if (Math.abs(dy) > 0.1) s.ball.vy += dy * 0.5
      }

      // Physics
      s.ball.vx *= 0.8 // friction
      s.ball.vy *= 0.8

      const nextX = s.ball.x + s.ball.vx
      const nextY = s.ball.y + s.ball.vy

      // Collision Detection
      if (!s.isJumping && nextX > 0 && nextX < w && nextY > 0 && nextY < h) {
        // Check 4 points around the ball radius
        const checkPoints = [
          { x: nextX - s.ball.radius, y: nextY },
          { x: nextX + s.ball.radius, y: nextY },
          { x: nextX, y: nextY - s.ball.radius },
          { x: nextX, y: nextY + s.ball.radius }
        ]

        let hitWall = false
        for (let p of checkPoints) {
          if (p.x >= 0 && p.x < w && p.y >= 0 && p.y < h) {
             const pixel = colCtx.getImageData(p.x, p.y, 1, 1).data
             if (pixel[0] > 128) hitWall = true // white wall
          }
        }

        if (!hitWall) {
          s.ball.x = nextX
          s.ball.y = nextY
        } else {
          // Bounce
          s.ball.vx *= -0.5
          s.ball.vy *= -0.5
        }
      } else if (s.isJumping) {
        s.ball.x = nextX
        s.ball.y = nextY
      }

      // Jump mechanics
      if (s.isJumping) {
        s.jumpZ += 0.1
        if (s.jumpZ > Math.PI) {
          s.isJumping = false
          s.jumpZ = 0
        }
      }

      // Check Win (Exit is bottom right open cell)
      const exitX = s.mazeX + (s.cols - 1.5) * s.cellSize
      const exitY = s.mazeY + (s.rows - 0.5) * s.cellSize
      if (Math.hypot(s.ball.x - exitX, s.ball.y - exitY) < s.cellSize) {
        s.level++
        initMaze()
      }

      // Draw Maze
      ctx.fillStyle = '#1e1e2e'
      for(let r=0; r<s.rows; r++) {
        for(let c=0; c<s.cols; c++) {
          if (s.maze[r][c] === 1) {
            ctx.fillRect(s.mazeX + c * s.cellSize, s.mazeY + r * s.cellSize, s.cellSize, s.cellSize)
          }
        }
      }

      // Draw Exit
      ctx.fillStyle = '#00ff00'
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.005) * 0.5
      ctx.fillRect(s.mazeX + (s.cols - 2) * s.cellSize, s.mazeY + (s.rows - 1) * s.cellSize, s.cellSize, s.cellSize)
      ctx.globalAlpha = 1

      // Mode Effects
      if (modeRefVal.current === 'moving') {
         // Move wall horizontally
         s.movingWall.x += s.movingWall.dir * 0.05
         if (s.movingWall.x > s.cols - 2 || s.movingWall.x < 1) s.movingWall.dir *= -1
         
         ctx.fillStyle = '#ff0055'
         ctx.fillRect(s.mazeX + s.movingWall.x * s.cellSize, s.mazeY + s.movingWall.y * s.cellSize, s.cellSize, s.cellSize)
         
         // Basic collision
         const mx = s.mazeX + s.movingWall.x * s.cellSize + s.cellSize/2
         const my = s.mazeY + s.movingWall.y * s.cellSize + s.cellSize/2
         if (Math.hypot(s.ball.x - mx, s.ball.y - my) < s.cellSize && !s.isJumping) {
           // Reset to start
           s.ball.x = s.mazeX + 1.5 * s.cellSize
           s.ball.y = s.mazeY + 0.5 * s.cellSize
         }
      }

      // Torch Mode overlay
      if (modeRefVal.current === 'torch') {
        const radGrad = ctx.createRadialGradient(s.ball.x, s.ball.y, s.cellSize * 2, s.ball.x, s.ball.y, s.cellSize * 6)
        radGrad.addColorStop(0, 'rgba(0,0,0,0)')
        radGrad.addColorStop(1, 'rgba(6,6,16,1)')
        ctx.fillStyle = radGrad
        ctx.fillRect(0, 0, w, h)
      }

      // Draw Ball
      const zScale = s.isJumping ? 1 + Math.sin(s.jumpZ) * 0.5 : 1
      ctx.beginPath()
      ctx.arc(s.ball.x, s.ball.y, s.ball.radius * zScale, 0, Math.PI * 2)
      ctx.fillStyle = '#00ffff'
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = s.isJumping ? 20 : 10
      ctx.fill()
      ctx.shadowBlur = 0

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, running])

  const handleStart = async () => {
    await startVision()
    baselineRef.current.set = false // Re-calibrate
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
              {(['classic', 'torch', 'moving'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    mode === m ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="ml-4 px-4 py-1.5 bg-black/40 rounded-full text-white/80 text-xs font-bold">
              LEVEL {stateRef.current.level}
            </div>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Eye className="w-4 h-4 text-white/50 mr-2 animate-pulse" />
          <span className="text-xs font-medium text-white/80">Steer with your eyes. Blink to jump over walls.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Mind Maze</p>
            <p className="mb-4 text-sm text-white/70">Navigate a procedural maze using only your eye movements. If you get stuck, blink to jump over a wall!</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enter Maze
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
