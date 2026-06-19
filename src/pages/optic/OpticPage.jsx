import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import HalftonePage from './halftone/HalftonePage'

// Optic — generative 2D optical/pattern toys (halftone, mesh-gradient field,
// moiré, reaction-diffusion). Router shell over /optic/*, like MathPage.
const GradientFieldPage = lazy(() => import('./gradient-field/GradientFieldPage'))
const MoirePage = lazy(() => import('./moire/MoirePage'))
const ReactionPage = lazy(() => import('./reaction/ReactionPage'))

const fallback = <div className="min-h-dvh bg-surface-secondary" />
const lazyRoute = (el) => <Suspense fallback={fallback}>{el}</Suspense>

export default function OpticPage() {
  return (
    <Routes>
      <Route path="/" element={<HalftonePage />} />
      <Route path="gradient-field" element={lazyRoute(<GradientFieldPage />)} />
      <Route path="moire" element={lazyRoute(<MoirePage />)} />
      <Route path="reaction" element={lazyRoute(<ReactionPage />)} />
    </Routes>
  )
}
