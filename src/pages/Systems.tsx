import { useEffect, useRef } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import BreadcrumbSchema from '@/components/BreadcrumbSchema'
import './systems.css'

/** SVG icon helpers to keep JSX cleaner */
const IconWebsite = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#csGs1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Website systems icon">
    <defs><linearGradient id="csGs1" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#00e5ff"/><stop offset="1" stopColor="#6366f1"/></linearGradient></defs>
    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
)
const IconAutomation = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#csGs2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Automation systems icon">
    <defs><linearGradient id="csGs2" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#00e5ff"/></linearGradient></defs>
    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconInfra = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#csGs3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Custom digital infrastructure icon">
    <defs><linearGradient id="csGs3" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="#00e5ff"/><stop offset="1" stopColor="#6366f1"/></linearGradient></defs>
    <path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/>
  </svg>
)

function initGSAP() {
  const gsap = (window as any).gsap
  const ScrollTrigger = (window as any).ScrollTrigger
  if (!gsap || !ScrollTrigger) return
  gsap.registerPlugin(ScrollTrigger)

  gsap.utils.toArray('.cs-gs-reveal').forEach((el: any) => {
    const parent = el.parentElement
    const isGridChild = parent && (
      parent.classList.contains('cs-cards-grid') ||
      parent.classList.contains('cs-feature-grid') ||
      parent.classList.contains('cs-process-stepper')
    )
    if (!isGridChild) {
      gsap.fromTo(el, { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      })
    }
  })

  document.querySelectorAll('.cs-cards-grid, .cs-feature-grid, .cs-process-stepper').forEach((grid: any) => {
    const children = grid.querySelectorAll('.cs-gs-reveal')
    if (!children.length) return
    gsap.fromTo(children, { y: 40, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: grid, start: 'top 85%', once: true }
    })
  })
}

