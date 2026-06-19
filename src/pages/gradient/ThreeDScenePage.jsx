import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import GradientPage from './GradientPage'

// Primitive scene carries its own three.js geometry/preset code; Forms is its
// own router (one shell per form, sidebar nav hop between them) — both lazy
// so the default Gradient route doesn't bundle them.
const PrimitiveScenePage = lazy(() => import('./primitive/PrimitiveScenePage'))
const FormsPage = lazy(() => import('./forms/FormsPage.jsx'))
const EnvironmentsPage = lazy(() => import('./environments/EnvironmentsPage.jsx'))

// Descendant routes under the shell's /3d-scene/* mount. The #4 pipeline rebuild
// will add more scene types as siblings here.
export default function ThreeDScenePage() {
  return (
    <Routes>
      <Route path="/" element={<GradientPage />} />
      <Route
        path="primitive"
        element={
          <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
            <PrimitiveScenePage />
          </Suspense>
        }
      />
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
