import { useEffect, useRef, useState } from 'react'
import { Play, Download, Square, Settings2 } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as THREE from 'three'
import { FaceLandmarker } from '@mediapipe/tasks-vision'

interface Props {
  onClose: () => void
}

type Mode = 'wireframe' | 'neon' | 'solid'

export default function FaceWarpSculptor({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<Mode>('neon')
  const animRef = useRef<number>(0)
  
  const meshRef = useRef<{ 
    points: THREE.Points, 
    lines: THREE.LineSegments,
    geometry: THREE.BufferGeometry 
  } | null>(null)

  useEffect(() => {
    if (!running) return
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    const w = container.offsetWidth
    const h = container.offsetHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.z = 2.5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    // Geometry
    const geometry = new THREE.BufferGeometry()
    const vertices = new Float32Array(478 * 3)
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    
    // Indices for lines
    const indices: number[] = []
    if (FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
      FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(edge => {
        indices.push(edge.start, edge.end)
      })
    }
    geometry.setIndex(indices)

    // Materials
    const pointsMat = new THREE.PointsMaterial({ 
      color: 0x00ffff, 
      size: 0.02,
      transparent: true,
      opacity: 0.8
    })
    
    const lineMat = new THREE.LineBasicMaterial({ 
      color: 0xff00ff,
      transparent: true,
      opacity: 0.4
    })

    // Decorative environment
    const gridHelper = new THREE.GridHelper(20, 40, 0x00ffff, 0xff00ff)
    gridHelper.position.y = -2
    gridHelper.material.opacity = 0.2
    gridHelper.material.transparent = true
    scene.add(gridHelper)

    // Floating Orbs
    const orbGroup = new THREE.Group()
    scene.add(orbGroup)
    for(let i=0; i<15; i++) {
      const orbGeo = new THREE.SphereGeometry(Math.random() * 0.1 + 0.05)
      const orbMat = new THREE.MeshBasicMaterial({ 
        color: Math.random() > 0.5 ? 0x00ffff : 0xff00ff,
        transparent: true,
        opacity: 0.6
      })
      const orb = new THREE.Mesh(orbGeo, orbMat)
      orb.position.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5 - 2
      )
      orbGroup.add(orb)
    }

    const points = new THREE.Points(geometry, pointsMat)
    const lines = new THREE.LineSegments(geometry, lineMat)
    
    scene.add(points)
    scene.add(lines)
    meshRef.current = { points, lines, geometry }

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    let angleY = 0

    const loop = () => {
      const results = detectFrame(performance.now())
      const face = results?.face?.faceLandmarks?.[0]

      if (face && meshRef.current) {
        const pos = meshRef.current.geometry.attributes.position
        
        // Center the face
        let cx = 0, cy = 0, cz = 0
        face.forEach(l => { cx += l.x; cy += l.y; cz += l.z })
        cx /= face.length
        cy /= face.length
        cz /= face.length

        for (let i = 0; i < face.length; i++) {
          const l = face[i]
          // Flip Y and X to act like a mirror and match standard 3D coords
          pos.setXYZ(i, (l.x - cx) * 3, -(l.y - cy) * 3, (l.z - cz) * 3)
        }
        meshRef.current.geometry.attributes.position.needsUpdate = true

        // Apply mode settings
        const currentMode = modeRef.current
        if (currentMode === 'wireframe') {
          points.visible = false
          lines.visible = true
          lines.material.color.setHex(0xffffff)
          lines.material.opacity = 0.5
        } else if (currentMode === 'neon') {
          points.visible = true
          lines.visible = true
          points.material.color.setHex(0x00ffff)
          lines.material.color.setHex(0xff00ff)
          lines.material.opacity = 0.6
        } else if (currentMode === 'solid') {
          points.visible = true
          lines.visible = false
          points.material.color.setHex(0xaaaaaa)
          points.material.size = 0.04
        }
        
        // Orbit environment
        const time = performance.now() * 0.0005
        orbGroup.rotation.y = time * 0.5
        orbGroup.rotation.x = time * 0.2
        gridHelper.position.z = (time * 2) % 1
        
        // Slight rotation to show 3D
        angleY = (face[1].x - face[234].x) * -0.5
        points.rotation.y = angleY
        lines.rotation.y = angleY
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
      geometry.dispose()
      pointsMat.dispose()
      lineMat.dispose()
    }
  }, [detectFrame, running])

  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const handleStart = async () => {
    await startVision()
    setRunning(true)
  }

  const handleStop = () => {
    setRunning(false)
    stopVision()
    onClose()
  }

  const handleExport = () => {
    if (!containerRef.current) return
    const canvas = containerRef.current.querySelector('canvas')
    if (canvas) {
      const link = document.createElement('a')
      link.download = `face-sculpture-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
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
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <button onClick={handleExport} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Download className="h-4 w-4" /> Export
            </button>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-2 py-2">
          <Settings2 className="w-4 h-4 text-white/50 ml-2" />
          <div className="flex bg-black/40 rounded-full p-1">
            {(['wireframe', 'neon', 'solid'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  mode === m ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <video ref={videoRef} className="absolute inset-0 h-10 w-10 opacity-0 pointer-events-none" playsInline muted />
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Face Warp Sculptor</p>
            <p className="mb-4 text-sm text-white/70">Your face is rendered as a real-time 3D mesh that deforms with every expression.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Camera
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
