import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import HalftonePage from './halftone/HalftonePage'
import { ImageProvider } from '../radar/state/ImageContext'
import { SCENE_PRESETS } from '../radar/refract/scenes.js'

// Optic — generative 2D optical/pattern toys (Pattern) + two source-driven lens
// families: LENS (2D flat refraction — a glass object over the photo) and SCENE
// (a real 3D scene — photo plane behind a glass mesh, depth-true). Router shell
// over /optic/*, like MathPage. The lens shells live in radar/refract/ (they
// share Radar's source-picker plumbing); presented here under Lens + Scene.
const GradientFieldPage = lazy(() => import('./gradient-field/GradientFieldPage'))
const MoirePage = lazy(() => import('./moire/MoirePage'))
const ReactionPage = lazy(() => import('./reaction/ReactionPage'))
const Lens2DShell = lazy(() => import('../radar/refract/Lens2DShell'))
const LensShell = lazy(() => import('../radar/refract/LensShell')) // the 3D scene

const fallback = <div className="min-h-dvh bg-surface-secondary" />
const lazyRoute = (el) => <Suspense fallback={fallback}>{el}</Suspense>
// One ImageProvider for the whole Optic tree → the uploaded source persists when
// you switch lens surfaces / between Lens (2D) and Scene (3D).
const lens2d = (surface, title) => lazyRoute(<Lens2DShell surface={surface} title={title} />)

export default function OpticPage() {
  return (
    <ImageProvider>
      <Routes>
        <Route path="/" element={<HalftonePage />} />
        <Route path="gradient-field" element={lazyRoute(<GradientFieldPage />)} />
        <Route path="moire" element={lazyRoute(<MoirePage />)} />
        <Route path="reaction" element={lazyRoute(<ReactionPage />)} />

        {/* Lens — 2D flat refraction, one surface per sub-page */}
        <Route path="lens/glass" element={lens2d('glass', 'Glass')} />
        <Route path="lens/ice" element={lens2d('ice', 'Ice')} />
        <Route path="lens/metal" element={lens2d('mirror', 'Liquid Metal')} />
        <Route path="lens/mirror" element={lens2d('kaleido', 'Mirror')} />
        <Route path="lens/ripple" element={lens2d('ripple', 'Ripple')} />

        {/* Scene — 3D photo-plane + glass-mesh; one SETTINGS preset per sub-page
            (same concept, different mood). Material stays live via the floating menu. */}
        {SCENE_PRESETS.map((s) => (
          <Route key={s.id} path={`scene/${s.id}`} element={lazyRoute(<LensShell surface={s.surface} title={s.label} preset={s} />)} />
        ))}

        {/* legacy /optic/refract → 2D Glass */}
        <Route path="refract" element={lens2d('glass', 'Glass')} />
      </Routes>
    </ImageProvider>
  )
}
