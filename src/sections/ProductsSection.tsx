import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Calendar, CheckCircle2, BookOpen } from 'lucide-react'

export default function ProductsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const features = [
    'Smart daily scheduling',
    'Task prioritization',
    'Habit tracking',
    'Study session timer',
    'Grade calculator',
    'Class timetable',
  ]

  return (
    <section id="products" className="relative py-24 sm:py-32" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <span className="text-sm font-medium text-[var(--accent-color)] tracking-wide uppercase mb-2 block">
            Core Product
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Meet Revisit
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="order-2 lg:order-1"
          >
            <div className="glass rounded-3xl p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h3
                  className="text-2xl font-bold text-[var(--text-primary)]"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Revisit
                </h3>
              </div>
              <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
                A student daily life management app designed to help you organize
                your schedule, track your habits, and stay on top of your academic
                goals — all in one beautifully simple interface.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <a
                href="https://getrevisit.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full accent-gradient text-white font-semibold text-sm btn-hover glow-accent"
              >
                Visit Revisit
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="order-1 lg:order-2"
          >
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl accent-gradient opacity-10 blur-2xl" />
              <div className="relative glass rounded-3xl p-6 sm:p-8 overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-[var(--accent-color)]" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Morning Study Session</div>
                      <div className="text-xs text-[var(--text-secondary)]">8:00 AM — Library Room B</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Habit: Read 30 mins</div>
                      <div className="text-xs text-[var(--text-secondary)]">Streak: 12 days</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Physics Assignment</div>
                      <div className="text-xs text-[var(--text-secondary)]">Due tomorrow, 11:59 PM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
