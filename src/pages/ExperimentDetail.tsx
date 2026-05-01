import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Camera, Mic, Play, Info, Settings,
  Hexagon, ChevronRight, BookOpen, Wand2, Zap,
} from 'lucide-react'
import { experiments } from '@/experiments/registry'
import { CATEGORY_COLORS, CATEGORY_BG } from '@/experiments/types'
import type { Category } from '@/experiments/types'
import SEO from '@/components/SEO'
import BreadcrumbSchema from '@/components/BreadcrumbSchema'
import ExperimentStructuredData from '@/components/ExperimentStructuredData'
import ThemeToggle from '@/components/ThemeToggle'
import { useState, useCallback, Suspense, lazy } from 'react'
import { Spinner } from '@/components/ui/spinner'

// Lazy load all experiment components for better performance
const WebShooter = lazy(() => import('@/experiments/WebShooter'))
const ThereminAirSynth = lazy(() => import('@/experiments/ThereminAirSynth'))
const BubblePopper = lazy(() => import('@/experiments/BubblePopper'))
const FingerLightsaber = lazy(() => import('@/experiments/FingerLightsaber'))
const ColorStealer = lazy(() => import('@/experiments/ColorStealer'))
const MouthSynth = lazy(() => import('@/experiments/MouthSynth'))
const EmotionReactor = lazy(() => import('@/experiments/EmotionReactor'))
const EyebrowDJ = lazy(() => import('@/experiments/EyebrowDJ'))
const FacePong = lazy(() => import('@/experiments/FacePong'))
const FingerHarp = lazy(() => import('@/experiments/FingerHarp'))
const BeatboxVisualizer = lazy(() => import('@/experiments/BeatboxVisualizer'))
const TimeWarpMirror = lazy(() => import('@/experiments/TimeWarpMirror'))
const PixelRain = lazy(() => import('@/experiments/PixelRain'))
const HolographicTwin = lazy(() => import('@/experiments/HolographicTwin'))
const GravityPainter = lazy(() => import('@/experiments/GravityPainter'))

// Hand Tracking Batch (Phase 1)
const MagicSpellcaster = lazy(() => import('@/experiments/MagicSpellcaster'))
const PuppetMaster = lazy(() => import('@/experiments/PuppetMaster'))
const SandPainter = lazy(() => import('@/experiments/SandPainter'))
const InvisibleTouchscreen = lazy(() => import('@/experiments/InvisibleTouchscreen'))
const OrigamiFolder = lazy(() => import('@/experiments/OrigamiFolder'))

// Face & Mouth Batch (Phase 2)
const VirtualPiano = lazy(() => import('@/experiments/VirtualPiano'))
const FaceWarpSculptor = lazy(() => import('@/experiments/FaceWarpSculptor'))
const LipSyncAnimator = lazy(() => import('@/experiments/LipSyncAnimator'))
const BlowDetector = lazy(() => import('@/experiments/BlowDetector'))

// Body Pose & Air Drums Batch (Phase 3)
const AirDrums = lazy(() => import('@/experiments/AirDrums'))
const ShadowFighter = lazy(() => import('@/experiments/ShadowFighter'))
const MirrorDimension = lazy(() => import('@/experiments/MirrorDimension'))
const FitnessRepCounter = lazy(() => import('@/experiments/FitnessRepCounter'))
const DanceScoreMachine = lazy(() => import('@/experiments/DanceScoreMachine'))

// Eye Tracking Batch (Phase 4)
const GazeControlledUI = lazy(() => import('@/experiments/GazeControlledUI'))
const AttentionHeatmap = lazy(() => import('@/experiments/AttentionHeatmap'))
const EyeSynth = lazy(() => import('@/experiments/EyeSynth'))
const IrisPortal = lazy(() => import('@/experiments/IrisPortal'))

// Music & WebGL Batch (Phase 5)
const AIJamPartner = lazy(() => import('@/experiments/AIJamPartner'))
const Living3DSelfPortrait = lazy(() => import('@/experiments/Living3DSelfPortrait'))

// Spatial AI & Games Batch (Phase 6)
const SketchToWorld = lazy(() => import('@/experiments/SketchToWorld'))
const MindMaze = lazy(() => import('@/experiments/MindMaze'))

