import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Hero from '@/sections/Hero'
import AboutSection from '@/sections/AboutSection'
import ProductsSection from '@/sections/ProductsSection'
import PlayLabsPreview from '@/sections/PlayLabsPreview'
import ContactSection from '@/sections/ContactSection'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
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
