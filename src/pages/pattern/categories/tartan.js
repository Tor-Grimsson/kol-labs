import { R, PAL } from './_helpers.js'

// TARTAN — woven plaid. The true thread-based plaids are a FIELD (render:'field',
// field:'tartan'): warp+weft threads from a `sett` (threadcount table in
// fields/setts.js) AVERAGE at each crossing into the woven "mix" tone. Colours come
// from the preset (retintable): sett indices 0..3 → color/color2/color3/bg.
//   sett        which threadcount table       settScale   px per thread
//   twill       diagonal 2/2 grain (0 = flat average)
// camFlow scrolls the sett (whole repeats ⇒ seamless; paused on load).
// Argyle + houndstooth are genuine TILE tessellations, not thread averages, so they
// stay on the tile engine (no `render` ⇒ 'tiles').

const tartan = (o) => ({ render: 'field', field: 'tartan', ...o })

export default [
  // ── the icons (field) ──
  { id: 'burberry', label: 'Burberry', params: tartan({
    sett: 'royal', settScale: 5, twill: 0.16,
    color: PAL.camel, color2: PAL.red, color3: PAL.ink, bg: PAL.bone }) },
  { id: 'gingham', label: 'Gingham', params: tartan({
    sett: 'gingham', settScale: 6, twill: 0,
    color: PAL.red, bg: PAL.cream }) },
  { id: 'buffalo-check', label: 'Buffalo check', params: tartan({
    sett: 'buffalo', settScale: 9, twill: 0.1,
    color: PAL.red, color2: PAL.ink }) },
  { id: 'madras', label: 'Madras', params: tartan({
    sett: 'madras', settScale: 5, twill: 0.2,
    color: PAL.green, color2: PAL.gold, color3: PAL.red }) },
  { id: 'windowpane', label: 'Windowpane', params: tartan({
    sett: 'windowpane', settScale: 6, twill: 0,
    color: PAL.navy, color2: PAL.sky }) },

  // ── classic tartans (field) ──
  { id: 'black-watch', label: 'Black Watch', params: tartan({
    sett: 'black-watch', settScale: 5, twill: 0.2,
    color: PAL.navy, color2: PAL.forest, color3: PAL.ink }) },
  { id: 'royal-stewart', label: 'Royal Stewart', params: tartan({
    sett: 'royal', settScale: 5, twill: 0.2,
    color: PAL.red, color2: PAL.navy, color3: PAL.forest, bg: PAL.bone }) },
  { id: 'glen-plaid', label: 'Glen plaid', params: tartan({
    sett: 'glen', settScale: 4, twill: 0.22,
    color: PAL.slate, bg: PAL.cream }) },

  // ── argyle / houndstooth — genuine TILE tessellations (kept on the tile engine) ──
  { id: 'argyle', label: 'Argyle', params: {
    shape: 'prim:diamond', cols: 4, rows: 4, cell: 130, gap: -10, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.forest, color2: PAL.oat, color3: PAL.brick, bg: PAL.cream,
    animAxis: 'diag', animWaves: 2, colorMix: 0.14 } },
  { id: 'houndstooth', label: 'Houndstooth', params: {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 88, gap: -4, stretch: true,
    colorRule: 'checker', color: PAL.ink, color2: PAL.bone, bg: PAL.ink,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 3, fade: 0.12 } },
]
