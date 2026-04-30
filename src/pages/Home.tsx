import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import Hero from '@/sections/Hero'
import AboutSection from '@/sections/AboutSection'
import ProductsSection from '@/sections/ProductsSection'
import PlayLabsPreview from '@/sections/PlayLabsPreview'
import ContactSection from '@/sections/ContactSection'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <SEO
        title="Cynocyte — Intelligent Products & Experimental AI Platforms"
        description="Discover Cynocyte Play Labs: 55+ interactive AI experiments using computer vision and hand tracking. Run entirely in your browser. No setup required."
        canonicalUrl="https://cynocyte.com"
        ogImage="https://cynocyte.com/logos/cynocyte%20long%20logo%20for%20dark%20theme.png"
        keywords="Cynocyte, AI experiments, Play Labs, computer vision, hand tracking, face detection, pose estimation, interactive AI, MediaPipe, browser experiments"
      />
      <Navbar />
      <main>
        <Hero />
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
          <AboutSection />
        </div>
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
          <ProductsSection />
        </div>
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
          <PlayLabsPreview />
        </div>
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
          <ContactSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}
