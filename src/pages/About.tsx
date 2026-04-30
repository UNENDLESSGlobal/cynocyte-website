import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Hexagon, Sparkles, Cpu, Mail, ArrowRight, ExternalLink } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import BreadcrumbSchema from '@/components/BreadcrumbSchema'
import PersonSchema from '@/components/PersonSchema'
import ThemeToggle from '@/components/ThemeToggle'

export default function About() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <SEO
        title="About Swarnadeep Mukherjee — Developer of Cynocyte Systems"
        description="Learn about Swarnadeep Mukherjee, the developer and founder of Cynocyte Systems. Discover Cynocyte Play Labs: 55 browser-based AI experiments using MediaPipe, Three.js, and Tone.js. Developed by Swarnadeep Mukherjee."
        canonicalUrl="https://cynocyte.vercel.app/about"
        ogImage="https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png"
        keywords="Swarnadeep Mukherjee, Cynocyte Systems, Cynocyte, Play Labs, AI experiments, computer vision, hand tracking, browser-based AI, MediaPipe, educational AI, developer"
      />
      <BreadcrumbSchema
        items={[
          { name: 'Cynocyte Systems', url: 'https://cynocyte.vercel.app' },
          { name: 'About', url: 'https://cynocyte.vercel.app/about' },
        ]}
      />
      <PersonSchema />
      <Navbar />

      <main className="pt-24 pb-16">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium text-[var(--accent-color)] mb-6">
              <Hexagon className="w-4 h-4" />
              About the Developer
            </span>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              <span className="accent-gradient-text">Swarnadeep Mukherjee</span>
            </h1>
            <p
              className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-4"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Founder & Developer of Cynocyte Systems
            </p>
            <p className="text-lg sm:text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              Cynocyte Play Labs is a collection of 55 browser-based AI experiments that run entirely
              on your device. No downloads, no sign-ups, no API keys — just your camera, microphone,
              and curiosity. Built by Swarnadeep Mukherjee as part of Cynocyte Systems.
            </p>
          </motion.div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: Cpu,
                title: '100% Client-Side',
                desc: 'Every experiment runs locally in your browser. Your webcam feed never leaves your device. We use MediaPipe, Three.js, and Tone.js — all processed on your machine.',
              },
              {
                icon: Sparkles,
                title: 'Zero Setup Required',
                desc: 'No installations, no accounts, no credit cards. Open a page, grant camera permission, and start experimenting. It could not be simpler.',
              },
              {
                icon: Hexagon,
                title: 'Open Source Philosophy',
                desc: 'Built with open web standards and open-source libraries. We believe the best creative tools should be accessible to everyone, everywhere.',
              },
              {
                icon: ExternalLink,
                title: 'Built by Swarnadeep Mukherjee',
                desc: 'Cynocyte Play Labs is an experimental initiative by Cynocyte Systems, developed by Swarnadeep Mukherjee, focused on intelligent products and AI-powered platforms.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
                className="glass rounded-2xl p-6"
              >
                <div className="w-10 h-10 rounded-full accent-gradient flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3
                  className="text-lg font-semibold text-[var(--text-primary)] mb-2"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass rounded-3xl p-8 sm:p-12 text-center"
          >
            <h2
              className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Ready to Explore?
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-lg mx-auto">
              Jump into the lab and start experimenting. All 55 experiences are free and ready to play.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/labs"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full accent-gradient text-white font-semibold text-sm btn-hover glow-accent"
              >
                Open Play Labs
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="mailto:cynocyte@gmail.com"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full glass text-[var(--text-primary)] font-semibold text-sm btn-hover"
              >
                <Mail className="w-4 h-4" />
                cynocyte@gmail.com
              </a>
            </div>
          </motion.div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center"
          >
            <p className="text-sm text-[var(--text-secondary)]">
              Cynocyte Play Labs is an experimental project by Cynocyte Systems, developed by Swarnadeep Mukherjee. Results may vary by device and browser.
              For the best experience, use Chrome or Edge on a desktop or laptop with a webcam.
            </p>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
