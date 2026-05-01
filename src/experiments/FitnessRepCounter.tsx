import { useEffect, useRef, useState } from 'react'
import { Play, Square, Activity } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { drawPoseSkeleton } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

type Exercise = 'squats' | 'pushups'

function calculateAngle(a: { x: number, y: number }, b: { x: number, y: number }, c: { x: number, y: number }) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs(radians * 180.0 / Math.PI)
  if (angle > 180.0) angle = 360.0 - angle
  return angle
}

export default function FitnessRepCounter({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [exercise, setExercise] = useState<Exercise>('squats')
  const animRef = useRef<number>(0)

  // Tracker state
  const stateRef = useRef({
    reps: 0,
    stage: 'up', // 'up' or 'down'
    feedback: 'Ready',
    angle: 0
  })

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
      const s = stateRef.current

      ctx.clearRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.4)'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const pose = results?.pose?.landmarks?.[0]

      if (pose) {
        // Draw standard skeleton
        ctx.save()
        ctx.scale(-1, 1)
        ctx.translate(-w, 0)
        drawPoseSkeleton(ctx, pose, { color: '#ffffff', glow: false, width: w, height: h })
        ctx.restore()

        const currentExercise = exerciseRef.current
        let a, b, c

        if (currentExercise === 'squats') {
          // Use left side (23=hip, 25=knee, 27=ankle)
          a = pose[23]
          b = pose[25]
          c = pose[27]
        } else {
          // Pushups (11=shoulder, 13=elbow, 15=wrist)
          a = pose[11]
          b = pose[13]
          c = pose[15]
        }

        if (a && b && c) {
          // Note: coordinates are normalized 0-1, but ratio is same so angle math works
          const angle = calculateAngle(
            { x: a.x, y: a.y },
            { x: b.x, y: b.y },
            { x: c.x, y: c.y }
          )
          
          // Smooth the angle reading slightly
          s.angle += (angle - s.angle) * 0.2

          // Highlight the tracking joints
          ctx.save()
          ctx.scale(-1, 1)
          ctx.translate(-w, 0)
          
          ctx.beginPath()
          ctx.moveTo(a.x * w, a.y * h)
          ctx.lineTo(b.x * w, b.y * h)
          ctx.lineTo(c.x * w, c.y * h)
          ctx.strokeStyle = '#00ffff'
          ctx.lineWidth = 6
          ctx.stroke()
          
          ctx.fillStyle = '#ff00ff'
          ;[a, b, c].forEach(pt => {
            ctx.beginPath()
            ctx.arc(pt.x * w, pt.y * h, 8, 0, Math.PI*2)
            ctx.fill()
          })
          
          // Draw angle text near the joint
          ctx.save()
          ctx.scale(-1, 1) // Un-mirror text
          ctx.fillStyle = '#fff'
          ctx.font = '20px sans-serif'
          ctx.fillText(`${Math.round(s.angle)}°`, -(b.x * w) + 15, b.y * h)
          ctx.restore()
          
          ctx.restore()

          // Rep Logic
          if (currentExercise === 'squats') {
            if (s.angle > 160) {
              if (s.stage === 'down') {
                s.reps++
                s.stage = 'up'
                s.feedback = 'Good rep!'
              } else {
                s.feedback = 'Go down'
              }
            } else if (s.angle < 100) {
              s.stage = 'down'
              s.feedback = 'Push up!'
            }
          } else if (currentExercise === 'pushups') {
            if (s.angle > 160) {
              if (s.stage === 'down') {
                s.reps++
                s.stage = 'up'
                s.feedback = 'Good rep!'
              } else {
                s.feedback = 'Go down'
              }
            } else if (s.angle < 90) {
              s.stage = 'down'
              s.feedback = 'Push up!'
            }
          }
        }
      }

      // Draw UI
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(20, 20, 250, 120)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 48px sans-serif'
      ctx.fillText(`Reps: ${s.reps}`, 40, 70)
      
      ctx.fillStyle = s.feedback === 'Good rep!' ? '#00ffff' : '#ff00ff'
      ctx.font = '24px sans-serif'
      ctx.fillText(s.feedback, 40, 110)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, running])

  const exerciseRef = useRef(exercise)
  useEffect(() => { 
    exerciseRef.current = exercise
    stateRef.current.reps = 0 // reset on swap
    stateRef.current.stage = 'up'
    stateRef.current.feedback = 'Ready'
  }, [exercise])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    stateRef.current.reps = 0
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
          <Activity className="w-4 h-4 text-white/50 ml-2" />
          <div className="flex bg-black/40 rounded-full p-1">
            {(['squats', 'pushups'] as Exercise[]).map(e => (
              <button
                key={e}
                onClick={() => setExercise(e)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  exercise === e ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Fitness Rep Counter</p>
            <p className="mb-4 text-sm text-white/70">Calculates joint angles to automatically count reps for squats and push-ups.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Tracking
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
