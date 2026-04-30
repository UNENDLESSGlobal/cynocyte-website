import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Cpu, FlaskConical, Lightbulb } from 'lucide-react'

export default function AboutSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const values = [
    {
      icon: Cpu,
      title: 'Intelligent Products',
      desc: 'We build software that understands context, learns from interaction, and gets smarter with every use.',
    },
    {
      icon: FlaskConical,
      title: 'Experimental Platforms',
      desc: 'Our labs explore the cutting edge of AI, computer vision, and human-computer interaction.',
    },
    {
      icon: Lightbulb,
      title: 'Vision-Driven',
      desc: 'Every project starts with a question: what should the future feel like? Then we build toward that answer.',
    },
  ]

  return (
    <section id="about" className="relative py-24 sm:py-32" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Who We Are
          </h2>
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
            Cynocyte is the technology division of Unendless, focused on building
            intelligent products and creating experimental platforms. We believe
            the best technology feels invisible — it understands you, adapts to
            you, and gets out of your way.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
              className="glass rounded-2xl p-6 card-hover"
            >
              <div className="w-12 h-12 rounded-full accent-gradient flex items-center justify-center mb-4">
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <h3
                className="text-lg font-semibold text-[var(--text-primary)] mb-2"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {item.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
