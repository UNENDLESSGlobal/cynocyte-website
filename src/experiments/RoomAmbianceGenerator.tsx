import { useEffect, useRef, useState } from 'react'
import { Play, Square, Mic, Waves } from 'lucide-react'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

const SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5']

export default function RoomAmbianceGenerator({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [sensitivity, setSensitivity] = useState(50) // 0 to 100
  const [mood, setMood] = useState<'calm' | 'energetic' | 'dark'>('calm')
  const animRef = useRef<number>(0)

  const micRef = useRef<Tone.UserMedia | null>(null)
  const fftRef = useRef<Tone.FFT | null>(null)

  const audioRef = useRef<{
    bass: Tone.Synth | null,
    arp: Tone.Synth | null,
    shimmer: Tone.NoiseSynth | null,
    loop: Tone.Loop | null
  }>({ bass: null, arp: null, shimmer: null, loop: null })

  const stateRef = useRef({
    bassActive: false,
    arpActive: false,
    shimmerActive: false,
    smoothLow: -100,
    smoothMid: -100,
    smoothHigh: -100
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
      Tone.Transport.bpm.value = 90

      micRef.current = new Tone.UserMedia()
      fftRef.current = new Tone.FFT(64)
      micRef.current.connect(fftRef.current)
      
      try {
        await micRef.current.open()
      } catch (e) {
        console.error("Mic access denied", e)
      }

      const reverb = new Tone.Reverb(8).toDestination()
      reverb.wet.value = 0.8
      
      const delay = new Tone.FeedbackDelay("8n", 0.6).connect(reverb)

      // Bass Pad
      const bass = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 2, decay: 1, sustain: 1, release: 4 }
      }).connect(reverb)
      bass.volume.value = -15

      // Arpeggio
      const arp = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0, release: 0.5 }
      }).connect(delay)
      arp.volume.value = -20

      // Shimmer
      const shimmer = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 1, decay: 0.1, sustain: 1, release: 2 }
      }).connect(reverb)
      shimmer.volume.value = -30

      // Arp Loop
      let step = 0
      const loop = new Tone.Loop((time) => {
        if (stateRef.current.arpActive) {
           const note = SCALE[Math.floor(Math.random() * SCALE.length)]
           arp.triggerAttackRelease(note, '16n', time)
        }
      }, '8n')
      loop.start(0)
      Tone.Transport.start()

      audioRef.current = { bass, arp, shimmer, loop }
    }
    setupAudio()

    const drawLoop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current
      const fft = fftRef.current

      // Background
      ctx.fillStyle = mood === 'dark' ? 'rgba(5, 0, 10, 0.2)' : 'rgba(5, 10, 20, 0.2)'
      ctx.fillRect(0, 0, w, h)

      if (fft) {
        const values = fft.getValue() // Float32Array of decibels roughly -100 to 0
        
        // Calculate average energy in buckets
        let low = 0, mid = 0, high = 0
        const third = Math.floor(values.length / 3)
        
        for (let i = 0; i < values.length; i++) {
          const val = Number.isFinite(values[i]) ? values[i] : -100
          if (i < third) low += val
          else if (i < third * 2) mid += val
          else high += val
        }
        
        low = low / third
        mid = mid / third
        high = high / third

        // Smooth values
        s.smoothLow += (low - s.smoothLow) * 0.1
        s.smoothMid += (mid - s.smoothMid) * 0.1
        s.smoothHigh += (high - s.smoothHigh) * 0.1

        // Threshold based on sensitivity (-80 to -30 range)
        const thresh = -80 + ((100 - sensitivity) * 0.5)

        // Bass Logic
        if (s.smoothLow > thresh && !s.bassActive) {
           s.bassActive = true
           const root = mood === 'dark' ? 'C2' : mood === 'energetic' ? 'D2' : 'F2'
           audioRef.current.bass?.triggerAttack(root)
        } else if (s.smoothLow < thresh - 5 && s.bassActive) {
           s.bassActive = false
           audioRef.current.bass?.triggerRelease()
        }

        // Arp Logic
        if (s.smoothMid > thresh) {
           s.arpActive = true
           if (mood === 'energetic') Tone.Transport.bpm.rampTo(140, 1)
           else Tone.Transport.bpm.rampTo(90, 1)
        } else {
           s.arpActive = false
        }

        // Shimmer Logic
        if (s.smoothHigh > thresh && !s.shimmerActive) {
           s.shimmerActive = true
           audioRef.current.shimmer?.triggerAttack()
        } else if (s.smoothHigh < thresh - 5 && s.shimmerActive) {
           s.shimmerActive = false
           audioRef.current.shimmer?.triggerRelease()
        }

        // Draw FFT Aurora
        const barW = w / values.length
        ctx.beginPath()
        ctx.moveTo(0, h)
        
        for (let i = 0; i < values.length; i++) {
           const val = Number.isFinite(values[i]) ? values[i] : -100
           // Map -100 -> 0 to 0 -> 1
           const n = clamp((val + 100) / 100, 0, 1)
           
           const x = i * barW
           const y = h - (n * h * 0.8)
           
           // Smooth curve
           if (i === 0) ctx.moveTo(x, y)
           else {
             const prevVal = Number.isFinite(values[i-1]) ? values[i-1] : -100
             const pn = clamp((prevVal + 100) / 100, 0, 1)
             const px = (i - 1) * barW
             const py = h - (pn * h * 0.8)
             const cx = (x + px) / 2
             const cy = (y + py) / 2
             ctx.quadraticCurveTo(px, py, cx, cy)
           }
        }
        ctx.lineTo(w, h)
        ctx.lineTo(0, h)
        ctx.closePath()

        // Gradient based on mood
        const grad = ctx.createLinearGradient(0, 0, 0, h)
        if (mood === 'calm') {
           grad.addColorStop(0, 'rgba(0, 255, 255, 0.5)')
           grad.addColorStop(1, 'rgba(0, 100, 255, 0.1)')
        } else if (mood === 'energetic') {
           grad.addColorStop(0, 'rgba(255, 0, 100, 0.5)')
           grad.addColorStop(1, 'rgba(255, 100, 0, 0.1)')
        } else {
           grad.addColorStop(0, 'rgba(100, 0, 255, 0.4)')
           grad.addColorStop(1, 'rgba(50, 0, 100, 0.1)')
        }
        
        ctx.fillStyle = grad
        ctx.shadowBlur = 30
        ctx.shadowColor = mood === 'calm' ? '#00ffff' : mood === 'energetic' ? '#ff0055' : '#8a2be2'
        ctx.fill()
        ctx.shadowBlur = 0

        // Draw active indicators
        const drawInd = (lbl: string, active: boolean, x: number) => {
           ctx.fillStyle = active ? '#fff' : 'rgba(255,255,255,0.2)'
           ctx.font = '14px sans-serif'
           ctx.textAlign = 'center'
           ctx.fillText(lbl, x, h - 30)
           
           ctx.beginPath()
           ctx.arc(x, h - 15, 4, 0, Math.PI*2)
           ctx.fillStyle = active ? '#00ffff' : 'rgba(255,255,255,0.2)'
           if (active) { ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff' }
           ctx.fill()
           ctx.shadowBlur = 0
        }

        drawInd('LOW (BASS)', s.bassActive, w/4)
        drawInd('MID (ARP)', s.arpActive, w/2)
        drawInd('HIGH (SHIMMER)', s.shimmerActive, (w/4)*3)
      }

      animRef.current = requestAnimationFrame(drawLoop)
    }

    animRef.current = requestAnimationFrame(drawLoop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      Tone.Transport.stop()
      if (micRef.current) { micRef.current.close(); micRef.current.dispose() }
      if (fftRef.current) fftRef.current.dispose()
      if (audioRef.current.loop) audioRef.current.loop.dispose()
      if (audioRef.current.bass) audioRef.current.bass.dispose()
      if (audioRef.current.arp) audioRef.current.arp.dispose()
      if (audioRef.current.shimmer) audioRef.current.shimmer.dispose()
    }
  }, [running, sensitivity, mood])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#060610]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-4">
        {!running ? (
          <button onClick={() => setRunning(true)} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start Ambient Gen
          </button>
        ) : (
          <>
            <button onClick={() => setRunning(false)} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <div className="flex bg-black/40 rounded-full p-1 items-center px-4 gap-2">
              <Waves className="w-4 h-4 text-white/50" />
              <span className="text-xs text-white/70">Sensitivity</span>
              <input 
                type="range" 
                min="0" max="100" 
                value={sensitivity} 
                onChange={e => setSensitivity(parseInt(e.target.value))}
                className="w-24 accent-white"
              />
            </div>
            <div className="flex bg-black/40 rounded-full p-1">
              {(['calm', 'energetic', 'dark'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    mood === m ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Mic className="w-4 h-4 text-white/50 mr-2 animate-pulse" />
          <span className="text-xs font-medium text-white/80">Listening to room audio... Tap table for bass, snap/shhh for shimmer.</span>
        </div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Room Ambiance Generator</p>
            <p className="mb-4 text-sm text-white/70">Transforms background noise into music. Rain becomes soft pads, footsteps become rhythmic arpeggios, and keyboard typing adds shimmer.</p>
            <button onClick={() => setRunning(true)} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Microphone
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
