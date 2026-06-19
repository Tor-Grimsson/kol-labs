import { R, PAL } from './_helpers.js'

// INTERLACE — woven, crossing, and knotted structures. Three reliable techniques:
//   · warp/weft  = `prim:bar` base; an every-col:2 rule rotates alternate columns
//     90° → vertical strips cross horizontal ones. A checker opacity rule creates
//     the over/under depth illusion. Works for plain weave, twill, basketweave.
//   · lattice    = `prim:plus` with a positive gap + showGrid. Plus marks at each
//     cell node + the showGrid lattice line = a two-layer trellis read.
//   · chainlink  = `prim:diamond` with negative gap (overlap) so diamond edges
//     interlock. colorRule:checker or diag gives the link separation.
// Scale: big-and-few (trellis cols:4) → fine mesh (cols:20+).

export default [
  // ── plain weave family ──
  { id: 'plain-weave', label: 'Plain weave', params: {
    shape: 'prim:bar', cols: 8, rows: 8, cell: 90, gap: 6,
    color: PAL.camel, bg: PAL.tan,
    rules: [
      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
      R({ selectKind: 'checker', opacity: 0.65 }),
    ],
    animAxis: 'diag', animWaves: 2, fade: 0.2, animCurveExpr: 'k<0.5?2*k*k:1-2*(1-k)*(1-k)' } },

  { id: 'linen-weave', label: 'Linen weave', params: {
    shape: 'prim:bar', cols: 12, rows: 12, cell: 68, gap: 4,
    color: PAL.oat, bg: PAL.bone,
    rules: [
      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
      R({ selectKind: 'checker', opacity: 0.6 }),
    ],
    animAxis: 'diag', animWaves: 3, fade: 0.18 } },

  { id: 'twill-weave', label: 'Twill weave', params: {
    shape: 'prim:bar', cols: 10, rows: 10, cell: 78, gap: 5,
    colorRule: 'diag', color: PAL.navy, color2: PAL.blue, color3: PAL.sky, bg: PAL.ink,
    rules: [
      R({ selectKind: 'every-col', n: 3, offset: 0, rotate: 90 }),
      R({ selectKind: 'every-col', n: 3, offset: 1, rotate: 90 }),
      R({ selectKind: 'checker', opacity: 0.7 }),
    ],
    animAxis: 'diag', animWaves: 3, colorMix: 0.15, fade: 0.2 } },

  { id: 'basketweave', label: 'Basketweave', params: {
    shape: 'prim:bar', cols: 8, rows: 8, cell: 88, gap: 6,
    color: PAL.amber, bg: PAL.ochre,
    rules: [
      R({ selectKind: 'checker', groupW: 2, groupH: 2, rotate: 90 }),
      R({ selectKind: 'every-nth', n: 5, offset: 0, opacity: 0.65 }),
    ],
    animAxis: 'diag', animWaves: 2, fade: 0.2 } },

  { id: 'satin-weave', label: 'Satin weave', params: {
    shape: 'prim:bar', cols: 10, rows: 10, cell: 76, gap: 5,
    colorRule: 'diag', color: PAL.gold, color2: PAL.amber, color3: PAL.ochre, bg: PAL.ink,
    rules: [
      R({ selectKind: 'every-col', n: 5, offset: 0, rotate: 90 }),
      R({ selectKind: 'every-row', n: 5, offset: 2, opacity: 0.55 }),
    ],
    animAxis: 'diag', animWaves: 2, colorMix: 0.18, fade: 0.22 } },

  // ── herringbone & chevron ──
  { id: 'herringbone', label: 'Herringbone', params: {
    shape: 'prim:triangle', cols: 10, rows: 10, cell: 76, gap: -2,
    colorRule: 'checker', color: PAL.camel, color2: PAL.tan, bg: PAL.char,
    rules: [
      R({ selectKind: 'every-col', n: 2, flipH: true }),
      R({ selectKind: 'every-row', n: 2, flipV: true }),
    ],
    animAxis: 'diag', animWaves: 3, fade: 0.18 } },

  { id: 'herringbone-bold', label: 'Herringbone bold', params: {
    shape: 'prim:triangle', cols: 6, rows: 6, cell: 120, gap: -4,
    colorRule: 'checker', color: PAL.navy, color2: PAL.bone, bg: PAL.ink,
    rules: [
      R({ selectKind: 'every-col', n: 2, flipH: true }),
      R({ selectKind: 'every-row', n: 2, flipV: true }),
    ],
    animAxis: 'diag', animWaves: 2, fade: 0.16 } },

  { id: 'chevron-weave', label: 'Chevron weave', params: {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 90, gap: 0,
    colorRule: 'rows', color: PAL.teal, color2: PAL.sky, color3: PAL.navy, bg: PAL.ink2,
    rules: [
      R({ selectKind: 'every-col', n: 2, flipH: true }),
      R({ selectKind: 'every-row', n: 2, flipV: true }),
    ],
    animAxis: 'diag', animWaves: 3, colorMix: 0.15, fade: 0.2 } },

  // ── lattice & trellis ──
  { id: 'trellis', label: 'Trellis', params: {
    shape: 'prim:plus', cols: 4, rows: 4, cell: 170, gap: 10, showGrid: true,
    color: PAL.forest, bg: PAL.moss,
    animAxis: 'radial', animWaves: 1, fade: 0.2 } },

  { id: 'lattice', label: 'Lattice', params: {
    shape: 'prim:plus', cols: 8, rows: 8, cell: 90, gap: 6, showGrid: true,
    colorRule: 'checker', color: PAL.cream, color2: PAL.oat, bg: PAL.brick,
    animAxis: 'diag', animWaves: 2, fade: 0.2 } },

  { id: 'diamond-lattice', label: 'Diamond lattice', params: {
    shape: 'prim:diamond', cols: 6, rows: 6, cell: 110, gap: -6, showGrid: true,
    colorRule: 'checker', color: PAL.sky, color2: PAL.teal, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.22 } },

  { id: 'caning', label: 'Caning', params: {
    shape: 'prim:plus', cols: 16, rows: 16, cell: 62, gap: 4, showGrid: true,
    color: PAL.camel, bg: PAL.tan,
    animAxis: 'radial', animWaves: 4, fade: 0.18 } },

  // ── chainlink & reef ──
  { id: 'chainlink', label: 'Chainlink', params: {
    shape: 'prim:diamond', cols: 8, rows: 8, cell: 96, gap: -12,
    colorRule: 'checker', color: PAL.slate, color2: PAL.bone, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.2, animCurveExpr: 'k<0.5?2*k*k:1-2*(1-k)*(1-k)' } },

  { id: 'chainlink-gold', label: 'Chainlink gold', params: {
    shape: 'prim:diamond', cols: 6, rows: 6, cell: 120, gap: -14,
    colorRule: 'checker', color: PAL.gold, color2: PAL.amber, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.22 } },

  { id: 'reef-knot', label: 'Reef knot', params: {
    shape: 'prim:square', cols: 6, rows: 6, cell: 110, gap: 0, stretch: true, showGrid: true,
    colorRule: 'checker', color: PAL.teal, color2: PAL.navy, bg: PAL.ink,
    rules: [R({ selectKind: 'checker', rotate: 45 })],
    animAxis: 'diag', animWaves: 2, fade: 0.18 } },

  // ── mesh & netting ──
  { id: 'mesh', label: 'Mesh', params: {
    shape: 'prim:bar', cols: 16, rows: 16, cell: 62, gap: 4,
    color: PAL.ink, bg: PAL.bone,
    rules: [
      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
    ],
    animAxis: 'diag', animWaves: 4, fade: 0.2 } },

  { id: 'netting', label: 'Netting', params: {
    shape: 'prim:diamond', cols: 10, rows: 10, cell: 78, gap: -4,
    color: PAL.sky, bg: PAL.ink2,
    rules: [R({ selectKind: 'every-nth', n: 3, offset: 1, opacity: 0.55 })],
    animAxis: 'radial', animWaves: 3, fade: 0.25 } },

  { id: 'grid-weave', label: 'Grid weave', params: {
    shape: 'prim:plus', cols: 20, rows: 20, cell: 55, gap: 5, showGrid: true,
    color: PAL.bone, bg: PAL.char,
    animAxis: 'diag', animWaves: 5, fade: 0.18 } },

  // ── loom / cable (bold textile feel) ──
  { id: 'loom', label: 'Loom', params: {
    shape: 'prim:bar', cols: 8, rows: 10, cell: 84, gap: 6,
    colorRule: 'cols', color: PAL.red, color2: PAL.amber, color3: PAL.navy, bg: PAL.ink,
    rules: [
      R({ selectKind: 'every-row', n: 2, offset: 0, rotate: 90, opacity: 0.7 }),
    ],
    animAxis: 'col', animWaves: 3, colorMix: 0.15, fade: 0.2 } },

  { id: 'cable', label: 'Cable', params: {
    shape: 'prim:bar', cols: 6, rows: 6, cell: 120, gap: 8,
    colorRule: 'checker', color: PAL.cream, color2: PAL.coral, bg: PAL.brick,
    rules: [
      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
      R({ selectKind: 'checker', groupW: 2, groupH: 2, opacity: 0.7 }),
    ],
    animAxis: 'diag', animWaves: 2, fade: 0.2 } },
]
