import { useEffect, useRef, useState } from 'react'
import { Play, Square, Wind } from 'lucide-react'
import { useVision } from '@/hooks/useVision'

interface Props {
  onClose: () => void
}

export default function BreathPacer({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const stateRef = useRef({
    history: [] as number[], // Shoulder Y history
    lastPeakTime: 0,
    bpm: 12, // User estimated breaths per minute
    targetBpm: 6, // The pacer
    phase: 0, // Pacer phase 0 to 1
    smoothColor: [0, 100, 255] // R, G, B
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
      const now = performance.now()

      // 1. Process Vision
      const results = detectFrame(now)
      const pose = results?.pose?.landmarks?.[0]

      if (pose && pose[11] && pose[12]) {
        // Average shoulder Y (11=left, 12=right)
        // High Y on screen means low shoulder physically, but MediaPipe 0 is top
        const avgY = (pose[11].y + pose[12].y) / 2
        s.history.push(avgY)
        if (s.history.length > 60) s.history.shift() // keep 1s at 60fps
      }

      // 2. Estimate Breathing Rate (Peak detection on smoothed history)
      if (s.history.length === 60) {
         // Simple moving average
         const smoothed = []
         for(let i=2; i<s.history.length-2; i++) {
            smoothed.push((s.history[i-2]+s.history[i-1]+s.history[i]+s.history[i+1]+s.history[i+2])/5)
         }
         
         // Are we currently at a local peak/trough?
         // Inhale = shoulders go UP = Y goes DOWN
         const current = smoothed[smoothed.length - 1]
         const prev = smoothed[smoothed.length - 2]
         
         // Simple threshold for "moving down" to "moving up" transition (max inhale point)
         if (prev < current && smoothed[smoothed.length - 3] > prev) {
            // Found a peak!
            if (s.lastPeakTime > 0 && now - s.lastPeakTime > 1500) { // minimum 1.5s between breaths
               const durationMs = now - s.lastPeakTime
               const newBpm = 60000 / durationMs
               // Smooth the BPM reading
               s.bpm += (newBpm - s.bpm) * 0.1
            }
            s.lastPeakTime = now
         }
      }

      // 3. Update Pacer Phase
      // The guide ring breathes at targetBpm
      const secondsPerBreath = 60 / s.targetBpm
      s.phase = (now % (secondsPerBreath * 1000)) / (secondsPerBreath * 1000)

      // 4. Update Colors based on User BPM
      // Calm (bpm < 8) = Green (0, 255, 100)
      // Alert (bpm > 15) = Blue (0, 100, 255)
      const calmRatio = Math.max(0, Math.min(1, (15 - s.bpm) / 7))
      const targetR = 0
      const targetG = 100 + calmRatio * 155
      const targetB = 255 - calmRatio * 155

      s.smoothColor[0] += (targetR - s.smoothColor[0]) * 0.01
      s.smoothColor[1] += (targetG - s.smoothColor[1]) * 0.01
      s.smoothColor[2] += (targetB - s.smoothColor[2]) * 0.01

      const r = Math.round(s.smoothColor[0])
      const g = Math.round(s.smoothColor[1])
      const b = Math.round(s.smoothColor[2])
      const colorStr = `rgb(${r}, ${g}, ${b})`

      // 5. Draw
      // Background
      ctx.fillStyle = `rgba(${r * 0.1}, ${g * 0.1}, ${b * 0.1}, 0.2)` // Fade effect
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.05
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      // Pacer Ring (Sine wave expansion)
      // phase 0 to 0.5 = inhale (expand)
      // phase 0.5 to 1 = exhale (contract)
      const scale = Math.sin(s.phase * Math.PI * 2 - Math.PI/2) * 0.5 + 0.5 // 0 to 1 smooth
      
      const cx = w / 2
      const cy = h / 2
      const maxRadius = Math.min(w, h) * 0.4
      const radius = 100 + scale * maxRadius

      // Outer glow
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.05)`
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`
      ctx.stroke()

      // Inner ring
      ctx.beginPath()
      ctx.arc(cx, cy, radius - 20, 0, Math.PI * 2)
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`
      ctx.shadowBlur = 20
      ctx.shadowColor = colorStr
      ctx.stroke()
      ctx.shadowBlur = 0

      // Text feedback
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      ctx.font = '32px sans-serif'
      ctx.fillText(s.phase < 0.5 ? 'INHALE' : 'EXHALE', cx, cy - 20)
      
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '16px sans-serif'
      ctx.fillText(`Your Rate: ${Math.round(s.bpm)} bpm`, cx, cy + 30)

      // Particles flowing towards/away from center
      for(let i=0; i<3; i++) {
         const angle = Math.random() * Math.PI * 2
         const dist = s.phase < 0.5 ? maxRadius + 100 : radius // Inhale pulls in, exhale pushes out
         const px = cx + Math.cos(angle) * dist
         const py = cy + Math.sin(angle) * dist
         
         ctx.beginPath()
         ctx.arc(px, py, 2, 0, Math.PI*2)
         ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`
         ctx.fill()
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [detectFrame, running])

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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a0f]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start Pacer
          </button>
        ) : (
          <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Wind className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Follow the expanding circle. The color shifts to green as your breathing slows.</span>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Breath Pacer</p>
            <p className="mb-4 text-sm text-white/70">A calming breath guide that tracks your shoulder movements to estimate your breathing rate. Sync your breath to the expanding circle to find calm.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Begin Meditation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
