import { useEffect, useRef, useState } from 'react'
import { Mountain, Trees, Waves, Sun, Trash2 } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as Tone from 'tone'

interface Props {
  onClose: () => void
}

type Tool = 'mountain' | 'tree' | 'water' | 'sun'

interface Element {
  id: string
  type: Tool
  x: number // 0-1 normalized
  y: number // 0-1 normalized
  size: number
}

export default function SketchToWorld({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const threeContainerRef = useRef<HTMLDivElement>(null)
  
  const [tool, setTool] = useState<Tool>('mountain')
  const [elements, setElements] = useState<Element[]>([])
  
  const sceneRef = useRef<THREE.Scene | null>(null)
  const meshesRef = useRef<Record<string, THREE.Object3D>>({})
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null)
  
  const synthRef = useRef<Tone.PolySynth | null>(null)

  // 2D Drawing Effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      draw()
    }

    const draw = () => {
      ctx.fillStyle = '#1e293b' // Base grid color
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Draw grid
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1
      for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke() }
      for(let i=0; i<canvas.height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke() }

      elements.forEach(el => {
        const px = el.x * canvas.width
        const py = el.y * canvas.height
        
        ctx.save()
        ctx.translate(px, py)
        
        if (el.type === 'mountain') {
          ctx.fillStyle = '#64748b'
          ctx.beginPath()
          ctx.moveTo(0, -30 * el.size)
          ctx.lineTo(25 * el.size, 20 * el.size)
          ctx.lineTo(-25 * el.size, 20 * el.size)
          ctx.fill()
        } else if (el.type === 'tree') {
          ctx.fillStyle = '#8b5a2b'
          ctx.fillRect(-5 * el.size, 0, 10 * el.size, 20 * el.size)
          ctx.fillStyle = '#22c55e'
          ctx.beginPath()
          ctx.arc(0, -10 * el.size, 15 * el.size, 0, Math.PI*2)
          ctx.fill()
        } else if (el.type === 'water') {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.6)'
          ctx.fillRect(-30 * el.size, -30 * el.size, 60 * el.size, 60 * el.size)
        } else if (el.type === 'sun') {
          ctx.fillStyle = '#eab308'
          ctx.beginPath()
          ctx.arc(0, 0, 20 * el.size, 0, Math.PI*2)
          ctx.fill()
        }
        
        ctx.restore()
      })
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [elements])

  // 3D Engine Effect
  useEffect(() => {
    const container = threeContainerRef.current
    if (!container) return

    const w = container.offsetWidth
    const h = container.offsetHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#87CEEB') // Sky blue
    scene.fog = new THREE.FogExp2('#87CEEB', 0.02)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
    // Position camera to look at the ground plane
    camera.position.set(0, 15, 30)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 - 0.05 // Don't go below ground

    // Base Ground
    const groundGeo = new THREE.PlaneGeometry(50, 50)
    const groundMat = new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 0.8 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2)
    sunLight.position.set(10, 20, 10)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 1024
    sunLight.shadow.mapSize.height = 1024
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 50
    sunLight.shadow.camera.left = -20
    sunLight.shadow.camera.right = 20
    sunLight.shadow.camera.top = 20
    sunLight.shadow.camera.bottom = -20
    scene.add(sunLight)
    sunLightRef.current = sunLight

    let animId = 0
    const waterMeshes: THREE.Mesh[] = []

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    const loop = () => {
      controls.update()
      
      const time = performance.now() * 0.001
      waterMeshes.forEach(water => {
        // Simple wave animation
        const pos = water.geometry.attributes.position
        for(let i=0; i<pos.count; i++) {
          const u = pos.getX(i)
          const v = pos.getY(i)
          pos.setZ(i, Math.sin(u * 2 + time) * 0.2 + Math.cos(v * 2 + time) * 0.2)
        }
        pos.needsUpdate = true
      })

      renderer.render(scene, camera)
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    // Sync Elements
    const syncElements = () => {
      const currentIds = new Set(elements.map(e => e.id))
      
      // Remove deleted
      Object.keys(meshesRef.current).forEach(id => {
        if (!currentIds.has(id)) {
          scene.remove(meshesRef.current[id])
          delete meshesRef.current[id]
        }
      })

      // Update or Add
      elements.forEach(el => {
        // Map 2D (0->1) to 3D (-20->20)
        const px = (el.x - 0.5) * 40
        const pz = (el.y - 0.5) * 40
        
        if (!meshesRef.current[el.id]) {
          const group = new THREE.Group()
          group.position.set(px, 0, pz)
          
          if (el.type === 'mountain') {
            const h = 4 + Math.random() * 4 * el.size
            const geo = new THREE.ConeGeometry(3 * el.size, h, 4)
            const mat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.9 })
            const mesh = new THREE.Mesh(geo, mat)
            mesh.position.y = h / 2
            mesh.castShadow = true
            mesh.receiveShadow = true
            group.add(mesh)
          } else if (el.type === 'tree') {
            const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1)
            const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f' })
            const trunk = new THREE.Mesh(trunkGeo, trunkMat)
            trunk.position.y = 0.5
            trunk.castShadow = true
            
            const leavesGeo = new THREE.DodecahedronGeometry(1.5 * el.size)
            const leavesMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.8 })
            const leaves = new THREE.Mesh(leavesGeo, leavesMat)
            leaves.position.y = 2
            leaves.castShadow = true
            
            group.add(trunk)
            group.add(leaves)
            
            // Random slight rotation for variety
            group.rotation.y = Math.random() * Math.PI
            group.scale.setScalar(0.8 + Math.random() * 0.4)
          } else if (el.type === 'water') {
            const geo = new THREE.PlaneGeometry(6 * el.size, 6 * el.size, 16, 16)
            const mat = new THREE.MeshStandardMaterial({ 
              color: '#38bdf8', 
              transparent: true, 
              opacity: 0.8,
              roughness: 0.1,
              metalness: 0.8
            })
            const mesh = new THREE.Mesh(geo, mat)
            mesh.rotation.x = -Math.PI / 2
            mesh.position.y = 0.1 // slightly above ground
            group.add(mesh)
            waterMeshes.push(mesh)
          } else if (el.type === 'sun') {
            const geo = new THREE.SphereGeometry(2)
            const mat = new THREE.MeshBasicMaterial({ color: '#fef08a' })
            const mesh = new THREE.Mesh(geo, mat)
            // Sun floats high
            group.position.y = 15
            group.add(mesh)
            
            if (sunLightRef.current) {
              sunLightRef.current.position.set(px, 15, pz)
            }
          }
          
          scene.add(group)
          meshesRef.current[el.id] = group
        } else {
          // Just update position
          const group = meshesRef.current[el.id]
          if (el.type === 'sun') {
            group.position.set(px, 15, pz)
            if (sunLightRef.current) {
              sunLightRef.current.position.set(px, 15, pz)
            }
            // Update sky color based on sun position
            const timeOfDay = Math.max(0, Math.min(1, 1 - (pz + 20) / 40)) // 0 to 1 based on Y
            const color = new THREE.Color().lerpColors(new THREE.Color('#87CEEB'), new THREE.Color('#fb923c'), timeOfDay)
            scene.background = color
            scene.fog = new THREE.FogExp2(color, 0.02)
          } else {
            group.position.set(px, group.position.y, pz)
          }
        }
      })
    }

    syncElements()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [elements])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (synthRef.current) {
      // Play a little chime
      const note = ['C4', 'E4', 'G4', 'C5'][Math.floor(Math.random() * 4)]
      synthRef.current.triggerAttackRelease(note, "8n")
    }

    setElements(prev => {
      // Only 1 sun allowed
      let next = prev
      if (tool === 'sun') next = prev.filter(p => p.type !== 'sun')
      
      return [...next, {
        id: Math.random().toString(36).substr(2, 9),
        type: tool,
        x,
        y,
        size: 0.8 + Math.random() * 0.4
      }]
    })
  }

  const handleClear = () => {
    setElements([])
  }

  // Audio Init
  useEffect(() => {
    const initAudio = async () => {
      await Tone.start()
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.05, release: 1 }
      }).toDestination()
      synthRef.current.volume.value = -10
    }
    initAudio()
    return () => {
      if (synthRef.current) synthRef.current.dispose()
    }
  }, [])

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#060610]" style={{ minHeight: '60vh' }}>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        <button onClick={onClose} className="btn-hover rounded-full glass px-4 py-2 text-sm font-medium text-white">
          Close
        </button>
      </div>

      <div className="flex h-full w-full">
        {/* 2D Drawing Panel */}
        <div className="relative flex flex-col border-r border-white/10" style={{ width: '40%' }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-slate-900 p-4">
            <div className="flex gap-2">
              <button onClick={() => setTool('mountain')} className={`p-2 rounded-lg transition-colors ${tool === 'mountain' ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                <Mountain className="w-5 h-5 text-slate-400" />
              </button>
              <button onClick={() => setTool('tree')} className={`p-2 rounded-lg transition-colors ${tool === 'tree' ? 'bg-green-900' : 'hover:bg-slate-800'}`}>
                <Trees className="w-5 h-5 text-green-500" />
              </button>
              <button onClick={() => setTool('water')} className={`p-2 rounded-lg transition-colors ${tool === 'water' ? 'bg-sky-900' : 'hover:bg-slate-800'}`}>
                <Waves className="w-5 h-5 text-sky-400" />
              </button>
              <button onClick={() => setTool('sun')} className={`p-2 rounded-lg transition-colors ${tool === 'sun' ? 'bg-yellow-900' : 'hover:bg-slate-800'}`}>
                <Sun className="w-5 h-5 text-yellow-500" />
              </button>
            </div>
            <button onClick={handleClear} className="p-2 rounded-lg hover:bg-slate-800 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 relative cursor-crosshair">
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full"
              onClick={handleCanvasClick}
            />
          </div>
        </div>

        {/* 3D Render Panel */}
        <div className="relative flex-1">
          <div ref={threeContainerRef} className="absolute inset-0" />
          <div className="absolute bottom-4 left-4 pointer-events-none">
            <p className="text-white/70 text-sm font-medium">Procedural 3D World</p>
          </div>
        </div>
      </div>
    </div>
  )
}
