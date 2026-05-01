import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { toCanvasPoint, type Point } from '@/lib/landmarks'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onClose: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  size: number
}

interface Spell {
  name: string
  color: string
  description: string
}

const SPELLS: Record<string, Spell> = {
  FIRE: { name: 'FIRE', color: '#ff4400', description: 'Draw a circle' },
  LIGHTNING: { name: 'LIGHTNING', color: '#00ffff', description: 'Draw a zigzag' },
  LEVITATE: { name: 'LEVITATE', color: '#a855f7', description: 'Draw a line up' },
  SHIELD: { name: 'SHIELD', color: '#3b82f6', description: 'Draw a triangle' },
  VORTEX: { name: 'VORTEX', color: '#10b981', description: 'Draw a spiral' },
}

export default function MagicSpellcaster({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const [activeSpell, setActiveSpell] = useState<Spell | null>(null)
  const pathRef = useRef<Point[]>([])
  const particlesRef = useRef<Particle[]>([])
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    if (activeSpell) {
      const t = setTimeout(() => setActiveSpell(null), 2000)
      return () => clearTimeout(t)
    }
  }, [activeSpell])

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

    const castSpell = (spellName: string, cx: number, cy: number) => {
      const spell = SPELLS[spellName]
      setActiveSpell(spell)
      
      // Emit particles
      for (let i = 0; i < 100; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 15 + 5
        particlesRef.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: spell.color,
          size: Math.random() * 8 + 2
        })
      }
    }

    const recognizeGesture = (points: Point[]) => {
      if (points.length < 10) return

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      let totalDist = 0
      
      for (let i = 0; i < points.length; i++) {
        const p = points[i]
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
        
        if (i > 0) {
          totalDist += Math.hypot(p.x - points[i-1].x, p.y - points[i-1].y)
        }
      }

      const w = maxX - minX
      const h = maxY - minY
      const diag = Math.hypot(w, h)
      if (diag < 50) return // Too small

      const start = points[0]
      const end = points[points.length - 1]
      const endToEnd = Math.hypot(end.x - start.x, end.y - start.y)

      const d_ratio = totalDist / diag
      const e_ratio = endToEnd / diag

      const cx = minX + w/2
      const cy = minY + h/2

      // Count X direction changes
      let xChanges = 0
      let lastDx = 0
      for (let i = 2; i < points.length; i+=2) {
        const dx = points[i].x - points[i-2].x
        if (dx * lastDx < 0 && Math.abs(dx) > 10) xChanges++
        if (Math.abs(dx) > 10) lastDx = dx
      }

      if (e_ratio > 0.8) {
        if (start.y > end.y && h > w) castSpell('LEVITATE', cx, cy)
      } else if (xChanges >= 3 && d_ratio > 2.0) {
        castSpell('LIGHTNING', cx, cy)
      } else if (e_ratio < 0.4) {
        if (d_ratio > 4.5) castSpell('VORTEX', cx, cy)
        else if (d_ratio > 2.8) castSpell('FIRE', cx, cy)
        else castSpell('SHIELD', cx, cy)
      }
    }

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

      ctx.fillStyle = 'rgba(6, 6, 16, 0.65)'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const hand = results?.hand?.landmarks?.[0]

      if (hand) {
        const tip = toCanvasPoint(hand[8], w, h)
        
        // Add point if moved enough
        const lastP = pathRef.current[pathRef.current.length - 1]
        if (!lastP || Math.hypot(tip.x - lastP.x, tip.y - lastP.y) > 5) {
          pathRef.current.push(tip)
          lastTimeRef.current = Date.now()
        }

        // Draw current path
        if (pathRef.current.length > 0) {
          ctx.beginPath()
          ctx.moveTo(pathRef.current[0].x, pathRef.current[0].y)
          for (let i = 1; i < pathRef.current.length; i++) {
            ctx.lineTo(pathRef.current[i].x, pathRef.current[i].y)
          }
          ctx.strokeStyle = '#a855f7'
          ctx.lineWidth = 4
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.shadowBlur = 10
          ctx.shadowColor = '#a855f7'
          ctx.stroke()
        }

        // Draw fingertip
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      }

      // Check for pause to evaluate gesture
      if (pathRef.current.length > 0 && Date.now() - lastTimeRef.current > 300) {
        recognizeGesture(pathRef.current)
        pathRef.current = [] // reset
      }

      // Update particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.02
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.life
        ctx.shadowBlur = 10
        ctx.shadowColor = p.color
        ctx.fill()
        ctx.globalAlpha = 1
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

      <div className="absolute right-4 top-4 z-20 hidden sm:block">
        <div className="glass rounded-xl p-4 text-xs text-white/70 space-y-2">
          {Object.values(SPELLS).map(spell => (
            <div key={spell.name} className="flex items-center justify-between gap-4">
              <span style={{ color: spell.color }} className="font-bold">{spell.name}</span>
              <span>{spell.description}</span>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeSpell && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5, filter: 'blur(10px)' }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <h2 
              className="text-6xl font-black italic tracking-widest uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]"
              style={{ color: activeSpell.color }}
            >
              {activeSpell.name}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Magic Spellcaster</p>
            <p className="mb-4 text-sm text-white/70">Draw shapes in the air with your index finger to cast spells.</p>
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