// Advanced Interactive Controls Batch (Phase 7)
const HumanTheremin = lazy(() => import('@/experiments/HumanTheremin'))
const GestureFighter2P = lazy(() => import('@/experiments/GestureFighter2P'))
const AvatarMirror = lazy(() => import('@/experiments/AvatarMirror'))
const FaceDJ = lazy(() => import('@/experiments/FaceDJ'))

// Audio-Visual Simulation Batch (Phase 8)
const EmotionKaraoke = lazy(() => import('@/experiments/EmotionKaraoke'))
const InvisibleInstrumentOrchestra = lazy(() => import('@/experiments/InvisibleInstrumentOrchestra'))
const BodyDJ = lazy(() => import('@/experiments/BodyDJ'))
const SandDunePainter = lazy(() => import('@/experiments/SandDunePainter'))

// Acoustic Ecology Batch (Phase 9)
const FingerHarpBass = lazy(() => import('@/experiments/FingerHarpBass'))
const RoomAmbianceGenerator = lazy(() => import('@/experiments/RoomAmbianceGenerator'))
const VoiceLandscape = lazy(() => import('@/experiments/VoiceLandscape'))
const SnapCounter = lazy(() => import('@/experiments/SnapCounter'))

// Biometric & Grand Finale Batch (Phase 10)
const HeadConductor = lazy(() => import('@/experiments/HeadConductor'))
const BreathPacer = lazy(() => import('@/experiments/BreathPacer'))
const NeuralMirror = lazy(() => import('@/experiments/NeuralMirror'))

// Fallback loading component
function ExperimentLoadingFallback() {
  return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="size-8" />
        <p className="text-sm text-[var(--text-secondary)]">Loading experiment...</p>
      </div>
    </div>
  )
}

