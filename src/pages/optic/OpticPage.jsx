import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import HalftonePage from './halftone/HalftonePage'
import { ImageProvider } from '../radar/state/ImageContext'
import { SCENE_PRESETS } from '../radar/refract/scenes.js'
import { LENS_VARIANTS } from '../radar/refract/surfaces2d.js'

// Optic — generative 2D optical/pattern toys (Pattern) + two source-driven lens
// families: LENS (2D flat refraction — a glass object over the photo) and SCENE
// (a real 3D scene — photo plane behind a glass mesh, depth-true). Router shell
// over /optic/*, like MathPage. The lens shells live in radar/refract/ (they
// share Radar's source-picker plumbing); presented here under Lens + Scene.
const GradientFieldPage = lazy(() => import('./gradient-field/GradientFieldPage'))
const HalftoneGenPage = lazy(() => import('./halftone/HalftoneGenPage'))
const MoirePage = lazy(() => import('./moire/MoirePage'))
const ReactionPage = lazy(() => import('./reaction/ReactionPage'))
const Lens2DShell = lazy(() => import('../radar/refract/Lens2DShell'))
const LensShell = lazy(() => import('../radar/refract/LensShell')) // the 3D scene

const fallback = <div className="min-h-dvh bg-surface-secondary" />
const lazyRoute = (el) => <Suspense fallback={fallback}>{el}</Suspense>
// One ImageProvider for the whole Optic tree → the uploaded source persists when
// you switch lens surfaces / between Lens (2D) and Scene (3D).
const lens2d = (surface) => lazyRoute(<Lens2DShell surface={surface} />)

export default function OpticPage() {
  return (
    <ImageProvider>
      <Routes>
        <Route path="/" element={<HalftonePage />} />
        <Route path="halftone" element={lazyRoute(<HalftoneGenPage />)} />
        <Route path="gradient-field" element={lazyRoute(<GradientFieldPage />)} />
        <Route path="moire" element={lazyRoute(<MoirePage />)} />
        <Route path="reaction" element={lazyRoute(<ReactionPage />)} />

        {/* Lens — 2D flat refraction. One page; the surface is picked from the
            in-rail dropdown (route per surface so it stays deep-linkable). */}
        <Route path="lens" element={lens2d('glass')} />
        {LENS_VARIANTS.map((v) => (
          <Route key={v.id} path={`lens/${v.id}`} element={lens2d(v.id)} />
        ))}

        {/* Scene — 3D photo-plane + glass-mesh. One page; the SCENE preset is
            picked from the in-rail dropdown. `key` forces a fresh mount per scene
            so the preset re-seeds the whole rig. */}
        <Route path="scene" element={lazyRoute(<LensShell key={SCENE_PRESETS[0].id} preset={SCENE_PRESETS[0]} />)} />
        {SCENE_PRESETS.map((s) => (
          <Route key={s.id} path={`scene/${s.id}`} element={lazyRoute(<LensShell key={s.id} preset={s} />)} />
        ))}

        {/* legacy /optic/refract → 2D Glass */}
        <Route path="refract" element={lens2d('glass')} />
      </Routes>
    </ImageProvider>
  )
}
