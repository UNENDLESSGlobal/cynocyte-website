import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Camera, Mic, ArrowRight, Sparkles, Hand, Brain,
  Activity, Gamepad2, Eye, X, Menu, ChevronRight, Hexagon,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import BreadcrumbSchema from '@/components/BreadcrumbSchema'
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

export default function Labs() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const filtered = useMemo(() => {
    let result = experiments
    if (activeCategory !== 'All') {
      result = result.filter((e) => e.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.tagline.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      )
    }
    return result
  }, [search, activeCategory])

  const stats = [
    { label: 'Experiments', value: '55' },
    { label: 'Client-Side', value: '100%' },
    { label: 'Downloads', value: 'Zero' },
    { label: 'Inputs', value: 'Camera + Mic' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <SEO
        title="Cynocyte Play Labs — 55 Interactive AI Experiments | Cynocyte"
        description="Explore 55 interactive AI experiments powered by Cynocyte Systems: hand tracking, face detection, pose estimation, music synthesis, and more. Run entirely in your browser."
        canonicalUrl="https://cynocyte.vercel.app/labs"
        ogImage="https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png"
        keywords="Cynocyte, Cynocyte Systems, Play Labs, AI experiments, hand tracking, face detection, pose estimation, music synthesis, computer vision, interactive AI"
      />
      <BreadcrumbSchema
        items={[
          { name: 'Cynocyte', url: 'https://cynocyte.vercel.app' },
          { name: 'Play Labs', url: 'https://cynocyte.vercel.app/labs' },
        ]}
      />
      <nav className="sticky top-0 z-50 glass border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <Hexagon className="w-6 h-6 text-[var(--accent-color)]" />
              <span className="hidden sm:block text-lg font-bold accent-gradient-text" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Cynocyte Play Labs
              </span>
            </Link>

            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search experiments..."
                  className="w-full pl-10 pr-4 py-2 rounded-full glass text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {categories.slice(0, 4).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? 'accent-gradient text-white'
                      : 'glass text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/about"
                className="hidden sm:inline-flex px-4 py-2 rounded-full glass text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                About
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden w-9 h-9 rounded-full glass flex items-center justify-center"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden glass border-t border-[var(--border-color)] p-4 space-y-3"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search experiments..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full glass text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/30"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setMobileMenuOpen(false) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? 'accent-gradient text-white'
                      : 'glass text-[var(--text-secondary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="relative mb-16 rounded-3xl overflow-hidden glass p-8 sm:p-12 lg:p-16">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-72 h-72 bg-[var(--accent-color)] opacity-5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--gradient-end)] opacity-5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium text-[var(--accent-color)] mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                The Future Plays Here
              </span>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}
              >
                55 Browser-Based{' '}
                <span className="accent-gradient-text">AI Experiments</span>
              </h1>
              <p className="text-lg text-[var(--text-secondary)] mb-8 leading-relaxed">
                No downloads. No sign-ups. No API keys. Just your camera and microphone.
                Explore interactive experiences powered by MediaPipe, Three.js, and Tone.js —
                all running 100% in your browser.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              {stats.map((s) => (
                <div key={s.label} className="glass rounded-2xl px-5 py-3 text-center">
                  <div className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {s.value}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {activeCategory === 'All' ? 'All Experiments' : activeCategory}
              <span className="ml-2 text-sm font-normal text-[var(--text-secondary)]">
                ({filtered.length})
              </span>
            </h2>
            {activeCategory !== 'All' && (
              <button
                onClick={() => setActiveCategory('All')}
                className="text-xs text-[var(--accent-color)] hover:underline"
              >
                Show all
              </button>
            )}
          </div>

          <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((exp) => {
                const Icon = categoryIcons[exp.category] || Sparkles
                return (
                  <motion.div
                    key={exp.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Link
                      to={`/labs/${exp.id}`}
                      className="group block glass rounded-2xl p-5 card-hover h-full"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            backgroundColor: CATEGORY_BG[exp.category as Category],
                            color: CATEGORY_COLORS[exp.category as Category],
                          }}
                        >
                          <Icon className="w-3 h-3" />
                          {exp.category}
                        </span>
                        <span className="mono text-[10px] text-[var(--text-secondary)] opacity-50">
                          #{String(exp.number).padStart(2, '0')}
                        </span>
                      </div>

                      <h3
                        className="text-base font-semibold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-color)] transition-colors"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                      >
                        {exp.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
                        {exp.tagline}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {exp.requires.map((r) => (
                            <span key={r} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                              {r === 'camera' ? <Camera className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
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
                        <div className="w-7 h-7 rounded-full accent-gradient flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-[var(--text-secondary)]">No experiments match your search.</p>
              <button
                onClick={() => { setSearch(''); setActiveCategory('All') }}
                className="mt-4 text-sm text-[var(--accent-color)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
