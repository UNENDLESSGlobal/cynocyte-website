import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { motion } from 'framer-motion'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`relative flex items-center justify-center w-10 h-10 rounded-full glass transition-all duration-300 hover:scale-105 ${className}`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === 'dark' ? 360 : 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {theme === 'dark' ? (
          <Moon className="w-5 h-5 text-[var(--text-primary)]" />
        ) : (
          <Sun className="w-5 h-5 text-[var(--text-primary)]" />
        )}
      </motion.div>
    </button>
  )
}
