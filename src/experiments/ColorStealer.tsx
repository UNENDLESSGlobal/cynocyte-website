import { useRef, useEffect, useState, useCallback } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import { Play, Square, Pipette, RefreshCw } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function ColorStealer({ onClose }: Props) {
  const { videoRef, start, stop } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [running, setRunning] = useState(false)
  const [currentColor, setCurrentColor] = useState('#6C63FF')
  const [palette, setPalette] = useState<string[]>(['#6C63FF', '#EC4899', '#10B981', '#F59E0B'])
  const mouseRef = useRef({ x: 0, y: 0, clicking: false })
  const animRef = useRef<number>(0)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top
  }, [])

  const handleClick = useCallback(() => {
    if (!hiddenCanvasRef.current) return
    const hc = hiddenCanvasRef.current
    const mx = mouseRef.current.x * (hc.width / (canvasRef.current?.offsetWidth || hc.width))
    const my = mouseRef.current.y * (hc.height / (canvasRef.current?.offsetHeight || hc.height))
    const ctx = hc.getContext('2d')
    if (!ctx) return
    const pixel = ctx.getImageData(Math.max(0, Math.min(hc.width - 1, mx)), Math.max(0, Math.min(hc.height - 1, my)), 1, 1).data
    const hex = `#${[pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`
    setCurrentColor(hex)
    setPalette(p => p.length >= 8 ? [...p.slice(1), hex] : [...p, hex])
  }, [])

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

    const hc = document.createElement('canvas')
    hc.width = 640
    hc.height = 480
    hiddenCanvasRef.current = hc

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      if (video.readyState >= 2) {
        // Draw mirrored video
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()

        // Update hidden canvas
        const hCtx = hc.getContext('2d')
        if (hCtx) {
          hCtx.save()
          hCtx.scale(-1, 1)
          hCtx.drawImage(video, -hc.width, 0, hc.width, hc.height)
          hCtx.restore()
        }
      }

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // Preview ring
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 3
      ctx.shadowBlur = 15
      ctx.shadowColor = currentColor
      ctx.beginPath()
      ctx.arc(mx, my, 40, 0, Math.PI * 2)
      ctx.stroke()

      // Fill with sampled color
      ctx.fillStyle = currentColor + '80'
      ctx.fill()

      // Hex text
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 4
      ctx.shadowColor = '#000'
      ctx.fillText(currentColor.toUpperCase(), mx, my + 55)

      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [running, currentColor, videoRef])

  const handleStart = async () => {
    await start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stop()
    onClose()
  }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover">
            <Play className="w-4 h-4" /> Start
          </button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover">
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 glass rounded-full px-4 py-2 flex items-center gap-3">
          {palette.map((c, i) => (
            <button
              key={i}
              onClick={() => setCurrentColor(c)}
              className="w-8 h-8 rounded-full border-2 border-white/30 transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
          <button onClick={handleClick} className="ml-2 w-8 h-8 rounded-full accent-gradient flex items-center justify-center">
            <Pipette className="w-4 h-4 text-white" />
          </button>
          <button onClick={() => setPalette(['#6C63FF', '#EC4899', '#10B981', '#F59E0B'])} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </button>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{ minHeight: '60vh' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Color Stealer</p>
            <p className="text-white/70 text-sm mb-4">Point and click to sample colors from your camera feed.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
