import { useEffect, useRef, useState } from 'react'
import { Play, Square, Swords } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

export default function GestureFighter2P({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const synthRef = useRef<Tone.PolySynth | null>(null)

  const stateRef = useRef({
    p1: { hp: 100, isBlocking: false, hitFlash: 0 },
    p2: { hp: 100, isBlocking: false, hitFlash: 0 },
    state: 'playing', // playing, p1win, p2win
    lastHitTime: 0
  })

  // To calculate velocity of fists
  const lastFistsRef = useRef({
    p1: { l: { x: 0, y: 0 }, r: { x: 0, y: 0 } },
    p2: { l: { x: 0, y: 0 }, r: { x: 0, y: 0 } }
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

    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
    }).toDestination()
    synthRef.current.volume.value = -10

    const playSound = (type: 'hit' | 'block' | 'ko') => {
      if (!synthRef.current) return
      if (type === 'hit') synthRef.current.triggerAttackRelease(['C3', 'E3'], '16n')
      if (type === 'block') synthRef.current.triggerAttackRelease('A4', '32n')
      if (type === 'ko') synthRef.current.triggerAttackRelease(['C2', 'G2'], '2n')
    }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      // Background
      ctx.fillStyle = '#060610'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.2
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const poses = results?.pose?.landmarks ?? []

      // Sort poses by X position (Player 1 left, Player 2 right)
      // Since video is mirrored, smaller X landmark is physically on the right, 
      // but on-screen mirrored it's on the left. Wait: 
      // Mirrored X = (1 - landmark.x) * w
      // So larger landmark.x = smaller screen X (Left side).
      const sortedPoses = [...poses].sort((a, b) => b[0].x - a[0].x)

      if (sortedPoses.length >= 2 && s.state === 'playing') {
        const p1Pose = sortedPoses[0]
        const p2Pose = sortedPoses[1]

        const checkBlock = (pose: any) => {
          if (!pose[15] || !pose[16] || !pose[11] || !pose[12]) return false
          if (pose[15].visibility < 0.5 || pose[16].visibility < 0.5) return false
          // Cross arms: L wrist X > R wrist X (in normal coords, or swapped in mirrored)
          // Also wrists should be relatively high (above shoulders)
          const wristsCrossed = Math.abs(pose[15].x - pose[16].x) < 0.1
          const wristsHigh = pose[15].y < pose[11].y + 0.1 && pose[16].y < pose[12].y + 0.1
          return wristsCrossed && wristsHigh
        }

        s.p1.isBlocking = checkBlock(p1Pose)
        s.p2.isBlocking = checkBlock(p2Pose)

        const drawFighter = (pose: any, isP1: boolean) => {
          const color = isP1 ? '#00ffff' : '#ff00ff'
          const state = isP1 ? s.p1 : s.p2
          
          ctx.strokeStyle = state.isBlocking ? '#ffffff' : color
          ctx.lineWidth = state.isBlocking ? 6 : 4
          ctx.shadowBlur = 10
          ctx.shadowColor = ctx.strokeStyle

          const drawBone = (p1: number, p2: number) => {
            if (pose[p1] && pose[p2] && pose[p1].visibility > 0.5 && pose[p2].visibility > 0.5) {
              ctx.beginPath()
              ctx.moveTo((1 - pose[p1].x) * w, pose[p1].y * h)
              ctx.lineTo((1 - pose[p2].x) * w, pose[p2].y * h)
              ctx.stroke()
            }
          }
          
          drawBone(11, 12); drawBone(11, 13); drawBone(13, 15); drawBone(12, 14); drawBone(14, 16)
          drawBone(11, 23); drawBone(12, 24); drawBone(23, 24)
          drawBone(23, 25); drawBone(25, 27); drawBone(24, 26); drawBone(26, 28)

          // Head
          if (pose[0] && pose[0].visibility > 0.5) {
            ctx.beginPath()
            ctx.arc((1 - pose[0].x) * w, pose[0].y * h, 20, 0, Math.PI*2)
            ctx.fillStyle = ctx.strokeStyle
            if (state.hitFlash > 0) {
              ctx.fillStyle = '#ffffff'
              state.hitFlash--
            }
            ctx.fill()
          }
          ctx.shadowBlur = 0
        }

        drawFighter(p1Pose, true)
        drawFighter(p2Pose, false)

        // Collision Logic
        const now = performance.now()
        if (now - s.lastHitTime > 500) { // 500ms iframe
          // Check if P1 hits P2
          const checkHit = (attacker: any, defender: any, defState: any) => {
            const fists = [15, 16] // Wrists
            const targets = [0, 11, 12, 23, 24] // Head, shoulders, hips
            
            for (let f of fists) {
              if (attacker[f] && attacker[f].visibility > 0.5) {
                const fx = (1 - attacker[f].x) * w
                const fy = attacker[f].y * h
                
                for (let t of targets) {
                  if (defender[t] && defender[t].visibility > 0.5) {
                    const tx = (1 - defender[t].x) * w
                    const ty = defender[t].y * h
                    if (Math.hypot(fx - tx, fy - ty) < 80) { // 80px hitbox
                      if (defState.isBlocking) {
                         defState.hp -= 2
                         playSound('block')
                      } else {
                         defState.hp -= 10
                         playSound('hit')
                      }
                      defState.hitFlash = 10
                      s.lastHitTime = now
                      return true
                    }
                  }
                }
              }
            }
            return false
          }

          if (checkHit(p1Pose, p2Pose, s.p2)) {
            if (s.p2.hp <= 0) { s.state = 'p1win'; playSound('ko') }
          } else if (checkHit(p2Pose, p1Pose, s.p1)) {
            if (s.p1.hp <= 0) { s.state = 'p2win'; playSound('ko') }
          }
        }
      } else if (sortedPoses.length === 1 && s.state === 'playing') {
         // Draw single player waiting
         ctx.fillStyle = '#fff'
         ctx.font = '24px sans-serif'
         ctx.textAlign = 'center'
         ctx.fillText('Waiting for Player 2...', w/2, h/2)
      }

      // Draw UI
      const drawHP = (x: number, y: number, hp: number, color: string, rightAlign: boolean) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        const bw = 300
        const bh = 30
        const rx = rightAlign ? x - bw : x
        ctx.fillRect(rx, y, bw, bh)
        
        ctx.fillStyle = color
        ctx.shadowBlur = 10
        ctx.shadowColor = color
        const fw = Math.max(0, (hp / 100) * bw)
        const fx = rightAlign ? x - fw : x
        ctx.fillRect(fx, y, fw, bh)
        ctx.shadowBlur = 0
      }

      drawHP(40, 40, s.p1.hp, '#00ffff', false)
      drawHP(w - 40, 40, s.p2.hp, '#ff00ff', true)

      if (s.state !== 'playing') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = s.state === 'p1win' ? '#00ffff' : '#ff00ff'
        ctx.font = 'bold 80px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(s.state === 'p1win' ? 'P1 WINS!' : 'P2 WINS!', w/2, h/2)
        
        ctx.fillStyle = '#fff'
        ctx.font = '24px sans-serif'
        ctx.fillText('Cross arms to restart', w/2, h/2 + 60)

        // Restart condition
        if (sortedPoses.length > 0) {
           const p1Cross = sortedPoses[0] && Math.abs(sortedPoses[0][15]?.x - sortedPoses[0][16]?.x) < 0.1
           if (p1Cross) {
             s.p1.hp = 100
             s.p2.hp = 100
             s.state = 'playing'
           }
        }
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (synthRef.current) synthRef.current.dispose()
    }
  }, [detectFrame, running])

  const handleStart = async () => {
    await Tone.start()
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
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Swords className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Two players stand in frame. Punch opponent to damage. Cross arms to block.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Gesture Fighter 2P</p>
            <p className="mb-4 text-sm text-white/70">A physical 2-player fighting game. Stand side-by-side, throw real punches, and cross your arms to block.</p>
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
