import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ENVIRONMENTS } from './data/scenes.js'

// Environments — abstract mood scenes (mountain range / ocean / tunnel), the
// "doesn't have to be realistic" cousin of Forms. One shell, one route per
// environment (mirrors Forms' surface-per-route pattern); switching is a
// sidebar nav hop, not an in-rail picker.
const EnvironmentShell = lazy(() => import('./EnvironmentShell.jsx'))

const fallback = <div className="min-h-dvh bg-surface-secondary" />
const envRoute = (e) => (
  <Route key={e.id} path={e.id} element={<Suspense fallback={fallback}><EnvironmentShell env={e.id} title={e.label} /></Suspense>} />
)

export default function EnvironmentsPage() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ENVIRONMENTS[0].id} replace />} />
      {ENVIRONMENTS.map(envRoute)}
    </Routes>
  )
}
