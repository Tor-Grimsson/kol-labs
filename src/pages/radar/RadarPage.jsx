import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ImageProvider } from './state/ImageContext'
import DitherPage from './pages/DitherPage'

// three.js only loads when the distort route is actually visited — the dither
// page's bundle stays lean.
const DistortPage = lazy(() => import('./pages/DistortPage'))
const AsciiPage = lazy(() => import('./pages/AsciiPage'))

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
      </Routes>
    </ImageProvider>
  )
}
