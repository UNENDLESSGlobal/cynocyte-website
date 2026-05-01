import { useEffect, useRef, useState } from 'react'
import { Play, Square, Settings2 } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as THREE from 'three'

interface Props {
  onClose: () => void
}

type Mode = 'rain' | 'explode' | 'swirl'

export default function PixelRain({ onClose }: Props) {
  const { videoRef, startVision, stopVision, visionError, error } = useVision({ cameraOnly: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<Mode>('explode')
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    const w = container.offsetWidth
    const h = container.offsetHeight

    const RES_W = 80
    const RES_H = 60
    const pCount = RES_W * RES_H

    // Setup offscreen canvas for sampling
    const txCanvas = document.createElement('canvas')
    txCanvas.width = RES_W
    txCanvas.height = RES_H
    const txCtx = txCanvas.getContext('2d', { willReadFrequently: true })
    if (!txCtx) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#030308')
    scene.fog = new THREE.FogExp2('#030308', 0.1)

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(0, 0, 4)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    // Particle System
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(pCount * 3)
    const targets = new Float32Array(pCount * 3)
    const velocities = new Float32Array(pCount * 3)
    const colors = new Float32Array(pCount * 3)

    // Initialize with random scatter
    for(let i=0; i<pCount; i++) {
      positions[i*3] = (Math.random() - 0.5) * 10
      positions[i*3+1] = (Math.random() - 0.5) * 10
      positions[i*3+2] = (Math.random() - 0.5) * 10
      
      colors[i*3] = 1
      colors[i*3+1] = 1
      colors[i*3+2] = 1
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Create a circular particle texture
    const pCanvas = document.createElement('canvas')
    pCanvas.width = 32
    pCanvas.height = 32
    const pCtx = pCanvas.getContext('2d')
    if (pCtx) {
      pCtx.beginPath()
      pCtx.arc(16, 16, 16, 0, Math.PI * 2)
      pCtx.fillStyle = '#ffffff'
      pCtx.fill()
    }
    const pTex = new THREE.CanvasTexture(pCanvas)

    const mat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      map: pTex,
      transparent: true,
      opacity: 0.9,
      alphaTest: 0.5,
      depthWrite: false
    })

    const points = new THREE.Points(geo, mat)
    scene.add(points)

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    // State Machine
    let phase = 'ASSEMBLE' // ASSEMBLE -> HOLD -> SHATTER
    let phaseTimer = 0

    const updateTargets = () => {
      if (video.readyState >= 2) {
        // Draw video mirrored and center cropped
        const vw = video.videoWidth
        const vh = video.videoHeight
        const minDim = Math.min(vw, vh)
        const sx = (vw - minDim) / 2
        const sy = (vh - minDim) / 2

        txCtx.save()
        txCtx.scale(-1, 1)
        txCtx.translate(-RES_W, 0)
        txCtx.drawImage(video, sx, sy, minDim, minDim, 0, 0, RES_W, RES_H)
        txCtx.restore()

        const imgData = txCtx.getImageData(0, 0, RES_W, RES_H).data

        // Map to targets
        const aspect = RES_W / RES_H
        const size = 3
        
        for(let y=0; y<RES_H; y++) {
          for(let x=0; x<RES_W; x++) {
            const i = y * RES_W + x
            const p = i * 3
            const d = i * 4

            // Normalized -0.5 to 0.5
            const nx = (x / RES_W) - 0.5
            const ny = (y / RES_H) - 0.5

            // Brightness pushes Z forward
            const r = imgData[d]/255
            const g = imgData[d+1]/255
            const b = imgData[d+2]/255
            const brightness = (r+g+b)/3

            targets[p] = nx * size * aspect
            targets[p+1] = -ny * size
            targets[p+2] = brightness * 0.5

            colors[p] = r
            colors[p+1] = g
            colors[p+2] = b
          }
        }
        geo.attributes.color.needsUpdate = true
      }
    }

    const currentModeRef = { current: mode }
    // Update ref so loop sees latest mode without dependency array breaking it
    currentModeRef.current = mode

    const loop = () => {
      phaseTimer++
      
      const posAttr = geo.attributes.position as THREE.BufferAttribute
      const posArray = posAttr.array as Float32Array

      if (phase === 'ASSEMBLE') {
        if (phaseTimer === 1) updateTargets()
        
        // Lerp to targets
        for(let i=0; i<pCount*3; i++) {
          posArray[i] += (targets[i] - posArray[i]) * 0.05
        }
        
        if (phaseTimer > 60) {
          phase = 'HOLD'
          phaseTimer = 0
        }
      } 
      else if (phase === 'HOLD') {
        // Slight float
        const time = performance.now() * 0.001
        for(let i=0; i<pCount; i++) {
          const p = i*3
          posArray[p+2] = targets[p+2] + Math.sin(time * 2 + i * 0.1) * 0.02
        }

        if (phaseTimer > 90) {
          phase = 'SHATTER'
          phaseTimer = 0
          
          // Assign velocities based on mode
          const m = currentModeRef.current
          for(let i=0; i<pCount; i++) {
            const p = i*3
            if (m === 'rain') {
              velocities[p] = (Math.random()-0.5)*0.05
              velocities[p+1] = -(Math.random()*0.1 + 0.05) // Down
              velocities[p+2] = (Math.random()-0.5)*0.05
            } else if (m === 'explode') {
              velocities[p] = (Math.random()-0.5)*0.3
              velocities[p+1] = (Math.random()-0.5)*0.3
              velocities[p+2] = (Math.random()-0.5)*0.3 + 0.1 // Forward
            } else if (m === 'swirl') {
              // Vector cross product with UP roughly
              const cx = posArray[p]
              const cy = posArray[p+1]
              velocities[p] = cy * 0.1 + (Math.random()-0.5)*0.05
              velocities[p+1] = -cx * 0.1 + (Math.random()-0.5)*0.05
              velocities[p+2] = (Math.random()-0.5)*0.1
            }
          }
        }
      }
      else if (phase === 'SHATTER') {
        for(let i=0; i<pCount; i++) {
          const p = i*3
          posArray[p] += velocities[p]
          posArray[p+1] += velocities[p+1]
          posArray[p+2] += velocities[p+2]
          
          // Gravity or drag
          if (currentModeRef.current === 'rain') {
            velocities[p+1] -= 0.005 // gravity
          } else {
            velocities[p] *= 0.95
            velocities[p+1] *= 0.95
            velocities[p+2] *= 0.95
          }
        }

        if (phaseTimer > 60) {
          phase = 'ASSEMBLE'
          phaseTimer = 0
        }
      }

      posAttr.needsUpdate = true

      // Slow orbit
      points.rotation.y = Math.sin(performance.now() * 0.0005) * 0.2
      points.rotation.x = Math.sin(performance.now() * 0.0003) * 0.1

      renderer.render(scene, camera)
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      geo.dispose()
      mat.dispose()
      pTex.dispose()
    }
  }, [running])

  // Sync mode state to ref so loop can read it without tearing down the WebGL context
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

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
          <>
            <button onClick={handleStop} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <Square className="h-4 w-4" /> Stop
            </button>
            <div className="flex bg-black/40 rounded-full p-1 ml-4">
              {(['explode', 'rain', 'swirl'] as Mode[]).map(m => (
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
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <Settings2 className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Select a shatter mode from the top menu.</span>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Pixel Rain</p>
            <p className="mb-4 text-sm text-white/70">Your face is assembled from 4,800 colored 3D pixels. It holds your expression, then shatters and reforms over and over.</p>
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
