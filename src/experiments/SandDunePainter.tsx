import { useEffect, useRef, useState } from 'react'
import { Play, Square, Wind } from 'lucide-react'
import { useVision } from '@/hooks/useVision'

interface Props {
  onClose: () => void
}

type Palette = 'desert' | 'ocean' | 'aurora'

const PALETTES = {
  desert: ['#fde047', '#eab308', '#ca8a04', '#a16207', '#713f12'],
  ocean: ['#38bdf8', '#0284c7', '#0369a1', '#075985', '#082f49'],
  aurora: ['#4ade80', '#22c55e', '#16a34a', '#8b5cf6', '#7c3aed']
}

export default function SandDunePainter({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [palette, setPalette] = useState<Palette>('desert')
  const animRef = useRef<number>(0)

  // Wind state
  const windRef = useRef({ x: 1, y: 0 })
  const [windUi, setWindUi] = useState({ x: 1, y: 0 })

  // Simulation Grid (Downscaled for performance)
  const SCALE = 4
  const gridRef = useRef<Uint32Array | null>(null)
  const colsRef = useRef(0)
  const rowsRef = useRef(0)

  const stateRef = useRef({
    prevHand: { x: 0, y: 0 },
    activeColor: PALETTES.desert[0]
  })

  // Convert hex string to little-endian RGBA for Uint32Array (ABGR format)
  const hexToUint32 = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (255 << 24) | (b << 16) | (g << 8) | r
  }

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const initGrid = () => {
      colsRef.current = Math.floor(canvas.offsetWidth / SCALE)
      rowsRef.current = Math.floor(canvas.offsetHeight / SCALE)
      canvas.width = colsRef.current * SCALE
      canvas.height = rowsRef.current * SCALE
      gridRef.current = new Uint32Array(colsRef.current * rowsRef.current)
    }
    
    if (!gridRef.current) initGrid()

    const resize = () => {
       // On resize, we could keep the old grid and copy, but to keep it simple we just re-init
       initGrid()
    }
    window.addEventListener('resize', resize)

    const loop = () => {
      const grid = gridRef.current
      const cols = colsRef.current
      const rows = rowsRef.current
      const wind = windRef.current
      const s = stateRef.current

      if (!grid) return

      // --- 1. Hand Input ---
      const results = detectFrame(performance.now())
      const hand = results?.hand?.landmarks?.[0]
      
      if (hand) {
        const index = hand[8]
        const thumb = hand[4]
        // Pinch to drop sand
        const pinchDist = Math.hypot(index.x - thumb.x, index.y - thumb.y)
        
        if (pinchDist < 0.1) {
          const cx = Math.floor((1 - index.x) * cols) // mirror
          const cy = Math.floor(index.y * rows)
          
          // Velocity = distance from prev hand
          const vx = ((1 - index.x) - s.prevHand.x) * cols
          const vy = (index.y - s.prevHand.y) * rows
          const speed = Math.hypot(vx, vy)

          // Pick color based on speed (fast = darker/coarse, slow = lighter/fine)
          const colors = PALETTES[palette]
          let cIdx = Math.floor((speed / 5) * colors.length)
          cIdx = Math.max(0, Math.min(colors.length - 1, cIdx))
          const colorInt = hexToUint32(colors[cIdx])

          // Drop a brush of sand
          const brushSize = 3
          for(let dx=-brushSize; dx<=brushSize; dx++) {
            for(let dy=-brushSize; dy<=brushSize; dy++) {
              if (Math.random() > 0.5) {
                const nx = cx + dx
                const ny = cy + dy
                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                  const idx = ny * cols + nx
                  if (grid[idx] === 0) grid[idx] = colorInt
                }
              }
            }
          }
        }
        
        s.prevHand = { x: 1 - index.x, y: index.y }
      }

      // --- 2. Cellular Automata Physics ---
      // Loop from bottom up
      for (let y = rows - 2; y >= 0; y--) {
        // Iterate left-to-right or right-to-left based on frame to avoid bias
        const dir = Math.random() > 0.5 ? 1 : -1
        const startX = dir === 1 ? 0 : cols - 1
        const endX = dir === 1 ? cols : -1

        for (let x = startX; x !== endX; x += dir) {
          const idx = y * cols + x
          const cell = grid[idx]
          
          if (cell !== 0) {
            const below = (y + 1) * cols + x
            
            // Apply wind if in air (not resting on much)
            let windOffset = 0
            if (y < rows - 5 && Math.random() < 0.1) {
              if (wind.x > 0) windOffset = 1
              else if (wind.x < 0) windOffset = -1
            }

            // Check directly below
            if (grid[below] === 0) {
              grid[below] = cell
              grid[idx] = 0
            } else {
              // Check bottom diagonals (Angle of repose)
              // Prioritize wind direction
              const checkOrder = windOffset === 1 ? [1, -1] : [-1, 1]
              let moved = false
              
              for (const dx of checkOrder) {
                const nx = x + dx
                if (nx >= 0 && nx < cols) {
                   const diag = (y + 1) * cols + nx
                   if (grid[diag] === 0) {
                     grid[diag] = cell
                     grid[idx] = 0
                     moved = true
                     break
                   }
                }
              }

              // If resting but wind is strong, surface slip (sand blowing off dunes)
              if (!moved && Math.random() < Math.abs(wind.x) * 0.05) {
                 const nx = x + windOffset
                 if (nx >= 0 && nx < cols && grid[y * cols + nx] === 0) {
                    grid[y * cols + nx] = cell
                    grid[idx] = 0
                 }
              }
            }
          }
        }
      }

      // --- 3. Render ---
      // We will render directly to an ImageData buffer for maximum speed
      const imgData = ctx.createImageData(cols, rows)
      const data32 = new Uint32Array(imgData.data.buffer)
      
      // Copy grid to imgData (0 is transparent black by default, we want dark blue background)
      const bg = hexToUint32('#060610')
      for (let i = 0; i < grid.length; i++) {
        data32[i] = grid[i] === 0 ? bg : grid[i]
      }

      // Use a temporary canvas to scale up the ImageData without blurring
      const tmpCanvas = document.createElement('canvas')
      tmpCanvas.width = cols
      tmpCanvas.height = rows
      tmpCanvas.getContext('2d')!.putImageData(imgData, 0, 0)

      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, running, palette])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    // clear grid
    if (gridRef.current) gridRef.current.fill(0)
    onClose()
  }

  const updateWind = (val: number) => {
    windRef.current.x = val
    setWindUi({ x: val, y: 0 })
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
            <div className="flex bg-black/40 rounded-full p-1 ml-4 items-center px-4 gap-2">
              <Wind className="w-4 h-4 text-white/50" />
              <input 
                type="range" 
                min="-2" max="2" step="0.1" 
                value={windUi.x} 
                onChange={e => updateWind(parseFloat(e.target.value))}
                className="w-24 accent-white"
              />
            </div>
            <div className="flex bg-black/40 rounded-full p-1 ml-4">
              {(['desert', 'ocean', 'aurora'] as Palette[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPalette(p)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    palette === p ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button 
              onClick={() => { if (gridRef.current) gridRef.current.fill(0) }}
              className="ml-4 text-xs font-bold text-rose-400 hover:text-rose-300"
            >
              CLEAR SAND
            </button>
          </>
        )}
      </div>

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10 cursor-crosshair" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Sand Dune Painter</p>
            <p className="mb-4 text-sm text-white/70">Pinch your fingers to drop sand. Fast movements drop coarse sand, slow movements drop fine dust. Adjust the wind to sculpt massive dunes.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Sculpting
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
