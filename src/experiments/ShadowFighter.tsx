import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { drawPoseSkeleton } from '@/lib/landmarks'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

export default function ShadowFighter({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const synthRef = useRef<Tone.Synth | null>(null)
  const hitSynthRef = useRef<Tone.MembraneSynth | null>(null)

  // Game State
  const gameStateRef = useRef({
    playerHp: 100,
    cpuHp: 100,
    playerAction: 'idle',
    cpuAction: 'idle',
    cpuTimer: 0,
    lastWrists: { lx: 0, ly: 0, rx: 0, ry: 0 },
    hitCooldown: 0,
    flashOpacity: 0
  })

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const synth = new Tone.Synth({ oscillator: { type: 'square' } }).toDestination()
    const hitSynth = new Tone.MembraneSynth().toDestination()
    synthRef.current = synth
    hitSynthRef.current = hitSynth

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const state = gameStateRef.current

      // Background
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, w, h)
      
      // Grid
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2
      for(let i=0; i<w; i+=50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke() }
      for(let i=0; i<h; i+=50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke() }

      const results = detectFrame(performance.now())
      const pose = results?.pose?.landmarks?.[0]

      if (video.readyState >= 2 && pose) {
        // Player Pose Tracking
        ctx.save()
        // Draw the player pose scaled and shifted to the left side
        ctx.translate(w * 0.3, h * 0.6)
        ctx.scale(w * 0.4, h * 0.4) // Approximate scaling
        
        // Offset center
        ctx.translate(-0.5, -0.5)

        // Draw Player Skeleton
        const scaledPose = pose.map(p => ({ x: 1 - p.x, y: p.y, z: p.z })) // Mirror
        drawPoseSkeleton(ctx, scaledPose, { color: '#00ffff', lineWidth: 8, glow: true })
        ctx.restore()

        // Velocity & Action Detection
        const lw = scaledPose[15] // left wrist
        const rw = scaledPose[16] // right wrist
        
        const dlx = lw.x - state.lastWrists.lx
        const drx = rw.x - state.lastWrists.rx

        state.playerAction = 'idle'
        
        // Punch threshold (moving right rapidly, since mirrored)
        if (dlx > 0.05 || drx > 0.05) {
          state.playerAction = 'punch'
        }

        // Blocking (wrists crossed in front of chest)
        const shoulders = (scaledPose[11].x + scaledPose[12].x) / 2
        if (Math.abs(lw.x - rw.x) < 0.1 && lw.x > shoulders) {
          state.playerAction = 'block'
        }

        state.lastWrists = { lx: lw.x, ly: lw.y, rx: rw.x, ry: rw.y }
      }

      // CPU AI
      state.cpuTimer++
      if (state.cpuTimer > 60) {
        state.cpuAction = Math.random() > 0.5 ? 'punch' : 'idle'
        state.cpuTimer = 0
        
        // CPU attacks Player
        if (state.cpuAction === 'punch') {
          if (state.playerAction !== 'block') {
            state.playerHp -= 10
            state.flashOpacity = 1.0
            hitSynth.triggerAttackRelease("C2", "8n")
            ctx.translate((Math.random()-0.5)*20, (Math.random()-0.5)*20) // screen shake
          } else {
            hitSynth.triggerAttackRelease("C4", "16n") // Blocked sound
          }
        }
      } else if (state.cpuTimer > 20) {
        state.cpuAction = 'idle'
      }

      // Player attacks CPU
      if (state.playerAction === 'punch' && state.hitCooldown <= 0 && state.cpuHp > 0) {
        state.cpuHp -= 5
        state.hitCooldown = 15
        hitSynth.triggerAttackRelease("G2", "8n")
      }
      if (state.hitCooldown > 0) state.hitCooldown--

      // Draw CPU Fighter
      ctx.save()
      ctx.translate(w * 0.7, h * 0.6)
      
      const bounce = Math.sin(Date.now() * 0.01) * 20
      
      ctx.strokeStyle = state.cpuAction === 'punch' ? '#ff0000' : '#ff00ff'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowBlur = 20
      ctx.shadowColor = ctx.strokeStyle
      
      // CPU Body
      ctx.beginPath()
      ctx.moveTo(0, bounce - 100) // Head
      ctx.lineTo(0, bounce + 100) // Spine
      // Legs
      ctx.lineTo(-40, bounce + 200)
      ctx.moveTo(0, bounce + 100)
      ctx.lineTo(40, bounce + 200)
      
      // Arms
      ctx.moveTo(0, bounce - 50)
      if (state.cpuAction === 'punch') {
        ctx.lineTo(-150, bounce - 50) // Punching out
      } else {
        ctx.lineTo(-50, bounce + 50) // Idle arm
      }
      
      ctx.stroke()
      
      // CPU Head
      ctx.beginPath()
      ctx.arc(0, bounce - 130, 30, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // UI (Health Bars)
      ctx.fillStyle = '#fff'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('YOU', 50, 50)
      ctx.textAlign = 'right'
      ctx.fillText('CPU', w - 50, 50)

      ctx.fillStyle = '#333'
      ctx.fillRect(50, 70, 300, 20)
      ctx.fillRect(w - 350, 70, 300, 20)

      ctx.fillStyle = '#00ffff'
      ctx.fillRect(50, 70, Math.max(0, state.playerHp) * 3, 20)
      ctx.fillStyle = '#ff00ff'
      ctx.fillRect(w - 50 - Math.max(0, state.cpuHp) * 3, 70, Math.max(0, state.cpuHp) * 3, 20)

      // Damage Flash
      if (state.flashOpacity > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${state.flashOpacity})`
        ctx.fillRect(0, 0, w, h)
        state.flashOpacity -= 0.1
      }
      
      // Win/Loss State
      if (state.playerHp <= 0 || state.cpuHp <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = state.playerHp <= 0 ? '#ff0000' : '#00ffff'
        ctx.font = 'bold 64px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(state.playerHp <= 0 ? 'YOU LOSE' : 'YOU WIN!', w/2, h/2)
      }

      ctx.resetTransform()
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (synthRef.current) synthRef.current.dispose()
      if (hitSynthRef.current) hitSynthRef.current.dispose()
    }
  }, [detectFrame, running])

  const handleStart = async () => {
    await Tone.start()
    await startVision()
    gameStateRef.current.playerHp = 100
    gameStateRef.current.cpuHp = 100
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

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Shadow Fighter</p>
            <p className="mb-4 text-sm text-white/70">Throw real punches and cross your arms to block. Defeat the CPU opponent in this neon boxing game.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Fight
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
