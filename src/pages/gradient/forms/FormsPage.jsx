import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { FORMS } from './data/shapes.js'

// Forms — parametric point-cloud creatures (the de-lofi'd interfaces lofi
// widgets) as real 3D THREE.Points clouds. One shell, one route per form
// (mirrors Optic Lens2D's surface-per-route pattern); switching forms is a
// sidebar nav hop, not an in-rail picker.
const FormShell = lazy(() => import('./FormShell.jsx'))

const fallback = <div className="min-h-dvh bg-surface-secondary" />
const formRoute = (f) => (
  <Route key={f.id} path={f.id} element={<Suspense fallback={fallback}><FormShell form={f.id} title={f.label} /></Suspense>} />
)

export default function FormsPage() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={FORMS[0].id} replace />} />
      {FORMS.map(formRoute)}
    </Routes>
  )
}
