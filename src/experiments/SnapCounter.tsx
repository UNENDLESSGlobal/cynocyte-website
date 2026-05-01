import { useEffect, useRef, useState } from 'react'
import { Play, Square, Mic } from 'lucide-react'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

export default function SnapCounter({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const micRef = useRef<Tone.UserMedia | null>(null)
  const meterHighRef = useRef<Tone.Meter | null>(null)
  const meterLowRef = useRef<Tone.Meter | null>(null)
  const synthRef = useRef<Tone.Synth | null>(null)

  const stateRef = useRef({
    count: 0,
    visualScale: 1,
    lastHighVol: -100,
    lastLowVol: -100,
    cooldown: 0,
    particles: [] as { x: number, y: number, vx: number, vy: number, life: number, color: string }[]
  })

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

    const setupAudio = async () => {
      await Tone.start()
      
      micRef.current = new Tone.UserMedia()
      meterHighRef.current = new Tone.Meter({ normalRange: false }) // dB
      meterLowRef.current = new Tone.Meter({ normalRange: false })
      
      const highPass = new Tone.Filter(2000, "highpass")
      const lowPass = new Tone.Filter(1000, "lowpass")

      micRef.current.connect(highPass)
      micRef.current.connect(lowPass)
      highPass.connect(meterHighRef.current)
      lowPass.connect(meterLowRef.current)
      
      synthRef.current = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
      }).toDestination()
      synthRef.current.volume.value = -10

      try {
        await micRef.current.open()
      } catch (e) {
        console.error("Mic access denied", e)
      }
    }
    setupAudio()

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      // Background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      // Logic
      if (s.cooldown > 0) {
        s.cooldown--
      } else if (meterHighRef.current && meterLowRef.current) {
        const highVol = meterHighRef.current.getValue() as number
        const lowVol = meterLowRef.current.getValue() as number

        // Delta is the instantaneous jump in volume
        const dHigh = highVol - s.lastHighVol
        const dLow = lowVol - s.lastLowVol

        // Transients are massive instantaneous spikes
        if (dHigh > 15 && highVol > -30) {
           // We have a transient! Is it a snap or a clap?
           // Claps have lots of low frequency energy too. Snaps are mostly high frequency.
           let isClap = false
           if (dLow > 10 && lowVol > -20) {
              isClap = true
           }

           if (isClap) {
             s.count += 10
             s.visualScale = 1.5
             s.cooldown = 20 // 20 frames debounce
             synthRef.current?.triggerAttackRelease('C5', '16n')
             
             // Explode big particles
             for(let i=0; i<30; i++) {
                const a = Math.random() * Math.PI * 2
                const v = 5 + Math.random() * 15
                s.particles.push({ x: w/2, y: h/2, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 1, color: '#ff0055' })
             }
           } else {
             s.count += 1
             s.visualScale = 1.3
             s.cooldown = 15 // 15 frames debounce
             synthRef.current?.triggerAttackRelease('G5', '32n')

             // Explode small particles
             for(let i=0; i<10; i++) {
                const a = Math.random() * Math.PI * 2
                const v = 2 + Math.random() * 8
                s.particles.push({ x: w/2, y: h/2, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 1, color: '#00ffff' })
             }
           }
        }

        s.lastHighVol = highVol
        s.lastLowVol = lowVol
      }

      // Physics
      s.visualScale += (1 - s.visualScale) * 0.1

      s.particles = s.particles.filter(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.5 // gravity
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.life * 6, 0, Math.PI*2)
        ctx.fillStyle = p.color
        ctx.fill()
        p.life -= 0.02
        return p.life > 0
      })

      // Draw Number
      ctx.save()
      ctx.translate(w/2, h/2)
      ctx.scale(s.visualScale, s.visualScale)
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 150px sans-serif'
      
      // Shadow
      ctx.shadowBlur = 30
      ctx.shadowColor = s.visualScale > 1.2 ? '#ff0055' : 'rgba(255,255,255,0.2)'
      ctx.fillText(s.count.toString(), 0, 0)
      ctx.restore()

      // Debug meters (bottom corners)
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'
      ctx.fillRect(20, h - 20, 50, clamp((s.lastHighVol + 100) * 2, 0, 100) * -1)
      ctx.fillStyle = 'rgba(255, 0, 85, 0.5)'
      ctx.fillRect(w - 70, h - 20, 50, clamp((s.lastLowVol + 100) * 2, 0, 100) * -1)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (micRef.current) { micRef.current.close(); micRef.current.dispose() }
      if (meterHighRef.current) meterHighRef.current.dispose()
      if (meterLowRef.current) meterLowRef.current.dispose()
      if (synthRef.current) synthRef.current.dispose()
    }
  }, [running])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a14]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={() => setRunning(true)} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start Counter
          </button>
        ) : (
          <button onClick={() => setRunning(false)} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none w-max">
          <Mic className="w-4 h-4 text-white/50 mr-2 animate-pulse" />
          <span className="text-xs font-medium text-white/80">Listening for transients. Snap fingers for +1, Clap hands for +10.</span>
        </div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Snap Counter</p>
            <p className="mb-4 text-sm text-white/70">Counts your snaps and claps without you having to touch anything. Snap your fingers to increment by 1. Clap your hands to jump by 10.</p>
            <button onClick={() => setRunning(true)} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Mic
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
