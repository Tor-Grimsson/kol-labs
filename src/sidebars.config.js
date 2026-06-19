/**
 * Single navigation tree for the labs shell.
 *
 * Node shapes:
 *   { section: 'Label' }               — top-level section header (no link)
 *   { id, label, to, icon, children }  — a page hop (+ optional sub-tree)
 * Sub-tree leaf / group shapes:
 *   { id: 'about',  label: 'About' }   — page section anchor (#about)
 *   { to: '/about', label: 'About' }   — sub-route link
 *   { label: 'View', children: [...] } — labeled group
 *
 * Order groups by what you're MAKING: the first three groups generate from
 * nothing; "Source-in" pages take a media input (upload, or the CDN library).
 * Add a top-level entry here + a matching <Route> in App.jsx.
 */

import { categoryLabel, FOUNDATION_KEYS, TERRITORY_KEYS } from './pages/penrose/prototypes/categories.js'
import { GROUPS as INTERFACE_GROUPS } from './pages/interfaces/widgets/groups.js'
import { SCREEN_GROUPS } from './pages/interfaces/screens.groups.js'
import { EFFECT_GROUPS } from './pages/effects/effects.config.js'
import { SCENE_GROUPS, ELEMENT_GROUPS } from './pages/kinetic/scenes/groups.js'
import { GROUPS as LOOP_GROUPS, SUBGROUPS as LOOP_SUBGROUPS } from './loops/registry.js'
import { SCENE_PRESETS } from './pages/radar/refract/scenes.js'
import { CATEGORIES as SCANLINE_CATEGORIES, SUBPAGES as SCANLINE_SUBPAGES } from './pages/scanlines/registry.js'
import { FORMS } from './pages/gradient/forms/data/shapes.js'
import { ENVIRONMENTS } from './pages/gradient/environments/data/scenes.js'

