import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Mail, Github, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ContactSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="contact" className="relative py-24 sm:py-32" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-8 sm:p-12 lg:p-16 text-center"
        >
          <h2
            className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Get in Touch
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-8">
            Have a question, idea, or just want to say hello? We would love to hear from you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <a
              href="mailto:cynocyte@gmail.com"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full accent-gradient text-white font-semibold text-sm btn-hover glow-accent"
            >
              <Mail className="w-4 h-4" />
              cynocyte@gmail.com
            </a>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full glass text-[var(--text-primary)] font-semibold text-sm btn-hover"
            >
              About Us
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6">
            <a
              href="https://github.com/cynocyte"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full glass flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
