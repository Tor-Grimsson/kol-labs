import { R, PAL } from './_helpers.js'

// INTERLACE — woven, crossing, knotted structures. The true over/under weaves are a
// dedicated WEAVE pass (render:'weave'): warp (vertical) + weft (horizontal) ribbons
// cross, and a `weaveType` parity decides which passes OVER at each crossing — real
// z-ordering, not a fake opacity check.
//   weaveType   plain · twill · satin · basket       strandWidth  ribbon width (× cell)
//   color = warp · color2 = weft · bg = gaps         cols/rows/cell/gap = the lattice
// camFlow travels the over/under boundary diagonally (whole cycles ⇒ seamless).
// Herringbone, lattice and chainlink are genuine TILE tessellations (not over/under
// weaves), so they stay on the tile engine (no `render` ⇒ 'tiles').

const weave = (o) => ({ render: 'weave', ...o })

export default [
  // ── true weaves (over/under) ──
  { id: 'plain-weave', label: 'Plain weave', params: weave({
    weaveType: 'plain', cols: 8, rows: 8, cell: 90, gap: 4, strandWidth: 0.74,
    color: PAL.camel, color2: PAL.tan, bg: PAL.char }) },
  { id: 'twill-weave', label: 'Twill weave', params: weave({
    weaveType: 'twill', cols: 10, rows: 10, cell: 78, gap: 4, strandWidth: 0.76,
    color: PAL.navy, color2: PAL.blue, bg: PAL.ink }) },
  { id: 'basketweave', label: 'Basketweave', params: weave({
    weaveType: 'basket', cols: 8, rows: 8, cell: 88, gap: 4, strandWidth: 0.8,
    color: PAL.amber, color2: PAL.ochre, bg: PAL.noir }) },
  { id: 'satin-weave', label: 'Satin weave', params: weave({
    weaveType: 'satin', cols: 10, rows: 10, cell: 76, gap: 3, strandWidth: 0.78,
    color: PAL.gold, color2: PAL.amber, bg: PAL.ink }) },
  { id: 'mesh', label: 'Mesh', params: weave({
    weaveType: 'plain', cols: 16, rows: 16, cell: 60, gap: 5, strandWidth: 0.5,
    color: PAL.ink, color2: PAL.slate, bg: PAL.bone }) },

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
