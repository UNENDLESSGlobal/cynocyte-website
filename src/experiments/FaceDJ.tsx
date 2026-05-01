import { useEffect, useRef, useState } from 'react'
import { Play, Square, Headphones } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

export default function FaceDJ({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const synthsRef = useRef<{
    kick: Tone.MembraneSynth | null,
    hat: Tone.MetalSynth | null,
    bass: Tone.Synth | null,
    lead: Tone.PolySynth | null,
    loops: Tone.Loop[]
  }>({
    kick: null, hat: null, bass: null, lead: null, loops: []
  })

  // State channels for UI visualization
  const channelsRef = useRef({
    kick: { active: true, intensity: 0 }, // always playing
    hat: { active: false, intensity: 0 }, // smile
    bass: { active: false, intensity: 0 }, // brows
    lead: { active: false, intensity: 0 } // mouth open
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

    // Setup Tone.js sequence
    const setupAudio = async () => {
      await Tone.start()
      Tone.Transport.bpm.value = 120

      const kick = new Tone.MembraneSynth().toDestination()
      const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination()
      const bass = new Tone.Synth({ oscillator: { type: 'fmmsquare' } }).toDestination()
      const lead = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.1, release: 0.2 } }).toDestination()

      hat.volume.value = -10
      bass.volume.value = -5
      lead.volume.value = -5

      synthsRef.current = { kick, hat, bass, lead, loops: [] }

      // Sequence
      let step = 0
      const bassNotes = ['C2', 'C2', 'E2', 'D2', 'C2', 'C2', 'G1', 'G1']
      const leadChords = [['C4', 'E4', 'G4'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['E4', 'G4', 'B4']]

      const loop = new Tone.Loop((time) => {
        const c = channelsRef.current
        
        // Kick on 1/4 notes
        if (step % 4 === 0 && c.kick.active) {
          kick.triggerAttackRelease('C1', '8n', time)
          c.kick.intensity = 1
        }

        // Hats on 1/16 notes
        if (c.hat.active) {
          hat.triggerAttackRelease('32n', time, step % 4 === 0 ? 0.8 : 0.4) // Accent on downbeat
          c.hat.intensity = 1
        }

        // Bass on 1/8 notes
        if (step % 2 === 0 && c.bass.active) {
          bass.triggerAttackRelease(bassNotes[(step/2) % bassNotes.length], '16n', time)
          c.bass.intensity = 1
        }

        // Lead chords every 2 beats (8 steps)
        if (step % 8 === 0 && c.lead.active) {
          lead.triggerAttackRelease(leadChords[Math.floor(step/8) % leadChords.length], '4n', time)
          c.lead.intensity = 1
        }

        step = (step + 1) % 16
      }, '16n')

      loop.start(0)
      synthsRef.current.loops.push(loop)
      Tone.Transport.start()
    }
    setupAudio()

    // Helper to get blendshape score safely
    const getShape = (shapes: any[], name: string) => {
      const s = shapes.find(s => s.categoryName === name)
      return s ? s.score : 0
    }

    const drawLoop = () => {
      const w = canvas.width
      const h = canvas.height
      const c = channelsRef.current

      // Background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, w, h)

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.2
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const shapes = results?.face?.faceBlendshapes?.[0]?.categories
      const landmarks = results?.face?.faceLandmarks?.[0]

      if (shapes) {
        // Control Logic
        const smile = (getShape(shapes, 'mouthSmileLeft') + getShape(shapes, 'mouthSmileRight')) / 2
        const brows = (getShape(shapes, 'browInnerUp') + getShape(shapes, 'browOuterUpLeft') + getShape(shapes, 'browOuterUpRight')) / 3
        const jaw = getShape(shapes, 'jawOpen')

        // Hysteresis/Thresholding
        if (smile > 0.4) c.hat.active = true
        else if (smile < 0.2) c.hat.active = false

        if (brows > 0.4) c.bass.active = true
        else if (brows < 0.2) c.bass.active = false

        if (jaw > 0.3) c.lead.active = true
        else if (jaw < 0.1) c.lead.active = false
      }

      // Draw UI / Visualizer
      const channels = [
        { name: 'KICK', active: c.kick.active, intensity: c.kick.intensity, color: '#ff0055', icon: 'Always On' },
        { name: 'HI-HATS', active: c.hat.active, intensity: c.hat.intensity, color: '#00ffff', icon: 'Smile' },
        { name: 'BASS', active: c.bass.active, intensity: c.bass.intensity, color: '#4ade80', icon: 'Raise Brows' },
        { name: 'CHORDS', active: c.lead.active, intensity: c.lead.intensity, color: '#facc15', icon: 'Open Mouth' }
      ]

      const barWidth = 120
      const spacing = 40
      const totalWidth = (barWidth * 4) + (spacing * 3)
      const startX = (w - totalWidth) / 2

      channels.forEach((ch, i) => {
        const x = startX + i * (barWidth + spacing)
        const centerY = h / 2

        // Base box
        ctx.fillStyle = ch.active ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'
        ctx.fillRect(x, centerY - 150, barWidth, 300)

        // Outline
        ctx.strokeStyle = ch.active ? ch.color : 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 2
        ctx.strokeRect(x, centerY - 150, barWidth, 300)

        // Intensity fill
        const fillHeight = 300 * ch.intensity
        ctx.fillStyle = ch.color
        ctx.shadowColor = ch.color
        ctx.shadowBlur = 20
        ctx.fillRect(x, centerY + 150 - fillHeight, barWidth, fillHeight)
        ctx.shadowBlur = 0

        // Labels
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 20px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(ch.name, x + barWidth/2, centerY - 170)

        ctx.fillStyle = ch.active ? ch.color : 'rgba(255,255,255,0.5)'
        ctx.font = '14px sans-serif'
        ctx.fillText(ch.icon, x + barWidth/2, centerY + 180)

        // Decay intensity
        if (i === 0) c.kick.intensity *= 0.8
        else if (i === 1) c.hat.intensity *= 0.8
        else if (i === 2) c.bass.intensity *= 0.8
        else if (i === 3) c.lead.intensity *= 0.8
      })

      // Draw Face Markers
      if (landmarks) {
        ctx.fillStyle = '#ff00ff'
        // Mouth
        const mouthTop = landmarks[13]
        const mouthBot = landmarks[14]
        ctx.beginPath(); ctx.arc((1-mouthTop.x)*w, mouthTop.y*h, 4, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc((1-mouthBot.x)*w, mouthBot.y*h, 4, 0, Math.PI*2); ctx.fill()
        // Brows
        const browL = landmarks[105]
        const browR = landmarks[334]
        ctx.fillStyle = '#4ade80'
        ctx.beginPath(); ctx.arc((1-browL.x)*w, browL.y*h, 4, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc((1-browR.x)*w, browR.y*h, 4, 0, Math.PI*2); ctx.fill()
        // Smile corners
        const smileL = landmarks[61]
        const smileR = landmarks[291]
        ctx.fillStyle = '#00ffff'
        ctx.beginPath(); ctx.arc((1-smileL.x)*w, smileL.y*h, 4, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc((1-smileR.x)*w, smileR.y*h, 4, 0, Math.PI*2); ctx.fill()
      }

      animRef.current = requestAnimationFrame(drawLoop)
    }

    animRef.current = requestAnimationFrame(drawLoop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      Tone.Transport.stop()
      synthsRef.current.loops.forEach(l => l.dispose())
      if (synthsRef.current.kick) synthsRef.current.kick.dispose()
      if (synthsRef.current.hat) synthsRef.current.hat.dispose()
      if (synthsRef.current.bass) synthsRef.current.bass.dispose()
      if (synthsRef.current.lead) synthsRef.current.lead.dispose()
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
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Headphones className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Make faces to toggle tracks and build a beat!</span>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Face DJ</p>
            <p className="mb-4 text-sm text-white/70">Your expressions control the music mix. Smile for hi-hats, raise brows for bass, open mouth for synths.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start Mixing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
