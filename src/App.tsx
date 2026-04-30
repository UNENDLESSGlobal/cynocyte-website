import { Routes, Route } from 'react-router-dom'
import { useThemeSync } from '@/stores/themeStore'
import Home from '@/pages/Home'
import Labs from '@/pages/Labs'
import ExperimentDetail from '@/pages/ExperimentDetail'
import About from '@/pages/About'
import ScrollToTop from '@/components/ScrollToTop'

function App() {
  useThemeSync()

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/labs" element={<Labs />} />
        <Route path="/labs/:id" element={<ExperimentDetail />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </>
  )
}

export default App
