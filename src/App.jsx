import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppShell from './components/framework/AppShell.jsx'
import { NAV_TREE, getActivePage } from './sidebars.config'
import Home from './pages/Home'

// Experiments load lazily so their runtimes (p5, simplex-noise, d3-*) never
// land in the home chunk.
const InterfacesPage = lazy(() => import('./pages/interfaces/InterfacesPage.jsx'))
const GlyphLabPage = lazy(() => import('./pages/glyph-lab/GlyphLabPage.jsx'))
const RadarPage = lazy(() => import('./pages/radar/RadarPage.jsx'))
const PosterPage = lazy(() => import('./pages/poster/PosterPage.jsx'))
const DistressPage = lazy(() => import('./pages/distress/DistressPage.jsx'))
const LayoutPage = lazy(() => import('./pages/layout/LayoutPage.jsx'))
const GradientPage = lazy(() => import('./pages/gradient/GradientPage.jsx'))
const ParaTypePage = lazy(() => import('./pages/para-type/ParaTypePage.jsx'))

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell navTree={NAV_TREE} getActivePage={getActivePage} />}>
        <Route path="/" element={<Home />} />
        <Route path="/interfaces" element={<Suspense fallback={null}><InterfacesPage /></Suspense>} />
        <Route path="/glyph-lab" element={<Suspense fallback={null}><GlyphLabPage /></Suspense>} />
        <Route path="/radar/*" element={<Suspense fallback={null}><RadarPage /></Suspense>} />
        <Route path="/poster" element={<Suspense fallback={null}><PosterPage /></Suspense>} />
        <Route path="/distress/*" element={<Suspense fallback={null}><DistressPage /></Suspense>} />
        <Route path="/layout" element={<Suspense fallback={null}><LayoutPage /></Suspense>} />
        <Route path="/gradient" element={<Suspense fallback={null}><GradientPage /></Suspense>} />
        <Route path="/para-type" element={<Suspense fallback={null}><ParaTypePage /></Suspense>} />
      </Route>
    </Routes>
  )
}
