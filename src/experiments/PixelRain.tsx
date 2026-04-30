import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useWebcam } from '@/hooks/useWebcam'

interface Props {
  onClose: () => void
}

type DissolveMode = 'rain' | 'explosion' | 'swirl'

interface PixelParticle {
  targetX: number
  targetY: number
  x: number
  y: number
  color: string
  size: number
  state: 'forming' | 'holding' | 'dissolving'
  vx: number
  vy: number
  swirlAngle: number
}

export default function PixelRain({ onClose }: Props) {
  const { videoRef, start, stop, error } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [pixelSize, setPixelSize] = useState(1)
  const [dissolveMode, setDissolveMode] = useState<DissolveMode>('rain')
  const animRef = useRef<number>(0)
  const particlesRef = useRef<PixelParticle[]>([])
  const cycleRef = useRef(0)
  const cycleTimerRef = useRef(0)
  const lastCycleRef = useRef(0)

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

    resize()
    window.addEventListener('resize', resize)

    const columns = 40
    const rows = 30
    const total = columns * rows

    if (particlesRef.current.length === 0) {
      for (let index = 0; index < total; index += 1) {
        particlesRef.current.push({
          targetX: 0,
          targetY: 0,
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          color: '#6C63FF',
          size: (4 + Math.random() * 4) * pixelSize,
          state: 'forming',
          vx: 0,
          vy: 0,
          swirlAngle: Math.random() * Math.PI * 2,
        })
      }
    }

    const loop = () => {
      const width = canvas.width
      const height = canvas.height
      const cellWidth = width / columns
      const cellHeight = height / rows

      context.fillStyle = 'rgba(6, 6, 16, 0.3)'
      context.fillRect(0, 0, width, height)

      if (video.readyState >= 2) {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = columns
        tempCanvas.height = rows
        const tempContext = tempCanvas.getContext('2d')
        if (tempContext) {
          tempContext.drawImage(video, 0, 0, columns, rows)
          const data = tempContext.getImageData(0, 0, columns, rows).data

          cycleTimerRef.current += 1
          if (cycleTimerRef.current > 180) {
            cycleRef.current = (cycleRef.current + 1) % 3
            cycleTimerRef.current = 0
          }

          const cycle = cycleRef.current
          if (cycle === 2 && lastCycleRef.current !== 2) {
            particlesRef.current.forEach((particle) => {
              if (dissolveMode === 'rain') {
                particle.vx = (Math.random() - 0.5) * 2
                particle.vy = -Math.random() * 4
              } else if (dissolveMode === 'explosion') {
                const dx = particle.targetX - width / 2
                const dy = particle.targetY - height / 2
                const distance = Math.max(1, Math.hypot(dx, dy))
                particle.vx = (dx / distance) * (2 + Math.random() * 4)
                particle.vy = (dy / distance) * (2 + Math.random() * 4)
              } else {
                particle.swirlAngle = Math.atan2(particle.targetY - height / 2, particle.targetX - width / 2)
              }
            })
          }
          lastCycleRef.current = cycle

          for (let index = 0; index < total; index += 1) {
            const column = index % columns
            const row = Math.floor(index / columns)
            const particle = particlesRef.current[index]
            const r = data[index * 4]
            const g = data[index * 4 + 1]
            const b = data[index * 4 + 2]

            particle.color = `rgb(${r},${g},${b})`
            particle.targetX = column * cellWidth + cellWidth / 2
            particle.targetY = row * cellHeight + cellHeight / 2
            particle.size = (4 + (index % 5)) * 0.45 * pixelSize

            if (cycle === 0) {
              particle.state = 'forming'
              particle.x += (particle.targetX - particle.x) * 0.08
              particle.y += (particle.targetY - particle.y) * 0.08
            } else if (cycle === 1) {
              particle.state = 'holding'
              particle.x += (particle.targetX - particle.x) * 0.02
              particle.y += (particle.targetY - particle.y) * 0.02
            } else {
              particle.state = 'dissolving'
              if (dissolveMode === 'rain') {
                particle.x += particle.vx
                particle.y += particle.vy
                particle.vy += 0.12
              } else if (dissolveMode === 'explosion') {
                particle.x += particle.vx
                particle.y += particle.vy
                particle.vx *= 0.985
                particle.vy *= 0.985
              } else {
                particle.swirlAngle += 0.03
                const radius = Math.max(20, Math.hypot(particle.x - width / 2, particle.y - height / 2))
                particle.x = width / 2 + Math.cos(particle.swirlAngle) * radius * 0.99
                particle.y = height / 2 + Math.sin(particle.swirlAngle) * radius * 0.99
              }
            }
          }
        }
      }

      for (const particle of particlesRef.current) {
        context.save()
        context.globalAlpha = particle.state === 'dissolving' ? 0.6 : 0.9
        context.fillStyle = particle.color
        context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
        context.restore()
      }

      context.fillStyle = '#fff'
      context.font = '12px JetBrains Mono, monospace'
      context.textAlign = 'center'
      context.fillText(`${['Assembling', 'Holding', 'Dissolving'][cycleRef.current]} · ${dissolveMode}`, canvas.width / 2, 20)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [dissolveMode, pixelSize, running, videoRef])

  const handleStart = async () => {
    await start()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stop()
    particlesRef.current = []
    onClose()
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
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full glass px-4 py-2">
          <span className="text-xs text-[var(--text-secondary)]">Pixel Size</span>
          <input type="range" min="0.6" max="2" step="0.1" value={pixelSize} onChange={(event) => setPixelSize(parseFloat(event.target.value))} className="w-24 accent-[var(--accent-color)]" />
          {(['rain', 'explosion', 'swirl'] as const).map((mode) => (
            <button key={mode} onClick={() => setDissolveMode(mode)} className={`rounded-full px-3 py-1 text-xs ${dissolveMode === mode ? 'accent-gradient text-white' : 'glass text-[var(--text-secondary)]'}`}>
              {mode}
            </button>
          ))}
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Pixel Rain</p>
            <p className="mb-4 text-sm text-white/70">Your face assembles from pixels, then dissolves as rain, an explosion, or a swirl. Use the slider to tune pixel size.</p>
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
