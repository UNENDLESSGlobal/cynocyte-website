import { useEffect, useRef, useState } from 'react'
import { Play, Square, Activity } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

const SCALE = ['C', 'D', 'E', 'G', 'A']

function getNoteFromRatio(ratio: number, octaves: number[]) {
  const noteIdx = Math.floor(ratio * SCALE.length * octaves.length)
  const clampedIdx = clamp(noteIdx, 0, SCALE.length * octaves.length - 1)
  const octave = octaves[Math.floor(clampedIdx / SCALE.length)]
  const note = SCALE[clampedIdx % SCALE.length]
  return `${note}${octave}`
}

export default function HumanTheremin({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ pose: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  // Tone.js nodes
  const nodesRef = useRef<{
    lead: Tone.Synth | null,
    bass: Tone.Synth | null,
    filter: Tone.Filter | null,
    chorus: Tone.Chorus | null,
    delay: Tone.FeedbackDelay | null,
    reverb: Tone.Reverb | null,
    vol: Tone.Volume | null
  }>({
    lead: null, bass: null, filter: null, chorus: null, delay: null, reverb: null, vol: null
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

    // Setup Audio Chain
    const setupAudio = async () => {
      await Tone.start()
      
      const vol = new Tone.Volume(-10).toDestination()
      const reverb = new Tone.Reverb(3)
      const delay = new Tone.FeedbackDelay("8n", 0.5)
      const chorus = new Tone.Chorus(4, 2.5, 0.5)
      const filter = new Tone.Filter(2000, "lowpass")
      
      const lead = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.1, release: 0.1 } })
      const bass = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.1, release: 0.1 } })

      // Chain: Lead -> Chorus -> Delay -> Reverb -> Filter -> Vol -> Dest
      lead.chain(chorus, delay, reverb, filter, vol)
      // Bass -> Filter -> Vol
      bass.chain(filter, vol)

      nodesRef.current = { lead, bass, filter, chorus, delay, reverb, vol }
    }
    setupAudio()

    let activeNotes = { lead: '', bass: '' }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height
      const nodes = nodesRef.current

      // Fade background
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
      const pose = results?.pose?.landmarks?.[0]

      if (pose && nodes.lead && nodes.bass && nodes.filter && nodes.delay && nodes.reverb && nodes.vol) {
        // Draw Skeleton lines
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'
        ctx.lineWidth = 2
        const drawBone = (p1: number, p2: number) => {
          if (pose[p1] && pose[p2] && pose[p1].visibility > 0.5 && pose[p2].visibility > 0.5) {
            ctx.beginPath()
            ctx.moveTo((1 - pose[p1].x) * w, pose[p1].y * h)
            ctx.lineTo((1 - pose[p2].x) * w, pose[p2].y * h)
            ctx.stroke()
          }
        }
        drawBone(11, 12) // Shoulders
        drawBone(11, 13); drawBone(13, 15) // L Arm
        drawBone(12, 14); drawBone(14, 16) // R Arm
        drawBone(11, 23); drawBone(12, 24); drawBone(23, 24) // Torso
        drawBone(23, 25); drawBone(25, 27) // L Leg
        drawBone(24, 26); drawBone(26, 28) // R Leg

        // Calculate parameters
        
        // 1. Right Wrist Y -> Lead Pitch (High notes)
        // Note: Landmarks are mirrored. 16 is right wrist physically, but appears on left of screen when mirrored.
        // Let's use 16 (Right) and 15 (Left)
        if (pose[16] && pose[16].visibility > 0.5) {
          const ratio = clamp(1 - pose[16].y, 0, 1) // 1 = top of screen
          const note = getNoteFromRatio(ratio, [4, 5, 6])
          if (note !== activeNotes.lead) {
            nodes.lead.triggerAttack(note)
            activeNotes.lead = note
          }
          drawMarker(pose[16], `Lead: ${note}`, '#00ffff')
        } else if (activeNotes.lead) {
          nodes.lead.triggerRelease()
          activeNotes.lead = ''
        }

        // 2. Left Wrist Y -> Bass Pitch (Low notes)
        if (pose[15] && pose[15].visibility > 0.5) {
          const ratio = clamp(1 - pose[15].y, 0, 1)
          const note = getNoteFromRatio(ratio, [2, 3])
          if (note !== activeNotes.bass) {
            nodes.bass.triggerAttack(note)
            activeNotes.bass = note
          }
          drawMarker(pose[15], `Bass: ${note}`, '#ff00ff')
        } else if (activeNotes.bass) {
          nodes.bass.triggerRelease()
          activeNotes.bass = ''
        }

        // 3. Wrist X Distance -> Delay Feedback
        if (pose[15] && pose[16] && pose[15].visibility > 0.5 && pose[16].visibility > 0.5) {
          const dist = Math.abs(pose[15].x - pose[16].x)
          const feedback = clamp(dist * 1.5, 0, 0.9) // 0 to 0.9
          nodes.delay.feedback.rampTo(feedback, 0.1)
          
          // Draw connecting line
          ctx.beginPath()
          ctx.moveTo((1 - pose[15].x) * w, pose[15].y * h)
          ctx.lineTo((1 - pose[16].x) * w, pose[16].y * h)
          ctx.strokeStyle = `rgba(255, 255, 0, ${feedback})`
          ctx.lineWidth = 4
          ctx.stroke()
        }

        // 4. Head Tilt (Ears 7, 8) -> Reverb Wet
        if (pose[7] && pose[8] && pose[7].visibility > 0.5 && pose[8].visibility > 0.5) {
          const tilt = Math.abs(pose[7].y - pose[8].y)
          const wet = clamp(tilt * 10, 0, 1)
          nodes.reverb.wet.rampTo(wet, 0.1)
          drawMarker(pose[0], `Reverb: ${Math.round(wet*100)}%`, '#ffff00') // Draw on nose
        }

        // 5. Ankle Spread (27, 28) -> Filter Cutoff
        if (pose[27] && pose[28] && pose[27].visibility > 0.5 && pose[28].visibility > 0.5) {
          const spread = Math.abs(pose[27].x - pose[28].x)
          const freq = clamp(spread * 5000 + 200, 200, 5000)
          nodes.filter.frequency.rampTo(freq, 0.1)
          drawMarker(pose[27], `Filter`, '#00ff00')
          drawMarker(pose[28], `${Math.round(freq)}Hz`, '#00ff00')
        }

        // 6. Master Volume -> Base on visibility of shoulders (just a global switch basically)
        // Actually, let's map height of hands to volume (both hands down = quiet)
        if (pose[15] && pose[16]) {
          const avgY = (pose[15].y + pose[16].y) / 2
          // If avgY is close to 1 (bottom), volume is low
          const volValue = clamp((1 - avgY) * 30 - 30, -40, 0) // -40dB to 0dB
          nodes.vol.volume.rampTo(volValue, 0.1)
        }
      } else {
        // Mute if no pose
        if (activeNotes.lead && nodes.lead) { nodes.lead.triggerRelease(); activeNotes.lead = ''; }
        if (activeNotes.bass && nodes.bass) { nodes.bass.triggerRelease(); activeNotes.bass = ''; }
      }

      function drawMarker(lm: any, label: string, color: string) {
        const px = (1 - lm.x) * w
        const py = lm.y * h
        
        ctx.beginPath()
        ctx.arc(px, py, 8, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 15
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.fillStyle = '#fff'
        ctx.font = '12px sans-serif'
        ctx.fillText(label, px + 15, py + 4)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (nodesRef.current.lead) {
        Object.values(nodesRef.current).forEach(n => {
          if (n) n.dispose()
        })
      }
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
          <Activity className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Move hands up/down for pitch. Tilt head for reverb. Spread legs for filter. Spread hands for delay.</span>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Human Theremin</p>
            <p className="mb-4 text-sm text-white/70">Your entire body becomes a musical instrument. Control pitch, filter, delay, and reverb simultaneously with different limbs.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Conducting
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
