import { useCallback, useEffect, useRef, useState } from 'react'
import { Layers, Play, ScanLine, Square } from 'lucide-react'
import { useWebcam } from '@/hooks/useWebcam'

interface Props {
  onClose: () => void
}

export default function HolographicTwin({ onClose }: Props) {
  const { videoRef, start, stop, error } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [ghostLayers, setGhostLayers] = useState(1)
  const [scanlineIntensity, setScanlineIntensity] = useState(0.5)
  const [freezeGhost, setFreezeGhost] = useState(false)
  const animRef = useRef<number>(0)
  const frameBuffer = useRef<ImageData[]>([])
  const frozenGhostRef = useRef<ImageData | null>(null)
  const maxBuffer = 90

  const captureFrame = useCallback((context: CanvasRenderingContext2D, width: number, height: number) => {
    try {
      return context.getImageData(0, 0, width, height)
    } catch {
      return null
    }
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
        context.save()
        context.scale(-1, 1)
        context.drawImage(video, -width, 0, width, height)
        context.restore()

        if (!freezeGhost && frameCount % 3 === 0) {
          const frame = captureFrame(context, width, height)
          if (frame) {
            frameBuffer.current.push(frame)
            if (frameBuffer.current.length > maxBuffer) frameBuffer.current.shift()
          }
        }

        const ghostDelays = [30, 60, 90].slice(0, ghostLayers)
        for (let index = 0; index < ghostDelays.length; index += 1) {
          const delay = ghostDelays[index]
          const sourceFrame =
            freezeGhost && frozenGhostRef.current
              ? frozenGhostRef.current
              : frameBuffer.current[frameBuffer.current.length - 1 - delay]

          if (!sourceFrame) continue

          const ghostCanvas = document.createElement('canvas')
          ghostCanvas.width = width
          ghostCanvas.height = height
          const ghostContext = ghostCanvas.getContext('2d')
          if (!ghostContext) continue

          ghostContext.putImageData(sourceFrame, 0, 0)
          context.save()
          context.globalAlpha = 0.3 - index * 0.08
          context.filter = 'hue-rotate(180deg) saturate(0.3) brightness(1.2)'
          context.globalCompositeOperation = 'screen'
          context.drawImage(ghostCanvas, width * 0.1 * (index + 1), height * 0.05 * (index + 1), width * 0.9, height * 0.9)
          context.restore()
        }

        context.fillStyle = `rgba(0, 0, 0, ${scanlineIntensity * 0.3})`
        const scanlineOffset = Math.floor(Date.now() / 50) % 3
        for (let y = scanlineOffset; y < height; y += 3) {
          context.fillRect(0, y, width, 1)
        }

        context.save()
        const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.8)
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0)')
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0.05)')
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
        context.restore()
      } else {
        context.fillStyle = '#060610'
        context.fillRect(0, 0, width, height)
      }

      frameCount += 1
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [captureFrame, freezeGhost, ghostLayers, running, scanlineIntensity, videoRef])

  const handleStart = async () => {
    frameBuffer.current = []
    frozenGhostRef.current = null
    await start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stop()
    frameBuffer.current = []
    frozenGhostRef.current = null
    onClose()
  }

  const toggleFreezeGhost = () => {
    setFreezeGhost((value) => {
      const next = !value
      if (next) {
        frozenGhostRef.current = frameBuffer.current[frameBuffer.current.length - 1] ?? null
      } else {
        frozenGhostRef.current = null
      }
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
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-full glass px-4 py-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--text-secondary)]" />
            <input type="range" min="1" max="3" step="1" value={ghostLayers} onChange={(event) => setGhostLayers(parseInt(event.target.value, 10))} className="w-16 accent-[var(--accent-color)]" />
            <span className="text-xs text-[var(--text-secondary)]">{ghostLayers}</span>
          </div>
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-[var(--text-secondary)]" />
            <input type="range" min="0" max="1" step="0.1" value={scanlineIntensity} onChange={(event) => setScanlineIntensity(parseFloat(event.target.value))} className="w-16 accent-[var(--accent-color)]" />
          </div>
          <button onClick={toggleFreezeGhost} className={`rounded-full px-3 py-1 text-xs ${freezeGhost ? 'accent-gradient text-white' : 'glass text-[var(--text-secondary)]'}`}>
            Freeze Ghost
          </button>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Holographic Twin</p>
            <p className="mb-4 text-sm text-white/70">Add up to three echo layers, tune the scanlines, and freeze a ghost frame in place.</p>
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