export const NAV_TREE = [
  { id: 'home', label: 'Home', to: '/', icon: 'book-open' },
  { id: 'library', label: 'Library', to: '/library', icon: 'image' },
  { id: 'gallery', label: 'Gallery', to: '/gallery', icon: 'layout-01' },
  { id: 'radar', label: 'Radar', to: '/radar', icon: 'target-lock', children: [
    { label: 'Halftone', children: [
      { to: '/radar/ascii', label: 'ASCII' },
      { to: '/radar', label: 'Dither' },
    ] },
    { label: 'Distortion', children: [
      { to: '/radar/distort', label: 'Chromatic' },
    ] },
    { label: 'Synth', children: [
      { to: '/radar/trails', label: 'Trails' },
      { to: '/radar/slitscan', label: 'Slitscan' },
      { to: '/radar/scan', label: 'Scan' },
      { to: '/radar/disco', label: 'Disco' },
    ] },
    { label: 'Effects', children: EFFECT_GROUPS.map((g, i) => ({
      to: i === 0 ? '/radar/effects' : `/radar/effects/${g.id}`,
      label: g.label,
    })) },
  ] },

  { section: 'Generative' },
  { id: 'interfaces', label: 'Interfaces', to: '/interfaces', icon: 'phone', children: [
    { label: 'View', children: [
      { to: '/interfaces/generate', label: 'Generate' },
      { to: '/interfaces/player', label: 'Player' },
    ] },
    // Screens = the gallery of 50 composed screens, grouped by content category.
    { label: 'Screens', children: SCREEN_GROUPS.map((g) => ({
      to: `/interfaces/gallery/${g.key}`,
      label: g.label,
    })) },
    // Elements = the widget catalog, one entry per widget group (filters the Library).
    { label: 'Elements', children: INTERFACE_GROUPS.map((g) => ({
      to: `/interfaces/library/${g.key}`,
      label: g.label,
    })) },
  ] },
  { id: 'penrose', label: 'Penrose', to: '/penrose', icon: 'a-framed', children: [
    { label: 'View', children: [
      { to: '/penrose/generate', label: 'Generate' },
      { to: '/penrose/player', label: 'Player' },
    ] },
    // Two big content categories (mirrors interfaces' Screens + Elements):
    // Foundations = the 15 base prototypes, grouped by technique; Territories =
    // the 100 round-2 prototypes grouped into their 20 research territories.
    // Exactly two content categories, four even subgroups each.
    { label: 'Foundations', children: FOUNDATION_KEYS.map((key) => ({
      to: `/penrose/browse/${key}`,
      label: categoryLabel(key),
      matchPaths: [`/penrose/browse/${key}`],
    })) },
    { label: 'Territories', children: TERRITORY_KEYS.map((key) => ({
      to: `/penrose/browse/${key}`,
      label: categoryLabel(key),
      matchPaths: [`/penrose/browse/${key}`],
    })) },
  ] },
  { id: 'kinetic', label: 'Kinetic', to: '/kinetic', icon: 'font-01', children: [
    { label: 'View', children: [
      { to: '/kinetic/generate', label: 'Generate' },
      { to: '/kinetic/player',   label: 'Player' },
    ] },
    { label: 'Scenes', children: SCENE_GROUPS.map((g) => ({
      to: `/kinetic/gallery/${g.key}`,
      label: g.label,
    })) },
    { label: 'Elements', children: ELEMENT_GROUPS.map((g) => ({
      to: `/kinetic/library/${g.key}`,
      label: g.label,
    })) },
  ] },

  { id: 'math', label: 'Math', to: '/math', icon: 'sum', children: [
    { label: 'Waveforms', children: [
      { to: '/math', label: 'Expression' },
      { to: '/math/fourier', label: 'Fourier' },
      { to: '/math/animate', label: 'Animate' },
    ]},
    { label: 'Parametric', children: [
      { to: '/math/uzumaki', label: 'Curves' },
      { to: '/math/orbits', label: 'Orbits' },
    ]},
    { label: 'Surfaces', children: [
      { to: '/math/surface', label: 'Surface' },
      { to: '/math/attractor', label: 'Attractor' },
    ]},
    { label: 'Fields', children: [
      { to: '/math/field', label: 'Field' },
      { to: '/math/complex', label: 'Complex' },
    ]},
  ] },
  { id: 'loops', label: 'Loops', to: '/loops', icon: 'cycle', children:
    // Three categories (Simple · Pattern · Field), six routed sub-pages each —
    // derived from the loop registry so nav + router never drift (mirrors Math).
    LOOP_GROUPS.map((g) => ({
      label: g.label,
      children: LOOP_SUBGROUPS[g.id].map((s) => ({
        to: s.route,
        label: s.sub,
      })),
    })),
  },
  { id: '3d-scene', label: '3D Scene', to: '/3d-scene', icon: 'ball', children: [
    { label: 'Gradient', children: [{ to: '/3d-scene', label: 'Gradient' }] },
    { label: 'Primitive', children: [{ to: '/3d-scene/primitive', label: 'Primitive' }] },
    { label: 'Forms', children: FORMS.map((f) => ({ to: `/3d-scene/forms/${f.id}`, label: f.label })) },
    { label: 'Environments', children: ENVIRONMENTS.map((e) => ({ to: `/3d-scene/environments/${e.id}`, label: e.label })) },
  ] },
  { id: 'optic', label: 'Optic', to: '/optic', icon: 'ptrn-dot', children: [
    { label: 'Pattern', children: [
      { to: '/optic', label: 'Halftone' },
      { to: '/optic/moire', label: 'Moiré' },
      { to: '/optic/gradient-field', label: 'Mesh Gradient' },
      { to: '/optic/reaction', label: 'Reaction' },
    ] },
    { label: 'Lens', children: [
      { to: '/optic/lens/glass', label: 'Glass' },
      { to: '/optic/lens/ice', label: 'Ice' },
      { to: '/optic/lens/metal', label: 'Liquid Metal' },
      { to: '/optic/lens/mirror', label: 'Mirror' },
      { to: '/optic/lens/ripple', label: 'Ripple' },
    ] },
    // Scene = a category of 3D-scene SETTINGS presets (same concept, different
    // mood). The glass material is switched by the floating menu on the stage.
    { label: 'Scene', children: SCENE_PRESETS.map((s) => ({
      to: `/optic/scene/${s.id}`,
      label: s.label,
    })) },
  ] },
  // Scanlines — cumulative-sum variable-density scanline toys. Three categories
  // (Lines · Radial · Source), each a routed family; derived from the registry
  // so nav + routes can't drift.
  { id: 'scanlines', label: 'Scanlines', to: '/scanlines', icon: 'line-line', children:
    SCANLINE_CATEGORIES.map((c) => ({
      label: c.label,
      children: SCANLINE_SUBPAGES[c.id].map((s) => ({ to: s.route, label: s.label })),
    })),
  },

  { section: 'Source-in' },
  { id: 'poster', label: 'Poster', to: '/poster', icon: 'image' },
  { id: 'video', label: 'Video', to: '/video', icon: 'scissors' },

  { section: 'Vector shapes' },
  { id: 'para-type', label: 'Para Type', to: '/para-type', icon: 'aa' },
  { id: 'distress', label: 'Distress', to: '/distress', icon: 'wave' },
]

/* Find the active top-level page given a pathname. Section headers have no `to`. */
export function getActivePage(pathname) {
  if (pathname === '/') return NAV_TREE.find((n) => n.to === '/')
  return NAV_TREE.find((n) => n.to && n.to !== '/' && pathname.startsWith(n.to))
}
