import { useEffect, useRef, useState } from 'react'
import { Play, Square, Layers, Snowflake } from 'lucide-react'
import { useVision } from '@/hooks/useVision'

interface Props {
  onClose: () => void
}

export default function TimeWarpMirror({ onClose }: Props) {
  const { videoRef, startVision, stopVision, visionError, error } = useVision({ cameraOnly: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [layers, setLayers] = useState<1 | 2 | 3>(1)
  const [frozen, setFrozen] = useState(false)
  const animRef = useRef<number>(0)

  // Use a smaller resolution for the frame buffer to prevent memory exhaustion
  const BUF_W = 320
  const BUF_H = 240
  // 9 seconds at ~30fps = 270 frames
  const BUF_SIZE = 270
  
  const bufferRef = useRef<(ImageData | null)[]>(new Array(BUF_SIZE).fill(null))
  const headRef = useRef(0)
  const frozenFrameRef = useRef<ImageData | null>(null)

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Offscreen canvas for downscaling and reading pixels
    const txCanvas = document.createElement('canvas')
    txCanvas.width = BUF_W
    txCanvas.height = BUF_H
    const txCtx = txCanvas.getContext('2d', { willReadFrequently: true })
    if (!txCtx) return

    // Offscreen canvas for drawing ghost frames
    const ghostCanvas = document.createElement('canvas')
    ghostCanvas.width = BUF_W
    ghostCanvas.height = BUF_H
    const ghostCtx = ghostCanvas.getContext('2d')

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Throttle frame capture to ~30fps even if requestAnimationFrame runs at 60fps
    let lastCapture = 0

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const now = performance.now()

      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        // Draw live feed
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()

        // Capture frame to buffer every ~33ms (30fps)
        if (now - lastCapture > 33) {
          txCtx.save()
          txCtx.scale(-1, 1)
          txCtx.drawImage(video, -BUF_W, 0, BUF_W, BUF_H)
          txCtx.restore()
          
          const frameData = txCtx.getImageData(0, 0, BUF_W, BUF_H)
          
          if (!frozen) {
            headRef.current = (headRef.current + 1) % BUF_SIZE
            bufferRef.current[headRef.current] = frameData
          } else if (!frozenFrameRef.current) {
            // Freeze the current oldest requested layer
            const oldestDelay = layers * 90 // 1=3s, 2=6s, 3=9s
            let idx = (headRef.current - oldestDelay + BUF_SIZE) % BUF_SIZE
            if (idx < 0) idx += BUF_SIZE
            frozenFrameRef.current = bufferRef.current[idx] || frameData
          }
          
          lastCapture = now
        }

        // Draw Ghost Layers
        ctx.globalCompositeOperation = 'screen'
        
        for (let l = 1; l <= layers; l++) {
          const delayFrames = l * 90 // 3 seconds per layer at 30fps
          
          let ghostData: ImageData | null = null
          
          if (frozen && l === layers && frozenFrameRef.current) {
             ghostData = frozenFrameRef.current
          } else {
             let targetIdx = (headRef.current - delayFrames + BUF_SIZE) % BUF_SIZE
             if (targetIdx < 0) targetIdx += BUF_SIZE
             ghostData = bufferRef.current[targetIdx]
          }

          if (ghostData && ghostCtx) {
            // Apply a tint based on the layer depth
            // We manipulate pixels manually for tinting
            const tinted = new ImageData(new Uint8ClampedArray(ghostData.data), BUF_W, BUF_H)
            const d = tinted.data
            
            for(let i=0; i<d.length; i+=4) {
              const r = d[i]
              const g = d[i+1]
              const b = d[i+2]
              const gray = r * 0.3 + g * 0.59 + b * 0.11
              
              if (l === 1) { // Cyan
                d[i] = gray * 0.2
                d[i+1] = gray
                d[i+2] = gray
              } else if (l === 2) { // Magenta
                d[i] = gray
                d[i+1] = gray * 0.2
                d[i+2] = gray
              } else { // Yellow
                d[i] = gray
                d[i+1] = gray
                d[i+2] = gray * 0.2
              }
              // Add scanline gap
              if (Math.floor((i/4)/BUF_W) % 4 === 0) {
                 d[i+3] = 0 // transparent scanline
              } else {
                 d[i+3] = 150 // Semi-transparent overall
              }
            }
            
            ghostCtx.putImageData(tinted, 0, 0)
            
            ctx.save()
            ctx.globalAlpha = 0.8
            ctx.drawImage(ghostCanvas, 0, 0, w, h)
            ctx.restore()
          }
        }
        
        ctx.globalCompositeOperation = 'source-over'
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [running, layers, frozen])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    // Reset buffer
    bufferRef.current.fill(null)
    frozenFrameRef.current = null
    setFrozen(false)
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
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <div className="flex bg-black/40 rounded-full p-1 ml-4 items-center">
              <Layers className="w-4 h-4 text-white/50 ml-2 mr-1" />
              {([1, 2, 3] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLayers(l)}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    layers === l ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {l * 3}s Delay
                </button>
              ))}
            </div>
            <button 
              onClick={() => {
                if (frozen) frozenFrameRef.current = null;
                setFrozen(!frozen)
              }}
              className={`ml-4 flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                frozen ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'glass text-white'
              }`}
            >
              <Snowflake className="w-4 h-4" /> {frozen ? 'UNFREEZE GHOST' : 'FREEZE GHOST'}
            </button>
          </>
        )}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Time Warp Mirror</p>
            <p className="mb-4 text-sm text-white/70">Dance with your own ghost. See your live self alongside delayed temporal echoes from up to 9 seconds in the past.</p>
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
