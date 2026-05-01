import { useEffect, useRef, useState } from 'react'
import { Play, Square, Settings2 } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { drawPoseSkeleton } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

type Mode = 'bilateral' | 'quadrant' | 'radial' | 'infinite'

export default function MirrorDimension({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<Mode>('radial')
  const [motionBlur, setMotionBlur] = useState(true)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    if (!canvas) return
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
      const currentMode = modeRef.current

      // Background clear with optional motion blur
      ctx.fillStyle = motionBlurRef.current ? 'rgba(10, 10, 20, 0.1)' : '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const pose = results?.pose?.landmarks?.[0]

      if (pose) {
        const cx = w / 2
        const cy = h / 2

        if (currentMode === 'bilateral') {
          // Normal
          ctx.save()
          ctx.translate(w, 0)
          ctx.scale(-1, 1) // Base mirroring for camera
          drawPoseSkeleton(ctx, pose, { color: '#00ffff', glow: true, width: w, height: h })
          ctx.restore()
          
          // Mirrored
          ctx.save()
          drawPoseSkeleton(ctx, pose, { color: '#ff00ff', glow: true, width: w, height: h })
          ctx.restore()
        } 
        else if (currentMode === 'quadrant') {
          for (let i = 0; i < 4; i++) {
            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate((Math.PI / 2) * i)
            ctx.translate(-cx, -cy)
            
            ctx.translate(w, 0)
            ctx.scale(-1, 1)
            drawPoseSkeleton(ctx, pose, { color: `hsl(${i * 90}, 100%, 60%)`, glow: true, width: w, height: h })
            ctx.restore()
          }
        }
        else if (currentMode === 'radial') {
          for (let i = 0; i < 8; i++) {
            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate((Math.PI / 4) * i)
            ctx.translate(-cx, -cy)
            
            ctx.translate(w, 0)
            ctx.scale(-1, 1)
            drawPoseSkeleton(ctx, pose, { color: `hsl(${i * 45}, 100%, 60%)`, lineWidth: 2, glow: true, width: w, height: h })
            ctx.restore()
          }
        }
        else if (currentMode === 'infinite') {
          for (let i = 0; i < 10; i++) {
            ctx.save()
            ctx.translate(cx, cy)
            
            const scale = Math.pow(0.8, i)
            const rotation = (performance.now() * 0.0005) * (i + 1) * 0.1
            
            ctx.rotate(rotation)
            ctx.scale(scale, scale)
            ctx.translate(-cx, -cy)
            
            ctx.translate(w, 0)
            ctx.scale(-1, 1)
            
            ctx.globalAlpha = 1 - (i * 0.08)
            drawPoseSkeleton(ctx, pose, { color: `hsl(${i * 36 + performance.now() * 0.1}, 100%, 60%)`, glow: true, width: w, height: h })
            ctx.restore()
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

  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])
  
  const motionBlurRef = useRef(motionBlur)
  useEffect(() => { motionBlurRef.current = motionBlur }, [motionBlur])

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
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-2 py-2">
          <Settings2 className="w-4 h-4 text-white/50 ml-2" />
          <div className="flex bg-black/40 rounded-full p-1">
            {(['bilateral', 'quadrant', 'radial', 'infinite'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  mode === m ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-white/20 mx-2" />
          <button 
            onClick={() => setMotionBlur(!motionBlur)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              motionBlur ? 'bg-indigo-500/30 text-indigo-200' : 'text-white/50 hover:text-white'
            }`}
          >
            Trails: {motionBlur ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Mirror Dimension</p>
            <p className="mb-4 text-sm text-white/70">Kaleidoscopic body mirroring. Move around to create stunning geometric visual art with your silhouette.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
