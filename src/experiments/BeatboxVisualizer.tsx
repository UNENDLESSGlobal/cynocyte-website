import { useEffect, useRef, useState } from 'react'
import { Play, Square, Mic } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function BeatboxVisualizer({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const animRef = useRef<number>(0)
  
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const effectsRef = useRef<{
    shockwaves: { x: number, y: number, r: number, life: number }[]
    bursts: { x: number, y: number, lines: { angle: number, length: number }[], life: number }[]
    sparkles: { x: number, y: number, vx: number, vy: number, life: number }[]
  }>({
    shockwaves: [],
    bursts: [],
    sparkles: []
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

    const analyser = analyserRef.current
    if (!analyser) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    let lastKickTime = 0
    let lastSnareTime = 0
    let lastHatTime = 0

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const now = performance.now()

      // Dark background with slight fade for trails
      ctx.fillStyle = 'rgba(6, 6, 16, 0.2)'
      ctx.fillRect(0, 0, w, h)

      analyser.getByteFrequencyData(dataArray)

      // Very rough frequency bin ranges (depends on sample rate, usually 44100Hz / 2048 bins ~ 21Hz per bin)
      // Kick: ~40-120Hz (Bins 2 to 6)
      let kickEnergy = 0
      for(let i=2; i<=6; i++) kickEnergy += dataArray[i]
      kickEnergy /= 5

      // Snare: ~200-500Hz (Bins 10 to 25)
      let snareEnergy = 0
      for(let i=10; i<=25; i++) snareEnergy += dataArray[i]
      snareEnergy /= 16

      // Hi-Hat: ~8000Hz+ (Bins 380 to 500)
      let hatEnergy = 0
      for(let i=380; i<=500; i++) hatEnergy += dataArray[i]
      hatEnergy /= 120

      // Triggers
      if (kickEnergy > 200 && now - lastKickTime > 200) {
        effectsRef.current.shockwaves.push({ x: w/2, y: h/2, r: 10, life: 1 })
        lastKickTime = now
      }

      if (snareEnergy > 160 && now - lastSnareTime > 200) {
        const lines = Array.from({length: 12}).map(() => ({
          angle: Math.random() * Math.PI * 2,
          length: 50 + Math.random() * 150
        }))
        effectsRef.current.bursts.push({ x: w/2 + (Math.random()-0.5)*200, y: h/2 + (Math.random()-0.5)*200, lines, life: 1 })
        lastSnareTime = now
        // Flash screen
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.fillRect(0, 0, w, h)
      }

      if (hatEnergy > 80 && now - lastHatTime > 100) {
        for(let i=0; i<5; i++) {
          effectsRef.current.sparkles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1
          })
        }
        lastHatTime = now
      }

      // Draw Shockwaves (Kick)
      effectsRef.current.shockwaves = effectsRef.current.shockwaves.filter(s => s.life > 0)
      effectsRef.current.shockwaves.forEach(s => {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 0, 100, ${s.life})`
        ctx.lineWidth = 10 * s.life
        ctx.stroke()
        s.r += 20
        s.life -= 0.05
      })

      // Draw Bursts (Snare)
      effectsRef.current.bursts = effectsRef.current.bursts.filter(b => b.life > 0)
      effectsRef.current.bursts.forEach(b => {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.life})`
        ctx.lineWidth = 4 * b.life
        b.lines.forEach(l => {
          ctx.moveTo(b.x, b.y)
          ctx.lineTo(b.x + Math.cos(l.angle) * l.length, b.y + Math.sin(l.angle) * l.length)
        })
        ctx.stroke()
        b.life -= 0.1
      })

      // Draw Sparkles (Hi-Hat)
      effectsRef.current.sparkles = effectsRef.current.sparkles.filter(s => s.life > 0)
      ctx.fillStyle = '#00ffff'
      effectsRef.current.sparkles.forEach(s => {
        ctx.globalAlpha = s.life
        ctx.beginPath()
        ctx.arc(s.x, s.y, 4, 0, Math.PI*2)
        ctx.fill()
        s.x += s.vx
        s.y += s.vy
        s.life -= 0.02
      })
      ctx.globalAlpha = 1

      // Draw bottom spectrum
      const barWidth = w / 100
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      for (let i = 0; i < 100; i++) {
        // Sample linearly from 0 to 500 bins
        const bin = Math.floor((i / 100) * 500)
        const v = dataArray[bin] / 255
        const barH = v * 100
        ctx.fillRect(i * barWidth, h - barH, barWidth - 1, barH)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [running])

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = audioCtx
      
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser
      
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      setRunning(true)
      setError(null)
    } catch (err) {
      console.error(err)
      setError("Microphone access denied or unavailable.")
    }
  }

  const handleStop = () => {
    setRunning(false)
    if (audioCtxRef.current) audioCtxRef.current.close()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    onClose()
  }

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
          <Mic className="w-4 h-4 text-white/50 mr-2 animate-pulse" />
          <span className="text-xs font-medium text-white/80">Make Kick, Snare, or Hi-Hat sounds to trigger visuals!</span>
        </div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Beatbox Visualizer</p>
            <p className="mb-4 text-sm text-white/70">Make beatbox sounds into your microphone. Kick drums, snares, and hi-hats trigger unique explosive visuals.</p>
            {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Microphone
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