function initMagneticButtons() {
  document.querySelectorAll('.cs-btn').forEach((btn: any) => {
    btn.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect()
      const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.15
      const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.15
      btn.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`
    })
    btn.addEventListener('mouseleave', () => { btn.style.transform = '' })
  })
}

export default function Systems() {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Load GSAP if not already present
    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
        const s = document.createElement('script')
        s.src = src; s.onload = () => resolve(); document.head.appendChild(s)
      })

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js'),
    ]).then(() => {
      setTimeout(() => { initGSAP(); initMagneticButtons() }, 100)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = formRef.current
    if (!form) return
    const name = (form.querySelector('#cs-field-name') as HTMLInputElement)?.value.trim()
    const email = (form.querySelector('#cs-field-email') as HTMLInputElement)?.value.trim()
    if (!name || !email) return

    const submitBtn = form.querySelector('.cs-btn') as HTMLButtonElement
    const formGrid = form.querySelector('.cs-form-grid') as HTMLElement
    const success = form.querySelector('.cs-form-success') as HTMLElement
    if (submitBtn) { submitBtn.classList.add('cs-btn-loading'); submitBtn.style.opacity = '0.7' }

    try {
      const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwWkOpvfIaNK9yrsSk9f0BPxca_M3OsaT2jY-uASTjgDvGB2gAEKVKyT2lY1POG0iFYTA/exec'
      const payload = {
        name,
        email,
        phone: (form.querySelector('#cs-field-phone') as HTMLInputElement)?.value.trim() || '',
        message: (form.querySelector('#cs-field-message') as HTMLTextAreaElement)?.value.trim() || '',
      }
      await fetch(WEBHOOK_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (formGrid) formGrid.style.display = 'none'
      if (submitBtn) submitBtn.style.display = 'none'
      if (success) success.classList.add('cs-visible')
    } catch (err) {
      console.error('Form submission error:', err)
    } finally {
      if (submitBtn) { submitBtn.classList.remove('cs-btn-loading'); submitBtn.style.opacity = '1' }
    }
  }

  return (
    <div className="min-h-screen">
      <SEO
        title="Systems | Cynocyte"
        description="Cynocyte Systems builds intelligent digital systems, automation infrastructure, and scalable business technology. Engineering-first approach to modern enterprise solutions. A division of Cynocyte under UNENDLESS."
        canonicalUrl="https://cynocyte.vercel.app/systems"
        keywords="Cynocyte Systems, intelligent digital systems, automation infrastructure, business technology, website systems, custom digital infrastructure, scalable technology, enterprise automation, Cynocyte, UNENDLESS, Swarnadeep Mukherjee"
      />
      <BreadcrumbSchema
        items={[
          { name: 'Cynocyte', url: 'https://cynocyte.vercel.app' },
          { name: 'Systems', url: 'https://cynocyte.vercel.app/systems' },
        ]}
      />
      <Navbar />

      <div className="cs-page">
        {/* Aurora Background */}
        <div className="cs-aurora" aria-hidden="true">
          <div className="cs-aurora-blob" />
          <div className="cs-aurora-blob" />
          <div className="cs-aurora-blob" />
        </div>
        <div className="cs-noise-overlay" aria-hidden="true" />

        <div className="cs-page-content">
          {/* Hidden SEO */}
          <div aria-hidden="true" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
            Cynocyte Systems, intelligent digital systems, automation infrastructure, scalable business technology, website systems, custom digital infrastructure, Swarnadeep Mukherjee, UNENDLESS, Cynocyte
          </div>

          {/* ===== HERO ===== */}
          <section className="cs-hero" id="cs-home">
            <div className="cs-hero-badge cs-gs-reveal">
              <span className="cs-hero-badge-icon">✦</span>
              Intelligent Systems for Modern Business
            </div>
            <h1 className="cs-hero-headline cs-gs-reveal">
              Building <span className="cs-gradient-text">Intelligent</span><br />Digital Systems
            </h1>
            <p className="cs-hero-sub cs-gs-reveal">
              Engineering scalable technology and automation infrastructure for modern businesses.
            </p>
            <div className="cs-hero-ctas cs-gs-reveal">
              <a href="#cs-contact" className="cs-btn cs-btn-primary"><span className="cs-btn-text">Get Started</span></a>
              <a href="#cs-services" className="cs-btn cs-btn-secondary"><span className="cs-btn-text">View Services</span></a>
            </div>
          </section>

          {/* ===== SERVICES ===== */}
          <section className="cs-section" id="cs-services">
            <div className="cs-section-header cs-gs-reveal">
              <span className="cs-section-label">Services</span>
              <h2 className="cs-section-title">What We Build</h2>
              <p className="cs-section-desc">End-to-end digital systems designed for performance, scale and long-term growth.</p>
            </div>
            <div className="cs-cards-grid">
              <div className="cs-glass-card cs-gs-reveal">
                <div className="cs-card-icon"><IconWebsite /></div>
                <h3 className="cs-card-title">Website Systems</h3>
                <p className="cs-card-desc">High-performance business websites designed for scalability, speed and modern user experience.</p>
              </div>
              <div className="cs-glass-card cs-gs-reveal">
                <div className="cs-card-icon"><IconAutomation /></div>
                <h3 className="cs-card-title">Automation Systems</h3>
                <p className="cs-card-desc">Automated workflows that streamline operations, reduce manual work and improve efficiency.</p>
              </div>
              <div className="cs-glass-card cs-gs-reveal">
                <div className="cs-card-icon"><IconInfra /></div>
                <h3 className="cs-card-title">Custom Digital Infrastructure</h3>
                <p className="cs-card-desc">Tailored digital systems engineered to support unique business operations and future growth.</p>
              </div>
            </div>
          </section>

          {/* ===== PROCESS ===== */}
          <section className="cs-section" id="cs-process">
            <div className="cs-section-header cs-gs-reveal">
              <span className="cs-section-label">Process</span>
              <h2 className="cs-section-title">How We Work</h2>
              <p className="cs-section-desc">A structured engineering approach from first conversation to live system.</p>
            </div>
            <div className="cs-process-stepper">
              {[
                { n: 1, title: 'Discovery', desc: 'We analyze your business, workflows and goals to define system requirements.' },
                { n: 2, title: 'Design', desc: 'Architecture, interfaces and automation logic are planned with precision.' },
                { n: 3, title: 'Build', desc: 'Systems are developed with modern frameworks, tested rigorously and optimized.' },
                { n: 4, title: 'Launch', desc: 'Deployed to production with monitoring, support and continuous improvement.' },
              ].map((s) => (
                <div className="cs-process-step cs-gs-reveal" key={s.n}>
                  <div className="cs-step-number">{s.n}</div>
                  <h4 className="cs-step-title">{s.title}</h4>
                  <p className="cs-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== WHY US ===== */}
          <section className="cs-section" id="cs-about">
            <div className="cs-section-header cs-gs-reveal">
              <span className="cs-section-label">Why Us</span>
              <h2 className="cs-section-title">Why Cynocyte Systems</h2>
              <p className="cs-section-desc">Built for businesses that demand reliability, performance and intelligent design.</p>
            </div>
            <div className="cs-feature-grid">
              {[
                { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cs-accent-cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>, title: 'Engineering-First', desc: 'Every system is architected for production scale, not quick prototypes.' },
                { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cs-accent-indigo)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, title: 'Scalable', desc: 'Designed to grow with your business without rebuilds or bottlenecks.' },
                { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>, title: 'Future-Ready', desc: 'Built on modern stacks that evolve with emerging technologies and standards.' },
                { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, title: 'Client-Focused', desc: 'Transparent process, direct communication and outcomes tied to real goals.' },
              ].map((f) => (
                <div className="cs-feature-card cs-gs-reveal" key={f.title}>
                  <div className="cs-feature-icon">{f.icon}</div>
                  <div className="cs-feature-content">
                    <h4 className="cs-feature-title">{f.title}</h4>
                    <p className="cs-feature-desc">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ===== INFRASTRUCTURE ===== */}
          <section className="cs-section cs-section--wide" id="cs-infrastructure">
            <div className="cs-section-header cs-gs-reveal">
              <span className="cs-section-label">Architecture</span>
              <h2 className="cs-section-title">Digital Infrastructure</h2>
              <p className="cs-section-desc">Systems designed as connected, intelligent infrastructure — not isolated tools.</p>
            </div>
            <div className="cs-infra-container cs-gs-reveal">
              <svg className="cs-infra-svg" viewBox="0 0 900 500" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Digital infrastructure architecture diagram">
                <line className="cs-infra-line" x1="200" y1="250" x2="450" y2="140" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5"/>
                <line className="cs-infra-line" x1="200" y1="250" x2="450" y2="250" stroke="rgba(0,229,255,0.3)" strokeWidth="1.5"/>
                <line className="cs-infra-line" x1="200" y1="250" x2="450" y2="360" stroke="rgba(168,85,247,0.3)" strokeWidth="1.5"/>
                <line className="cs-infra-line" x1="450" y1="140" x2="700" y2="250" stroke="rgba(236,72,153,0.3)" strokeWidth="1.5"/>
                <line className="cs-infra-line" x1="450" y1="250" x2="700" y2="250" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5"/>
                <line className="cs-infra-line" x1="450" y1="360" x2="700" y2="250" stroke="rgba(245,158,11,0.3)" strokeWidth="1.5"/>
                <g className="cs-infra-node"><circle cx="200" cy="250" r="40" fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5"/><text x="200" y="245" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="600" fontFamily="Inter">Client</text><text x="200" y="260" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Inter">Interface</text></g>
                <g className="cs-infra-node"><rect x="415" y="105" width="70" height="70" rx="14" fill="rgba(0,229,255,0.08)" stroke="rgba(0,229,255,0.35)" strokeWidth="1.5"/><text x="450" y="138" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="600" fontFamily="Inter">API</text><text x="450" y="153" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Inter">Gateway</text></g>
                <g className="cs-infra-node"><rect x="415" y="215" width="70" height="70" rx="14" fill="rgba(168,85,247,0.08)" stroke="rgba(168,85,247,0.35)" strokeWidth="1.5"/><text x="450" y="248" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="600" fontFamily="Inter">Logic</text><text x="450" y="263" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Inter">Engine</text></g>
                <g className="cs-infra-node"><rect x="415" y="325" width="70" height="70" rx="14" fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5"/><text x="450" y="358" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="600" fontFamily="Inter">Auto</text><text x="450" y="373" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Inter">Workflows</text></g>
                <g className="cs-infra-node"><circle cx="700" cy="250" r="44" fill="rgba(236,72,153,0.08)" stroke="rgba(236,72,153,0.35)" strokeWidth="1.5"/><text x="700" y="245" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="600" fontFamily="Inter">Data</text><text x="700" y="260" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Inter">Infrastructure</text></g>
              </svg>
            </div>
          </section>

          {/* ===== CONTACT ===== */}
          <section className="cs-section" id="cs-contact">
            <div className="cs-section-header cs-gs-reveal">
              <span className="cs-section-label">Contact</span>
              <h2 className="cs-section-title">Let's Build Together</h2>
              <p className="cs-section-desc">Tell us about your project or business challenge.</p>
            </div>
            <div className="cs-contact-wrapper cs-gs-reveal">
              <form className="cs-contact-form" ref={formRef} onSubmit={handleSubmit} autoComplete="off">
                <div className="cs-form-grid">
                  <div className="cs-form-field">
                    <label className="cs-form-label" htmlFor="cs-field-name">Name</label>
                    <input className="cs-form-input" type="text" id="cs-field-name" placeholder="Your name" required />
                  </div>
                  <div className="cs-form-field">
                    <label className="cs-form-label" htmlFor="cs-field-email">Email</label>
                    <input className="cs-form-input" type="email" id="cs-field-email" placeholder="you@example.com" required />
                  </div>
                  <div className="cs-form-field">
                    <label className="cs-form-label" htmlFor="cs-field-phone">Phone</label>
                    <input className="cs-form-input" type="tel" id="cs-field-phone" placeholder="+91 00000 00000" />
                  </div>
                  <div className="cs-form-field">
                    <label className="cs-form-label" htmlFor="cs-field-message">Business / Requirement</label>
                    <textarea className="cs-form-input" id="cs-field-message" rows={4} placeholder="Describe what you're looking to build..." />
                  </div>
                  <div className="cs-form-submit">
                    <button type="submit" className="cs-btn cs-btn-primary" style={{ width: '100%' }}><span className="cs-btn-text">Send Message</span></button>
                  </div>
                </div>
                <div className="cs-form-success">
                  <div className="cs-form-success-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <h3 className="cs-form-success-title">Message Sent</h3>
                  <p className="cs-form-success-desc">Thank you! We'll get back to you within 24 hours.</p>
                </div>
              </form>
            </div>
          </section>

          {/* ===== FINAL CTA ===== */}
          <section className="cs-final-cta cs-gs-reveal" id="cs-cta">
            <h2 className="cs-final-cta-title">Ready to Build<br />Your Digital Future?</h2>
            <p className="cs-final-cta-desc">Schedule a free consultation and discover how intelligent systems can transform your business.</p>
            <a href="#cs-contact" className="cs-btn cs-btn-primary"><span className="cs-btn-text">Start a Conversation</span></a>
          </section>

          {/* ===== INNER FOOTER ===== */}
          <div className="cs-site-footer">
            <p className="cs-footer-text">© 2026 Cynocyte Systems</p>
            <span className="cs-footer-hierarchy">Cynocyte Systems · A Cynocyte Technology Division · UNENDLESS</span>
          </div>
        </div>
      </div>

      <Footer />

      {/* SEO keyword signal block */}
      <aside aria-hidden="false" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        <h2>Cynocyte Systems — Intelligent Digital Systems Division of Cynocyte</h2>
        <p>
          Cynocyte Systems is the technology services division of Cynocyte, building intelligent digital systems,
          automation infrastructure, and scalable business technology for modern enterprises. Services include
          website systems, automation systems, and custom digital infrastructure. Part of UNENDLESS,
          founded by Swarnadeep Mukherjee.
        </p>
      </aside>
    </div>
  )
}
