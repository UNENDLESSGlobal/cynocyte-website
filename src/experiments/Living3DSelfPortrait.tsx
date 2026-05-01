import { useEffect, useRef, useState } from 'react'
import { Play, Square, MousePointer2 } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface Props {
  onClose: () => void
}

export default function Living3DSelfPortrait({ onClose }: Props) {
  const { videoRef, startVision, stopVision, visionError, error } = useVision({ cameraOnly: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  const [displacementScale, setDisplacementScale] = useState(0.8)

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    const w = container.offsetWidth
    const h = container.offsetHeight

    // Setup offscreen canvas for texture mapping
    const txCanvas = document.createElement('canvas')
    txCanvas.width = 512
    txCanvas.height = 512
    const txCtx = txCanvas.getContext('2d')
    if (!txCtx) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#060610')
    scene.fog = new THREE.FogExp2('#060610', 0.15)

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(0, 0, 4)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxDistance = 10
    controls.minDistance = 1

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(2, 2, 5)
    scene.add(dirLight)

    // Texture
    const texture = new THREE.CanvasTexture(txCanvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    // Dense Plane
    const geo = new THREE.PlaneGeometry(4, 4, 128, 128)
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      displacementMap: texture,
      displacementScale: displacementScale,
      roughness: 0.8,
      metalness: 0.2,
      wireframe: false,
    })

    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    const loop = () => {
      if (video.readyState >= 2) {
        // Draw video mirrored and center cropped to square
        const vw = video.videoWidth
        const vh = video.videoHeight
        const minDim = Math.min(vw, vh)
        const sx = (vw - minDim) / 2
        const sy = (vh - minDim) / 2

        txCtx.save()
        txCtx.scale(-1, 1) // Mirror
        txCtx.translate(-512, 0)
        txCtx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 512, 512)
        txCtx.restore()

        texture.needsUpdate = true
      }

      controls.update()
      mat.displacementScale = displacementScaleRef.current // Allow live update
      renderer.render(scene, camera)
      
      // Auto slight rotation if user isn't interacting
      if (!controls.state && Math.abs(mesh.rotation.y) < 0.2) {
        mesh.rotation.y = Math.sin(performance.now() * 0.0005) * 0.1
        mesh.rotation.x = Math.sin(performance.now() * 0.0003) * 0.05
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      geo.dispose()
      mat.dispose()
      texture.dispose()
    }
  }, [running])

  const displacementScaleRef = useRef(displacementScale)
  useEffect(() => {
    displacementScaleRef.current = displacementScale
  }, [displacementScale])

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
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <div className="flex items-center gap-2 ml-4 bg-black/40 px-4 py-1.5 rounded-full">
              <span className="text-xs text-white/60">Depth</span>
              <input 
                type="range" 
                min="0" max="2" step="0.1" 
                value={displacementScale} 
                onChange={(e) => setDisplacementScale(parseFloat(e.target.value))}
                className="w-24 accent-cyan-400"
              />
            </div>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <MousePointer2 className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Click and drag to orbit around your 3D portrait.</span>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Living 3D Self-Portrait</p>
            <p className="mb-4 text-sm text-white/70">Your webcam feed is converted into a live 3D relief map in WebGL. Bright areas protrude, dark areas recede.</p>
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
