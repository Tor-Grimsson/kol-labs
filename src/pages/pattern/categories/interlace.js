import { R, PAL } from './_helpers.js'

// INTERLACE — woven-LOOKING tile tessellations: herringbone & chevron (triangle
// tessellations), lattice, chainlink, netting. These are genuine TILE patterns
// (shape + rules), not true over/under weaves — the real warp/weft weaves live in
// the Weave category (render:'weave'). camFlow/animAxis animate them like any tile
// pattern (no `render` key ⇒ 'tiles').

export default [
  // ── herringbone & chevron — genuine triangle tessellations (tiles) ──
  { id: 'herringbone', label: 'Herringbone', params: {
    shape: 'prim:triangle', cols: 10, rows: 10, cell: 76, gap: -2,
    colorRule: 'checker', color: PAL.camel, color2: PAL.tan, bg: PAL.char,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 3, fade: 0.18 } },
  { id: 'chevron-weave', label: 'Chevron weave', params: {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 90, gap: 0,
    colorRule: 'rows', color: PAL.teal, color2: PAL.sky, color3: PAL.navy, bg: PAL.ink2,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 3, colorMix: 0.15, fade: 0.2 } },

  // ── lattice (tiles) ──
  { id: 'lattice', label: 'Lattice', params: {
    shape: 'prim:plus', cols: 8, rows: 8, cell: 90, gap: 6, showGrid: true,
    colorRule: 'checker', color: PAL.cream, color2: PAL.oat, bg: PAL.brick,
    animAxis: 'diag', animWaves: 2, fade: 0.2 } },

  // ── chainlink & netting (tiles) ──
  { id: 'chainlink', label: 'Chainlink', params: {
    shape: 'prim:diamond', cols: 8, rows: 8, cell: 96, gap: -12,
    colorRule: 'checker', color: PAL.slate, color2: PAL.bone, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.2 } },
  { id: 'netting', label: 'Netting', params: {
    shape: 'prim:diamond', cols: 10, rows: 10, cell: 78, gap: -4,
    color: PAL.sky, bg: PAL.ink2,
    rules: [R({ selectKind: 'every-nth', n: 3, offset: 1, opacity: 0.55 })],
    animAxis: 'radial', animWaves: 3, fade: 0.25 } },
]
