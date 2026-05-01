import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import { getFingerTips } from '@/lib/landmarks'
import * as Tone from 'tone'
import * as THREE from 'three'

interface Props {
  onClose: () => void
}

export default function AirDrums({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ hand: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(false)
  const animRef = useRef<number>(0)
  
  const synthsRef = useRef<Record<string, any>>({})
  const hitStateRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!container || !canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Setup Audio
    const kickSynth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).toDestination()
    const snareSynth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination()
    const hihatSynth = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination()
    const crashSynth = new Tone.MetalSynth({ frequency: 300, envelope: { attack: 0.001, decay: 1.4, release: 0.2 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination()
    const tomSynth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.5, sustain: 0.01, release: 1.4 } }).toDestination()
    
    // Lower volume a bit
    kickSynth.volume.value = 5
    snareSynth.volume.value = 0
    hihatSynth.volume.value = -10
    crashSynth.volume.value = -5
    tomSynth.volume.value = 2

    synthsRef.current = { kick: kickSynth, snare: snareSynth, hihat: hihatSynth, crash: crashSynth, tom: tomSynth }

    // Setup Three.js
    const w = container.offsetWidth
    const h = container.offsetHeight
    const scene = new THREE.Scene()
    
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
    camera.position.set(0, 1.5, 3)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(0, 5, 2)
    scene.add(dirLight)

    // Drum Materials
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 })
    const headMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 })
    const cymbalMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1.0, roughness: 0.3 })
    const activeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 })

    const drums: { id: string, mesh: THREE.Group, radius: number, trigger: () => void }[] = []

    const createDrum = (id: string, x: number, y: number, z: number, radius: number, height: number, tiltX: number, tiltZ: number, isCymbal: boolean, triggerFunc: () => void) => {
      const group = new THREE.Group()
      group.position.set(x, y, z)
      group.rotation.set(tiltX, 0, tiltZ)

      if (isCymbal) {
        const geo = new THREE.CylinderGeometry(radius, radius * 0.9, height, 32)
        const mesh = new THREE.Mesh(geo, cymbalMat)
        group.add(mesh)
      } else {
        const shellGeo = new THREE.CylinderGeometry(radius, radius, height, 32, 1, true)
        const shell = new THREE.Mesh(shellGeo, drumMat)
        const headGeo = new THREE.CylinderGeometry(radius, radius, 0.01, 32)
        const head = new THREE.Mesh(headGeo, headMat)
        head.position.y = height / 2
        group.add(shell)
        group.add(head)
      }

      scene.add(group)
      drums.push({ id, mesh: group, radius, trigger: triggerFunc })
      return group
    }

    // Snare (Center left)
    createDrum('snare', -0.5, 0, 0, 0.3, 0.2, 0.1, 0.1, false, () => snareSynth.triggerAttackRelease("8n"))
    // Hi-Hat (Far left, higher)
    createDrum('hihat', -1.2, 0.5, -0.5, 0.25, 0.02, 0.1, 0.2, true, () => hihatSynth.triggerAttackRelease("32n"))
    // Tom (Center right, slightly higher)
    createDrum('tom', 0.5, 0.2, -0.2, 0.25, 0.3, 0.2, -0.1, false, () => tomSynth.triggerAttackRelease("G2", "8n"))
    // Crash (Far right, very high)
    createDrum('crash', 1.2, 0.8, -0.5, 0.35, 0.02, 0.2, -0.2, true, () => crashSynth.triggerAttackRelease("8n"))
    // Kick (Center bottom)
    createDrum('kick', 0, -1.0, 0, 0.4, 0.4, Math.PI/2, 0, false, () => kickSynth.triggerAttackRelease("C1", "8n"))

    // Sticks
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xff0000 })
    const stickGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8)
    // Pivot at bottom
    stickGeo.translate(0, 0.4, 0)
    
    const leftStick = new THREE.Mesh(stickGeo, stickMat)
    const rightStick = new THREE.Mesh(stickGeo, stickMat)
    scene.add(leftStick)
    scene.add(rightStick)

    // 2D Overlay
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

    const particles: {x:number, y:number, z:number, vx:number, vy:number, vz:number, life:number, color:number}[] = []

    const loop = () => {
      const w = canvas.width
      const h = canvas.height

      if (video.readyState >= 2) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -w, 0, w, h)
        ctx.restore()
      } else {
        ctx.fillStyle = '#060610'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.fillStyle = 'rgba(6, 6, 16, 0.6)'
      ctx.fillRect(0, 0, w, h)

      const results = detectFrame(performance.now())
      const hands = results?.hand?.landmarks ?? []
      
      leftStick.visible = false
      rightStick.visible = false

      const checkCollision = (stickTipPos: THREE.Vector3) => {
        drums.forEach(drum => {
          // Simple sphere-like collision around the drum center
          const dist = stickTipPos.distanceTo(drum.mesh.position)
          const isHit = dist < drum.radius + 0.1

          const wasHit = hitStateRef.current[drum.id] > 0
          if (isHit && !wasHit) {
            drum.trigger()
            hitStateRef.current[drum.id] = 10 // Cooldown frames
            
            // Visual hit effect on drum
            const head = drum.mesh.children.length > 1 ? drum.mesh.children[1] as THREE.Mesh : drum.mesh.children[0] as THREE.Mesh
            head.material = activeMat
            setTimeout(() => {
              head.material = head.geometry.type.includes('Cylinder') && drum.mesh.children.length === 1 ? cymbalMat : headMat
            }, 100)

            // Sparkles
            for(let i=0; i<10; i++) {
              particles.push({
                x: stickTipPos.x, y: stickTipPos.y, z: stickTipPos.z,
                vx: (Math.random()-0.5)*0.1, vy: Math.random()*0.1, vz: (Math.random()-0.5)*0.1,
                life: 1, color: 0x00ffff
              })
            }
          }
          if (hitStateRef.current[drum.id] > 0) {
            hitStateRef.current[drum.id]--
          }
        })
      }

      hands.forEach((landmarks, i) => {
        // Find wrist and index tip to orient stick
        const tip = landmarks[8]
        const wrist = landmarks[0]

        // Map normalized coordinates to 3D space (-2 to 2)
        const mapX = (x: number) => (x * -2 + 1) * 3
        const mapY = (y: number) => (y * -2 + 1) * 2
        
        const tipX = mapX(tip.x)
        const tipY = mapY(tip.y)
        const wristX = mapX(wrist.x)
        const wristY = mapY(wrist.y)
        
        const stick = i === 0 ? rightStick : leftStick // Rough assumption based on array order
        stick.visible = true
        stick.position.set(wristX, wristY, 0)
        
        // Point stick towards tip
        const direction = new THREE.Vector3(tipX - wristX, tipY - wristY, -0.5).normalize()
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
        stick.setRotationFromQuaternion(quaternion)

        // The tip of the stick is 0.8 units long in the Y direction (which is now rotated)
        const stickTipPos = new THREE.Vector3(0, 0.8, 0).applyQuaternion(quaternion).add(stick.position)

        // Draw 2D tracking dot for debugging/UX
        const px = tip.x * w
        const py = tip.y * h
        ctx.beginPath()
        ctx.arc(px, py, 6, 0, Math.PI*2)
        ctx.fillStyle = '#ff0000'
        ctx.fill()

        checkCollision(stickTipPos)
      })

      // Draw 3D particles on 2D canvas
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.vy -= 0.005
        p.x += p.vx
        p.y += p.vy
        p.z += p.vz
        p.life -= 0.05
        
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        const vec = new THREE.Vector3(p.x, p.y, p.z)
        vec.project(camera)
        const px = (vec.x * .5 + .5) * w
        const py = (vec.y * -.5 + .5) * h

        ctx.globalAlpha = p.life
        ctx.fillStyle = '#00ffff'
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI*2)
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
      
      Object.values(synthsRef.current).forEach(synth => synth.dispose())
      drumMat.dispose()
      headMat.dispose()
      cymbalMat.dispose()
      activeMat.dispose()
      stickMat.dispose()
      stickGeo.dispose()
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
      
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full z-10 pointer-events-none" />
      <div ref={containerRef} className="absolute inset-0 z-15 pointer-events-none" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Air Drums</p>
            <p className="mb-4 text-sm text-white/70">Hold virtual 3D drumsticks in your hands to play a full AR drum kit surrounding you.</p>
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
