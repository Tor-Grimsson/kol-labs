import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import GradientPage from './GradientPage'

// Primitive scene carries its own three.js geometry/preset code; Forms is its
// own router (one shell per form, sidebar nav hop between them) — both lazy
// so the default Gradient route doesn't bundle them.
const PrimitiveScenePage = lazy(() => import('./primitive/PrimitiveScenePage'))
const RibbonPage = lazy(() => import('./ribbon/RibbonPage.jsx'))
const FormsPage = lazy(() => import('./forms/FormsPage.jsx'))
const EnvironmentsPage = lazy(() => import('./environments/EnvironmentsPage.jsx'))
const AbstractRDPage = lazy(() => import('./abstract/AbstractRDPage.jsx'))
const AbstractDitherPage = lazy(() => import('./abstract/AbstractDitherPage.jsx'))
const AbstractMSTPPage = lazy(() => import('./abstract/AbstractMSTPPage.jsx'))

// Descendant routes under the shell's /3d-scene/* mount. The #4 pipeline rebuild
// will add more scene types as siblings here.
export default function ThreeDScenePage() {
  // Primitive renders the same lazy page whether or not a primitive is deep-linked
  // (the sidebar Primitive category routes to /primitive/<id>); share one element.
  const primitiveEl = (
    <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
      <PrimitiveScenePage />
    </Suspense>
  )
  // Abstract › Reaction-Diffusion — one page, variation chosen by :variant.
  const abstractEl = (
    <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
      <AbstractRDPage />
    </Suspense>
  )
  const ditherEl = (
    <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
      <AbstractDitherPage />
    </Suspense>
  )
  const mstpEl = (
    <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
      <AbstractMSTPPage />
    </Suspense>
  )
  // Ribbon — the swept-glass "Puddle" studio; sidebar Ribbon category deep-links a form.
  const ribbonEl = (
    <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
      <RibbonPage />
    </Suspense>
  )
  return (
    <Routes>
      <Route path="/" element={<GradientPage />} />
      {/* Abstract › Field deep-links a locked gradient shape; bare /3d-scene = auto grid. */}
      <Route path="gradient/:shape" element={<GradientPage />} />
      <Route path="abstract" element={abstractEl} />
      <Route path="abstract/dither" element={ditherEl} />
      <Route path="abstract/mstp" element={mstpEl} />
      <Route path="abstract/mstp/:preset" element={mstpEl} />
      <Route path="abstract/:variant" element={abstractEl} />
      <Route path="primitive" element={primitiveEl} />
      <Route path="primitive/:primitiveId" element={primitiveEl} />
      <Route path="ribbon" element={ribbonEl} />
      <Route path="ribbon/:ribbonId" element={ribbonEl} />
      <Route
        path="forms/*"
        element={
          <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
            <FormsPage />
          </Suspense>
        }
      />
      <Route
        path="environments/*"
        element={
          <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
            <EnvironmentsPage />
          </Suspense>
        }
      />
    </Routes>
  )
}
