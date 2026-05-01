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
        title="Cynocyte"
        description="Cynocyte builds intelligent products and experimental AI platforms. Explore Revisit, the student academic life manager, and Cynocyte Play Labs — 55 browser-based AI experiments. Founded by Swarnadeep Mukherjee under UNENDLESS."
        canonicalUrl="https://cynocyte.vercel.app"
        ogImage="https://cynocyte.vercel.app/logos/cynocyte-long-logo-for-dark-theme.png"
      />
      <BreadcrumbSchema
        items={[
          { name: 'Cynocyte', url: 'https://cynocyte.vercel.app' },
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
      {/* SEO keyword signal block — visually hidden, screen-reader accessible */}
      <aside
        aria-hidden="false"
        className="sr-only"
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        <h2>Cynocyte by Swarnadeep Mukherjee — A Division of UNENDLESS</h2>
        <p>
          Cynocyte is a technology company under UNENDLESS that builds intelligent products 
          and experimental AI platforms. Cynocyte Systems is the interactive computer vision 
          infrastructure division. Revisit is a student daily life management app for academic 
          planning, habit tracking, smart scheduling, study session timing, grade calculation, 
          and class timetable management — the complete student manager and academic planner. 
          Cynocyte Play Labs offers 55 browser-based AI experiments using MediaPipe, Three.js, 
          and Tone.js with hand tracking, face detection, pose estimation, and music synthesis. 
          Founded and developed by Swarnadeep Mukherjee.
        </p>
      </aside>
    </div>
  )
}
