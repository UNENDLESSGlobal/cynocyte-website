import { useEffect, useRef, useState } from 'react'
import { Play, Square, Music, Image as ImageIcon, Clock } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { clamp, isPinching, toCanvasPoint, type Point } from '@/lib/landmarks'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onClose: () => void
}

interface AppIcon {
  id: string
  name: string
  icon: React.ElementType
  color: string
  x: number
  y: number
}

const APPS: AppIcon[] = [
  { id: 'music', name: 'Music', icon: Music, color: '#ec4899', x: 0.25, y: 0.4 },
  { id: 'gallery', name: 'Gallery', icon: ImageIcon, color: '#3b82f6', x: 0.5, y: 0.4 },
  { id: 'clock', name: 'Clock', icon: Clock, color: '#10b981', x: 0.75, y: 0.4 },
]

export default function InvisibleTouchscreen({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const [activeApp, setActiveApp] = useState<string | null>(null)
  const [hoverApp, setHoverApp] = useState<string | null>(null)
  
  // Ref states for canvas rendering loop
  const cursorRef = useRef<Point | null>(null)
  const pinchRef = useRef(false)
  const hoverStartRef = useRef<number>(0)
  const activeAppRef = useRef<string | null>(null)
  const trailRef = useRef<{x:number, y:number, life:number}[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeAppRef.current = activeApp
  }, [activeApp])

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

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      // Dynamic tilt based on cursor position
      if (cursorRef.current && containerRef.current) {
        const cx = w / 2
        const cy = h / 2
        const tiltX = (cursorRef.current.y - cy) / cy * 15
        const tiltY = -(cursorRef.current.x - cx) / cx * 15
        containerRef.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
      } else if (containerRef.current) {
        containerRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`
      }

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.65)'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const hand = results?.hand?.landmarks?.[0]
      let currentHover: string | null = null

      if (hand) {
        const tip = toCanvasPoint(hand[8], w, h)
        cursorRef.current = tip
        
        const pinching = isPinching(hand, 0.4)
        const justPinched = pinching && !pinchRef.current
        pinchRef.current = pinching

        // Cursor trail
        ctx.save()
        trailRef.current.push({ x: tip.x, y: tip.y, life: 1 })
        if (trailRef.current.length > 20) trailRef.current.shift()
        
        ctx.beginPath()
        if (trailRef.current.length > 0) {
          ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y)
          for(let i=1; i<trailRef.current.length; i++) {
            ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y)
          }
        }
        ctx.strokeStyle = pinching ? 'rgba(125, 249, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
        ctx.restore()

        // Draw cursor
        ctx.save()
        ctx.fillStyle = pinching ? '#7df9ff' : '#ffffff'
        ctx.shadowBlur = pinching ? 20 : 10
        ctx.shadowColor = ctx.fillStyle
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, pinching ? 8 : 12, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.strokeStyle = ctx.fillStyle
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, 20, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()

        // Check app interactions if no app is active
        if (!activeAppRef.current) {
          for (const app of APPS) {
            const appX = app.x * w
            const appY = app.y * h
            const dist = Math.hypot(tip.x - appX, tip.y - appY)
            
            if (dist < 60) {
              currentHover = app.id
              if (justPinched) {
                setActiveApp(app.id)
              }
              break
            }
          }
        } else {
          // Check close button if app is active
          const closeX = w / 2
          const closeY = h * 0.8
          const dist = Math.hypot(tip.x - closeX, tip.y - closeY)
          if (dist < 50 && justPinched) {
            setActiveApp(null)
          }
        }
      } else {
        cursorRef.current = null
        pinchRef.current = false
      }

      // Update hover state
      setHoverApp((prev) => {
        if (prev !== currentHover) {
          hoverStartRef.current = Date.now()
        }
        return currentHover
      })

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
    setActiveApp(null)
    onClose()
  }

  const launchError = visionError ?? error

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ minHeight: '60vh' }}>
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

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {/* Holographic UI Overlay */}
      {running && (
        <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none transition-transform duration-75 ease-out">
          <AnimatePresence>
            {!activeApp && APPS.map((app) => {
              const isHovered = hoverApp === app.id
              const Icon = app.icon
              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isHovered ? 1.2 : 1,
                    top: `${app.y * 100}%`,
                    left: `${app.x * 100}%`
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
                >
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center transition-shadow"
                    style={{ 
                      backgroundColor: app.color,
                      boxShadow: isHovered ? `0 0 30px ${app.color}80` : 'none'
                    }}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-white font-medium text-sm drop-shadow-md">
                    {app.name}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>

          <AnimatePresence>
            {activeApp && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="absolute inset-10 glass rounded-3xl p-8 flex flex-col items-center border border-white/20 shadow-2xl"
              >
                <h2 className="text-3xl font-bold text-white mb-8">
                  {APPS.find(a => a.id === activeApp)?.name} App
                </h2>
                
                <div className="flex-1 w-full flex items-center justify-center">
                  <p className="text-white/60">Pinch the close button to exit</p>
                </div>

                <div className="absolute bottom-10 flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                    <Square className="w-6 h-6 text-red-500" />
                  </div>
                  <span className="text-red-400 font-medium text-sm">Close</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Invisible Touchscreen</p>
            <p className="mb-4 text-sm text-white/70">Hover over app icons and pinch to open them.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