const experimentComponents: Record<string, React.ComponentType<{ onClose: () => void }>> = {
  'web-shooter': WebShooter,
  'theremin-air-synth': ThereminAirSynth,
  'bubble-popper': BubblePopper,
  'finger-lightsaber': FingerLightsaber,
  'color-stealer': ColorStealer,
  'mouth-synth': MouthSynth,
  'emotion-reactor': EmotionReactor,
  'eyebrow-dj': EyebrowDJ,
  'face-pong': FacePong,
  'finger-harp': FingerHarp,
  'beatbox-visualizer': BeatboxVisualizer,
  'time-warp-mirror': TimeWarpMirror,
  'pixel-rain': PixelRain,
  'holographic-twin': HolographicTwin,
  'gravity-painter': GravityPainter,
  'magic-spellcaster': MagicSpellcaster,
  'puppet-master': PuppetMaster,
  'sand-painter': SandPainter,
  'invisible-touchscreen': InvisibleTouchscreen,
  'origami-folder': OrigamiFolder,
  'virtual-piano': VirtualPiano,
  'face-warp-sculptor': FaceWarpSculptor,
  'lip-sync-animator': LipSyncAnimator,
  'blow-detector': BlowDetector,
  'air-drums': AirDrums,
  'shadow-fighter': ShadowFighter,
  'mirror-dimension': MirrorDimension,
  'fitness-rep-counter': FitnessRepCounter,
  'dance-score-machine': DanceScoreMachine,
  'gaze-controlled-ui': GazeControlledUI,
  'attention-heatmap': AttentionHeatmap,
  'eye-synth': EyeSynth,
  'iris-portal': IrisPortal,
  'ai-jam-partner': AIJamPartner,
  'living-3d-self-portrait': Living3DSelfPortrait,
  'sketch-to-world': SketchToWorld,
  'mind-maze': MindMaze,
  'human-theremin': HumanTheremin,
  'gesture-fighter-2p': GestureFighter2P,
  'avatar-mirror': AvatarMirror,
  'face-dj': FaceDJ,
  'emotion-karaoke': EmotionKaraoke,
  'invisible-instrument-orchestra': InvisibleInstrumentOrchestra,
  'body-dj': BodyDJ,
  'sand-dune-painter': SandDunePainter,
  'finger-harp-bass': FingerHarpBass,
  'room-ambiance-generator': RoomAmbianceGenerator,
  'voice-landscape': VoiceLandscape,
  'snap-counter': SnapCounter,
  'head-conductor': HeadConductor,
  'breath-pacer': BreathPacer,
  'neural-mirror': NeuralMirror,
}

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'instructions' | 'launch'>('instructions')
  const [isRunning, setIsRunning] = useState(false)

  const experiment = experiments.find((e) => e.id === id)

  if (!experiment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Experiment not found</h1>
          <Link to="/labs" className="text-[var(--accent-color)] hover:underline">Back to Labs</Link>
        </div>
      </div>
    )
  }

  const hasImplementation = experimentComponents[experiment.id] !== undefined

  const handleLaunch = useCallback(() => {
    if (hasImplementation) {
      setIsRunning(true)
      setActiveTab('launch')
    }
  }, [hasImplementation])

  const handleStop = useCallback(() => {
    setIsRunning(false)
    setActiveTab('instructions')
  }, [])

  const prevExp = experiments.find((e) => e.number === experiment.number - 1)
  const nextExp = experiments.find((e) => e.number === experiment.number + 1)

  const ExperimentComponent = hasImplementation ? experimentComponents[experiment.id] : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <SEO
        title={`${experiment.title} — Cynocyte Play Labs | Cynocyte`}
        description={`${experiment.description} Interactive ${experiment.category} experiment from Cynocyte Play Labs, powered by Cynocyte Systems.`}
        canonicalUrl={`https://cynocyte.vercel.app/labs/${experiment.id}`}
        ogImage="https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png"
        keywords={`${experiment.title}, ${experiment.category}, Cynocyte, Cynocyte Systems, AI experiments, Play Labs, ${experiment.tagline}`}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://cynocyte.vercel.app' },
          { name: 'Play Labs', url: 'https://cynocyte.vercel.app/labs' },
          { name: experiment.title, url: `https://cynocyte.vercel.app/labs/${experiment.id}` },
        ]}
      />
      <ExperimentStructuredData
        title={experiment.title}
        description={experiment.description}
        category={experiment.category}
        difficulty={experiment.difficulty}
        number={experiment.number}
        experimentId={experiment.id}
      />
      <nav className="sticky top-0 z-50 glass border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/labs" className="w-8 h-8 rounded-full glass flex items-center justify-center hover:scale-105 transition-transform">
                <ArrowLeft className="w-4 h-4 text-[var(--text-primary)]" />
              </Link>
              <Link to="/labs" className="flex items-center gap-2">
                <Hexagon className="w-5 h-5 text-[var(--accent-color)]" />
                <span className="hidden sm:block text-sm font-bold accent-gradient-text" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Play Labs
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2">
                {prevExp && (
                  <Link
                    to={`/labs/${prevExp.id}`}
                    className="px-3 py-1.5 rounded-full glass text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    &larr; Prev
                  </Link>
                )}
                <span className="mono text-xs text-[var(--text-secondary)] opacity-50 px-2">
                  #{String(experiment.number).padStart(2, '0')} / 55
                </span>
                {nextExp && (
                  <Link
                    to={`/labs/${nextExp.id}`}
                    className="px-3 py-1.5 rounded-full glass text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Next &rarr;
                  </Link>
                )}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: CATEGORY_BG[experiment.category as Category],
                color: CATEGORY_COLORS[experiment.category as Category],
              }}
            >
              {experiment.category}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full ${
              experiment.difficulty === 'Beginner' ? 'bg-emerald-500/10 text-emerald-500' :
              experiment.difficulty === 'Intermediate' ? 'bg-amber-500/10 text-amber-500' :
              'bg-red-500/10 text-red-500'
            }`}>
              {experiment.difficulty}
            </span>
            <span className="mono text-xs text-[var(--text-secondary)] opacity-50">
              #{String(experiment.number).padStart(2, '0')}
            </span>
          </div>

          <h1
            className="text-3xl sm:text-4xl font-bold mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}
          >
            {experiment.title}
          </h1>
          <p className="text-lg text-[var(--text-secondary)] mb-8">
            {experiment.tagline}
          </p>

          <div className="flex items-center gap-3 mb-8 border-b border-[var(--border-color)] pb-4 overflow-x-auto">
            <button
              onClick={() => { setActiveTab('instructions'); setIsRunning(false) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === 'instructions'
                  ? 'accent-gradient text-white'
                  : 'glass text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Instructions
            </button>
            <button
              onClick={handleLaunch}
              disabled={!hasImplementation}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                !hasImplementation
                  ? 'opacity-50 cursor-not-allowed glass text-[var(--text-secondary)]'
                  : activeTab === 'launch'
                  ? 'accent-gradient text-white'
                  : 'glass text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Play className="w-4 h-4" />
              {hasImplementation ? 'Launch' : 'Coming Soon'}
            </button>
          </div>

          {activeTab === 'instructions' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-8">
                <div className="glass rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    <Info className="w-5 h-5 text-[var(--accent-color)]" />
                    Description
                  </h2>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{experiment.description}</p>
                </div>

                <div className="glass rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    <Wand2 className="w-5 h-5 text-[var(--accent-color)]" />
                    How It Works
                  </h2>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{experiment.howItWorks}</p>
                </div>

                <div className="glass rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    <Zap className="w-5 h-5 text-[var(--accent-color)]" />
                    What to Expect
                  </h2>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{experiment.expectedOutcome}</p>
                </div>

                <div className="glass rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    <Settings className="w-5 h-5 text-[var(--accent-color)]" />
                    Controls
                  </h2>
                  <div className="space-y-3">
                    {experiment.controls.map((ctrl, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                        <div className="w-8 h-8 rounded-full accent-gradient flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">{i + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium text-[var(--text-primary)] text-sm">{ctrl.gesture}</div>
                          <div className="text-sm text-[var(--text-secondary)]">{ctrl.action}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Requirements
                  </h3>
                  <div className="space-y-3">
                    {experiment.requires.map((r) => (
                      <div key={r} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        {r === 'camera' ? (
                          <Camera className="w-4 h-4 text-[var(--accent-color)]" />
                        ) : (
                          <Mic className="w-4 h-4 text-[var(--accent-color)]" />
                        )}
                        {r === 'camera' ? 'Camera access' : 'Microphone access'}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {experiment.techUsed.map((tech) => (
                      <span key={tech} className="px-3 py-1.5 rounded-full glass text-xs text-[var(--text-secondary)]">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {hasImplementation ? (
                  <button
                    onClick={handleLaunch}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl accent-gradient text-white font-semibold text-sm btn-hover glow-accent"
                  >
                    <Play className="w-4 h-4" />
                    Launch Experiment
                  </button>
                ) : (
                  <div className="glass rounded-2xl p-6 text-center">
                    <p className="text-sm text-[var(--text-secondary)] mb-2">Full implementation coming soon</p>
                    <p className="text-xs text-[var(--text-secondary)] opacity-60">Check back for updates</p>
                  </div>
                )}

                <div className="glass rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Navigate
                  </h3>
                  <div className="space-y-2">
                    {prevExp && (
                      <Link
                        to={`/labs/${prevExp.id}`}
                        className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 transition-colors"
                      >
                        <span className="text-xs text-[var(--text-secondary)]">&larr;</span>
                        <div>
                          <div className="text-[10px] text-[var(--text-secondary)]">Previous</div>
                          <div className="text-xs font-medium text-[var(--text-primary)]">{prevExp.title}</div>
                        </div>
                      </Link>
                    )}
                    {nextExp && (
                      <Link
                        to={`/labs/${nextExp.id}`}
                        className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 transition-colors"
                      >
                        <div className="flex-1 text-right">
                          <div className="text-[10px] text-[var(--text-secondary)]">Next</div>
                          <div className="text-xs font-medium text-[var(--text-primary)]">{nextExp.title}</div>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">&rarr;</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'launch' && ExperimentComponent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {experiment.title} is running
                  </span>
                </div>
                <button
                  onClick={handleStop}
                  className="px-4 py-2 rounded-full glass text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Stop & Return
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden border border-[var(--border-color)]" style={{ minHeight: '60vh' }}>
                <Suspense fallback={<ExperimentLoadingFallback />}>
                  <ExperimentComponent onClose={handleStop} />
                </Suspense>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
