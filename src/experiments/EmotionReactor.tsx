import { useRef, useEffect, useState, useCallback } from 'react'
import { useWebcam } from '@/hooks/useWebcam'
import * as Tone from 'tone'
import { Play, Square, Smile, Frown, Zap, Droplets } from 'lucide-react'

interface Props { onClose: () => void }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string }

export default function EmotionReactor({ onClose }: Props) {
  const { videoRef, start, stop } = useWebcam()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [emotion, setEmotion] = useState('Neutral')
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)
  const emotionRef = useRef('Neutral')
  const emotionTimer = useRef(0)
  const synthRef = useRef<Tone.Synth | null>(null)

  const getDominantEmotion = useCallback((imageData: ImageData) => {
    // Simplified emotion estimation from image brightness/color
    const data = imageData.data
    let brightness = 0, red = 0, green = 0, blue = 0
    const step = 16
    for (let i = 0; i < data.length; i += step * 4) {
      brightness += (data[i] + data[i + 1] + data[i + 2]) / 3
      red += data[i]; green += data[i + 1]; blue += data[i + 2]
    }
    const count = data.length / (step * 4)
    brightness /= count
    red /= count; green /= count; blue /= count

    if (brightness > 150 && green > red * 0.9) return 'Happy'
    if (brightness > 140 && red > green && red > blue) return 'Surprised'
    if (brightness < 80) return 'Sad'
    if (red > green * 1.3 && red > blue * 1.3) return 'Angry'
    return 'Neutral'
  }, [])

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const synth = new Tone.Synth().toDestination()
    synthRef.current = synth

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      ctx.save()
      if (video.readyState >= 2) {
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
      } else {
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(-w, 0, w, h)
      }
      ctx.restore()

      // Sample center region for emotion
      try {
        const sampleW = Math.min(w, 200)
        const sampleH = Math.min(h, 200)
        const sx = (w - sampleW) / 2
        const sy = (h - sampleH) / 2
        const imageData = ctx.getImageData(sx, sy, sampleW, sampleH)
        const detected = getDominantEmotion(imageData)

        if (detected === emotionRef.current) {
          emotionTimer.current++
          if (emotionTimer.current > 30) {
            setEmotion(detected)
            emotionTimer.current = 0
          }
        } else {
          emotionRef.current = detected
          emotionTimer.current = 0
        }
      } catch { /* cross-origin tainted canvas */ }

      // Visual effects per emotion
      const currentEmotion = emotionRef.current

      if (currentEmotion === 'Happy') {
        // Warm overlay + confetti
        ctx.fillStyle = 'rgba(255, 200, 50, 0.15)'
        ctx.fillRect(0, 0, w, h)
        if (Math.random() > 0.7) {
          particlesRef.current.push({
            x: Math.random() * w, y: -10,
            vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2,
            life: 1, size: 4 + Math.random() * 6,
            color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'][Math.floor(Math.random() * 4)]
          })
        }
      } else if (currentEmotion === 'Surprised') {
        // Flash effect
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(Math.sin(Date.now() * 0.01)) * 0.1})`
        ctx.fillRect(0, 0, w, h)
      } else if (currentEmotion === 'Angry') {
        ctx.fillStyle = `rgba(255, 50, 50, ${0.1 + Math.sin(Date.now() * 0.02) * 0.05})`
        ctx.fillRect(0, 0, w, h)
        // Screen shake
        ctx.save()
        ctx.translate(Math.sin(Date.now() * 0.05) * 3, Math.cos(Date.now() * 0.05) * 3)
      } else if (currentEmotion === 'Sad') {
        ctx.fillStyle = 'rgba(50, 100, 200, 0.15)'
        ctx.fillRect(0, 0, w, h)
        // Rain
        if (Math.random() > 0.8) {
          particlesRef.current.push({
            x: Math.random() * w, y: -10,
            vx: -0.5, vy: 4 + Math.random() * 3,
            life: 1, size: 2, color: '#6699CC'
          })
        }
      } else {
        // Neutral - breathing circle
        const pulse = 0.9 + Math.sin(Date.now() * 0.003) * 0.1
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.3)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, 60 * pulse, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Particles
      const parts = particlesRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.x += p.vx; p.y += p.vy; p.life -= 0.008
        if (p.life <= 0 || p.y > h + 20) { parts.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
        ctx.restore()
      }

      if (currentEmotion === 'Angry') ctx.restore()

      // Emotion label
      ctx.save()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 20px Space Grotesk, sans-serif'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 10
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.fillText(currentEmotion, w / 2, 40)
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
    }
  }, [running, getDominantEmotion, videoRef])

  const handleStart = async () => {
    await Tone.start()
    await start()
    setRunning(true)
  }
  const handleStop = () => { setRunning(false); stop(); onClose() }

  const emotionIcons: Record<string, React.ElementType> = { Happy: Smile, Sad: Frown, Angry: Zap, Surprised: Zap, Neutral: Droplets }
  const EmotionIcon = emotionIcons[emotion] || Droplets

  return (
    <div className="relative w-full h-full flex flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 rounded-full accent-gradient text-white text-sm font-medium btn-hover"><Play className="w-4 h-4" /> Start</button>
        ) : (
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-full glass text-white text-sm font-medium btn-hover"><Square className="w-4 h-4" /> Stop</button>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10 glass rounded-full px-4 py-2 flex items-center gap-2 text-white text-sm">
        <EmotionIcon className="w-4 h-4" /> {emotion}
      </div>
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full" style={{ minHeight: '60vh' }} />
      {!running && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-2xl">
          <div className="text-center p-8">
            <p className="text-white text-lg font-semibold mb-2">Emotion Reactor</p>
            <p className="text-white/70 text-sm mb-4">Smile, frown, or show expressions. The screen reacts to your emotion.</p>
            <button onClick={handleStart} className="px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover">Start Camera</button>
          </div>
        </div>
      )}
    </div>
  )
}
