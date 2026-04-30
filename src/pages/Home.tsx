import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import BreadcrumbSchema from '@/components/BreadcrumbSchema'
import OrganizationSchema from '@/components/OrganizationSchema'
import PersonSchema from '@/components/PersonSchema'
import Hero from '@/sections/Hero'
import AboutSection from '@/sections/AboutSection'
import ProductsSection from '@/sections/ProductsSection'
import PlayLabsPreview from '@/sections/PlayLabsPreview'
import ContactSection from '@/sections/ContactSection'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <SEO
        title="Cynocyte Systems — Intelligent Products & Experimental AI Platforms | by Swarnadeep Mukherjee"
        description="Cynocyte Systems builds intelligent products and experimental AI platforms. Developed by Swarnadeep Mukherjee. Discover Cynocyte Play Labs: 55+ interactive AI experiments using computer vision and hand tracking, running entirely in your browser."
        canonicalUrl="https://cynocyte.vercel.app"
        ogImage="https://cynocyte.vercel.app/logos/cynocyte%20long%20logo%20for%20dark%20theme.png"
        keywords="Cynocyte, Cynocyte Systems, Swarnadeep Mukherjee, AI experiments, Play Labs, computer vision, hand tracking, face detection, pose estimation, interactive AI, MediaPipe, browser experiments"
      />
      <BreadcrumbSchema
        items={[
          { name: 'Cynocyte Systems', url: 'https://cynocyte.vercel.app' },
        ]}
      />
      <OrganizationSchema />
      <PersonSchema />
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
