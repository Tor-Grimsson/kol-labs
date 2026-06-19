import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ImageProvider } from './state/ImageContext'
import DitherPage from './pages/DitherPage'

// three.js only loads when the distort route is actually visited — the dither
// page's bundle stays lean.
const DistortPage = lazy(() => import('./pages/DistortPage'))
const AsciiPage = lazy(() => import('./pages/AsciiPage'))
// Synth family — WebGL temporal/feedback effects (shared SynthEngine base).
const TrailsPage = lazy(() => import('./pages/TrailsPage'))
const SlitscanPage = lazy(() => import('./pages/SlitscanPage'))
const ScanPage = lazy(() => import('./pages/ScanPage'))
const DiscoPage = lazy(() => import('./pages/DiscoPage'))
// Effects family — pixi.js + pixi-filters; lazy so it never lands in Dither's chunk.
const EffectsShell = lazy(() => import('../effects/EffectsPage'))
const RefractPage = lazy(() => import('./refract/RefractPage'))

// Descendant routes under the shell's /radar/* mount (was a standalone
// BrowserRouter app in kol-labs).
export default function RadarPage() {
  return (
    <ImageProvider>
      <Routes>
        <Route path="/" element={<DitherPage />} />
        <Route
          path="distort"
          element={
            <Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}>
              <DistortPage />
            </Suspense>
          }
        />
        <Route
          path="ascii"
          element={
            <Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}>
              <AsciiPage />
            </Suspense>
          }
        />
        <Route path="trails" element={<Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}><TrailsPage /></Suspense>} />
        <Route path="slitscan" element={<Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}><SlitscanPage /></Suspense>} />
        <Route path="scan" element={<Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}><ScanPage /></Suspense>} />
        <Route path="disco" element={<Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}><DiscoPage /></Suspense>} />
        <Route path="effects/*" element={<Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}><EffectsShell /></Suspense>} />
        <Route path="refract" element={<Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}><RefractPage /></Suspense>} />
      </Routes>
    </ImageProvider>
  )
}
