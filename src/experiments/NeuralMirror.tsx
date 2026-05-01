import { useEffect, useRef, useState } from 'react'
import { Play, Square, Activity } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as THREE from 'three'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

const NUM_PARTICLES = 15000

export default function NeuralMirror({ onClose }: Props) {
  // THE ULTIMATE COMBO: Face, Pose, and Hand tracking all active!
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true, pose: true, hand: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const audioRef = useRef<{ drone: Tone.FMSynth | null }>({ drone: null })

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    const w = container.offsetWidth
    const h = container.offsetHeight

    // THREE.js Setup
    const scene = new THREE.Scene()
    // We will do a manual video background instead of scene.background for blending
    
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
    camera.position.set(0, 0, 5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    // Additive blending looks best on black
    renderer.setClearColor('#000000', 1) 
    container.appendChild(renderer.domElement)

    // Particle System
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(NUM_PARTICLES * 3)
    const colors = new Float32Array(NUM_PARTICLES * 3)
    const velocities = new Float32Array(NUM_PARTICLES * 3)

    // Initialize particles in a sphere
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const r = 2 * Math.cbrt(Math.random())
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      colors[i * 3] = 0.5
      colors[i * 3 + 1] = 0.5
      colors[i * 3 + 2] = 1.0

      velocities[i * 3] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Create a circular texture for particles
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx2 = canvas.getContext('2d')!
    const gradient = ctx2.createRadialGradient(8, 8, 0, 8, 8, 8)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx2.fillStyle = gradient
    ctx2.fillRect(0, 0, 16, 16)
    const texture = new THREE.CanvasTexture(canvas)

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      map: texture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.8
    })

    const particleSystem = new THREE.Points(geometry, material)
    scene.add(particleSystem)

    // Ambient Drone Audio
    const setupAudio = async () => {
       await Tone.start()
       const reverb = new Tone.Reverb(10).toDestination()
       reverb.wet.value = 0.8
       
       const drone = new Tone.FMSynth({
         harmonicity: 0.5,
         modulationIndex: 2,
         oscillator: { type: 'sine' },
         envelope: { attack: 2, decay: 0, sustain: 1, release: 5 },
         modulation: { type: 'triangle' }
       }).connect(reverb)
       
       drone.volume.value = -20
       drone.triggerAttack('C2')
       audioRef.current.drone = drone
    }
    setupAudio()

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    // State smoothers
    let smoothRadius = 2
    let smoothR = 0.2, smoothG = 0.5, smoothB = 1.0
    let smoothTurbulence = 0.01
    let time = 0

    // To draw the video background manually behind Three.js, we can just use CSS
    // by making renderer alpha: true and placing the video behind it.
    video.style.display = 'block'
    video.style.position = 'absolute'
    video.style.top = '0'
    video.style.left = '0'
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'cover'
    video.style.transform = 'scaleX(-1)'
    video.style.opacity = '0.15' // Meditative dim reflection
    video.style.zIndex = '0'
    renderer.domElement.style.zIndex = '10'
    renderer.domElement.style.position = 'absolute'

    const loop = () => {
      time += 0.01
      const results = detectFrame(performance.now())

      // 1. EXTRACT SIGNALS
      let smile = 0
      let armSpread = 1
      let handMovement = 0

      // Face (Color/Mood)
      if (results?.face?.faceBlendshapes?.[0]) {
         const shapes = results.face.faceBlendshapes[0].categories
         const sL = shapes.find(s => s.categoryName === 'mouthSmileLeft')?.score || 0
         const sR = shapes.find(s => s.categoryName === 'mouthSmileRight')?.score || 0
         smile = (sL + sR) / 2
      }

      // Pose (Volume / Size)
      if (results?.pose?.landmarks?.[0]) {
         const pose = results.pose.landmarks[0]
         if (pose[15] && pose[16]) {
            armSpread = Math.abs(pose[15].x - pose[16].x)
         }
      }

      // Hands (Turbulence)
      if (results?.hand?.landmarks) {
         handMovement = results.hand.landmarks.length > 0 ? 0.05 : 0 // More chaos if hands are up
      }

      // 2. SMOOTH TARGETS
      smoothRadius += (armSpread * 3 - smoothRadius) * 0.05
      smoothTurbulence += ((0.01 + handMovement) - smoothTurbulence) * 0.05

      // Smile mapping (Smile = Gold/Pink, Neutral = Blue/Purple)
      const targetR = smile > 0.3 ? 1.0 : 0.2
      const targetG = smile > 0.3 ? 0.8 : 0.5
      const targetB = smile > 0.3 ? 0.4 : 1.0
      
      smoothR += (targetR - smoothR) * 0.05
      smoothG += (targetG - smoothG) * 0.05
      smoothB += (targetB - smoothB) * 0.05

      // Audio Modulation
      if (audioRef.current.drone) {
         audioRef.current.drone.modulationIndex.rampTo(1 + smile * 5, 0.5)
         audioRef.current.drone.volume.rampTo(-30 + (armSpread * 15), 0.5)
      }

      // 3. UPDATE PARTICLES
      const posAttribute = geometry.attributes.position
      const colAttribute = geometry.attributes.color

      for (let i = 0; i < NUM_PARTICLES; i++) {
        let px = posAttribute.array[i * 3]
        let py = posAttribute.array[i * 3 + 1]
        let pz = posAttribute.array[i * 3 + 2]

        // Add velocity
        px += velocities[i * 3]
        py += velocities[i * 3 + 1]
        pz += velocities[i * 3 + 2]

        // Noise/Turbulence field (simple sine waves)
        const nx = Math.sin(py * 2 + time) * smoothTurbulence
        const ny = Math.cos(pz * 2 + time) * smoothTurbulence
        const nz = Math.sin(px * 2 + time) * smoothTurbulence
        
        px += nx; py += ny; pz += nz

        // Attract back to sphere of smoothRadius
        const dist = Math.hypot(px, py, pz)
        if (dist > smoothRadius) {
           const pull = 0.01 * (dist - smoothRadius)
           px -= (px / dist) * pull
           py -= (py / dist) * pull
           pz -= (pz / dist) * pull
        }

        // Add subtle rotation
        const cosA = Math.cos(0.005); const sinA = Math.sin(0.005)
        const rx = px * cosA - pz * sinA
        const rz = px * sinA + pz * cosA
        px = rx; pz = rz

        posAttribute.array[i * 3] = px
        posAttribute.array[i * 3 + 1] = py
        posAttribute.array[i * 3 + 2] = pz

        // Update color
        colAttribute.array[i * 3] = smoothR * (0.8 + Math.random() * 0.2)
        colAttribute.array[i * 3 + 1] = smoothG * (0.8 + Math.random() * 0.2)
        colAttribute.array[i * 3 + 2] = smoothB * (0.8 + Math.random() * 0.2)
      }

      posAttribute.needsUpdate = true
      colAttribute.needsUpdate = true

      particleSystem.rotation.y += 0.002
      particleSystem.rotation.z = Math.sin(time * 0.5) * 0.2

      renderer.render(scene, camera)
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      if (audioRef.current.drone) {
        audioRef.current.drone.triggerRelease()
        audioRef.current.drone.dispose()
      }
      video.style.display = 'none' // reset video styles
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={handleStart} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Initialize Mirror
          </button>
        ) : (
          <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Disconnect
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Activity className="w-4 h-4 text-white/50 mr-2 animate-pulse" />
          <span className="text-xs font-medium text-white/80">Face + Pose + Hands active. Spread arms to expand. Smile to shift color. Raise hands for turbulence.</span>
        </div>
      )}

      {/* Video is manipulated directly in the DOM via refs to act as a background */}
      <video ref={videoRef} playsInline muted className="hidden" />
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/80 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-xl font-bold text-white tracking-widest uppercase">Neural Mirror</p>
            <p className="mb-6 text-sm text-white/70 leading-relaxed">
              Experiment #55. The culmination of Play Labs. This abstract generative sculpture analyzes your Face, Body Pose, and Hands simultaneously, turning your presence into an evolving neural web of 15,000 particles.
            </p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-8 py-3 text-sm font-semibold text-white tracking-wider">
              ENTER THE MIRROR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
