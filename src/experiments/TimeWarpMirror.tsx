import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Play, Square, SlidersHorizontal } from 'lucide-react'
import { useWebcam } from '@/hooks/useWebcam'

interface Props {
  onClose: () => void
}

type MirrorMode = 'overlay' | 'vertical' | 'horizontal' | 'pip'

export default function TimeWarpMirror({ onClose }: Props) {
  const { videoRef, start, stop, error } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(3)
  const [mode, setMode] = useState<MirrorMode>('overlay')
  const [paradoxMode, setParadoxMode] = useState(false)
  const animRef = useRef<number>(0)
  const frameBuffer = useRef<string[]>([])
  const frozenFrameRef = useRef<string | null>(null)
  const maxBuffer = 60

  const captureFrame = useCallback((video: HTMLVideoElement, width: number, height: number): string => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return ''
    context.scale(-1, 1)
    context.drawImage(video, -width, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.5)
  }, [])

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const context = canvas.getContext('2d')
    if (!context) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    let frameCount = 0
    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const width = canvas.width
      const height = canvas.height

      if (video.readyState >= 2) {
        if (frameCount % 2 === 0) {
          const frameData = captureFrame(video, width, height)
          if (frameData) {
            frameBuffer.current.push(frameData)
            if (frameBuffer.current.length > maxBuffer) frameBuffer.current.shift()
            if (paradoxMode && !frozenFrameRef.current) frozenFrameRef.current = frameData
          }
        }

        const delayFrames = Math.min(Math.floor(delay * 10), frameBuffer.current.length - 1)
        const liveDelayedFrame = frameBuffer.current[frameBuffer.current.length - 1 - delayFrames]
        const delayedFrame = paradoxMode ? frozenFrameRef.current ?? liveDelayedFrame : liveDelayedFrame

        context.save()
        context.scale(-1, 1)
        context.drawImage(video, -width, 0, width, height)
        context.restore()

        if (delayedFrame && frameBuffer.current.length > 5) {
          const image = new Image()
          image.onload = () => {
            context.save()
            if (mode === 'overlay') {
              context.globalAlpha = 0.6
              context.filter = 'hue-rotate(180deg) saturate(1.5) brightness(1.1)'
              context.globalCompositeOperation = 'screen'
              context.drawImage(image, 0, 0, width, height)
            } else if (mode === 'vertical') {
              context.globalAlpha = 0.7
              context.filter = 'hue-rotate(180deg)'
              context.drawImage(image, width / 2, 0, width / 2, height)
              context.globalCompositeOperation = 'source-over'
              context.strokeStyle = 'rgba(0, 255, 255, 0.5)'
              context.lineWidth = 2
              context.beginPath()
              context.moveTo(width / 2, 0)
              context.lineTo(width / 2, height)
              context.stroke()
            } else if (mode === 'horizontal') {
              context.globalAlpha = 0.7
              context.filter = 'hue-rotate(180deg)'
              context.drawImage(image, 0, height / 2, width, height / 2)
              context.globalCompositeOperation = 'source-over'
              context.strokeStyle = 'rgba(0, 255, 255, 0.5)'
              context.lineWidth = 2
              context.beginPath()
              context.moveTo(0, height / 2)
              context.lineTo(width, height / 2)
              context.stroke()
            } else if (mode === 'pip') {
              const pipWidth = width * 0.25
              const pipHeight = height * 0.25
              context.globalAlpha = 0.75
              context.filter = 'hue-rotate(180deg) grayscale(0.3)'
              context.drawImage(image, width - pipWidth - 20, 20, pipWidth, pipHeight)
              context.strokeStyle = 'rgba(0, 255, 255, 0.5)'
              context.lineWidth = 2
              context.strokeRect(width - pipWidth - 20, 20, pipWidth, pipHeight)
            }
            context.restore()
          }
          image.src = delayedFrame
        }
      } else {
        context.fillStyle = '#060610'
        context.fillRect(0, 0, width, height)
      }

      context.fillStyle = 'rgba(0, 0, 0, 0.05)'
      for (let y = 0; y < height; y += 3) {
        context.fillRect(0, y, width, 1)
      }

      frameCount += 1
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [captureFrame, delay, mode, paradoxMode, running, videoRef])

  const handleStart = async () => {
    frameBuffer.current = []
    frozenFrameRef.current = null
    await start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stop()
    frameBuffer.current = []
    frozenFrameRef.current = null
    onClose()
  }

  const toggleParadoxMode = () => {
    setParadoxMode((value) => {
      const next = !value
      if (!next) frozenFrameRef.current = null
      return next
    })
  }

  return (
    <div className="relative flex h-full w-full flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
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
        <>
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-white">
            <Clock className="h-3.5 w-3.5" /> {delay}s delay
          </div>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full glass px-4 py-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-secondary)]" />
            <input type="range" min="0.5" max="5" step="0.5" value={delay} onChange={(event) => setDelay(parseFloat(event.target.value))} className="w-24 accent-[var(--accent-color)]" />
            {(['overlay', 'vertical', 'horizontal', 'pip'] as const).map((value) => (
              <button key={value} onClick={() => setMode(value)} className={`rounded-full px-3 py-1 text-xs ${mode === value ? 'accent-gradient text-white' : 'glass text-[var(--text-secondary)]'}`}>
                {value}
              </button>
            ))}
            <button onClick={toggleParadoxMode} className={`rounded-full px-3 py-1 text-xs ${paradoxMode ? 'accent-gradient text-white' : 'glass text-[var(--text-secondary)]'}`}>
              Paradox
            </button>
          </div>
        </>
      )}

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Time Warp Mirror</p>
            <p className="mb-4 text-sm text-white/70">See a delayed ghost, switch between overlay, vertical, horizontal, or PIP views, and lock a paradox snapshot.</p>
            {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
