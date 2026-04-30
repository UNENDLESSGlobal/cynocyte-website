import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Droplets, Frown, Play, Smile, Square, Zap } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { getBlendshapeScore } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  color: string
}

export default function EmotionReactor({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [emotion, setEmotion] = useState('Neutral')
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)
  const confirmedEmotionRef = useRef('Neutral')
  const candidateEmotionRef = useRef('Neutral')
  const candidateFramesRef = useRef(0)
  const synthRef = useRef<Tone.Synth | null>(null)

  const detectEmotion = (blendshapes?: Array<{ categories?: Array<{ categoryName: string; score: number }> }>) => {
    const smile = (getBlendshapeScore(blendshapes, 'mouthSmileLeft') + getBlendshapeScore(blendshapes, 'mouthSmileRight')) / 2
    const frown = (getBlendshapeScore(blendshapes, 'mouthFrownLeft') + getBlendshapeScore(blendshapes, 'mouthFrownRight')) / 2
    const jawOpen = getBlendshapeScore(blendshapes, 'jawOpen')
    const browUp = getBlendshapeScore(blendshapes, 'browInnerUp')
    const browDown = (getBlendshapeScore(blendshapes, 'browDownLeft') + getBlendshapeScore(blendshapes, 'browDownRight')) / 2

    if (smile > 0.42) return 'Happy'
    if (jawOpen > 0.32 && browUp > 0.28) return 'Surprised'
    if (browDown > 0.32 && smile < 0.18) return 'Angry'
    if (frown > 0.24) return 'Sad'
    return 'Neutral'
  }

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const synth = new Tone.Synth().toDestination()
    synthRef.current = synth

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const triggerEmotionSound = (nextEmotion: string) => {
      if (nextEmotion === 'Happy') synth.triggerAttackRelease('C5', '8n')
      if (nextEmotion === 'Surprised') synth.triggerAttackRelease('A5', '16n')
      if (nextEmotion === 'Angry') synth.triggerAttackRelease('E3', '8n')
      if (nextEmotion === 'Sad') synth.triggerAttackRelease('D4', '4n')
    }

    const loop = () => {
      const width = canvas.width
      const height = canvas.height

      ctx.save()
      if (video.readyState >= 2) {
        ctx.scale(-1, 1)
        ctx.drawImage(video, -width, 0, width, height)
      } else {
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(-width, 0, width, height)
      }
      ctx.restore()

      const blendshapes = detectFrame(performance.now())?.face?.faceBlendshapes
      const detected = detectEmotion(blendshapes)

      if (detected === candidateEmotionRef.current) {
        candidateFramesRef.current += 1
      } else {
        candidateEmotionRef.current = detected
        candidateFramesRef.current = 0
      }

      if (candidateFramesRef.current >= 15 && detected !== confirmedEmotionRef.current) {
        confirmedEmotionRef.current = detected
        setEmotion(detected)
        triggerEmotionSound(detected)
      }

      const currentEmotion = confirmedEmotionRef.current

      if (currentEmotion === 'Happy') {
        ctx.fillStyle = 'rgba(255, 200, 50, 0.15)'
        ctx.fillRect(0, 0, width, height)
        if (Math.random() > 0.7) {
          particlesRef.current.push({
            x: Math.random() * width,
            y: -10,
            vx: (Math.random() - 0.5) * 2,
            vy: 2 + Math.random() * 2,
            life: 1,
            size: 4 + Math.random() * 6,
            color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'][Math.floor(Math.random() * 4)],
          })
        }
      } else if (currentEmotion === 'Surprised') {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(Math.sin(Date.now() * 0.01)) * 0.18})`
        ctx.fillRect(0, 0, width, height)
      } else if (currentEmotion === 'Angry') {
        ctx.save()
        ctx.translate(Math.sin(Date.now() * 0.05) * 3, Math.cos(Date.now() * 0.05) * 3)
        ctx.fillStyle = `rgba(255, 50, 50, ${0.12 + Math.sin(Date.now() * 0.02) * 0.08})`
        ctx.fillRect(0, 0, width, height)
        ctx.restore()
      } else if (currentEmotion === 'Sad') {
        ctx.fillStyle = 'rgba(50, 100, 200, 0.16)'
        ctx.fillRect(0, 0, width, height)
        if (Math.random() > 0.8) {
          particlesRef.current.push({
            x: Math.random() * width,
            y: -10,
            vx: -0.5,
            vy: 4 + Math.random() * 3,
            life: 1,
            size: 2,
            color: '#6699CC',
          })
        }
      } else {
        const pulse = 0.9 + Math.sin(Date.now() * 0.003) * 0.1
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.3)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, 60 * pulse, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (let index = particlesRef.current.length - 1; index >= 0; index -= 1) {
        const particle = particlesRef.current[index]
        particle.x += particle.vx
        particle.y += particle.vy
        particle.life -= 0.008
        if (particle.life <= 0 || particle.y > height + 20) {
          particlesRef.current.splice(index, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = particle.life
        ctx.fillStyle = particle.color
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
        ctx.restore()
      }

      ctx.save()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 20px Space Grotesk, sans-serif'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 10
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.fillText(currentEmotion, width / 2, 40)
      ctx.restore()

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      synth.dispose()
    }
  }, [detectFrame, running, videoRef])

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

  const emotionIcons: Record<string, React.ElementType> = {
    Happy: Smile,
    Sad: Frown,
    Angry: Zap,
    Surprised: Zap,
    Neutral: Droplets,
  }
  const EmotionIcon = emotionIcons[emotion] || Droplets
  const launchError = visionError ?? error

  return (
    <div className="relative flex h-full w-full flex-col" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
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
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white">
        <EmotionIcon className="h-4 w-4" /> {emotion}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Emotion Reactor</p>
            <p className="mb-4 text-sm text-white/70">Smile, act surprised, furrow your brows, or look sad. The scene responds once the expression is held briefly.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
