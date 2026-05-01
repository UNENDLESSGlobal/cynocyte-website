import { useEffect, useRef, useState } from 'react'
import { Play, Square, Video, Mic, RefreshCw } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { clamp } from '@/lib/landmarks'

interface Props {
  onClose: () => void
}

type CharacterType = 'robot' | 'alien' | 'anime'

export default function LipSyncAnimator({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const [character, setCharacter] = useState<CharacterType>('robot')
  const [recording, setRecording] = useState(false)
  const [micActive, setMicActive] = useState(false)
  
  const animRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

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

    // Setup audio
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      micStreamRef.current = stream
      setMicActive(true)
      const actx = new window.AudioContext()
      audioContextRef.current = actx
      const source = actx.createMediaStreamSource(stream)
      const analyser = actx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
    }).catch(err => console.error('Mic error:', err))

    let eyeBlink = 0
    let mouthOpen = 0
    let mouthSmile = 0

    const drawCharacter = (type: CharacterType, x: number, y: number, scale: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(scale, scale)

      // Base Head
      ctx.fillStyle = type === 'robot' ? '#94a3b8' : type === 'alien' ? '#4ade80' : '#fcd34d'
      ctx.beginPath()
      if (type === 'robot') {
        ctx.roundRect(-80, -100, 160, 200, 20)
      } else if (type === 'alien') {
        ctx.ellipse(0, 0, 90, 120, 0, 0, Math.PI * 2)
      } else {
        ctx.arc(0, 0, 100, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#000'
      ctx.stroke()

      // Eyes
      const eyeY = -30
      const eyeX = 35
      const eyeH = type === 'anime' ? 40 : 25
      const blinkScale = Math.max(0.1, 1 - eyeBlink)

      ctx.fillStyle = type === 'alien' ? '#000' : '#fff'
      
      // Left eye
      ctx.beginPath()
      ctx.ellipse(-eyeX, eyeY, 20, eyeH * blinkScale, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Right eye
      ctx.beginPath()
      ctx.ellipse(eyeX, eyeY, 20, eyeH * blinkScale, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      if (type !== 'alien' && blinkScale > 0.2) {
        ctx.fillStyle = type === 'robot' ? '#ef4444' : '#3b82f6'
        ctx.beginPath()
        ctx.arc(-eyeX, eyeY, 8, 0, Math.PI * 2)
        ctx.arc(eyeX, eyeY, 8, 0, Math.PI * 2)
        ctx.fill()
      }

      // Mouth
      const mY = 50
      const mW = 30 + mouthSmile * 30
      const mH = 5 + mouthOpen * 40

      ctx.fillStyle = '#000'
      ctx.beginPath()
      if (type === 'robot') {
        // Robotic rectangle mouth
        const segments = 5
        const segW = (mW * 2) / segments
        for(let i=0; i<segments; i++) {
          ctx.fillRect(-mW + i*segW + 2, mY - mH/2, segW - 4, mH)
        }
      } else {
        // Bezier curve mouth
        ctx.moveTo(-mW, mY)
        ctx.quadraticCurveTo(0, mY + mH * 2, mW, mY)
        ctx.quadraticCurveTo(0, mY - (mouthSmile > 0.5 ? mH : 0), -mW, mY)
        ctx.fill()
      }

      ctx.restore()
    }

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, '#0f172a')
      bgGrad.addColorStop(1, '#1e293b')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      // Background audio visualizer
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        
        const barWidth = w / 32
        for (let i = 0; i < 32; i++) {
          const value = data[i * 2]
          const percent = value / 255
          const barHeight = h * percent * 0.5
          
          ctx.fillStyle = `hsla(${200 + i * 5}, 80%, 60%, 0.3)`
          ctx.fillRect(i * barWidth, h - barHeight, barWidth - 2, barHeight)
        }
      }

      if (video.readyState >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w/4, h - (w/4)*(video.videoHeight/video.videoWidth), w/4, (w/4)*(video.videoHeight/video.videoWidth))
        ctx.restore()
      }

      const results = detectFrame(performance.now())
      const face = results?.face?.faceBlendshapes?.[0]?.categories

      let targetBlink = 0
      let targetMouth = 0
      let targetSmile = 0

      if (face) {
        const getScore = (name: string) => face.find(c => c.categoryName === name)?.score ?? 0
        targetBlink = Math.max(getScore('eyeBlinkLeft'), getScore('eyeBlinkRight'))
        targetMouth = getScore('jawOpen')
        targetSmile = Math.max(getScore('mouthSmileLeft'), getScore('mouthSmileRight'))
      }

      // Audio reactive mouth
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < 32; i++) sum += data[i] // Only average lower freq for voice
        const avg = sum / 32
        // Boost mouth openness if talking loudly
        if (avg > 10) {
          targetMouth = Math.max(targetMouth, clamp((avg - 10) / 60, 0, 1))
        }
      }

      // Smooth interpolation
      eyeBlink += (targetBlink - eyeBlink) * 0.3
      mouthOpen += (targetMouth - mouthOpen) * 0.4
      mouthSmile += (targetSmile - mouthSmile) * 0.2

      drawCharacter(characterRef.current, w / 2, h / 2, Math.min(w, h) / 300)

      // Recording indicator
      if (recordingRef.current) {
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(w - 30, 30, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText('REC', w - 45, 35)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      if (audioContextRef.current) audioContextRef.current.close()
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop())
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [detectFrame, running, videoRef])

  const characterRef = useRef(character)
  useEffect(() => { characterRef.current = character }, [character])

  const recordingRef = useRef(recording)
  useEffect(() => { recordingRef.current = recording }, [recording])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    onClose()
  }

  const toggleRecording = () => {
    if (!canvasRef.current) return

    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
    } else {
      const canvasStream = canvasRef.current.captureStream(30)
      const audioTrack = micStreamRef.current?.getAudioTracks()[0]
      if (audioTrack) {
        canvasStream.addTrack(audioTrack)
      }

      const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' })
      recordedChunksRef.current = []
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `lipsync-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)

      // Auto stop after 10s
      setTimeout(() => {
        if (recordingRef.current) {
          mediaRecorderRef.current?.stop()
          setRecording(false)
        }
      }, 10000)
    }
  }

  const launchError = visionError ?? error

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start
          </button>
        ) : (
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <button 
              onClick={toggleRecording} 
              className={`btn-hover flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-colors ${
                recording ? 'bg-red-500 hover:bg-red-600' : 'glass'
              }`}
            >
              <Video className="h-4 w-4" /> {recording ? 'Stop REC' : 'Record 10s'}
            </button>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-2 py-2">
          <RefreshCw className="w-4 h-4 text-white/50 ml-2" />
          <div className="flex bg-black/40 rounded-full p-1">
            {(['robot', 'alien', 'anime'] as CharacterType[]).map(c => (
              <button
                key={c}
                onClick={() => setCharacter(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  character === c ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mx-2 text-white/30">|</div>
          <div className="flex items-center gap-1 pr-3" title={micActive ? "Mic Active" : "Mic Inactive"}>
            <Mic className={`w-4 h-4 ${micActive ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Lip Sync Animator</p>
            <p className="mb-4 text-sm text-white/70">A cartoon character beside you mirrors your lip movements in real-time.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Start
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
