import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { getFingerTips, toCanvasPoint } from '@/lib/landmarks'
import * as Tone from 'tone'
import * as THREE from 'three'

interface Props {
  onClose: () => void
}

const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5']
const BLACK_NOTES = [
  { note: 'C#4', index: 0 },
  { note: 'D#4', index: 1 },
  { note: 'F#4', index: 3 },
  { note: 'G#4', index: 4 },
  { note: 'A#4', index: 5 },
  { note: 'C#5', index: 7 },
  { note: 'D#5', index: 8 },
  { note: 'F#5', index: 10 },
]

export default function VirtualPiano({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const synthRef = useRef<Tone.PolySynth | null>(null)
  const activeNotesRef = useRef<Set<string>>(new Set())
  const keyMeshesRef = useRef<{ note: string, mesh: THREE.Mesh, isBlack: boolean }[]>([])

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!container || !canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Setup Audio
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 1.5 },
    }).toDestination()
    synthRef.current = synth

    // Setup Three.js
    const w = container.offsetWidth
    const h = container.offsetHeight
    const scene = new THREE.Scene()
    
    // Position camera to look down at the piano
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(0, 5, 8)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(w, h)
    // Add neon bloom effect later if needed, for now just high quality
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(0, 10, 5)
    scene.add(dirLight)
    
    // Add a glowing spotlight
    const spotLight = new THREE.SpotLight(0x00ffff, 2)
    spotLight.position.set(0, 10, 0)
    spotLight.angle = Math.PI / 4
    spotLight.penumbra = 0.5
    scene.add(spotLight)

    // Create Piano Keys
    const pianoGroup = new THREE.Group()
    scene.add(pianoGroup)
    
    const keyWidth = 1.0
    const keyLength = 4.0
    const keyDepth = 0.5
    const gap = 0.1
    const totalWidth = NOTES.length * (keyWidth + gap)
    const startX = -totalWidth / 2 + keyWidth / 2

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 })
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 })
    const activeWhiteMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 })
    const activeBlackMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.5 })

    // White keys
    NOTES.forEach((note, i) => {
      const geo = new THREE.BoxGeometry(keyWidth, keyDepth, keyLength)
      const mesh = new THREE.Mesh(geo, whiteMat.clone())
      mesh.position.set(startX + i * (keyWidth + gap), 0, 0)
      pianoGroup.add(mesh)
      keyMeshesRef.current.push({ note, mesh, isBlack: false })
    })

    // Black keys
    const blackWidth = 0.6
    const blackLength = 2.5
    const blackDepth = 0.8
    BLACK_NOTES.forEach((b) => {
      const geo = new THREE.BoxGeometry(blackWidth, blackDepth, blackLength)
      const mesh = new THREE.Mesh(geo, blackMat.clone())
      mesh.position.set(startX + b.index * (keyWidth + gap) + (keyWidth + gap)/2, blackDepth/2, -keyLength/2 + blackLength/2)
      pianoGroup.add(mesh)
      keyMeshesRef.current.push({ note: b.note, mesh, isBlack: true })
    })
    
    // Tilt the piano towards the user slightly and push it to the bottom quarter of the screen
    pianoGroup.rotation.x = -Math.PI / 6
    pianoGroup.position.y = -4
    pianoGroup.position.z = 2

    // Setup 2D overlay
    canvas.width = w
    canvas.height = h

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
      canvas.width = w2
      canvas.height = h2
    }
    window.addEventListener('resize', resize)

    // Raycaster for hit detection from 2D points to 3D space
    const raycaster = new THREE.Raycaster()

    const particles: {x:number, y:number, z:number, vx:number, vy:number, vz:number, life:number, color:number}[] = []

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      // Render video on 2D canvas
      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }
      // Dim video
      ctx.fillStyle = 'rgba(6, 6, 16, 0.4)'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const hands = results?.hand?.landmarks ?? []
      
      const currentlyPressed = new Set<string>()

      hands.forEach(landmarks => {
        const tips = getFingerTips(landmarks, w, h)
        tips.forEach(tip => {
          // Normalize tip coords to -1 to 1 for raycasting
          const nx = (tip.x / w) * 2 - 1
          const ny = -(tip.y / h) * 2 + 1
          
          raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
          
          // Check intersection with piano group
          const intersects = raycaster.intersectObjects(pianoGroup.children)
          
          if (intersects.length > 0) {
            // Find which key was hit
            const hitMesh = intersects[0].object as THREE.Mesh
            const keyInfo = keyMeshesRef.current.find(k => k.mesh === hitMesh)
            if (keyInfo) {
              currentlyPressed.add(keyInfo.note)
              
              // Sparkles!
              if (Math.random() > 0.5) {
                particles.push({
                  x: intersects[0].point.x,
                  y: intersects[0].point.y,
                  z: intersects[0].point.z,
                  vx: (Math.random()-0.5)*0.2,
                  vy: Math.random()*0.3,
                  vz: (Math.random()-0.5)*0.2,
                  life: 1,
                  color: keyInfo.isBlack ? 0xff00ff : 0x00ffff
                })
              }
            }
          }
          
          // Draw fingertip on 2D canvas
          ctx.beginPath()
          ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2)
          ctx.fillStyle = '#00ffff'
          ctx.shadowBlur = 10
          ctx.shadowColor = '#00ffff'
          ctx.fill()
          ctx.shadowBlur = 0
        })
      })

      // Audio and Material updates
      const active = activeNotesRef.current
      for (const note of currentlyPressed) {
        if (!active.has(note)) {
          synth.triggerAttack(note)
          active.add(note)
          // Press animation
          const key = keyMeshesRef.current.find(k => k.note === note)
          if (key) {
            key.mesh.position.y -= 0.2
            key.mesh.material = key.isBlack ? activeBlackMat : activeWhiteMat
          }
        }
      }
      for (const note of active) {
        if (!currentlyPressed.has(note)) {
          synth.triggerRelease(note)
          active.delete(note)
          // Release animation
          const key = keyMeshesRef.current.find(k => k.note === note)
          if (key) {
            key.mesh.position.y += 0.2
            key.mesh.material = key.isBlack ? blackMat : whiteMat
          }
        }
      }

      // Update 3D particles manually (we could use a ParticleSystem but manual meshes is fine for simple stuff, or just draw them in 2D)
      // Actually, drawing them in 2D over the 3D canvas is way easier and looks cool
      // Since they are defined in 3D, we need to project them to 2D
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.vy -= 0.01 // gravity
        p.x += p.vx
        p.y += p.vy
        p.z += p.vz
        p.life -= 0.02
        
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        // Project 3D to 2D
        const vec = new THREE.Vector3(p.x, p.y, p.z)
        vec.project(camera)
        const px = (vec.x * .5 + .5) * w
        const py = (vec.y * -.5 + .5) * h

        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color === 0xff00ff ? '#ff00ff' : '#00ffff'
        ctx.beginPath()
        ctx.arc(px, py, 4 * p.life, 0, Math.PI*2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      renderer.render(scene, camera)
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      synth.dispose()
      whiteMat.dispose()
      blackMat.dispose()
      activeWhiteMat.dispose()
      activeBlackMat.dispose()
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
    activeNotesRef.current.clear()
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

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      
      {/* 2D Canvas for webcam & fingertips */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10 pointer-events-none" />
      
      {/* 3D Container for Piano */}
      <div ref={containerRef} className="absolute inset-0 z-15 pointer-events-none" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Virtual Piano</p>
            <p className="mb-4 text-sm text-white/70">A 3D AR piano keyboard lays flat before you. Touch keys with your fingertips to play.</p>
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
