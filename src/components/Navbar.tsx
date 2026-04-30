import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    setMobileOpen(false)
    if (!isHome) return
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass border-b border-[var(--border-color)] shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/logos/cynocyte%20logo%20for%20light%20theme.png"
              alt="Cynocyte"
              className="h-8 w-8 dark:hidden"
            />
            <img
              src="/logos/logo%20light%20no%20background.png"
              alt="Cynocyte"
              className="h-8 w-8 hidden dark:block"
            />
            <img
              src="/logos/cynocyte%20long%20logo%20for%20light%20theme.png"
              alt="Cynocyte"
              className="h-6 dark:hidden"
            />
            <img
              src="/logos/cynocyte%20long%20logo%20for%20dark%20theme.png"
              alt="Cynocyte"
              className="h-6 hidden dark:block"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {isHome && (
              <>
                <button
                  onClick={() => scrollToSection('about')}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  About
                </button>
                <button
                  onClick={() => scrollToSection('products')}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Products
                </button>
                <button
                  onClick={() => scrollToSection('play-labs')}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Play Labs
                </button>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Contact
                </button>
              </>
            )}
            {!isHome && (
              <>
                <Link
                  to="/"
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Home
                </Link>
                <Link
                  to="/about"
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  About
                </Link>
              </>
            )}
            <ThemeToggle />
          </div>

          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-full glass"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-5 h-5 text-[var(--text-primary)]" />
              ) : (
                <Menu className="w-5 h-5 text-[var(--text-primary)]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden glass border-t border-[var(--border-color)] mx-4 mb-4 rounded-2xl p-4">
          <div className="flex flex-col gap-2">
            {isHome ? (
              <>
                <button onClick={() => scrollToSection('about')} className="text-left px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">About</button>
                <button onClick={() => scrollToSection('products')} className="text-left px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">Products</button>
                <button onClick={() => scrollToSection('play-labs')} className="text-left px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">Play Labs</button>
                <button onClick={() => scrollToSection('contact')} className="text-left px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">Contact</button>
              </>
            ) : (
              <>
                <Link to="/" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">Home</Link>
                <Link to="/about" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">About</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
