import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as THREE from 'three'

interface Props {
  onClose: () => void
}

export default function IrisPortal({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  // Offscreen canvas for extracting the iris texture
  const textureCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    // Setup offscreen canvas
    const txCanvas = document.createElement('canvas')
    txCanvas.width = 256
    txCanvas.height = 256
    const txCtx = txCanvas.getContext('2d')
    textureCanvasRef.current = txCanvas

    // Setup Three.js
    const w = container.offsetWidth
    const h = container.offsetHeight
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#030308')
    scene.fog = new THREE.FogExp2('#030308', 0.05)
    
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
    scene.add(ambientLight)
    
    // Core Iris Sphere
    const irisTex = new THREE.CanvasTexture(txCanvas)
    irisTex.minFilter = THREE.LinearFilter
    
    const sphereGeo = new THREE.SphereGeometry(1.5, 64, 64)
    const sphereMat = new THREE.MeshStandardMaterial({ 
      map: irisTex,
      emissiveMap: irisTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.8
    })
    const irisSphere = new THREE.Mesh(sphereGeo, sphereMat)
    scene.add(irisSphere)

    // Inner point light
    const pointLight = new THREE.PointLight(0x00ffff, 2, 10)
    scene.add(pointLight)

    // Outer Glow Ring
    const ringGeo = new THREE.RingGeometry(1.8, 1.85, 64)
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true, 
      opacity: 0.4,
      side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    scene.add(ring)

    // Star Particles
    const particlesGeo = new THREE.BufferGeometry()
    const pCount = 1000
    const pPos = new Float32Array(pCount * 3)
    for(let i=0; i<pCount*3; i+=3) {
      const radius = 2 + Math.random() * 5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      pPos[i] = radius * Math.sin(phi) * Math.cos(theta)
      pPos[i+1] = radius * Math.sin(phi) * Math.sin(theta)
      pPos[i+2] = radius * Math.cos(phi)
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    const pMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.5 })
    const particleSystem = new THREE.Points(particlesGeo, pMat)
    scene.add(particleSystem)

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    let frameCount = 0

    const loop = () => {
      const results = detectFrame(performance.now())
      const face = results?.face?.faceLandmarks?.[0]

      if (face && video.readyState >= 2 && txCtx && frameCount % 5 === 0) {
        // Extract Iris (Left Eye Iris Center = 468)
        const iris = face[468]
        // Estimate radius using distance to iris top edge (470)
        const topEdge = face[470]
        
        // Convert normalized coords to video pixels
        const vw = video.videoWidth
        const vh = video.videoHeight
        const ix = iris.x * vw
        const iy = iris.y * vh
        
        const rTopX = topEdge.x * vw
        const rTopY = topEdge.y * vh
        const radius = Math.sqrt(Math.pow(ix - rTopX, 2) + Math.pow(iy - rTopY, 2)) * 1.5 // Pad a bit

        if (radius > 5 && ix > radius && iy > radius) {
          // Draw extracted iris to 256x256 canvas
          txCtx.clearRect(0, 0, 256, 256)
          
          // Create circular clip
          txCtx.save()
          txCtx.beginPath()
          txCtx.arc(128, 128, 128, 0, Math.PI*2)
          txCtx.clip()
          
          // Draw video mapped to bounds
          txCtx.drawImage(
            video, 
            ix - radius, iy - radius, radius*2, radius*2,
            0, 0, 256, 256
          )
          txCtx.restore()
          
          // Average color for the light
          const imgData = txCtx.getImageData(128, 128, 10, 10).data
          let r=0, g=0, b=0
          for(let i=0; i<imgData.length; i+=4) { r+=imgData[i]; g+=imgData[i+1]; b+=imgData[i+2]; }
          r /= (imgData.length/4); g /= (imgData.length/4); b /= (imgData.length/4);
          
          // Boost saturation for sci-fi look
          const color = new THREE.Color(`rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`)
          pointLight.color = color
          ringMat.color = color
          
          irisTex.needsUpdate = true
        }
        
        // Subtle camera tracking of nose
        const nose = face[1]
        camera.position.x += ((nose.x - 0.5) * 2 - camera.position.x) * 0.1
        camera.position.y += (-(nose.y - 0.5) * 2 - camera.position.y) * 0.1
        camera.lookAt(0, 0, 0)
      }

      // Animations
      const time = performance.now() * 0.001
      irisSphere.rotation.y = time * 0.2
      irisSphere.rotation.x = Math.sin(time * 0.5) * 0.2
      
      ring.rotation.x = Math.PI/2 + Math.sin(time) * 0.2
      ring.rotation.y = Math.cos(time * 0.8) * 0.2
      ring.scale.setScalar(1 + Math.sin(time * 2) * 0.05)
      
      particleSystem.rotation.y = time * 0.05
      particleSystem.rotation.z = time * 0.02

      renderer.render(scene, camera)
      frameCount++
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      irisTex.dispose()
      sphereGeo.dispose()
      sphereMat.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      particlesGeo.dispose()
      pMat.dispose()
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#030308]" style={{ minHeight: '60vh' }}>
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
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Iris Portal</p>
            <p className="mb-4 text-sm text-white/70">Your physical iris texture is extracted in real-time to create a massive sci-fi nebula in 3D space.</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Open Portal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
