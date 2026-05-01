import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { getFingerTips, toCanvasPoint, type Point } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

interface Node {
  x: number
  y: number
  oldX: number
  oldY: number
  radius: number
  mass: number
  isPinned: false
}

interface Constraint {
  nodeA: number
  nodeB: number
  length: number
  stiffness: number
}

interface Spring {
  nodeId: number
  targetX: number
  targetY: number
  stiffness: number
}

export default function PuppetMaster({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const nodesRef = useRef<Node[]>([])
  const constraintsRef = useRef<Constraint[]>([])
  const springsRef = useRef<Spring[]>([])

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
      initRagdoll(canvas.width, canvas.height)
    }

    const initRagdoll = (w: number, h: number) => {
      const cx = w / 2
      const cy = h / 2

      // Create Nodes (Head, Torso, Shoulders, Elbows, Hands, Hips, Knees, Feet)
      nodesRef.current = [
        { x: cx, y: cy - 60, oldX: cx, oldY: cy - 60, radius: 15, mass: 1, isPinned: false }, // 0: Head
        { x: cx, y: cy - 20, oldX: cx, oldY: cy - 20, radius: 10, mass: 1, isPinned: false }, // 1: Neck
        { x: cx - 30, y: cy - 20, oldX: cx - 30, oldY: cy - 20, radius: 8, mass: 1, isPinned: false }, // 2: L Shoulder
        { x: cx + 30, y: cy - 20, oldX: cx + 30, oldY: cy - 20, radius: 8, mass: 1, isPinned: false }, // 3: R Shoulder
        { x: cx - 40, y: cy + 20, oldX: cx - 40, oldY: cy + 20, radius: 8, mass: 1, isPinned: false }, // 4: L Elbow
        { x: cx + 40, y: cy + 20, oldX: cx + 40, oldY: cy + 20, radius: 8, mass: 1, isPinned: false }, // 5: R Elbow
        { x: cx - 50, y: cy + 60, oldX: cx - 50, oldY: cy + 60, radius: 10, mass: 1, isPinned: false }, // 6: L Hand
        { x: cx + 50, y: cy + 60, oldX: cx + 50, oldY: cy + 60, radius: 10, mass: 1, isPinned: false }, // 7: R Hand
        { x: cx, y: cy + 40, oldX: cx, oldY: cy + 40, radius: 10, mass: 1, isPinned: false }, // 8: Pelvis
        { x: cx - 20, y: cy + 40, oldX: cx - 20, oldY: cy + 40, radius: 8, mass: 1, isPinned: false }, // 9: L Hip
        { x: cx + 20, y: cy + 40, oldX: cx + 20, oldY: cy + 40, radius: 8, mass: 1, isPinned: false }, // 10: R Hip
        { x: cx - 25, y: cy + 90, oldX: cx - 25, oldY: cy + 90, radius: 8, mass: 1, isPinned: false }, // 11: L Knee
        { x: cx + 25, y: cy + 90, oldX: cx + 25, oldY: cy + 90, radius: 8, mass: 1, isPinned: false }, // 12: R Knee
        { x: cx - 30, y: cy + 140, oldX: cx - 30, oldY: cy + 140, radius: 10, mass: 1, isPinned: false }, // 13: L Foot
        { x: cx + 30, y: cy + 140, oldX: cx + 30, oldY: cy + 140, radius: 10, mass: 1, isPinned: false }, // 14: R Foot
      ]

      const addConstraint = (a: number, b: number) => {
        const nA = nodesRef.current[a]
        const nB = nodesRef.current[b]
        constraintsRef.current.push({
          nodeA: a,
          nodeB: b,
          length: Math.hypot(nA.x - nB.x, nA.y - nB.y),
          stiffness: 1
        })
      }

      // Head to Neck
      addConstraint(0, 1)
      // Neck to Shoulders
      addConstraint(1, 2)
      addConstraint(1, 3)
      // Shoulders to Pelvis
      addConstraint(2, 8)
      addConstraint(3, 8)
      // Neck to Pelvis (Spine)
      addConstraint(1, 8)
      // Arms
      addConstraint(2, 4)
      addConstraint(4, 6)
      addConstraint(3, 5)
      addConstraint(5, 7)
      // Pelvis to Hips
      addConstraint(8, 9)
      addConstraint(8, 10)
      // Legs
      addConstraint(9, 11)
      addConstraint(11, 13)
      addConstraint(10, 12)
      addConstraint(12, 14)
    }

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.75)'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const hands = results?.hand?.landmarks ?? []
      
      let allTips: Point[] = []
      hands.forEach(landmarks => {
        allTips.push(...getFingerTips(landmarks, w, h))
      })

      // Map tips to nodes (up to 10 tips mapped to major joints)
      springsRef.current = []
      const mapOrder = [6, 7, 13, 14, 0, 8, 4, 5, 11, 12] // L hand, R hand, L foot, R foot, Head, Pelvis, elbows, knees
      allTips.forEach((tip, i) => {
        if (i < mapOrder.length) {
          springsRef.current.push({
            nodeId: mapOrder[i],
            targetX: tip.x,
            targetY: tip.y,
            stiffness: 0.05
          })
        }
      })

      // Physics Step (Verlet Integration)
      const gravity = 0.5
      const friction = 0.99
      const bounce = 0.5

      // 1. Update positions
      nodesRef.current.forEach(node => {
        if (!node.isPinned) {
          const vx = (node.x - node.oldX) * friction
          const vy = (node.y - node.oldY) * friction
          node.oldX = node.x
          node.oldY = node.y
          node.x += vx
          node.y += vy + gravity
        }
      })

      // 2. Apply Springs
      springsRef.current.forEach(spring => {
        const node = nodesRef.current[spring.nodeId]
        if (node) {
          node.x += (spring.targetX - node.x) * spring.stiffness
          node.y += (spring.targetY - node.y) * spring.stiffness
        }
      })

      // 3. Satisfy constraints (multiple iterations for stiffness)
      for (let i = 0; i < 5; i++) {
        constraintsRef.current.forEach(constraint => {
          const nA = nodesRef.current[constraint.nodeA]
          const nB = nodesRef.current[constraint.nodeB]
          const dx = nB.x - nA.x
          const dy = nB.y - nA.y
          const dist = Math.hypot(dx, dy)
          const diff = (constraint.length - dist) / dist
          
          const offsetX = dx * 0.5 * diff * constraint.stiffness
          const offsetY = dy * 0.5 * diff * constraint.stiffness
          
          if (!nA.isPinned) {
            nA.x -= offsetX
            nA.y -= offsetY
          }
          if (!nB.isPinned) {
            nB.x += offsetX
            nB.y += offsetY
          }
        })

        // Floor collision
        nodesRef.current.forEach(node => {
          if (node.y + node.radius > h) {
            node.y = h - node.radius
            const vx = node.x - node.oldX
            const vy = node.y - node.oldY
            node.oldY = node.y + vy * bounce
            node.oldX = node.x - vx * 0.1 // ground friction
          }
          if (node.x - node.radius < 0) {
            node.x = node.radius
            node.oldX = node.x + (node.x - node.oldX) * bounce
          }
          if (node.x + node.radius > w) {
            node.x = w - node.radius
            node.oldX = node.x + (node.x - node.oldX) * bounce
          }
        })
      }

      // Draw strings from fingertips to nodes
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      springsRef.current.forEach(spring => {
        const node = nodesRef.current[spring.nodeId]
        ctx.beginPath()
        ctx.moveTo(spring.targetX, spring.targetY)
        ctx.lineTo(node.x, node.y)
        ctx.stroke()
        
        ctx.fillStyle = '#ff00ff'
        ctx.beginPath()
        ctx.arc(spring.targetX, spring.targetY, 4, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw Ragdoll constraints
      ctx.lineWidth = 6
      ctx.strokeStyle = '#00ffff'
      ctx.lineCap = 'round'
      ctx.beginPath()
      constraintsRef.current.forEach(constraint => {
        const nA = nodesRef.current[constraint.nodeA]
        const nB = nodesRef.current[constraint.nodeB]
        ctx.moveTo(nA.x, nA.y)
        ctx.lineTo(nB.x, nB.y)
      })
      ctx.stroke()

      // Draw Ragdoll nodes
      nodesRef.current.forEach((node, i) => {
        ctx.fillStyle = i === 0 ? '#ff00ff' : '#00ffff' // Head is pink
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      if (allTips.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.65)'
        ctx.font = '600 15px Space Grotesk, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Show your hands to control the puppet', w / 2, h / 2 - 100)
      }

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

  const handleReset = () => {
    if (canvasRef.current) {
      nodesRef.current = []
      constraintsRef.current = []
      // The resize handler in the useEffect creates the ragdoll, 
      // but we can't call it here. We'll just set a flag or recreate it manually.
      // Easiest way is to toggle running state or just call a small init function.
      setRunning(false)
      setTimeout(() => setRunning(true), 50)
    }
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
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <button onClick={handleReset} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </>
        )}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Puppet Master</p>
            <p className="mb-4 text-sm text-white/70">Control a ragdoll with your fingertips via virtual strings.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Summon Puppet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
