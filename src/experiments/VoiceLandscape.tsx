import { useEffect, useRef, useState } from 'react'
import { Play, Square, Mic } from 'lucide-react'
import * as THREE from 'three'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

export default function VoiceLandscape({ onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)

  const micRef = useRef<Tone.UserMedia | null>(null)
  const fftRef = useRef<Tone.FFT | null>(null)

  const geoRef = useRef<THREE.PlaneGeometry | null>(null)

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    if (!container) return

    const w = container.offsetWidth
    const h = container.offsetHeight

    // THREE.js Setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#030308')
    scene.fog = new THREE.FogExp2('#030308', 0.05)

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
    camera.position.set(0, 5, 10)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    // Terrain Geometry
    const gridX = 64
    const gridY = 64
    const width = 40
    const depth = 40
    
    // We create a plane on the XZ axis by rotating it
    const geometry = new THREE.PlaneGeometry(width, depth, gridX - 1, gridY - 1)
    geometry.rotateX(-Math.PI / 2)
    geoRef.current = geometry

    // Custom shader material to color by height
    const material = new THREE.MeshBasicMaterial({ 
      color: '#00ffff', 
      wireframe: true,
      transparent: true,
      opacity: 0.8
    })

    const plane = new THREE.Mesh(geometry, material)
    scene.add(plane)

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    // Audio Setup
    const setupAudio = async () => {
      try {
        await Tone.start()
        micRef.current = new Tone.UserMedia()
        fftRef.current = new Tone.FFT(gridX) // Size matches our grid X width!
        micRef.current.connect(fftRef.current)
        await micRef.current.open()
      } catch (e) {
        console.error("Mic access denied", e)
      }
    }
    setupAudio()

    let offset = 0

    const loop = () => {
      if (fftRef.current && geoRef.current) {
        const values = fftRef.current.getValue()
        const posAttribute = geoRef.current.attributes.position

        // Scroll the entire grid backwards (from front to back)
        // A PlaneGeometry is a flat grid. If rotated X by -90, Y becomes Z (depth).
        // Vertices are stored row by row. 
        // Row 0 is the "top" edge of the plane (which is far away after rotation)
        // Row `gridY-1` is the "bottom" edge (which is close to camera)
        
        // 1. Shift all rows back by 1
        for (let y = 0; y < gridY - 1; y++) {
          for (let x = 0; x < gridX; x++) {
            const currentIdx = (y * gridX + x) * 3 + 1 // +1 is the Y axis (height)
            const nextIdx = ((y + 1) * gridX + x) * 3 + 1
            posAttribute.array[currentIdx] = posAttribute.array[nextIdx]
          }
        }

        // 2. Write new FFT data to the front row (closest to camera, y = gridY - 1)
        for (let x = 0; x < gridX; x++) {
          const val = Number.isFinite(values[x]) ? values[x] : -100
          // map -100 (silent) to 0, and 0 (loud) to height
          let height = ((val + 100) / 100) * 8 // Max height 8
          if (height < 0.5) height = 0 // deadzone
          
          const idx = ((gridY - 1) * gridX + x) * 3 + 1
          posAttribute.array[idx] = height
        }

        posAttribute.needsUpdate = true

        // Slowly move the material color over time to look cool
        offset += 0.005
        const r = Math.sin(offset) * 0.5 + 0.5
        const g = Math.sin(offset + 2) * 0.5 + 0.5
        const b = Math.sin(offset + 4) * 0.5 + 0.5
        material.color.setRGB(r, g, b)
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
      if (micRef.current) { micRef.current.close(); micRef.current.dispose() }
      if (fftRef.current) fftRef.current.dispose()
    }
  }, [running])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#030308]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        {!running ? (
          <button onClick={() => setRunning(true)} className="btn-hover flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white">
            <Play className="h-4 w-4" /> Start Sculpting
          </button>
        ) : (
          <button onClick={() => setRunning(false)} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
            <Square className="h-4 w-4" /> Stop
          </button>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Mic className="w-4 h-4 text-white/50 mr-2 animate-pulse" />
          <span className="text-xs font-medium text-white/80">Speak or sing to generate mountains. High pitch = left side, low pitch = right side.</span>
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Voice Landscape</p>
            <p className="mb-4 text-sm text-white/70">A 3D terrain that is literally sculpted by your voice in real-time. Make different sounds to see how the geometry reacts.</p>
            <button onClick={() => setRunning(true)} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Mic
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
