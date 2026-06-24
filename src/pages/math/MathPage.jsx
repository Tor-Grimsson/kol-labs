import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import ExpressionPage from './expression/ExpressionPage'

// uzumaki + animate pull funcgen + the curve engine; lazy so the lighter
// oscilloscope (the default route) doesn't carry it.
const UzumakiPage = lazy(() => import('./uzumaki/UzumakiPage'))
const AnimatePage = lazy(() => import('./animate/AnimatePage'))
const AttractorPage = lazy(() => import('./attractor/AttractorPage'))
const SurfacePage = lazy(() => import('./surface/SurfacePage'))
const FieldPage = lazy(() => import('./field/FieldPage'))
const ComplexPage = lazy(() => import('./complex/ComplexPage'))
const FourierPage = lazy(() => import('./fourier/FourierPage'))
const OrbitsPage = lazy(() => import('./orbits/OrbitsPage'))
const SpinnerPage = lazy(() => import('./spinner/SpinnerPage'))
const ThreadsPage = lazy(() => import('./threads/ThreadsPage'))
// Generator category shell (Page › Category › Preset). Surfaces is ported; the
// other three categories route to their first visualiser's existing page until
// they get the same treatment, so the 4-category nav never 404s.
const SurfacesEditor = lazy(() => import('./surfaces/SurfacesEditor'))
const FieldsEditor = lazy(() => import('./fields/FieldsEditor'))
const ParametricEditor = lazy(() => import('./parametric/ParametricEditor'))
const WaveformsEditor = lazy(() => import('./waveforms/WaveformsEditor'))

const fallback = <div className="min-h-dvh bg-surface-secondary" />
const lazyRoute = (el) => <Suspense fallback={fallback}>{el}</Suspense>

// Descendant routes under the shell's /math/* mount.
export default function MathPage() {
  return (
    <Routes>
      {/* Expression is the standalone /math index (text DSL, no presets). The
          categories sit below it: surfaces + fields are the ported generators;
          waveforms/parametric point at their first visualiser until ported. */}
      <Route path="/" element={<ExpressionPage />} />
      <Route path="waveforms" element={lazyRoute(<WaveformsEditor />)} />
      <Route path="parametric" element={lazyRoute(<ParametricEditor />)} />
      <Route path="surfaces" element={lazyRoute(<SurfacesEditor />)} />
      <Route path="fields" element={lazyRoute(<FieldsEditor />)} />
      {/* Direct visualiser routes (deep links + the soon-to-be presets). */}
      <Route path="uzumaki" element={lazyRoute(<UzumakiPage />)} />
      <Route path="animate" element={lazyRoute(<AnimatePage />)} />
      <Route path="attractor" element={lazyRoute(<AttractorPage />)} />
      <Route path="surface" element={lazyRoute(<SurfacePage />)} />
      <Route path="field" element={lazyRoute(<FieldPage />)} />
      <Route path="complex" element={lazyRoute(<ComplexPage />)} />
      <Route path="fourier" element={lazyRoute(<FourierPage />)} />
      <Route path="orbits" element={lazyRoute(<OrbitsPage />)} />
      <Route path="spinner" element={lazyRoute(<SpinnerPage />)} />
      <Route path="threads" element={lazyRoute(<ThreadsPage />)} />
    </Routes>
  )
}
