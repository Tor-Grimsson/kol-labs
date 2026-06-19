// Type loops catalog — single source of truth for the /type sub-pages (the
// acre_studio "type on a path, rotating" family). Nav + routes both derive from this
// list so they can't drift (mirrors the drift/scanlines model). `/type` itself is the
// blank typesetting canvas; each sub-page seeds the SAME editor with a loop
// composition, fully editable from there.
//
// Each entry's `loop` is a full engine composition ({ bg, instances }) authored for a
// ~1000px square frame. The hero arrangements are `radial` (sunburst spokes) and
// `rings` (concentric vortex); `circle`+orbit and `spiral` round out the set.

import { mergeInstance, FRAME_DEFAULTS } from '../kinetic/data/presets.js'

const BG = '#0b0d12'      // near-black, like the reel
const FG = '#e8e4dc'

const comp = (o) => ({ ...FRAME_DEFAULTS, bg: BG, instances: [mergeInstance({ font: 'rot', fill: FG, ...o }, 0)] })

export const CATEGORIES = [
  { id: 'radial', label: 'Radial' },
  { id: 'rings', label: 'Rings' },
  { id: 'path', label: 'Path' },
]
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]

// `path` is relative to /type; `route` is the absolute sidebar link.
export const SUBPAGES = {
  // ── Radial sunburst (reel frames 5–11) ──
  radial: [
    { id: 'sunburst', label: 'Sunburst', path: 'sunburst', route: '/type/sunburst',
      loop: comp({ text: 'Without a soul, is it a place?', fontSize: 26, vf: { wdth: 100, wght: 500 }, path: { type: 'radial', count: 14, inner: 0.1, spin: 1 } }) },
    { id: 'dense-burst', label: 'Dense burst', path: 'dense-burst', route: '/type/dense-burst',
      loop: comp({ text: 'is it a place', fontSize: 30, vf: { wdth: 90, wght: 600 }, path: { type: 'radial', count: 28, inner: 0.06, spin: 1 } }) },
    { id: 'double-twirl', label: 'Double twirl', path: 'double-twirl', route: '/type/double-twirl',
      loop: comp({ text: 'turning and turning', fontSize: 24, font: 'malromur', vf: { wght: 500 }, path: { type: 'radial', count: 18, inner: 0.12, spin: 2 } }) },
    { id: 'pulse-burst', label: 'Pulse burst', path: 'pulse-burst', route: '/type/pulse-burst',
      loop: comp({ text: 'breathe in, breathe out', fontSize: 26, font: 'gullhamrar', vf: { wght: 600 }, path: { type: 'radial', count: 16, inner: 0.1, spin: 1 }, motion: { mode: 'cascade', cycles: 2, phase: 0.5 } }) },
  ],
  // ── Concentric-ring vortex (reel frames 13–18) ──
  rings: [
    { id: 'vortex', label: 'Vortex', path: 'vortex', route: '/type/vortex',
      loop: comp({ text: 'Does a community make a place? ', fontSize: 24, vf: { wdth: 100, wght: 500 }, path: { type: 'rings', count: 12, inner: 0.1, radius: 0.94, spin: 1, twist: 0.6, grow: 0.8 } }) },
    { id: 'galaxy', label: 'Galaxy', path: 'galaxy', route: '/type/galaxy',
      loop: comp({ text: 'spiralling inward forever ', fontSize: 22, font: 'malromur', vf: { wght: 500 }, path: { type: 'rings', count: 16, inner: 0.05, radius: 0.96, spin: 1, twist: 1.25, grow: 0.9 } }) },
    { id: 'wide-rings', label: 'Wide rings', path: 'wide-rings', route: '/type/wide-rings',
      loop: comp({ text: 'around and around ', fontSize: 28, font: 'gullhamrar', vf: { wght: 600 }, path: { type: 'rings', count: 8, inner: 0.18, radius: 0.92, spin: 1, twist: 0.3, grow: 1.2 } }) },
  ],
  // ── Single ring + spiral (already-existing arrangements) ──
  path: [
    { id: 'orbit', label: 'Orbit', path: 'orbit', route: '/type/orbit',
      loop: comp({ text: 'KOLKRABBI · REYKJAVIK · ', fontSize: 40, font: 'malromur', vf: { wght: 500 }, path: { type: 'circle', radius: 0.82 }, motion: { mode: 'orbit', cycles: 1 } }) },
    { id: 'spiral', label: 'Spiral', path: 'spiral', route: '/type/spiral',
      loop: comp({ text: 'into the spiral we go ', fontSize: 30, vf: { wdth: 100, wght: 500 }, path: { type: 'spiral', turns: 4, radius: 0.95 }, motion: { mode: 'march', cycles: 1 } }) },
  ],
}

export const ALL_SUBPAGES = [...SUBPAGES.radial, ...SUBPAGES.rings, ...SUBPAGES.path]
export const subpageById = (id) => ALL_SUBPAGES.find((s) => s.id === id) || null
