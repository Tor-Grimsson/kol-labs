import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppShell from './components/framework/AppShell.jsx'
import { NAV_TREE, getActivePage } from './sidebars.config'
import Home from './pages/Home'

// Experiments load lazily so their runtimes (p5, simplex-noise, d3-*) never
// land in the home chunk.
const InterfacesPage = lazy(() => import('./pages/interfaces/InterfacesPage.jsx'))
const PenrosePage = lazy(() => import('./pages/penrose/PenrosePage.jsx'))
const RadarPage = lazy(() => import('./pages/radar/RadarPage.jsx'))
const PosterPage = lazy(() => import('./pages/poster/PosterPage.jsx'))
const DistressPage = lazy(() => import('./pages/distress/DistressPage.jsx'))
const LayoutPage = lazy(() => import('./pages/layout/LayoutPage.jsx'))
const ThreeDScenePage = lazy(() => import('./pages/gradient/ThreeDScenePage.jsx'))
const ParaTypePage = lazy(() => import('./pages/para-type/ParaTypePage.jsx'))
const VideoPage = lazy(() => import('./pages/video/VideoPage.jsx'))
const MathPage = lazy(() => import('./pages/math/MathPage.jsx'))
const LoopsPage = lazy(() => import('./pages/loops/LoopsPage.jsx'))
const KineticPage = lazy(() => import('./pages/kinetic/KineticPage.jsx'))

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell navTree={NAV_TREE} getActivePage={getActivePage} />}>
        <Route path="/" element={<Home />} />
        <Route path="/interfaces/*" element={<Suspense fallback={null}><InterfacesPage /></Suspense>} />
        <Route path="/penrose/*" element={<Suspense fallback={null}><PenrosePage /></Suspense>} />
        <Route path="/radar/*" element={<Suspense fallback={null}><RadarPage /></Suspense>} />
        <Route path="/poster" element={<Suspense fallback={null}><PosterPage /></Suspense>} />
        <Route path="/distress/*" element={<Suspense fallback={null}><DistressPage /></Suspense>} />
        <Route path="/layout/*" element={<Suspense fallback={null}><LayoutPage /></Suspense>} />
        <Route path="/3d-scene/*" element={<Suspense fallback={null}><ThreeDScenePage /></Suspense>} />
        <Route path="/para-type" element={<Suspense fallback={null}><ParaTypePage /></Suspense>} />
        <Route path="/video" element={<Suspense fallback={null}><VideoPage /></Suspense>} />
        <Route path="/math/*" element={<Suspense fallback={null}><MathPage /></Suspense>} />
        <Route path="/loops/*" element={<Suspense fallback={null}><LoopsPage /></Suspense>} />
        <Route path="/kinetic/*" element={<Suspense fallback={null}><KineticPage /></Suspense>} />
      </Route>
    </Routes>
  )
}
