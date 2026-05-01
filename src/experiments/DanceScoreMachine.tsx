import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { drawPoseSkeleton } from '@/lib/landmarks'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

// Simple angle calculation for 2D points relative to center (0,0)
function getAngle(x: number, y: number) {
  return Math.atan2(y, x) * (180 / Math.PI)
}

function angleDiff(a: number, b: number) {
  let diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

const TARGET_POSES = [
  { name: 'T-Pose', leftArm: 180, rightArm: 0, time: 4000 },
  { name: 'Y-Pose', leftArm: 225, rightArm: -45, time: 4000 },
  { name: 'Disco', leftArm: 270, rightArm: 45, time: 4000 },
  { name: 'Dab', leftArm: 200, rightArm: 160, time: 4000 }
]

export default function DanceScoreMachine({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const synthRef = useRef<Tone.Synth | null>(null)

  const stateRef = useRef({
    score: 0,
    combo: 0,
    poseIndex: 0,
    poseStartTime: 0,
    lastScoreTime: 0,
    matchPercentage: 0
  })

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const synth = new Tone.Synth({ oscillator: { type: 'triangle' } }).toDestination()
    synthRef.current = synth

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener('resize', resize)

    // Audio beat loop
    const loopPattern = new Tone.Loop((time) => {
      synth.triggerAttackRelease("C3", "8n", time)
      synth.triggerAttackRelease("G3", "8n", time + 0.5)
    }, "1n").start(0)

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const state = stateRef.current
      const now = performance.now()

      // Progression
      const currentPose = TARGET_POSES[state.poseIndex]
      if (now - state.poseStartTime > currentPose.time) {
        state.poseIndex = (state.poseIndex + 1) % TARGET_POSES.length
        state.poseStartTime = now
        if (state.matchPercentage < 50) {
          state.combo = 0 // Break combo if missed
        }
      }

      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const pose = results?.pose?.landmarks?.[0]

      if (pose) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.translate(-w, 0)
        drawPoseSkeleton(ctx, pose, { color: '#ffffff', glow: false, width: w, height: h })
        ctx.restore()

        // Calculate arm angles
        // MediaPipe Pose: 11=L.Shoulder, 15=L.Wrist. 12=R.Shoulder, 16=R.Wrist
        // Coordinates are mirrored, so we must be careful.
        // Actually, let's just use raw video coordinates.
        const ls = pose[11], lw = pose[15]
        const rs = pose[12], rw = pose[16]
        
        // Since image is mirrored horizontally, left arm is physically on the right side of the image
        // Math.atan2(y, x) -> Down is +Y, Right is +X.
        // Left arm relative to shoulder:
        const leftArmAngle = getAngle(-(lw.x - ls.x), lw.y - ls.y)
        const rightArmAngle = getAngle(-(rw.x - rs.x), rw.y - rs.y)

        // Compare to target
        const diffL = angleDiff(leftArmAngle, currentPose.leftArm)
        const diffR = angleDiff(rightArmAngle, currentPose.rightArm)
        
        const avgDiff = (diffL + diffR) / 2
        
        // Map 0-45 degrees to 100-0%
        state.matchPercentage = Math.max(0, 100 - (avgDiff * 2.22))

        // Scoring
        if (state.matchPercentage > 85 && now - state.lastScoreTime > 100) {
          state.score += 10 * (1 + state.combo * 0.1)
          state.lastScoreTime = now
          state.combo++
          if (state.combo % 10 === 0) {
            synth.triggerAttackRelease("C5", "16n") // Combo sound
          }
        }
      }

      // Draw Ghost Target
      ctx.save()
      ctx.translate(w/2, h/2)
      ctx.globalAlpha = 0.3 + (state.matchPercentage / 100) * 0.7
      
      const ghostColor = state.matchPercentage > 85 ? '#00ff00' : '#00ffff'
      ctx.strokeStyle = ghostColor
      ctx.lineWidth = 15
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowBlur = 20
      ctx.shadowColor = ghostColor

      // Spine & Head
      ctx.beginPath()
      ctx.moveTo(0, -100) // Head
      ctx.lineTo(0, 100) // Spine
      // Legs
      ctx.lineTo(-40, 300)
      ctx.moveTo(0, 100)
      ctx.lineTo(40, 300)
      
      // Arms (from shoulder at Y=-50)
      const armLength = 150
      const targetL = currentPose.leftArm * (Math.PI / 180)
      const targetR = currentPose.rightArm * (Math.PI / 180)
      
      ctx.moveTo(0, -50)
      ctx.lineTo(Math.cos(targetL) * armLength, -50 + Math.sin(targetL) * armLength)
      ctx.moveTo(0, -50)
      ctx.lineTo(Math.cos(targetR) * armLength, -50 + Math.sin(targetR) * armLength)
      
      ctx.stroke()
      
      ctx.beginPath()
      ctx.arc(0, -150, 40, 0, Math.PI*2)
      ctx.stroke()
      ctx.restore()

      // UI
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 32px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(currentPose.name, w/2, 80)
      
      // Timer bar
      const timeLeft = currentPose.time - (now - state.poseStartTime)
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.fillRect(w/2 - 200, 100, 400, 10)
      ctx.fillStyle = '#fff'
      ctx.fillRect(w/2 - 200, 100, (timeLeft / currentPose.time) * 400, 10)

      ctx.textAlign = 'left'
      ctx.fillStyle = '#00ffff'
      ctx.font = 'bold 48px sans-serif'
      ctx.fillText(`SCORE: ${Math.floor(state.score)}`, 40, 80)
      
      ctx.fillStyle = '#ff00ff'
      ctx.font = 'bold 32px sans-serif'
      ctx.fillText(`COMBO x${state.combo}`, 40, 130)

      // Match %
      ctx.fillStyle = ghostColor
      ctx.textAlign = 'right'
      ctx.fillText(`MATCH: ${Math.floor(state.matchPercentage)}%`, w - 40, 80)

      if (state.matchPercentage > 85) {
        ctx.fillStyle = '#00ff00'
        ctx.font = 'bold 64px sans-serif'
        ctx.fillText('PERFECT!', w - 40, 150)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      Tone.Transport.stop()
      loopPattern.dispose()
      if (synthRef.current) synthRef.current.dispose()
    }
  }, [detectFrame, running])

  const handleStart = async () => {
    await Tone.start()
    Tone.Transport.start()
    await startVision()
    stateRef.current.score = 0
    stateRef.current.combo = 0
    stateRef.current.poseStartTime = performance.now()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    Tone.Transport.stop()
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

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Dance Score Machine</p>
            <p className="mb-4 text-sm text-white/70">Match your body pose to the glowing neon silhouette. Rack up high scores and combos!</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Dancing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
