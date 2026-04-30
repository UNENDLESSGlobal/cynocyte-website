import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, Mic, Hand, Eye, Gamepad2, Brain, Sparkles, Activity } from 'lucide-react'
import { experiments, categories } from '@/experiments/registry'
import { CATEGORY_COLORS, CATEGORY_BG } from '@/experiments/types'
import type { Category } from '@/experiments/types'

const categoryIcons: Record<string, React.ElementType> = {
  'All': Sparkles,
  'Hand Tracking': Hand,
  'Face & Mouth': Brain,
  'Body Pose': Activity,
  'Music & Audio': Mic,
  'Eye Tracking': Eye,
  'WebGL & 3D': Sparkles,
  'Spatial AI': Sparkles,
  'Biometric': Activity,
  'Games': Gamepad2,
}

export default function PlayLabsPreview() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = activeCategory === 'All'
    ? experiments.slice(0, 8)
    : experiments.filter((e) => e.category === activeCategory).slice(0, 8)

  return (
    <section id="play-labs" className="relative py-24 sm:py-32" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium text-[var(--accent-color)] mb-4">
            <Sparkles className="w-4 h-4" />
            55 Browser-Based Experiments
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Cynocyte Play Labs
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            The future plays here. No downloads. No sign-ups. Just your camera and microphone.
            Explore 55 AI experiments that run entirely in your browser.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-10"
        >
          {categories.map((cat) => {
            const Icon = categoryIcons[cat] || Sparkles
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'accent-gradient text-white shadow-lg'
                    : 'glass text-[var(--text-secondary)] hover:text-[var(--text-primary)] card-hover'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat}
              </button>
            )
          })}
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {filtered.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.05 * i }}
            >
              <Link
                to={`/labs/${exp.id}`}
                className="block glass rounded-2xl p-5 card-hover h-full"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: CATEGORY_BG[exp.category as Category],
                      color: CATEGORY_COLORS[exp.category as Category],
                    }}
                  >
                    {exp.category}
                  </span>
                  <span className="mono text-[10px] text-[var(--text-secondary)] opacity-50">
                    #{String(exp.number).padStart(2, '0')}
                  </span>
                </div>
                <h3
                  className="text-base font-semibold text-[var(--text-primary)] mb-1"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {exp.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                  {exp.tagline}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {exp.requires.map((r) => (
                    <span key={r} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                      {r === 'camera' ? <Camera className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      {r === 'camera' ? 'Camera' : 'Mic'}
                    </span>
                  ))}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    exp.difficulty === 'Beginner' ? 'bg-emerald-500/10 text-emerald-500' :
                    exp.difficulty === 'Intermediate' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {exp.difficulty}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center"
        >
          <Link
            to="/labs"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full accent-gradient text-white font-semibold text-sm btn-hover glow-accent"
          >
            Explore All 55 Experiments
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
