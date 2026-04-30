import { useRef, useEffect, useState, useCallback } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import { Play, Square, Layers, ScanLine } from 'lucide-react'

interface Props { onClose: () => void }

export default function HolographicTwin({ onClose }: Props) {
  const { videoRef, start, stop } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [ghostLayers, setGhostLayers] = useState(1)
  const [scanlineIntensity, setScanlineIntensity] = useState(0.5)
  const animRef = useRef<number>(0)
  const frameBuffer = useRef<ImageData[]>([])
  const maxBuffer = 90 // ~3 seconds at 30fps

  const captureFrame = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    try {
      return ctx.getImageData(0, 0, w, h)
    } catch { return null }
  }, [])

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    let frameCount = 0

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      if (video.readyState >= 2) {
        // Draw current frame
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()

        // Capture for buffer
        if (frameCount % 3 === 0) {
          const frame = captureFrame(ctx, w, h)
          if (frame) {
            frameBuffer.current.push(frame)
            if (frameBuffer.current.length > maxBuffer) frameBuffer.current.shift()
          }
        }

        // Draw ghost frames
        const ghostDelays = [30, 60, 90].slice(0, ghostLayers)
        for (let i = 0; i < ghostDelays.length; i++) {
          const delay = ghostDelays[i]
          const idx = frameBuffer.current.length - 1 - delay
          if (idx >= 0 && idx < frameBuffer.current.length) {
            const ghostFrame = frameBuffer.current[idx]
            const ghostCanvas = document.createElement('canvas')
            ghostCanvas.width = w; ghostCanvas.height = h
            const gCtx = ghostCanvas.getContext('2d')
            if (gCtx) {
              gCtx.putImageData(ghostFrame, 0, 0)

              ctx.save()
              ctx.globalAlpha = 0.3 - i * 0.08
              ctx.filter = `hue-rotate(180deg) saturate(0.3) brightness(1.2)`
              ctx.globalCompositeOperation = 'screen'
              ctx.drawImage(ghostCanvas, w * 0.1 * (i + 1), h * 0.05 * (i + 1), w * 0.9, h * 0.9)
              ctx.restore()
            }
          }
        }

        // Scanlines
        ctx.fillStyle = `rgba(0, 0, 0, ${scanlineIntensity * 0.3})`
        const scanlineOffset = Math.floor(Date.now() / 50) % 3
        for (let y = scanlineOffset; y < h; y += 3) {
          ctx.fillRect(0, y, w, 1)
        }

        // Cyan glow vignette
        ctx.save()
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8)
        grad.addColorStop(0, 'rgba(0, 255, 255, 0)')
        grad.addColorStop(1, 'rgba(0, 255, 255, 0.05)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }

      frameCount++
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [running, ghostLayers, scanlineIntensity, captureFrame, videoRef])

  const handleStart = async () => { frameBuffer.current = []; await start(); setRunning(true) }
  const handleStop = () => { setRunning(false); stop(); frameBuffer.current = []; onClose() }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover"><Play className="w-4 h-4" /> Start</button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><Square className="w-4 h-4" /> Stop</button>
        )}
      </div>
      {running && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--text-secondary)]" />
            <input type="range" min="1" max="3" step="1" value={ghostLayers} onChange={(e) => setGhostLayers(parseInt(e.target.value))} className="w-16 accent-[var(--accent-color)]" />
            <span className="text-xs text-[var(--text-secondary)]">{ghostLayers}</span>
          </div>
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-[var(--text-secondary)]" />
            <input type="range" min="0" max="1" step="0.1" value={scanlineIntensity} onChange={(e) => setScanlineIntensity(parseFloat(e.target.value))} className="w-16 accent-[var(--accent-color)]" />
          </div>
        </div>
      )}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: '60vh' }} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Holographic Twin</p>
            <p className="text-white/70 text-sm mb-4">See your ghost from 3 seconds ago. Add temporal echo layers.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start Camera</button>
          </div>
        </div>
      )}
    </div>
  )
}
