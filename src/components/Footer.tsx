import { Link } from 'react-router-dom'
import { Github, Mail, Instagram, Twitter, Youtube } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="relative border-t border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/logos/cynocyte%20logo%20for%20light%20theme.png"
              alt="Cynocyte"
              className="h-6 w-6 dark:hidden"
            />
            <img
              src="/logos/logo%20light%20no%20background.png"
              alt="Cynocyte"
              className="h-6 w-6 hidden dark:block"
            />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Cynocyte
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/labs"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Play Labs
            </Link>
            <Link
              to="/about"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              About
            </Link>
            <a
              href="mailto:cynocyte@gmail.com"
              className="w-8 h-8 rounded-full glass flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Email"
            >
              <Mail className="w-4 h-4" />
            </a>
            <a
              href="https://www.instagram.com/cynocyte/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full glass flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com/cynocyte"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full glass flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://www.youtube.com/@Cynocyte"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full glass flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="YouTube"
            >
              <Youtube className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[var(--border-color)] text-center">
          <p className="text-xs text-[var(--text-secondary)]">
            &copy; {new Date().getFullYear()} Cynocyte.
          </p>
        </div>
      </div>
    </footer>
  )
}
