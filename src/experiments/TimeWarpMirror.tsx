import { useRef, useEffect, useState, useCallback } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import { Play, Square, Clock, SlidersHorizontal } from 'lucide-react'

interface Props { onClose: () => void }

export default function TimeWarpMirror({ onClose }: Props) {
  const { videoRef, start, stop } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(3)
  const [mode, setMode] = useState<'overlay' | 'split' | 'pip'>('overlay')
  const animRef = useRef<number>(0)
  const frameBuffer = useRef<string[]>([])
  const maxBuffer = 60 // ~2 seconds at 30fps

  const captureFrame = useCallback((video: HTMLVideoElement, w: number, h: number): string => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    ctx.scale(-1, 1)
    ctx.drawImage(video, -w, 0, w, h)
    return c.toDataURL('image/jpeg', 0.5)
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
        // Capture current frame
        if (frameCount % 2 === 0) {
          const frameData = captureFrame(video, w, h)
          if (frameData) {
            frameBuffer.current.push(frameData)
            if (frameBuffer.current.length > maxBuffer) frameBuffer.current.shift()
          }
        }

        // Get delayed frame
        const delayFrames = Math.min(Math.floor(delay * 10), frameBuffer.current.length - 1)
        const delayedFrame = frameBuffer.current[frameBuffer.current.length - 1 - delayFrames]

        // Draw current
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()

        if (delayedFrame && frameBuffer.current.length > 5) {
          const img = new Image()
          img.onload = () => {
            ctx.save()
            if (mode === 'overlay') {
              ctx.globalAlpha = 0.5
              ctx.filter = 'hue-rotate(180deg) saturate(1.5) brightness(1.1)'
              ctx.globalCompositeOperation = 'screen'
              ctx.drawImage(img, 0, 0, w, h)
            } else if (mode === 'split') {
              ctx.globalAlpha = 0.7
              ctx.filter = 'hue-rotate(180deg)'
              ctx.drawImage(img, w / 2, 0, w / 2, h)
              // Divider line
              ctx.globalCompositeOperation = 'source-over'
              ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'
              ctx.lineWidth = 2
              ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke()
            } else if (mode === 'pip') {
              const pw = w * 0.25, ph = h * 0.25
              ctx.globalAlpha = 0.7
              ctx.filter = 'hue-rotate(180deg) grayscale(0.3)'
              ctx.drawImage(img, w - pw - 20, 20, pw, ph)
              ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'
              ctx.lineWidth = 2
              ctx.strokeRect(w - pw - 20, 20, pw, ph)
            }
            ctx.restore()
          }
          img.src = delayedFrame
        }
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }

      // Scanlines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1)
      }

      frameCount++
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [running, delay, mode, captureFrame, videoRef])

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
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <div className="glass rounded-full px-3 py-1 flex items-center gap-1 text-white text-xs">
            <Clock className="w-3.5 h-3.5" /> {delay}s delay
          </div>
        </div>
      )}
      {running && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-4 py-2 flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-[var(--text-secondary)]" />
          <input type="range" min="0.5" max="5" step="0.5" value={delay} onChange={(e) => setDelay(parseFloat(e.target.value))} className="w-24 accent-[var(--accent-color)]" />
          {(['overlay', 'split', 'pip'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-full text-xs ${mode === m ? 'accent-gradient text-white' : 'glass text-[var(--text-secondary)]'}`}>
              {m}
            </button>
          ))}
        </div>
      )}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: '60vh' }} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Time Warp Mirror</p>
            <p className="text-white/70 text-sm mb-4">See yourself with a delayed ghost echo. Adjust delay and mode.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start Camera</button>
          </div>
        </div>
      )}
    </div>
  )
}
