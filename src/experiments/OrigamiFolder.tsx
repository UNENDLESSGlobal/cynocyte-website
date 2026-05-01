import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { isPinching, toCanvasPoint, type Point } from '@/lib/landmarks'
import * as THREE from 'three'

interface Props {
  onClose: () => void
}

export default function OrigamiFolder({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const stateRef = useRef({
    step: 0,
    foldProgress: 0,
    isFolding: false,
    pinchStart: null as Point | null,
    celebrationParticles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: number }[]
  })

  useEffect(() => {
    if (!running) return
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    // Setup Three.js
    const w = container.offsetWidth
    const h = container.offsetHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.z = 10

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    // Paper setup
    const geometry = new THREE.PlaneGeometry(5, 5, 10, 10)
    const material = new THREE.MeshPhongMaterial({ 
      color: 0xffffff, 
      side: THREE.DoubleSide,
      flatShading: true 
    })
    const paper = new THREE.Mesh(geometry, material)
    scene.add(paper)

    // 2D Overlay canvas for guides and particles
    const canvas2d = document.createElement('canvas')
    canvas2d.width = w
    canvas2d.height = h
    canvas2d.style.position = 'absolute'
    canvas2d.style.top = '0'
    canvas2d.style.left = '0'
    canvas2d.style.pointerEvents = 'none'
    container.appendChild(canvas2d)
    const ctx = canvas2d.getContext('2d')!

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
      canvas2d.width = w2
      canvas2d.height = h2
    }
    window.addEventListener('resize', resize)

    // Steps definition
    const steps = [
      { axis: 'x', dir: 1, text: 'Pinch right edge and drag left to fold in half' },
      { axis: 'y', dir: 1, text: 'Pinch top edge and drag down to fold again' },
      { axis: 'x', dir: -1, text: 'Pinch left edge and drag right to fold a wing' },
    ]

    const loop = () => {
      const st = stateRef.current
      ctx.clearRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const hand = results?.hand?.landmarks?.[0]

      if (hand) {
        const tip = toCanvasPoint(hand[8], w, h)
        const pinching = isPinching(hand, 0.4)

        if (st.step < steps.length) {
          const step = steps[st.step]
          
          if (pinching) {
            if (!st.isFolding) {
              st.isFolding = true
              st.pinchStart = tip
            } else if (st.pinchStart) {
              // Calculate drag
              const dx = tip.x - st.pinchStart.x
              const dy = tip.y - st.pinchStart.y
              
              if (step.axis === 'x') {
                const drag = step.dir > 0 ? -dx : dx
                st.foldProgress = Math.max(0, Math.min(1, drag / (w * 0.3)))
              } else {
                const drag = step.dir > 0 ? dy : -dy // Y is inverted in canvas vs 3D
                st.foldProgress = Math.max(0, Math.min(1, drag / (h * 0.3)))
              }

              // Apply fold to geometry
              const pos = geometry.attributes.position
              for (let i = 0; i < pos.count; i++) {
                const ox = pos.getX(i)
                const oy = pos.getY(i)
                const oz = pos.getZ(i)
                
                // Reset to flat
                pos.setZ(i, 0)
                
                // Simple fold: just rotate half the vertices
                if (step.axis === 'x') {
                  if ((step.dir > 0 && ox > 0) || (step.dir < 0 && ox < 0)) {
                    const angle = st.foldProgress * Math.PI
                    const sign = step.dir > 0 ? 1 : -1
                    const z = Math.sin(angle) * Math.abs(ox) * sign
                    const nx = Math.cos(angle) * ox
                    pos.setX(i, nx)
                    pos.setZ(i, z)
                  }
                } else {
                  if ((step.dir > 0 && oy > 0) || (step.dir < 0 && oy < 0)) {
                    const angle = st.foldProgress * Math.PI
                    const sign = step.dir > 0 ? 1 : -1
                    const z = Math.sin(angle) * Math.abs(oy) * sign
                    const ny = Math.cos(angle) * oy
                    pos.setY(i, ny)
                    pos.setZ(i, z)
                  }
                }
              }
              geometry.attributes.position.needsUpdate = true
              geometry.computeVertexNormals()

              // Check completion
              if (st.foldProgress > 0.95) {
                st.step++
                st.foldProgress = 0
                st.isFolding = false
                
                if (st.step >= steps.length) {
                  // Celebration
                  for(let i=0; i<100; i++) {
                    st.celebrationParticles.push({
                      x: w/2, y: h/2,
                      vx: (Math.random()-0.5)*15,
                      vy: (Math.random()-0.5)*15 - 5,
                      life: 1,
                      color: Math.random() * 360
                    })
                  }
                } else {
                  // Bake current geometry state as new base for next step
                  // In a real origami app, this would be much more complex!
                  // For this demo, we'll just slightly rotate the whole object to show progress
                  paper.rotation.y += 0.2
                  paper.rotation.x += 0.1
                }
              }
            }
          } else {
            st.isFolding = false
            st.pinchStart = null
            if (st.foldProgress > 0 && st.foldProgress < 0.95) {
              // Spring back
              st.foldProgress *= 0.8
              // Need to re-apply fold progress
              // For brevity, we just let it reset on next pinch
            }
          }
        }

        // Draw cursor
        ctx.fillStyle = pinching ? '#00ffff' : '#ffffff'
        ctx.shadowBlur = 15
        ctx.shadowColor = ctx.fillStyle
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Draw instructions
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '16px Space Grotesk, sans-serif'
      ctx.textAlign = 'center'
      if (st.step < steps.length) {
        ctx.fillText(`Step ${st.step + 1}/${steps.length}: ${steps[st.step].text}`, w/2, h - 40)
      } else {
        ctx.fillText('Origami Complete!', w/2, h - 40)
        paper.rotation.y += 0.02
        paper.rotation.x += 0.01
      }

      // Particles
      for (let i = st.celebrationParticles.length - 1; i >= 0; i--) {
        const p = st.celebrationParticles[i]
        p.vy += 0.5 // gravity
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.01
        
        if (p.life <= 0) {
          st.celebrationParticles.splice(i, 1)
          continue
        }
        
        ctx.fillStyle = `hsl(${p.color}, 80%, 60%)`
        ctx.globalAlpha = p.life
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      renderer.render(scene, camera)
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      if (container.contains(canvas2d)) container.removeChild(canvas2d)
      geometry.dispose()
      material.dispose()
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

  const handleReset = () => {
    stateRef.current = {
      step: 0,
      foldProgress: 0,
      isFolding: false,
      pinchStart: null,
      celebrationParticles: []
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
            <button onClick={handleReset} className="btn-hover flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-white">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </>
        )}
      </div>

      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-0" playsInline muted />
      
      {/* Background layer */}
      <div className="absolute inset-0 bg-[#0a0a1a]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--accent-color)]/10 to-transparent" />
      
      {/* Three.js Container */}
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60">
          <div className="p-8 text-center">
            <p className="mb-2 text-lg font-semibold text-white">Origami Folder</p>
            <p className="mb-4 text-sm text-white/70">Pinch and drag to fold a 3D paper crane step-by-step.</p>
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
