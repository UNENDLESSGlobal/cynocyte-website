import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Palette, Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { isIndexExtended, lineIntersection, toCanvasPoint, type Point } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

const colorSchemes = [
  {
    name: 'blue/red',
    primary: { core: '#ffffff', glow: '#4488ff', outer: '#2266cc' },
    secondary: { core: '#ffffff', glow: '#ff4444', outer: '#cc2222' },
  },
  {
    name: 'green/violet',
    primary: { core: '#ffffff', glow: '#44ff88', outer: '#22cc66' },
    secondary: { core: '#ffffff', glow: '#b266ff', outer: '#7c3aed' },
  },
  {
    name: 'amber/cyan',
    primary: { core: '#ffffff', glow: '#ffb347', outer: '#f97316' },
    secondary: { core: '#ffffff', glow: '#4deeea', outer: '#0891b2' },
  },
]

export default function FingerLightsaber({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [schemeIndex, setSchemeIndex] = useState(0)
  const animRef = useRef<number>(0)
  const humOscRef = useRef<Tone.Oscillator | null>(null)
  const clashSynthRef = useRef<Tone.NoiseSynth | null>(null)
  const sparksRef = useRef<Spark[]>([])
  const clashCooldownRef = useRef(0)

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const humOsc = new Tone.Oscillator(60, 'sawtooth').toDestination()
    humOsc.volume.value = -25
    humOsc.start()
    humOscRef.current = humOsc

    const clashSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    }).toDestination()
    clashSynth.volume.value = -10
    clashSynthRef.current = clashSynth

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const width = canvas.width
      const height = canvas.height

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -width, 0, width, height)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, width, height)
      }

      ctx.fillStyle = 'rgba(6, 6, 16, 0.38)'
      ctx.fillRect(0, 0, width, height)

      const scheme = colorSchemes[schemeIndex]
      const activeSabers: Array<{ handle: Point; tip: Point; color: typeof scheme.primary }> = []
      const hands = detectFrame(performance.now())?.hand?.landmarks ?? []

      hands.forEach((landmarks, index) => {
        if (!isIndexExtended(landmarks)) return

        const base = toCanvasPoint(landmarks[5], width, height)
        const tip = toCanvasPoint(landmarks[8], width, height)
        const dx = tip.x - base.x
        const dy = tip.y - base.y
        const magnitude = Math.max(1, Math.hypot(dx, dy))
        const color = index === 0 ? scheme.primary : scheme.secondary
        const bladeLength = height * 0.6
        const saberTip = {
          x: tip.x + (dx / magnitude) * bladeLength,
          y: tip.y + (dy / magnitude) * bladeLength,
        }
        const handle = {
          x: base.x - (dx / magnitude) * 30,
          y: base.y - (dy / magnitude) * 30,
        }

        activeSabers.push({ handle, tip: saberTip, color })

        const pulse = 2 + Math.sin(Date.now() * 0.1) * 2

        ctx.save()
        ctx.strokeStyle = color.outer
        ctx.lineWidth = 24 + pulse
        ctx.globalAlpha = 0.2
        ctx.shadowBlur = 40
        ctx.shadowColor = color.glow
        ctx.beginPath()
        ctx.moveTo(handle.x, handle.y)
        ctx.lineTo(saberTip.x, saberTip.y)
        ctx.stroke()

        ctx.strokeStyle = color.glow
        ctx.lineWidth = 12
        ctx.globalAlpha = 0.6
        ctx.shadowBlur = 25
        ctx.beginPath()
        ctx.moveTo(handle.x, handle.y)
        ctx.lineTo(saberTip.x, saberTip.y)
        ctx.stroke()

        ctx.strokeStyle = color.core
        ctx.lineWidth = 4 + pulse * 0.3
        ctx.globalAlpha = 1
        ctx.shadowBlur = 15
        ctx.shadowColor = color.glow
        ctx.beginPath()
        ctx.moveTo(handle.x, handle.y)
        ctx.lineTo(saberTip.x, saberTip.y)
        ctx.stroke()
        ctx.restore()

        ctx.save()
        ctx.fillStyle = '#888'
        ctx.fillRect(handle.x - 6, handle.y - 4, 12, 34)
        ctx.fillStyle = '#aaa'
        ctx.fillRect(handle.x - 8, handle.y + 2, 16, 4)
        ctx.fillRect(handle.x - 8, handle.y + 16, 16, 4)
        ctx.restore()
      })

      humOsc.frequency.value = 60 + activeSabers.length * 5 + Math.sin(Date.now() * 0.04) * 3

      if (activeSabers.length >= 2 && clashCooldownRef.current <= 0) {
        const clash = lineIntersection(activeSabers[0].handle, activeSabers[0].tip, activeSabers[1].handle, activeSabers[1].tip)
        if (clash) {
          clashSynth.triggerAttackRelease('16n')
          clashCooldownRef.current = 12
          for (let index = 0; index < 24; index += 1) {
            sparksRef.current.push({
              x: clash.x,
              y: clash.y,
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12,
              life: 1,
            })
          }

          ctx.save()
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          ctx.shadowBlur = 32
          ctx.shadowColor = '#ffffff'
          ctx.beginPath()
          ctx.arc(clash.x, clash.y, 20, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      clashCooldownRef.current = Math.max(0, clashCooldownRef.current - 1)

      for (let index = sparksRef.current.length - 1; index >= 0; index -= 1) {
        const spark = sparksRef.current[index]
        spark.x += spark.vx
        spark.y += spark.vy
        spark.life -= 0.025
        if (spark.life <= 0) {
          sparksRef.current.splice(index, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = spark.life
        ctx.fillStyle = '#ffdd44'
        ctx.shadowBlur = 6
        ctx.shadowColor = '#ffdd44'
        ctx.beginPath()
        ctx.arc(spark.x, spark.y, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      if (!activeSabers.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.72)'
        ctx.font = '600 15px Space Grotesk, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Extend one or two index fingers to ignite the sabers', width / 2, height / 2)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      humOsc.stop()
      humOsc.dispose()
      clashSynth.dispose()
    }
  }, [detectFrame, running, schemeIndex, videoRef])

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

  const cycleColor = () => {
    setSchemeIndex((value) => (value + 1) % colorSchemes.length)
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
            <button onClick={cycleColor} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Palette className="h-4 w-4" /> {colorSchemes[schemeIndex].name}
            </button>
          </>
        )}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full" style={{ minHeight: '60vh' }} />

      {!running && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Finger Lightsaber</p>
            <p className="mb-4 text-sm text-white/70">Extend your index fingers to summon sabers. Cross them to trigger the clash effect.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Activate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
