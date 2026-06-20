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
 * Order groups by FUNCTION, not engine. Labs = the workspace/settings cluster
 * (settings + sources). Then maker sections by what they DO: Effects transform a
 * source · Generative makes from params · Composition authors multi-instance
 * scenes · Modulation drives params from live signal · Export are output tools.
 * Add a top-level entry here + a matching <Route> in App.jsx.
 */

import { categoryLabel, FOUNDATION_KEYS, TERRITORY_KEYS } from './pages/penrose/prototypes/categories.js'
import { GROUPS as INTERFACE_GROUPS } from './pages/interfaces/widgets/groups.js'
import { SCREEN_GROUPS } from './pages/interfaces/screens.groups.js'
import { EFFECT_GROUPS } from './pages/effects/effects.config.js'
import { SCENE_GROUPS, ELEMENT_GROUPS } from './pages/kinetic/scenes/groups.js'
import { GROUPS as LOOP_GROUPS, SUBGROUPS as LOOP_SUBGROUPS } from './loops/registry.js'
import { CATEGORIES as DRIFT_CATEGORIES, SUBPAGES as DRIFT_SUBPAGES } from './pages/drift/registry.js'
import { CATEGORIES as TYPE_CATEGORIES, SUBPAGES as TYPE_SUBPAGES } from './pages/type/registry.js'
import { CATEGORIES as PATTERN_CATEGORIES, SUBPAGES as PATTERN_SUBPAGES } from './pages/pattern/registry.js'
import { FORMS } from './pages/gradient/forms/data/shapes.js'
import { ENVIRONMENTS } from './pages/gradient/environments/data/scenes.js'
import { SHAPES } from './pages/gradient/data/palettes.js'
import { PRIMITIVES } from './pages/gradient/primitive/data/primitives.js'
import { RIBBON_PRESETS } from './pages/gradient/ribbon/data/presets.js'
import { RD_VARIATIONS } from './pages/gradient/abstract/data/models.js'
import { MSTP_PRESETS } from './pages/gradient/abstract/data/mstp.js'
import { AUDIO_CATEGORIES, EXAMPLES as AUDIO_EXAMPLES } from './pages/live/audio/examples.js'
import { GRADIENT_CATEGORIES, GRADIENT_TYPES } from './pages/gradients/registry.js'
import { SOFTFORM_CATEGORIES, SCENES as SOFTFORM_SCENES } from './pages/softforms/registry.js'
import { CATEGORIES_3D, SCENES_3D } from './pages/softforms/registry3d.js'
import { RAIL_GROUPS } from './pages/_shared/railGroups.js'

// SHAPES are bare value-strings (sphere/plane); author Capitalized nav labels here.
const SHAPE_LABEL = { sphere: 'Sphere', plane: 'Plane' }

