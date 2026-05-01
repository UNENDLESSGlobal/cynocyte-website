import { useEffect, useRef, useState } from 'react'
import { Play, Square, Eye } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function GazeControlledUI({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const stateRef = useRef({
    mode: 'calibrating', // 'calibrating' | 'active'
    calibStep: 0,
    calibPoints: [] as { scrX: number, scrY: number, eyeX: number, eyeY: number }[],
    calibTimer: 0,
    cursorX: 0,
    cursorY: 0,
    dwellStart: 0,
    dwelledButton: -1,
    activeButton: -1,
    blinkFrameCount: 0
  })

  // 9 calibration points (normalized 0-1)
  const TARGETS = [
    {x: 0.1, y: 0.1}, {x: 0.5, y: 0.1}, {x: 0.9, y: 0.1},
    {x: 0.1, y: 0.5}, {x: 0.5, y: 0.5}, {x: 0.9, y: 0.5},
    {x: 0.1, y: 0.9}, {x: 0.5, y: 0.9}, {x: 0.9, y: 0.9}
  ]

  const BUTTONS = [
    { id: 0, x: 0.2, y: 0.3, label: 'Photos' },
    { id: 1, x: 0.5, y: 0.3, label: 'Messages' },
    { id: 2, x: 0.8, y: 0.3, label: 'Weather' },
    { id: 3, x: 0.35, y: 0.7, label: 'Music' },
    { id: 4, x: 0.65, y: 0.7, label: 'Settings' }
  ]

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

    resize()
    window.addEventListener('resize', resize)

    // To smooth out the jittery webcam iris
    let smoothEyeX = 0
    let smoothEyeY = 0

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.2
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const face = results?.face?.faceLandmarks?.[0]
      const blendshapes = results?.face?.faceBlendshapes?.[0]?.categories

      let isBlinking = false

      if (face) {
        // MediaPipe Face Mesh: Left eye bounds 33 (outer), 133 (inner), 159 (top), 145 (bottom)
        // Iris center 468
        // Right eye bounds 362 (inner), 263 (outer), 386 (top), 374 (bottom)
        // Iris center 473
        
        // Use left eye (which is physically on the right side of the screen due to mirroring)
        const outer = face[33]
        const inner = face[133]
        const top = face[159]
        const bottom = face[145]
        const iris = face[468]

        // Relative position within eye socket
        const eyeW = Math.abs(outer.x - inner.x)
        const eyeH = Math.abs(top.y - bottom.y)
        
        // Normalized 0 to 1
        const rawX = (iris.x - Math.min(outer.x, inner.x)) / eyeW
        const rawY = (iris.y - Math.min(top.y, bottom.y)) / eyeH

        // Exponential moving average for smoothing
        smoothEyeX += (rawX - smoothEyeX) * 0.1
        smoothEyeY += (rawY - smoothEyeY) * 0.1

        // Blink detection via blendshapes
        if (blendshapes) {
          const blinkLeft = blendshapes.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0
          const blinkRight = blendshapes.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0
          if (blinkLeft > 0.4 || blinkRight > 0.4) {
            isBlinking = true
            s.blinkFrameCount++
          } else {
            // Register click if blinked for a few frames then opened
            if (s.blinkFrameCount > 2 && s.blinkFrameCount < 15 && s.mode === 'active') {
              // Trigger click
              if (s.dwelledButton !== -1) {
                s.activeButton = s.dwelledButton
              }
            }
            s.blinkFrameCount = 0
          }
        }

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

          // Progress ring
          ctx.strokeStyle = '#00ffff'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(tx, ty, 25, -Math.PI/2, -Math.PI/2 + (s.calibTimer / 60) * Math.PI * 2)
          ctx.stroke()

          s.calibTimer++
          if (s.calibTimer > 60) {
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
          // Map smoothEye to screen using calibration bounds
          // Simplest mapping: find min/max eye bounds from calibration
          const minEyeX = Math.min(...s.calibPoints.map(p => p.eyeX))
          const maxEyeX = Math.max(...s.calibPoints.map(p => p.eyeX))
          const minEyeY = Math.min(...s.calibPoints.map(p => p.eyeY))
          const maxEyeY = Math.max(...s.calibPoints.map(p => p.eyeY))

          // Because camera is mirrored, mapping is inverted
          let mappedX = 1 - (smoothEyeX - minEyeX) / (maxEyeX - minEyeX)
          let mappedY = (smoothEyeY - minEyeY) / (maxEyeY - minEyeY)
          
          mappedX = clamp(mappedX, 0, 1)
          mappedY = clamp(mappedY, 0, 1)

          // Expand range slightly to reach edges
          mappedX = (mappedX - 0.5) * 1.5 + 0.5
          mappedY = (mappedY - 0.5) * 1.5 + 0.5

          // Very strong smoothing for the actual screen cursor
          s.cursorX += (mappedX * w - s.cursorX) * 0.15
          s.cursorY += (mappedY * h - s.cursorY) * 0.15

          // Draw Holographic UI
          let hoveredBtn = -1
          BUTTONS.forEach((btn, i) => {
            const bx = btn.x * w
            const by = btn.y * h
            const bw = 160
            const bh = 80
            
            const isHover = Math.abs(s.cursorX - bx) < bw/2 && Math.abs(s.cursorY - by) < bh/2
            if (isHover) hoveredBtn = i

            const isActive = s.activeButton === i

            ctx.fillStyle = isActive ? 'rgba(0, 255, 255, 0.4)' : isHover ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'
            ctx.strokeStyle = isActive ? '#00ffff' : isHover ? '#fff' : 'rgba(255,255,255,0.2)'
            ctx.lineWidth = 2
            
            ctx.beginPath()
            ctx.roundRect(bx - bw/2, by - bh/2, bw, bh, 12)
            ctx.fill()
            ctx.stroke()
            
            ctx.fillStyle = isActive ? '#00ffff' : '#fff'
            ctx.font = 'bold 20px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(btn.label, bx, by)
          })

          // Dwell detection
          if (hoveredBtn !== -1) {
            if (s.dwelledButton !== hoveredBtn) {
              s.dwelledButton = hoveredBtn
              s.dwellStart = performance.now()
            } else {
              const dwellTime = performance.now() - s.dwellStart
              // Draw dwell progress on cursor
              ctx.strokeStyle = '#00ffff'
              ctx.lineWidth = 4
              ctx.beginPath()
              ctx.arc(s.cursorX, s.cursorY, 25, -Math.PI/2, -Math.PI/2 + Math.min(1, dwellTime/1500) * Math.PI * 2)
              ctx.stroke()

              if (dwellTime > 1500) {
                s.activeButton = hoveredBtn // Click!
                s.dwellStart = performance.now() // Reset to prevent rapid firing
              }
            }
          } else {
            s.dwelledButton = -1
          }

          // Draw Gaze Cursor
          ctx.beginPath()
          ctx.arc(s.cursorX, s.cursorY, 15, 0, Math.PI * 2)
          ctx.fillStyle = isBlinking ? '#ff00ff' : 'rgba(0, 255, 255, 0.6)'
          ctx.fill()
          
          ctx.fillStyle = '#fff'
          ctx.font = '14px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(isBlinking ? 'BLINK' : 'GAZE', s.cursorX, s.cursorY - 25)
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

  const handleStart = async () => {
    await startVision()
    stateRef.current.mode = 'calibrating'
    stateRef.current.calibStep = 0
    stateRef.current.calibPoints = []
    stateRef.current.calibTimer = 0
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
          <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2">
          <Eye className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Stare at the dots to calibrate, then look at buttons to select. Blink to click.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Gaze-Controlled UI</p>
            <p className="mb-4 text-sm text-white/70">Navigate a holographic OS entirely with eye gaze. Stare to select, blink to click.</p>
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
