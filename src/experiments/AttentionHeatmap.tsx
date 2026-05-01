import { useEffect, useRef, useState } from 'react'
import { Play, Square, Image as ImageIcon, Download } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function AttentionHeatmap({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const animRef = useRef<number>(0)

  const stateRef = useRef({
    mode: 'calibrating', // 'calibrating' | 'active'
    calibStep: 0,
    calibPoints: [] as { scrX: number, scrY: number, eyeX: number, eyeY: number }[],
    calibTimer: 0,
    cursorX: 0,
    cursorY: 0,
  })

  // 5 calibration points (corners and center)
  const TARGETS = [
    {x: 0.1, y: 0.1}, {x: 0.9, y: 0.1}, 
    {x: 0.5, y: 0.5},
    {x: 0.1, y: 0.9}, {x: 0.9, y: 0.9}
  ]

  // Heatmap grid
  const COLS = 40
  const ROWS = 30
  const gridRef = useRef<number[][]>(Array(ROWS).fill(0).map(() => Array(COLS).fill(0)))
  const maxHitRef = useRef(1)

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const hCanvas = heatmapCanvasRef.current
    const video = videoRef.current
    if (!canvas || !hCanvas || !video) return

    const ctx = canvas.getContext('2d')
    const hCtx = hCanvas.getContext('2d')
    if (!ctx || !hCtx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      hCanvas.width = canvas.offsetWidth
      hCanvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener('resize', resize)

    let smoothEyeX = 0
    let smoothEyeY = 0

    // Load sample image
    const img = new Image()
    img.src = 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80' // Beautiful landscape with clear focal points

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      // Draw Base
      if (s.mode === 'calibrating') {
        ctx.fillStyle = '#0a0a14'
        ctx.fillRect(0, 0, w, h)
        if (video.readyState >= 2) {
          ctx.save()
          ctx.globalAlpha = 0.2
          ctx.scale(-1, 1)
          ctx.drawImage(video, -w, 0, w, h)
          ctx.restore()
        }
      } else {
        // Draw Image
        if (img.complete) {
          // Fill cover
          const scale = Math.max(w / img.width, h / img.height)
          const x = (w / 2) - (img.width / 2) * scale
          const y = (h / 2) - (img.height / 2) * scale
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
        } else {
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(0, 0, w, h)
        }
      }

      const results = detectFrame(performance.now())
      const face = results?.face?.faceLandmarks?.[0]

      if (face) {
        const outer = face[33]
        const inner = face[133]
        const top = face[159]
        const bottom = face[145]
        const iris = face[468]

        const eyeW = Math.abs(outer.x - inner.x)
        const eyeH = Math.abs(top.y - bottom.y)
        
        const rawX = (iris.x - Math.min(outer.x, inner.x)) / eyeW
        const rawY = (iris.y - Math.min(top.y, bottom.y)) / eyeH

        smoothEyeX += (rawX - smoothEyeX) * 0.1
        smoothEyeY += (rawY - smoothEyeY) * 0.1

        if (s.mode === 'calibrating') {
          const target = TARGETS[s.calibStep]
          const tx = target.x * w
          const ty = target.y * h

          ctx.fillStyle = '#ff00ff'
          ctx.beginPath()
          ctx.arc(tx, ty, 15, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.font = '16px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`Look here (${s.calibStep + 1}/${TARGETS.length})`, tx, ty - 25)

          ctx.strokeStyle = '#00ffff'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(tx, ty, 25, -Math.PI/2, -Math.PI/2 + (s.calibTimer / 45) * Math.PI * 2)
          ctx.stroke()

          s.calibTimer++
          if (s.calibTimer > 45) {
            s.calibPoints.push({ scrX: target.x, scrY: target.y, eyeX: smoothEyeX, eyeY: smoothEyeY })
            s.calibStep++
            s.calibTimer = 0
            if (s.calibStep >= TARGETS.length) {
              s.mode = 'active'
              s.cursorX = w / 2
              s.cursorY = h / 2
            }
          }
        } else if (s.mode === 'active') {
          const minEyeX = Math.min(...s.calibPoints.map(p => p.eyeX))
          const maxEyeX = Math.max(...s.calibPoints.map(p => p.eyeX))
          const minEyeY = Math.min(...s.calibPoints.map(p => p.eyeY))
          const maxEyeY = Math.max(...s.calibPoints.map(p => p.eyeY))

          let mappedX = 1 - (smoothEyeX - minEyeX) / (maxEyeX - minEyeX)
          let mappedY = (smoothEyeY - minEyeY) / (maxEyeY - minEyeY)
          
          mappedX = clamp(mappedX, -0.2, 1.2)
          mappedY = clamp(mappedY, -0.2, 1.2)

          mappedX = (mappedX - 0.5) * 1.5 + 0.5
          mappedY = (mappedY - 0.5) * 1.5 + 0.5

          s.cursorX += (mappedX * w - s.cursorX) * 0.15
          s.cursorY += (mappedY * h - s.cursorY) * 0.15

          // Record Heatmap Data
          const col = Math.floor((s.cursorX / w) * COLS)
          const row = Math.floor((s.cursorY / h) * ROWS)
          
          if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
            gridRef.current[row][col] += 1
            if (gridRef.current[row][col] > maxHitRef.current) {
              maxHitRef.current = gridRef.current[row][col]
            }
            
            // Add slight spread (Gaussian blur approximation)
            if (col > 0) gridRef.current[row][col-1] += 0.5
            if (col < COLS-1) gridRef.current[row][col+1] += 0.5
            if (row > 0) gridRef.current[row-1][col] += 0.5
            if (row < ROWS-1) gridRef.current[row+1][col] += 0.5
          }

          // Draw Heatmap Overlay if enabled
          const showHeat = showHeatmapRef.current
          if (showHeat) {
            hCtx.clearRect(0, 0, w, h)
            const cellW = w / COLS
            const cellH = h / ROWS

            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                const val = gridRef.current[r][c]
                if (val > 0) {
                  const intensity = Math.min(1, val / (maxHitRef.current * 0.8)) // 0.8 to make hot spots redder faster
                  
                  // Color mapping: 0=Blue, 0.5=Green/Yellow, 1=Red
                  const hue = (1 - intensity) * 240
                  hCtx.fillStyle = `hsla(${hue}, 100%, 50%, ${intensity * 0.6})`
                  
                  // Draw blurred circles instead of hard rects
                  hCtx.beginPath()
                  hCtx.arc(c * cellW + cellW/2, r * cellH + cellH/2, Math.max(cellW, cellH) * 1.5, 0, Math.PI*2)
                  hCtx.fill()
                }
              }
            }
            
            // Combine canvases
            ctx.globalCompositeOperation = 'multiply'
            ctx.drawImage(hCanvas, 0, 0)
            ctx.globalCompositeOperation = 'source-over'
          } else {
            // Just draw cursor
            ctx.beginPath()
            ctx.arc(s.cursorX, s.cursorY, 10, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(0, 255, 255, 0.4)'
            ctx.fill()
          }
        }
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, running])

  const showHeatmapRef = useRef(showHeatmap)
  useEffect(() => { showHeatmapRef.current = showHeatmap }, [showHeatmap])

  const handleStart = async () => {
    await startVision()
    stateRef.current.mode = 'calibrating'
    stateRef.current.calibStep = 0
    stateRef.current.calibPoints = []
    stateRef.current.calibTimer = 0
    // Reset grid
    gridRef.current = Array(ROWS).fill(0).map(() => Array(COLS).fill(0))
    maxHitRef.current = 1
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    setShowHeatmap(false)
    onClose()
  }

  const handleExport = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `attention-heatmap-${Date.now()}.png`
    a.click()
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
            {stateRef.current.mode === 'active' && (
              <>
                <button 
                  onClick={() => setShowHeatmap(!showHeatmap)} 
                  className={`btn-hover flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-colors ${
                    showHeatmap ? 'bg-indigo-500/50' : 'glass'
                  }`}
                >
                  <Eye className="h-4 w-4" /> {showHeatmap ? 'Hide Heatmap' : 'Reveal Heatmap'}
                </button>
                {showHeatmap && (
                  <button onClick={handleExport} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
                    <Download className="h-4 w-4" /> Export PNG
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />
      {/* Hidden canvas for drawing heatmap soft blobs */}
      <canvas ref={heatmapCanvasRef} className="hidden" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Attention Heatmap</p>
            <p className="mb-4 text-sm text-white/70">Look naturally at the image. We will track your gaze to build a UX research heatmap.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Calibration
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
