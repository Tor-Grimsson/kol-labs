import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import HalftonePage from './halftone/HalftonePage'
import { ImageProvider } from '../radar/state/ImageContext'

// Optic — generative 2D optical/pattern toys (Pattern: halftone, moiré,
// mesh-gradient field, reaction-diffusion) + a source-driven Lens (Refract —
// a photo/video behind a procedural glass/ice/mirror surface). Router shell
// over /optic/*, like MathPage. Refract physically lives in radar/refract/
// (it shares Radar's source-picker plumbing); it's presented here under Lens.
const GradientFieldPage = lazy(() => import('./gradient-field/GradientFieldPage'))
const MoirePage = lazy(() => import('./moire/MoirePage'))
const ReactionPage = lazy(() => import('./reaction/ReactionPage'))
const RefractPage = lazy(() => import('../radar/refract/RefractPage'))

const fallback = <div className="min-h-dvh bg-surface-secondary" />
const lazyRoute = (el) => <Suspense fallback={fallback}>{el}</Suspense>

export default function OpticPage() {
  return (
    <Routes>
      <Route path="/" element={<HalftonePage />} />
      <Route path="gradient-field" element={lazyRoute(<GradientFieldPage />)} />
      <Route path="moire" element={lazyRoute(<MoirePage />)} />
      <Route path="reaction" element={lazyRoute(<ReactionPage />)} />
      <Route path="refract" element={lazyRoute(<ImageProvider><RefractPage /></ImageProvider>)} />
    </Routes>
  )
}
