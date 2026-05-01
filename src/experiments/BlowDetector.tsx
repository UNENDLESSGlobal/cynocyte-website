import { useEffect, useRef, useState } from 'react'
import { Play, Square, Wind } from 'lucide-react'

interface Props {
  onClose: () => void
}

type SceneMode = 'candles' | 'leaves' | 'balloon'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color?: string
  size: number
  rot?: number
  vrot?: number
}

export default function BlowDetector({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<SceneMode>('candles')
  const [blowIntensity, setBlowIntensity] = useState(0)
  
  const animRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  
  const particlesRef = useRef<Particle[]>([])
  const blowIntensityRef = useRef(0)

  // Scene state
  const candlesRef = useRef([
    { x: 0.3, y: 0.7, lit: true, flicker: 0 },
    { x: 0.5, y: 0.6, lit: true, flicker: 0 },
    { x: 0.7, y: 0.7, lit: true, flicker: 0 },
  ])
  const balloonSizeRef = useRef(0)

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

    // Init Leaves
    if (mode === 'leaves' && particlesRef.current.length === 0) {
      for(let i=0; i<30; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height - 20 - Math.random() * 40,
          vx: 0, vy: 0,
          life: 1,
          size: 10 + Math.random() * 10,
          rot: Math.random() * Math.PI * 2,
          vrot: 0,
          color: ['#ef4444', '#f59e0b', '#84cc16'][Math.floor(Math.random() * 3)]
        })
      }
    }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      // Detect blow
      let currentBlow = 0
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        
        // Blow signature: high energy in low bins (rumble), low energy in high bins
        let lowSum = 0
        for (let i = 0; i < 10; i++) lowSum += data[i]
        const lowAvg = lowSum / 10
        
        // High frequency check (snap/clap)
        let highSum = 0
        for(let i = 100; i < 200; i++) highSum += data[i]
        const highAvg = highSum / 100
        
        if (lowAvg > 50 && highAvg < 20) {
          currentBlow = Math.min(1, (lowAvg - 50) / 150)
        }
        
        // Relight candles on snap (high freq)
        if (highAvg > 40 && mode === 'candles') {
          candlesRef.current.forEach(c => c.lit = true)
        }
      }

      // Smooth blow intensity
      blowIntensityRef.current += (currentBlow - blowIntensityRef.current) * 0.1
      setBlowIntensity(blowIntensityRef.current)
      const windForce = blowIntensityRef.current

      // Draw background
      const gradient = ctx.createLinearGradient(0, 0, 0, h)
      gradient.addColorStop(0, '#0f172a')
      gradient.addColorStop(1, '#020617')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)

      // Draw Wind Particles and Magic Sparkles
      if (windForce > 0.1) {
        // Screen shake
        ctx.translate((Math.random()-0.5)*windForce*10, (Math.random()-0.5)*windForce*10)
        
        if (Math.random() < windForce) {
          particlesRef.current.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 10 + windForce * 20,
            vy: (Math.random() - 0.5) * 5,
            life: 1,
            size: 2,
            color: 'rgba(255,255,255,0.4)'
          })
        }
        // Magic sparkles
        if (Math.random() < windForce * 2) {
          particlesRef.current.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: windForce * 15,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            size: Math.random() * 4,
            color: Math.random() > 0.5 ? '#00ffff' : '#ff00ff'
          })
        }
      }

      if (mode === 'candles') {
        // Draw Table
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(0, h * 0.75, w, h * 0.25)

        candlesRef.current.forEach((candle) => {
          const cx = candle.x * w
          const cy = candle.y * h
          
          // Body
          ctx.fillStyle = '#cbd5e1'
          ctx.fillRect(cx - 15, cy, 30, 80)
          
          // Wick
          ctx.fillStyle = '#000'
          ctx.fillRect(cx - 1, cy - 10, 2, 10)

          if (candle.lit) {
            candle.flicker = Math.random() * 0.2
            if (windForce > 0.6) candle.lit = false
            
            // Flame
            ctx.save()
            ctx.translate(cx + windForce * 20, cy - 15) // Wind bends flame
            ctx.scale(1 - candle.flicker, 1 + candle.flicker)
            
            const flameGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30)
            flameGlow.addColorStop(0, 'rgba(255, 200, 0, 0.8)')
            flameGlow.addColorStop(1, 'rgba(255, 100, 0, 0)')
            
            ctx.fillStyle = flameGlow
            ctx.beginPath()
            ctx.arc(0, -10, 30, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.fillStyle = '#fef08a'
            ctx.beginPath()
            ctx.moveTo(0, -20)
            ctx.quadraticCurveTo(10, 0, 0, 10)
            ctx.quadraticCurveTo(-10, 0, 0, -20)
            ctx.fill()
            ctx.restore()
          } else {
            // Smoke trail
            if (Math.random() < 0.4) {
              particlesRef.current.push({
                x: cx + (Math.random()-0.5)*5,
                y: cy - 15,
                vx: windForce * 15 + (Math.random()-0.5)*2,
                vy: -3 - Math.random() * 3,
                life: 1,
                size: 6 + Math.random() * 4,
                color: 'rgba(150,150,150,0.6)'
              })
            }
          }
        })
      } 
      else if (mode === 'leaves') {
        // Draw ground
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(0, h - 20, w, 20)

        particlesRef.current.forEach(p => {
          if (windForce > 0.1 && p.y >= h - 40) {
            p.vx += windForce * 8 + Math.random() * 4
            p.vy -= windForce * 5 + Math.random() * 6
            p.vrot = (Math.random() - 0.5) * 0.4
          }
          
          // Tornado effect: pull leaves to center Y
          if (windForce > 0.5 && p.y < h - 40) {
            p.vy += (h/2 - p.y) * 0.05
            p.vx += windForce * 2
          }
          
          p.vy += 0.2 // gravity
          p.vx *= 0.98 // air friction
          p.vy *= 0.98
          
          p.x += p.vx
          p.y += p.vy
          p.rot! += p.vrot!

          if (p.y > h - 20) {
            p.y = h - 20
            p.vy = 0
            p.vx *= 0.8 // ground friction
            p.vrot! *= 0.8
          }
          if (p.x > w + 50) p.x = -50 // Wrap around

          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot!)
          ctx.fillStyle = p.color!
          ctx.beginPath()
          ctx.ellipse(0, 0, p.size, p.size/2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        })
      }
      else if (mode === 'balloon') {
        balloonSizeRef.current += windForce * 2
        balloonSizeRef.current *= 0.995 // slow leak
        
        const bSize = 50 + balloonSizeRef.current
        const cx = w/2
        const cy = h/2 + 50

        // String
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, cy + bSize)
        ctx.quadraticCurveTo(cx + Math.sin(Date.now()*0.003)*20, cy + bSize + 100, cx, cy + bSize + 200)
        ctx.stroke()

        // Balloon
        ctx.save()
        ctx.translate(cx, cy)
        // Wind affects balloon position slightly
        ctx.rotate(windForce * 0.2)
        
        // Pop!
        if (bSize > h * 0.4) {
          balloonSizeRef.current = 0
          for(let i=0; i<30; i++) {
            particlesRef.current.push({
              x: cx, y: cy,
              vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20,
              life: 1, size: Math.random()*8, color: '#ef4444'
            })
          }
        } else {
          ctx.fillStyle = '#ef4444'
          ctx.beginPath()
          ctx.ellipse(0, 0, bSize * 0.85, bSize, 0, 0, Math.PI * 2)
          ctx.fill()
          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.3)'
          ctx.beginPath()
          ctx.ellipse(-bSize*0.3, -bSize*0.4, bSize*0.15, bSize*0.3, Math.PI/4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      // Render general particles (smoke, wind lines, balloon pops)
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]
        if (mode === 'leaves') continue // Leaves are persistent

        p.x += p.vx
        p.y += p.vy
        if (p.color && p.color.includes('rgba(255,255,255,0.4)')) {
          // Wind lines
          ctx.strokeStyle = p.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx, p.y)
          ctx.stroke()
          p.life -= 0.05
        } else {
          p.life -= 0.02
          ctx.globalAlpha = Math.max(0, p.life)
          ctx.fillStyle = p.color || '#fff'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }

        if (p.life <= 0 || p.x > w) {
          particlesRef.current.splice(i, 1)
        }
      }

      // Draw Blow Indicator
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(20, h - 30, 200, 10)
      ctx.fillStyle = '#00ffff'
      ctx.fillRect(20, h - 30, 200 * Math.min(1, windForce * 1.5), 10)
      ctx.fillStyle = '#fff'
      ctx.font = '10px sans-serif'
      ctx.fillText('Wind Force', 20, h - 35)

      ctx.resetTransform()
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [mode, running])

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const actx = new window.AudioContext()
      audioContextRef.current = actx
      const source = actx.createMediaStreamSource(stream)
      const analyser = actx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser
      setRunning(true)
    } catch (err) {
      console.error(err)
      alert("Microphone access is required to play.")
    }
  }

  const handleStop = () => {
    setRunning(false)
    if (audioContextRef.current) audioContextRef.current.close()
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop())
    particlesRef.current = []
    balloonSizeRef.current = 0
    onClose()
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#020617]" style={{ minHeight: '60vh' }}>
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
        <div className="absolute top-4 right-4 z-20 flex bg-black/40 rounded-full p-1 border border-white/10">
          {(['candles', 'leaves', 'balloon'] as SceneMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); particlesRef.current = [] }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                mode === m ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {running && blowIntensity > 0.1 && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-10">
          <Wind className="w-64 h-64 text-white animate-pulse" />
        </div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Blow Detector</p>
            <p className="mb-4 text-sm text-white/70">Blow into your microphone to trigger magical wind effects on screen.</p>
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Mic
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
