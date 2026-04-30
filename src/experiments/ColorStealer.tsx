import { useEffect, useRef, useState } from 'react'
import { Pipette, Play, RefreshCw, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { isPinching, toCanvasPoint } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

const DEFAULT_PALETTE = ['#6C63FF', '#EC4899', '#10B981', '#F59E0B']

function componentToHex(value: number) {
  return value.toString(16).padStart(2, '0')
}

function hexToHsl(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness * 100 }
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0)
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4

  return { h: hue * 60, s: saturation * 100, l: lightness * 100 }
}

function hslString(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`
}

export default function ColorStealer({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [running, setRunning] = useState(false)
  const [currentColor, setCurrentColor] = useState('#6C63FF')
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE)
  const previewColorRef = useRef('#6C63FF')
  const pinchHeldRef = useRef(false)
  const pointerRef = useRef({ x: 0, y: 0 })
  const animRef = useRef<number>(0)

  const applyThemeColor = (hex: string) => {
    const root = document.documentElement
    const { h, s, l } = hexToHsl(hex)
    root.style.setProperty('--accent-color', hex)
    root.style.setProperty('--accent-glow', `hsla(${Math.round(h)}, ${Math.round(Math.min(96, s + 8))}%, ${Math.round(Math.min(75, l + 6))}%, 0.35)`)
    root.style.setProperty('--gradient-start', hex)
    root.style.setProperty('--gradient-mid', hslString((h + 22) % 360, Math.min(96, s + 6), Math.min(82, l + 14)))
    root.style.setProperty('--gradient-end', hslString((h + 52) % 360, Math.min(96, s + 10), Math.max(40, Math.min(76, l + 8))))
  }

  const saveColor = (hex: string) => {
    setCurrentColor(hex)
    applyThemeColor(hex)
    setPalette((colors) => (colors.includes(hex) ? colors : colors.length >= 8 ? [...colors.slice(1), hex] : [...colors, hex]))
  }

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

    const hiddenCanvas = document.createElement('canvas')
    hiddenCanvas.width = 640
    hiddenCanvas.height = 480
    hiddenCanvasRef.current = hiddenCanvas

    const loop = () => {
      const width = canvas.width
      const height = canvas.height

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -width, 0, width, height)
        ctx.restore()

        const hiddenContext = hiddenCanvas.getContext('2d')
        if (hiddenContext) {
          hiddenContext.save()
          hiddenContext.scale(-1, 1)
          hiddenContext.drawImage(video, -hiddenCanvas.width, 0, hiddenCanvas.width, hiddenCanvas.height)
          hiddenContext.restore()
        }
      }

      const hand = detectFrame(performance.now())?.hand?.landmarks?.[0]
      if (hand) {
        const pointer = toCanvasPoint(hand[8], width, height)
        pointerRef.current = pointer

        const hiddenContext = hiddenCanvas.getContext('2d')
        if (hiddenContext) {
          const sampleX = Math.round((pointer.x / width) * hiddenCanvas.width)
          const sampleY = Math.round((pointer.y / height) * hiddenCanvas.height)
          const pixel = hiddenContext.getImageData(
            Math.max(0, Math.min(hiddenCanvas.width - 1, sampleX)),
            Math.max(0, Math.min(hiddenCanvas.height - 1, sampleY)),
            1,
            1,
          ).data

          previewColorRef.current = `#${componentToHex(pixel[0])}${componentToHex(pixel[1])}${componentToHex(pixel[2])}`
        }

        const pinching = isPinching(hand, 0.44)
        if (pinching && !pinchHeldRef.current) {
          saveColor(previewColorRef.current)
        }
        pinchHeldRef.current = pinching
      } else {
        pinchHeldRef.current = false
      }

      const ringColor = previewColorRef.current
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.82)'
      ctx.lineWidth = 3
      ctx.shadowBlur = 15
      ctx.shadowColor = ringColor
      ctx.beginPath()
      ctx.arc(pointerRef.current.x, pointerRef.current.y, 40, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = `${ringColor}88`
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 12px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 4
      ctx.shadowColor = '#000'
      ctx.fillText(ringColor.toUpperCase(), pointerRef.current.x, pointerRef.current.y + 55)
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, running, videoRef])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    onClose()
  }

  const launchError = visionError ?? error

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
          {palette.map((color) => (
            <button
              key={color}
              onClick={() => saveColor(color)}
              className="h-8 w-8 rounded-full border-2 border-white/30 transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            />
          ))}
          <button onClick={() => saveColor(previewColorRef.current)} className="ml-2 flex h-8 w-8 items-center justify-center rounded-full accent-gradient">
            <Pipette className="h-4 w-4 text-white" />
          </button>
          <button onClick={() => setPalette(DEFAULT_PALETTE)} className="flex h-8 w-8 items-center justify-center rounded-full glass">
            <RefreshCw className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          </button>
          <span className="hidden text-xs text-white/70 sm:block">{currentColor.toUpperCase()}</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Color Stealer</p>
            <p className="mb-4 text-sm text-white/70">Point with your index finger to preview a color, then pinch to steal and apply it to the site.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
