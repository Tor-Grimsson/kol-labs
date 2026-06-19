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
const LibraryPage = lazy(() => import('./pages/library/LibraryPage.jsx'))
const GalleryPage = lazy(() => import('./pages/gallery/GalleryPage.jsx'))
const ThreeDScenePage = lazy(() => import('./pages/gradient/ThreeDScenePage.jsx'))
const ParaTypePage = lazy(() => import('./pages/para-type/ParaTypePage.jsx'))
const VideoPage = lazy(() => import('./pages/video/VideoPage.jsx'))
const MathPage = lazy(() => import('./pages/math/MathPage.jsx'))
const LoopsPage = lazy(() => import('./pages/loops/LoopsPage.jsx'))
const KineticPage = lazy(() => import('./pages/kinetic/KineticPage.jsx'))
const OpticPage = lazy(() => import('./pages/optic/OpticPage.jsx'))
const ScanlinesPage = lazy(() => import('./pages/scanlines/ScanlinesPage.jsx'))
const DriftPage = lazy(() => import('./pages/drift/DriftPage.jsx'))
const LivePage = lazy(() => import('./pages/live/LivePage.jsx'))
const PatternPage = lazy(() => import('./pages/pattern/PatternPage.jsx'))
const GradientsPage = lazy(() => import('./pages/gradients/GradientsPage.jsx'))
const TypePage = lazy(() => import('./pages/type/TypePage.jsx'))

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
        <Route path="/library" element={<Suspense fallback={null}><LibraryPage /></Suspense>} />
        <Route path="/gallery" element={<Suspense fallback={null}><GalleryPage /></Suspense>} />
        <Route path="/3d-scene/*" element={<Suspense fallback={null}><ThreeDScenePage /></Suspense>} />
        <Route path="/para-type" element={<Suspense fallback={null}><ParaTypePage /></Suspense>} />
        <Route path="/video" element={<Suspense fallback={null}><VideoPage /></Suspense>} />
        <Route path="/math/*" element={<Suspense fallback={null}><MathPage /></Suspense>} />
        <Route path="/loops/*" element={<Suspense fallback={null}><LoopsPage /></Suspense>} />
        <Route path="/kinetic/*" element={<Suspense fallback={null}><KineticPage /></Suspense>} />
        <Route path="/optic/*" element={<Suspense fallback={null}><OpticPage /></Suspense>} />
        <Route path="/scanlines/*" element={<Suspense fallback={null}><ScanlinesPage /></Suspense>} />
        <Route path="/drift/*" element={<Suspense fallback={null}><DriftPage /></Suspense>} />
        <Route path="/live/*" element={<Suspense fallback={null}><LivePage /></Suspense>} />
        <Route path="/pattern" element={<Suspense fallback={null}><PatternPage /></Suspense>} />
        <Route path="/type" element={<Suspense fallback={null}><TypePage /></Suspense>} />
        <Route path="/gradients/*" element={<Suspense fallback={null}><GradientsPage /></Suspense>} />
      </Route>
    </Routes>
  )
}
