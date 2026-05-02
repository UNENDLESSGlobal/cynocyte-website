import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Code2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useThemeStore } from '@/stores/themeStore'

export default function Hero() {
  const theme = useThemeStore((s) => s.theme)
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--accent-color)] opacity-5 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[var(--gradient-end)] opacity-5 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[var(--gradient-mid)] opacity-3 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium text-[var(--accent-color)]">
            <Sparkles className="w-4 h-4" />
            A Division of Unendless
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[var(--text-primary)] mb-6"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Building the{' '}
          <span className="accent-gradient-text">Future</span>
          <br />
          of Intelligence
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: theme === 'dark' ? '#222222' : undefined }}
        >
          Cynocyte crafts intelligent products and experimental platforms
          that push the boundaries of what technology can do.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/labs"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full accent-gradient text-white font-semibold text-sm btn-hover glow-accent"
          >
            Explore Play Labs
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/systems"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full glass text-[var(--text-primary)] font-semibold text-sm btn-hover"
          >
            Cynocyte Systems
            <Code2 className="w-4 h-4" />
          </Link>
          <button
            onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full glass text-[var(--text-primary)] font-semibold text-sm btn-hover"
          >
            Learn More
          </button>
        </motion.div>
      </div>
    </section>
  )
}
