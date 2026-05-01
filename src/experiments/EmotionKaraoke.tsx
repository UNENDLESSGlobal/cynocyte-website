import { useEffect, useRef, useState } from 'react'
import { Play, Square, Mic } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

const LYRICS = [
  "Just a small town girl",
  "Livin' in a lonely world",
  "She took the midnight train goin' anywhere",
  "Just a city boy",
  "Born and raised in South Detroit",
  "He took the midnight train goin' anywhere",
  "A singer in a smokey room",
  "The smell of wine and cheap perfume",
  "For a smile they can share the night",
  "It goes on and on, and on, and on",
  "Don't stop believin'",
  "Hold on to that feelin'"
]

export default function EmotionKaraoke({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const micRef = useRef<Tone.UserMedia | null>(null)
  const meterRef = useRef<Tone.Meter | null>(null)

  const stateRef = useRef({
    emotion: 'neutral' as 'neutral' | 'happy' | 'sad' | 'surprised',
    particles: [] as any[],
    lyricIndex: 0,
    lyricProgress: 0,
    pitchBar: 0, // 0 to 1
    flashTimer: 0
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

    const setupMic = async () => {
      try {
        await Tone.start()
        micRef.current = new Tone.UserMedia()
        meterRef.current = new Tone.Meter()
        micRef.current.connect(meterRef.current)
        await micRef.current.open()
      } catch (e) {
        console.error("Mic access denied or unavailable", e)
      }
    }
    setupMic()

    const getShape = (shapes: any[], name: string) => {
      const s = shapes.find(s => s.categoryName === name)
      return s ? s.score : 0
    }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const s = stateRef.current

      // Advance Lyrics
      s.lyricProgress += 0.002
      if (s.lyricProgress >= 1) {
        s.lyricProgress = 0
        s.lyricIndex = (s.lyricIndex + 1) % LYRICS.length
      }

      // Audio Level
      let volume = -100
      if (meterRef.current) {
         volume = meterRef.current.getValue() as number // dB
      }
      // Map -60dB -> 0dB to 0 -> 1
      const normalizedVol = clamp((volume + 60) / 60, 0, 1)

      const results = detectFrame(performance.now())
      const shapes = results?.face?.faceBlendshapes?.[0]?.categories

      if (shapes) {
        const smile = (getShape(shapes, 'mouthSmileLeft') + getShape(shapes, 'mouthSmileRight')) / 2
        const sad = (getShape(shapes, 'browDownLeft') + getShape(shapes, 'browDownRight')) / 2 + getShape(shapes, 'mouthFrownLeft') * 0.5
        const surprise = (getShape(shapes, 'jawOpen') + getShape(shapes, 'browInnerUp')) / 2

        if (surprise > 0.4) s.emotion = 'surprised'
        else if (smile > 0.4) s.emotion = 'happy'
        else if (sad > 0.3) s.emotion = 'sad'
        else s.emotion = 'neutral'

        if (s.emotion === 'surprised' && Math.random() < 0.1) {
           s.flashTimer = 10
        }
      }

      // Simulate pitch accuracy based on jaw open & actual volume
      // If volume is high, pitch bar goes up. If mouth is shaped nicely (smile/open), it's more "accurate"
      if (shapes) {
         const jaw = getShape(shapes, 'jawOpen')
         const targetAcc = normalizedVol > 0.1 ? clamp(jaw * 2 + normalizedVol, 0.2, 1) : 0
         s.pitchBar += (targetAcc - s.pitchBar) * 0.1
      }

      // Draw Background
      if (s.emotion === 'sad') {
        ctx.fillStyle = 'rgba(10, 15, 30, 0.3)'
        ctx.fillRect(0, 0, w, h)
        // Add Rain particles
        if (Math.random() < 0.5) {
          s.particles.push({ type: 'rain', x: Math.random() * w, y: -10, vx: -2, vy: 15 + Math.random() * 10 })
        }
      } else if (s.emotion === 'happy') {
        ctx.fillStyle = 'rgba(30, 20, 10, 0.3)'
        ctx.fillRect(0, 0, w, h)
        // Add Fireflies
        if (Math.random() < 0.3) {
          s.particles.push({ type: 'firefly', x: Math.random() * w, y: h + 10, vx: (Math.random()-0.5)*2, vy: -2 - Math.random() * 2, life: 1 })
        }
      } else {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.2)'
        ctx.fillRect(0, 0, w, h)
      }

      // Draw Video (dimmed)
      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = s.emotion === 'surprised' ? 0.4 : 0.15
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      // Flash
      if (s.flashTimer > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.flashTimer * 0.05})`
        ctx.fillRect(0, 0, w, h)
        s.flashTimer--
        // Add burst particles
        for(let i=0; i<5; i++) {
          const a = Math.random() * Math.PI * 2
          const v = 5 + Math.random() * 10
          s.particles.push({ type: 'burst', x: w/2, y: h/2, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 1 })
        }
      }

      // Particles Physics & Render
      s.particles = s.particles.filter(p => {
        p.x += p.vx
        p.y += p.vy
        
        ctx.beginPath()
        if (p.type === 'rain') {
          ctx.strokeStyle = 'rgba(100, 150, 255, 0.6)'
          ctx.lineWidth = 2
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2)
          ctx.stroke()
          return p.y < h + 50
        } else if (p.type === 'firefly') {
          p.x += Math.sin(performance.now() * 0.005 + p.y) * 2 // Wiggle
          ctx.fillStyle = `rgba(255, 200, 50, ${p.life})`
          ctx.shadowBlur = 10
          ctx.shadowColor = '#ffaa00'
          ctx.arc(p.x, p.y, 3, 0, Math.PI*2)
          ctx.fill()
          ctx.shadowBlur = 0
          p.life -= 0.005
          return p.life > 0
        } else if (p.type === 'burst') {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`
          ctx.arc(p.x, p.y, 2 + p.life * 5, 0, Math.PI*2)
          ctx.fill()
          p.life -= 0.05
          return p.life > 0
        }
        return true
      })

      // UI: Lyrics
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, 0, w, 100)
      
      const currentLyric = LYRICS[s.lyricIndex]
      const nextLyric = LYRICS[(s.lyricIndex + 1) % LYRICS.length]
      
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Highlighted sung portion
      const splitIdx = Math.floor(currentLyric.length * s.lyricProgress)
      const sung = currentLyric.substring(0, splitIdx)
      const unsung = currentLyric.substring(splitIdx)
      
      ctx.font = 'bold 36px sans-serif'
      const sungW = ctx.measureText(sung).width
      const unsungW = ctx.measureText(unsung).width
      const startX = w/2 - (sungW + unsungW)/2
      
      ctx.fillStyle = '#00ffff'
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 10
      ctx.textAlign = 'left'
      ctx.fillText(sung, startX, 40)
      ctx.shadowBlur = 0
      
      ctx.fillStyle = '#ffffff'
      ctx.fillText(unsung, startX + sungW, 40)
      
      // Next lyric
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(nextLyric, w/2, 80)

      // UI: Pitch Accuracy Bar
      const barH = h - 200
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(w - 60, 150, 20, barH)
      
      const fillH = s.pitchBar * barH
      // Color from red (0) to green (1)
      const hue = s.pitchBar * 120
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 10
      ctx.fillRect(w - 60, 150 + barH - fillH, 20, fillH)
      ctx.shadowBlur = 0
      
      ctx.fillStyle = '#fff'
      ctx.font = '14px sans-serif'
      ctx.fillText('PITCH', w - 50, 130)

      // Current Emotion text
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`MOOD: ${s.emotion.toUpperCase()}`, 40, h - 40)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (micRef.current) {
        micRef.current.close()
        micRef.current.dispose()
      }
      if (meterRef.current) meterRef.current.dispose()
    }
  }, [detectFrame, running])

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
          <Mic className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Sing into the microphone. Make faces to change the stage visuals!</span>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Emotion Karaoke</p>
            <p className="mb-4 text-sm text-white/70">Sing your heart out! The stage visuals react instantly to your facial expressions—smile for warmth, frown for rain.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Grab the Mic
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