export const NAV_TREE = [
  // Labs = the workspace/settings cluster. Clicking the parent only toggles open
  // (SideNav convention); the self-child reaches the settings page at `/`.
  { id: 'home', label: 'Labs', to: '/', icon: 'book-open', children: [
    { to: '/', label: 'Settings' },
    { to: '/library', label: 'Library' },
    { to: '/gallery', label: 'Gallery' },
  ] },

  { section: 'Effects' },
  { id: 'halftone', label: 'Halftone', to: '/radar', icon: 'ptrn-dot',
    children: RAIL_GROUPS.halftone.map((v) => ({ to: v.to, label: v.label })) },
  // Scanline FILTER — source-in (image/video/webcam luma drives density). The
  // generator twin lives under Generative. Presets switch in-rail (dropdown).
  { id: 'scanline', label: 'Scanline', to: '/scanlines/filter', icon: 'grid-horizontal' },
  // CRT — the analog-video-synthesis family (70s TV-station look), moved out of
  // Scanline. Lives on the radar synth routes.
  { id: 'crt', label: 'CRT', to: '/radar/trails', icon: 'monitor', children: [
    { to: '/radar/trails', label: 'Disco' },
    { to: '/radar/slitscan', label: 'Slitscan' },
    { to: '/radar/scan', label: 'Scan' },
    { to: '/radar/disco', label: 'Symmetry' },
  ] },
  // Three pages: Lens (2D flat refraction) · Scene (3D glass-mesh) · Chromatic
  // (aberration filter). The surface + scene variants live in each page's in-rail
  // dropdown, not the nav.
  { id: 'refraction', label: 'Refraction', to: '/optic/lens', icon: 'circle', children: [
    { to: '/optic/lens', label: 'Lens' },
    { to: '/optic/scene', label: 'Scene' },
    { to: '/radar/distort', label: 'Chromatic' },
  ] },
  { id: 'fx-rack', label: 'FX Rack', to: '/radar/effects', icon: 'target-lock', children:
    EFFECT_GROUPS.map((g, i) => ({
      to: i === 0 ? '/radar/effects' : `/radar/effects/${g.id}`,
      label: g.label,
    })),
  },
  // Parked: Optic generators not in the 4 effect groups. Reachable until reassigned.
  { id: 'optic-pattern', label: 'Pattern', to: '/optic/moire', icon: 'ptrn-checker', children: [
    { to: '/optic/moire', label: 'Moiré' },
    { to: '/optic/gradient-field', label: 'Mesh Gradient' },
    { to: '/optic/reaction', label: 'Reaction' },
    { to: '/optic/halftone', label: 'Halftone' },
  ] },

  { section: 'Generative' },
  // Scanline GENERATOR — procedural field → scanline pattern (filter twin under Effects).
  { id: 'scanline-gen', label: 'Scanline', to: '/scanlines', icon: 'grid-horizontal' },
  // Pattern — the kolkrabbi rule/tiling engine as a standalone vector-pattern
  // studio. Five categories (Stripes · Tartan · Blocks · Organic · Interlace),
  // ~20 sub-pages each; derived from the registry so nav + routes can't drift.
  { id: 'pattern', label: 'Pattern', to: '/pattern', icon: 'ptrn-checker', children:
    PATTERN_CATEGORIES.map((c) => ({
      label: c.label,
      children: PATTERN_SUBPAGES[c.id].map((s) => ({ to: s.route, label: s.label })),
    })),
  },
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
  { id: 'math', label: 'Math', to: '/math', icon: 'sum', children: [
    { label: 'Waveforms', children: [
      { to: '/math', label: 'Expression' },
      { to: '/math/fourier', label: 'Fourier' },
      { to: '/math/animate', label: 'Animate' },
    ]},
    { label: 'Parametric', children: [
      { to: '/math/uzumaki', label: 'Curves' },
      { to: '/math/orbits', label: 'Orbits' },
      { to: '/math/spinner', label: 'Spinner' },
      { to: '/math/threads', label: 'Threads' },
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
  { id: 'para-type', label: 'Para Type', to: '/para-type', icon: 'aa' },
  // Drift — seamless motion-loop eyecandy (Air · Water · Cloth). Phase 1 = Air;
  // categories + sub-pages derive from the registry so nav + routes can't drift.
  { id: 'drift', label: 'Drift', to: '/drift', icon: 'wave', children:
    DRIFT_CATEGORIES.map((c) => ({
      label: c.label,
      children: DRIFT_SUBPAGES[c.id].map((s) => ({ to: s.route, label: s.label })),
    })),
  },
  { id: 'gradients', label: 'Gradients', to: '/gradients', icon: 'circle', children:
    GRADIENT_CATEGORIES.map((c) => ({
      label: c.label,
      children: GRADIENT_TYPES.filter((t) => t.cat === c.id).map((t) => ({
        to: `/gradients/${t.id}`,
        label: t.label,
      })),
    })),
  },
  // Soft Forms — matcap-shaded SDF compositions on black (the "Apple wallpaper"
  // look). Scenes derive from the registry so nav + routes can't drift.
  { id: 'softforms', label: 'Soft Forms', to: '/softforms', icon: 'paint-drop', children:
    SOFTFORM_CATEGORIES.map((c) => ({
      label: c.label,
      children: SOFTFORM_SCENES.filter((s) => s.cat === c.id).map((s) => ({
        to: `/softforms/${s.id}`,
        label: s.label,
      })),
    })),
  },
  { id: 'softforms-3d', label: 'Soft Forms 3D', to: '/softforms-3d', icon: 'ball', children:
    CATEGORIES_3D.map((c) => ({
      label: c.label,
      children: SCENES_3D.filter((s) => s.cat === c.id).map((s) => ({ to: `/softforms-3d/${s.id}`, label: s.label })),
    })),
  },
  { id: '3d-scene', label: '3D Scene', to: '/3d-scene', icon: 'ball', children: [
    { label: 'Abstract', children: [
      { label: 'Field', children: SHAPES.map((s) => ({ to: `/3d-scene/gradient/${s}`, label: SHAPE_LABEL[s] ?? s })) },
      { label: 'Reaction-Diffusion', children: RD_VARIATIONS.map((v) => ({ to: `/3d-scene/abstract/${v.id}`, label: v.label })) },
      { label: 'Multi-Scale', children: MSTP_PRESETS.map((p) => ({ to: `/3d-scene/abstract/mstp/${p.id}`, label: p.label })) },
      { label: 'Dither', children: [{ to: '/3d-scene/abstract/dither', label: 'Photo' }] },
    ] },
    { label: 'Primitive', children: PRIMITIVES.map((p) => ({ to: `/3d-scene/primitive/${p.id}`, label: p.label })) },
    { label: 'Ribbon', children: RIBBON_PRESETS.map((p) => ({ to: `/3d-scene/ribbon/${p.id}`, label: p.label })) },
    { label: 'Forms', children: FORMS.map((f) => ({ to: `/3d-scene/forms/${f.id}`, label: f.label })) },
    { label: 'Environments', children: ENVIRONMENTS.map((e) => ({ to: `/3d-scene/environments/${e.id}`, label: e.label })) },
  ] },

  { section: 'Composition' },
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
  // Type — blank typesetting canvas at /type; loop sub-pages (Radial · Rings · Path)
  // derive from the registry so nav + routes can't drift.
  { id: 'type', label: 'Type', to: '/type', icon: 'font-01', children:
    TYPE_CATEGORIES.map((c) => ({
      label: c.label,
      children: TYPE_SUBPAGES[c.id].map((s) => ({ to: s.route, label: s.label })),
    })),
  },

  { section: 'Modulation' },
  { id: 'live', label: 'Modulation', to: '/live', icon: 'camera', children: [
    { label: 'Controllers', children: [{ to: '/live/controllers', label: 'Gamepad' }] },
    ...AUDIO_CATEGORIES.map((c) => ({
      label: c.label,
      children: AUDIO_EXAMPLES.filter((e) => e.cat === c.id).map((e) => ({ to: `/live/audio/${e.id}`, label: e.label })),
    })),
  ] },

  { section: 'Export' },
  { id: 'poster', label: 'Poster', to: '/poster', icon: 'image' },
  { id: 'video', label: 'Video', to: '/video', icon: 'scissors' },
]

/* Collect every route string anywhere under a nav node. */
function collectRoutes(node, acc = []) {
  if (node.to) acc.push(node.to)
  if (node.children) for (const c of node.children) collectRoutes(c, acc)
  return acc
}

/* Find the active top-level page given a pathname. Section headers have no `to`.
 * The 4 effect groups draw routes from shared page prefixes (/radar, /optic), so
 * we pick the node owning the LONGEST matching route — most specific wins. */
export function getActivePage(pathname) {
  if (pathname === '/') return NAV_TREE.find((n) => n.to === '/')
  let best = null
  let bestLen = -1
  for (const n of NAV_TREE) {
    if (n.section) continue
    for (const r of collectRoutes(n)) {
      if (r && r !== '/' && pathname.startsWith(r) && r.length > bestLen) {
        best = n
        bestLen = r.length
      }
    }
  }
  return best
}
