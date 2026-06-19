import { R, PAL } from './_helpers.js'

// TARTAN — woven plaid / check. The reliable recipe:
//   · a `square` field with `stretch:true` = solid colour blocks
//   · a SMALL POSITIVE gap + `bg` set to the thread colour ⇒ thin lines show
//     between the blocks → the woven "thread" lattice that reads as plaid
//   · `colorRule` interleaves the blocks: checker (2-col) → gingham/buffalo;
//     diag/cols/rows (3-col) → madras/tartan colourways
//   · `showGrid:true` lays an extra thread lattice over the gaps (windowpane,
//     tattersall, argyle cross-lines)
// Scale runs big-and-few (buffalo, 2–4 cells) → fine-and-many (tartan-fine 18+).
// The static read must stay crisp, so the sweep is kept subtle / mostly off.

export default [
  // ── the icons ──
  { id: 'burberry', label: 'Burberry', params: {
    shape: 'prim:square', cols: 6, rows: 6, cell: 96, gap: 5, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.beige, color2: PAL.tan, color3: PAL.camel, bg: PAL.ink,
    rules: [R({ selectKind: 'both', n: 6, n2: 6, offset: 2, offset2: 2 })],
    animAxis: 'diag', animWaves: 2, colorMix: 0.12 } },
  { id: 'gingham', label: 'Gingham', params: {
    shape: 'prim:square', cols: 8, rows: 8, cell: 80, gap: 4, stretch: true,
    colorRule: 'checker', color: PAL.bone, color2: PAL.red, bg: PAL.cream,
    animAxis: 'diag', animWaves: 2, fade: 0.18 } },
  { id: 'buffalo-check', label: 'Buffalo check', params: {
    shape: 'prim:square', cols: 4, rows: 4, cell: 160, gap: 6, stretch: true,
    colorRule: 'checker', color: PAL.red, color2: PAL.ink, bg: PAL.brick,
    animAxis: 'diag', animWaves: 1, fade: 0.16 } },
  { id: 'madras', label: 'Madras', params: {
    shape: 'prim:square', cols: 7, rows: 7, cell: 84, gap: 5, stretch: true,
    colorRule: 'diag', color: PAL.green, color2: PAL.gold, color3: PAL.red, bg: PAL.ink,
    animAxis: 'diag', animCycles: 1, animWaves: 3, colorMix: 0.18 } },
  { id: 'windowpane', label: 'Windowpane', params: {
    shape: 'prim:square', cols: 3, rows: 3, cell: 200, gap: 3, stretch: true, showGrid: true,
    colorRule: 'none', color: PAL.navy, color2: PAL.sky, bg: PAL.sky,
    animAxis: 'radial', animWaves: 1, fade: 0.2 } },

  // ── argyle / houndstooth ──
  { id: 'argyle', label: 'Argyle', params: {
    shape: 'prim:diamond', cols: 4, rows: 4, cell: 130, gap: -10, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.forest, color2: PAL.oat, color3: PAL.brick, bg: PAL.cream,
    animAxis: 'diag', animWaves: 2, colorMix: 0.14 } },
  { id: 'argyle-navy', label: 'Argyle navy', params: {
    shape: 'prim:diamond', cols: 5, rows: 5, cell: 110, gap: -8, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.navy, color2: PAL.amber, color3: PAL.brick, bg: PAL.bone,
    animAxis: 'diag', animWaves: 3, colorMix: 0.12 } },
  { id: 'houndstooth', label: 'Houndstooth', params: {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 88, gap: -4, stretch: true,
    colorRule: 'checker', color: PAL.ink, color2: PAL.bone, bg: PAL.ink,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 3, fade: 0.12 } },
  { id: 'puppytooth', label: 'Puppytooth', params: {
    shape: 'prim:triangle', cols: 14, rows: 14, cell: 56, gap: -3, stretch: true,
    colorRule: 'checker', color: PAL.brick, color2: PAL.cream, bg: PAL.brick,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 4, fade: 0.12 } },

  // ── classic tartans / colourways ──
  { id: 'black-watch', label: 'Black Watch', params: {
    shape: 'prim:square', cols: 6, rows: 6, cell: 96, gap: 5, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.navy, color2: PAL.forest, color3: PAL.ink, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, colorMix: 0.12 } },
  { id: 'royal-stewart', label: 'Royal Stewart', params: {
    shape: 'prim:square', cols: 7, rows: 7, cell: 84, gap: 5, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.red, color2: PAL.navy, color3: PAL.forest, bg: PAL.bone,
    animAxis: 'diag', animCycles: 1, animWaves: 3, colorMix: 0.16 } },
  { id: 'dress-tartan', label: 'Dress tartan', params: {
    shape: 'prim:square', cols: 8, rows: 8, cell: 80, gap: 4, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.bone, color2: PAL.red, color3: PAL.navy, bg: PAL.cream,
    animAxis: 'diag', animWaves: 3, colorMix: 0.14 } },
  { id: 'blackwatch-bold', label: 'Black Watch bold', params: {
    shape: 'prim:square', cols: 4, rows: 4, cell: 150, gap: 6, stretch: true,
    colorRule: 'checker', color: PAL.forest, color2: PAL.navy, bg: PAL.ink,
    animAxis: 'diag', animWaves: 1, fade: 0.16 } },
  { id: 'hunting-tartan', label: 'Hunting tartan', params: {
    shape: 'prim:square', cols: 6, rows: 6, cell: 100, gap: 5, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.moss, color2: PAL.forest, color3: PAL.ochre, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, colorMix: 0.12 } },

  // ── fine grids / shirting ──
  { id: 'tattersall', label: 'Tattersall', params: {
    shape: 'prim:square', cols: 10, rows: 10, cell: 70, gap: 6, stretch: true, showGrid: true,
    colorRule: 'none', color: PAL.bone, color2: PAL.red, bg: PAL.brick,
    animAxis: 'radial', animWaves: 2, fade: 0.16 } },
  { id: 'glen-plaid', label: 'Glen plaid', params: {
    shape: 'prim:square', cols: 12, rows: 12, cell: 60, gap: 3, stretch: true,
    colorRule: 'checker', color: PAL.oat, color2: PAL.slate, bg: PAL.cream,
    animAxis: 'diag', animWaves: 4, fade: 0.14 } },
  { id: 'prince-of-wales', label: 'Prince of Wales', params: {
    shape: 'prim:square', cols: 16, rows: 16, cell: 50, gap: 2, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.bone, color2: PAL.slate, color3: PAL.ochre, bg: PAL.oat,
    animAxis: 'diag', animWaves: 5, colorMix: 0.12 } },
  { id: 'tartan-fine', label: 'Tartan fine', params: {
    shape: 'prim:square', cols: 18, rows: 18, cell: 46, gap: 3, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.teal, color2: PAL.navy, color3: PAL.coral, bg: PAL.ink,
    animAxis: 'diag', animWaves: 5, colorMix: 0.14 } },

  // ── bold scale ──
  { id: 'tartan-bold', label: 'Tartan bold', params: {
    shape: 'prim:square', cols: 3, rows: 3, cell: 210, gap: 8, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.plum, color2: PAL.amber, color3: PAL.teal, bg: PAL.noir,
    animAxis: 'diag', animWaves: 1, colorMix: 0.16 } },
  { id: 'picnic-check', label: 'Picnic check', params: {
    shape: 'prim:square', cols: 4, rows: 4, cell: 150, gap: 6, stretch: true,
    colorRule: 'checker', color: PAL.bone, color2: PAL.teal, bg: PAL.cream,
    animAxis: 'diag', animWaves: 2, fade: 0.18 } },
]
