import { useEffect, useRef, useState } from 'react'
import { Play, Square, UserCircle } from 'lucide-react'
import { useVision } from '@/hooks/useVision'
import * as THREE from 'three'

interface Props {
  onClose: () => void
}

type Style = 'robot' | 'alien' | 'bear'

export default function AvatarMirror({ onClose }: Props) {
  const { videoRef, startVision, stopVision, detectFrame, visionError, error } = useVision({ face: true })
  const containerRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const [style, setStyle] = useState<Style>('robot')
  const animRef = useRef<number>(0)

  // Meshes
  const partsRef = useRef<{
    group: THREE.Group | null,
    head: THREE.Mesh | null,
    eyeL: THREE.Mesh | null,
    eyeR: THREE.Mesh | null,
    browL: THREE.Mesh | null,
    browR: THREE.Mesh | null,
    mouth: THREE.Mesh | null,
    earL: THREE.Mesh | null,
    earR: THREE.Mesh | null
  }>({
    group: null, head: null, eyeL: null, eyeR: null, browL: null, browR: null, mouth: null, earL: null, earR: null
  })

  useEffect(() => {
    if (!running) return

    const container = containerRef.current
    if (!container) return

    const w = container.offsetWidth
    const h = container.offsetHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#060610')

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(0, 0, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(2, 5, 5)
    scene.add(dirLight)

    const avatarGroup = new THREE.Group()
    scene.add(avatarGroup)

    // Build Avatar based on Style
    let headColor = '#cbd5e1'
    let eyeColor = '#00ffff'
    let headGeo = new THREE.BoxGeometry(3, 3, 3)

    if (style === 'alien') {
      headColor = '#4ade80'
      eyeColor = '#000000'
      headGeo = new THREE.SphereGeometry(1.8, 32, 32)
      headGeo.scale(1, 1.2, 1)
    } else if (style === 'bear') {
      headColor = '#92400e'
      eyeColor = '#000000'
      headGeo = new THREE.SphereGeometry(1.8, 32, 32)
    }

    const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.7 })
    const head = new THREE.Mesh(headGeo, headMat)
    avatarGroup.add(head)

    const eyeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32)
    eyeGeo.rotateX(Math.PI / 2)
    const eyeMat = new THREE.MeshStandardMaterial({ color: eyeColor, emissive: style === 'robot' ? eyeColor : 0x0, emissiveIntensity: 0.5 })
    
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
    eyeL.position.set(-0.7, 0.3, 1.5)
    avatarGroup.add(eyeL)

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
    eyeR.position.set(0.7, 0.3, 1.5)
    avatarGroup.add(eyeR)

    const browGeo = new THREE.BoxGeometry(0.8, 0.1, 0.2)
    const browMat = new THREE.MeshStandardMaterial({ color: '#1e293b' })
    
    const browL = new THREE.Mesh(browGeo, browMat)
    browL.position.set(-0.7, 0.8, 1.6)
    avatarGroup.add(browL)

    const browR = new THREE.Mesh(browGeo, browMat)
    browR.position.set(0.7, 0.8, 1.6)
    avatarGroup.add(browR)

    const mouthGeo = new THREE.BoxGeometry(1.5, 0.2, 0.2)
    const mouthMat = new THREE.MeshStandardMaterial({ color: '#1e293b' })
    const mouth = new THREE.Mesh(mouthGeo, mouthMat)
    mouth.position.set(0, -0.6, 1.6)
    avatarGroup.add(mouth)

    // Ears / Antenna
    const earGeo = style === 'robot' ? new THREE.CylinderGeometry(0.1, 0.1, 1) : new THREE.SphereGeometry(0.6)
    if (style === 'robot') earGeo.rotateZ(Math.PI / 2)
    const earMat = new THREE.MeshStandardMaterial({ color: style === 'bear' ? headColor : '#94a3b8' })
    
    const earL = new THREE.Mesh(earGeo, earMat)
    earL.position.set(-1.6, style === 'bear' ? 1.2 : 0, 0)
    avatarGroup.add(earL)

    const earR = new THREE.Mesh(earGeo, earMat)
    earR.position.set(1.6, style === 'bear' ? 1.2 : 0, 0)
    avatarGroup.add(earR)

    partsRef.current = { group: avatarGroup, head, eyeL, eyeR, browL, browR, mouth, earL, earR }

    const resize = () => {
      const w2 = container.offsetWidth
      const h2 = container.offsetHeight
      renderer.setSize(w2, h2)
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    // Helper to get blendshape score safely
    const getShape = (shapes: any[], name: string) => {
      const s = shapes.find(s => s.categoryName === name)
      return s ? s.score : 0
    }

    const loop = () => {
      const results = detectFrame(performance.now())
      const shapes = results?.face?.faceBlendshapes?.[0]?.categories
      const landmarks = results?.face?.faceLandmarks?.[0]

      if (shapes && landmarks && partsRef.current.group) {
        const { group, eyeL, eyeR, browL, browR, mouth } = partsRef.current

        // 1. Head Rotation (Calculate from nose to sides of face)
        // Nose 1, Left cheek 234, Right cheek 454
        const nose = landmarks[1]
        const leftCheek = landmarks[234]
        const rightCheek = landmarks[454]
        const top = landmarks[10]
        const bottom = landmarks[152]

        // Very basic lookAt estimation
        // MediaPipe X is mirrored: 1 = left, 0 = right
        const yaw = (nose.x - 0.5) * Math.PI // left/right
        const pitch = -(nose.y - 0.5) * Math.PI * 0.5 // up/down
        const roll = Math.atan2(leftCheek.y - rightCheek.y, leftCheek.x - rightCheek.x) // tilt

        // Lerp rotation for smoothness
        group.rotation.y += (yaw - group.rotation.y) * 0.2
        group.rotation.x += (pitch - group.rotation.x) * 0.2
        group.rotation.z += (roll - group.rotation.z) * 0.2

        // 2. Eyes
        const blinkL = getShape(shapes, 'eyeBlinkLeft')
        const blinkR = getShape(shapes, 'eyeBlinkRight')
        if (eyeL) eyeL.scale.y = Math.max(0.1, 1 - blinkL)
        if (eyeR) eyeR.scale.y = Math.max(0.1, 1 - blinkR)

        // 3. Eyebrows
        const browDownL = getShape(shapes, 'browDownLeft')
        const browDownR = getShape(shapes, 'browDownRight')
        const browUpInner = getShape(shapes, 'browInnerUp')
        
        if (browL) {
          browL.position.y = 0.8 - browDownL * 0.2 + browUpInner * 0.2
          browL.rotation.z = browDownL * 0.3 - browUpInner * 0.2
        }
        if (browR) {
          browR.position.y = 0.8 - browDownR * 0.2 + browUpInner * 0.2
          browR.rotation.z = -browDownR * 0.3 + browUpInner * 0.2
        }

        // 4. Mouth
        const jawOpen = getShape(shapes, 'jawOpen')
        const smileL = getShape(shapes, 'mouthSmileLeft')
        const smileR = getShape(shapes, 'mouthSmileRight')
        const pucker = getShape(shapes, 'mouthPucker')

        if (mouth) {
          mouth.scale.y = Math.max(0.1, 1 + jawOpen * 5)
          mouth.scale.x = Math.max(0.2, 1 + (smileL + smileR) * 0.5 - pucker * 0.5)
          
          if (style !== 'robot') {
            mouth.position.y = -0.6 - (jawOpen * 0.2) // Drop jaw
          }
        }
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
    }
  }, [detectFrame, running, style])

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
            <div className="flex bg-black/40 rounded-full p-1 ml-4">
              {(['robot', 'alien', 'bear'] as Style[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    style === s ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {running && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full glass px-4 py-2 pointer-events-none">
          <UserCircle className="w-4 h-4 text-white/50 mr-2" />
          <span className="text-xs font-medium text-white/80">Smile, blink, frown, and look around. The avatar mirrors you using BlendShapes.</span>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {!running && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
          <div className="p-8 text-center max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Avatar Mirror</p>
            <p className="mb-4 text-sm text-white/70">Your face drives a real-time 3D puppet using 52 distinct facial blendshapes. Try smiling or winking!</p>
            {launchError && <p className="mb-4 text-sm text-rose-300">{launchError}</p>}
            <button onClick={handleStart} className="btn-hover rounded-full accent-gradient px-6 py-3 text-sm font-semibold text-white">
              Enable Tracking
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
