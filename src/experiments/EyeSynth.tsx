import { useEffect, useRef, useState } from 'react'
import { Play, Square, Music } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

export default function EyeSynth({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  // Tone.js references
  const audioCtxRef = useRef<{
    oscA: Tone.OmniOscillator<any>
    oscB: Tone.OmniOscillator<any>
    volA: Tone.Volume
    volB: Tone.Volume
    filterA: Tone.Filter
    reverbB: Tone.Reverb
  } | null>(null)

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

    // Setup Audio
    const volA = new Tone.Volume(-10).toDestination()
    const volB = new Tone.Volume(-10).toDestination()
    
    const filterA = new Tone.Filter(1000, 'lowpass').connect(volA)
    const reverbB = new Tone.Reverb({ decay: 2.5, wet: 0.5 }).connect(volB)
    
    const oscA = new Tone.Oscillator({ type: 'sine', frequency: 200 }).connect(filterA).start()
    const oscB = new Tone.Oscillator({ type: 'triangle', frequency: 200 }).connect(reverbB).start()

    audioCtxRef.current = { oscA, oscB, volA, volB, filterA, reverbB }

    let smoothL = { x: 0.5, y: 0.5 }
    let smoothR = { x: 0.5, y: 0.5 }
    let time = 0

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      // Background with motion blur trail
      ctx.fillStyle = 'rgba(6, 6, 16, 0.2)'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.1
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const face = results?.face?.faceLandmarks?.[0]
      const blendshapes = results?.face?.faceBlendshapes?.[0]?.categories

      let leftBlink = 0
      let rightBlink = 0

      if (face) {
        // Left Eye (User's physical left, screen right due to mirroring)
        const lOuter = face[263]
        const lInner = face[362]
        const lTop = face[386]
        const lBottom = face[374]
        const lIris = face[473]

        // Right Eye (User's physical right, screen left)
        const rOuter = face[33]
        const rInner = face[133]
        const rTop = face[159]
        const rBottom = face[145]
        const rIris = face[468]

        const getEyeNorm = (iris: any, inner: any, outer: any, top: any, bottom: any) => {
          const eyeW = Math.abs(outer.x - inner.x)
          const eyeH = Math.abs(top.y - bottom.y)
          let x = (iris.x - Math.min(outer.x, inner.x)) / eyeW
          let y = (iris.y - Math.min(top.y, bottom.y)) / eyeH
          return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
        }

        const lNorm = getEyeNorm(lIris, lInner, lOuter, lTop, lBottom)
        const rNorm = getEyeNorm(rIris, rInner, rOuter, rTop, rBottom)

        // Exponential smoothing
        smoothL.x += (lNorm.x - smoothL.x) * 0.2
        smoothL.y += (lNorm.y - smoothL.y) * 0.2
        smoothR.x += (rNorm.x - smoothR.x) * 0.2
        smoothR.y += (rNorm.y - smoothR.y) * 0.2

        if (blendshapes) {
          // Note: Because of mirroring, the model's "Left" is the screen's Left, which is the user's physical Right
          // Let's just map them based on score
          const rawLeftBlink = blendshapes.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0
          const rawRightBlink = blendshapes.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0
          
          // User's physical left eye blink = model's eyeBlinkRight
          leftBlink = rawRightBlink
          // User's physical right eye blink = model's eyeBlinkLeft
          rightBlink = rawLeftBlink
        }

        // Apply audio mappings
        // Left eye (smoothL): X = Pitch A, Y = Filter Cutoff
        oscA.frequency.rampTo(100 + smoothL.x * 600, 0.1)
        filterA.frequency.rampTo(200 + (1 - smoothL.y) * 4000, 0.1)
        
        // Right eye (smoothR): X = Pitch B, Y = Reverb Wet
        oscB.frequency.rampTo(100 + smoothR.x * 600, 0.1)
        reverbB.wet.rampTo(1 - smoothR.y, 0.1)

        // Blink muting (smooth)
        volA.volume.rampTo(leftBlink > 0.4 ? -100 : -10, 0.1)
        volB.volume.rampTo(rightBlink > 0.4 ? -100 : -10, 0.1)

        // Draw Debug UI
        ctx.fillStyle = '#fff'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(`Left Eye (Osc A): Freq ${Math.round(oscA.frequency.value)}Hz, Filter ${Math.round(filterA.frequency.value)}Hz`, 20, 40)
        ctx.fillText(`Right Eye (Osc B): Freq ${Math.round(oscB.frequency.value)}Hz, Reverb ${Math.round(reverbB.wet.value * 100)}%`, 20, 60)
        
        if (leftBlink > 0.4) ctx.fillText('Left Muted', 20, 80)
        if (rightBlink > 0.4) ctx.fillText('Right Muted', 20, 100)
      }

      // Draw Lissajous Figure
      ctx.save()
      ctx.translate(w / 2, h / 2)
      
      const freqA = oscA.frequency.value
      const freqB = oscB.frequency.value
      
      ctx.beginPath()
      ctx.strokeStyle = `hsl(${(freqA + freqB) / 4}, 100%, 60%)`
      ctx.lineWidth = 2
      ctx.shadowBlur = 15
      ctx.shadowColor = ctx.strokeStyle
      
      // Mute the lissajous drawing if both eyes are closed
      const isMuted = leftBlink > 0.4 && rightBlink > 0.4
      
      if (!isMuted) {
        for (let i = 0; i < Math.PI * 2; i += 0.02) {
          const lx = Math.sin(time * freqA * 0.01 + i) * (h * 0.3)
          const ly = Math.cos(time * freqB * 0.01 + i) * (h * 0.3)
          
          if (i === 0) ctx.moveTo(lx, ly)
          else ctx.lineTo(lx, ly)
        }
        ctx.stroke()
      }
      
      ctx.restore()
      time += 0.05

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (audioCtxRef.current) {
        const { oscA, oscB, volA, volB, filterA, reverbB } = audioCtxRef.current
        oscA.dispose()
        oscB.dispose()
        volA.dispose()
        volB.dispose()
        filterA.dispose()
        reverbB.dispose()
      }
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
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2">
          <Music className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Look left/right to change pitch. Up/down for filter/reverb. Blink to mute.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Eye Synth</p>
            <p className="mb-4 text-sm text-white/70">A musical synthesizer controlled entirely by your gaze. Create geometric soundscapes by looking around.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
