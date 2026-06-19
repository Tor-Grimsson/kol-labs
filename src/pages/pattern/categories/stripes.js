import { R, PAL } from './_helpers.js'

// STRIPES — directional bar fields. Two reliable techniques:
//   · solid stripes  = a `square` field + colorRule cols/rows/diag (continuous,
//     crisp colour bands; cell sets thickness, cols/rows the repeat)
//   · spaced lines   = a `bar` shape rotated, with gap, for slats / pinstripes
// Scale is varied on purpose: big-and-few (cols 2–3, big cells) → small-and-many
// (cols 18+, fine cells). A gentle sweep is set so the gallery breathes on play.

export default [
  // ── solid colour bands ──
  { id: 'awning', label: 'Awning', params: {
    shape: 'prim:square', cols: 2, rows: 1, cell: 200, gap: 0, stretch: true,
    colorRule: 'cols', color: PAL.red, color2: PAL.cream, color3: PAL.cream, bg: PAL.ink,
    animAxis: 'col', animWaves: 1, fade: 0.25 } },
  { id: 'deckchair', label: 'Deckchair', params: {
    shape: 'prim:square', cols: 3, rows: 1, cell: 150, gap: 0, stretch: true,
    colorRule: 'cols', color: PAL.teal, color2: PAL.amber, color3: PAL.coral, bg: PAL.ink,
    animAxis: 'col', animWaves: 1.5, colorMix: 0.18 } },
  { id: 'horizon', label: 'Horizon', params: {
    shape: 'prim:square', cols: 1, rows: 2, cell: 110, gap: 0, stretch: true,
    colorRule: 'rows', color: PAL.navy, color2: PAL.cream, color3: PAL.cream, bg: PAL.ink,
    animAxis: 'row', animWaves: 1, fade: 0.3 } },
  { id: 'ticking', label: 'Ticking', params: {
    shape: 'prim:square', cols: 8, rows: 1, cell: 90, gap: 0, stretch: true,
    colorRule: 'cols', color: PAL.navy, color2: PAL.cream, color3: PAL.navy, bg: PAL.cream,
    animAxis: 'col', animWaves: 3, fade: 0.2 } },
  { id: 'corduroy', label: 'Corduroy', params: {
    shape: 'prim:square', cols: 20, rows: 1, cell: 60, gap: 0, stretch: true,
    colorRule: 'cols', color: PAL.rust, color2: PAL.brick, color3: PAL.coral, bg: PAL.noir,
    animAxis: 'col', animWaves: 5, pulse: 0.0, fade: 0.35 } },
  { id: 'candy', label: 'Candy', params: {
    shape: 'prim:square', cols: 3, rows: 3, cell: 100, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.red, color2: PAL.bone, color3: PAL.rose, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, colorMix: 0.2, animCurveExpr: 'pow(sin(PI*k),2)' } },
  { id: 'liquorice', label: 'Liquorice', params: {
    shape: 'prim:square', cols: 6, rows: 1, cell: 96, gap: 0, stretch: true,
    colorRule: 'cols', color: PAL.ink, color2: PAL.amber, color3: PAL.ink, bg: PAL.amber,
    animAxis: 'col', animWaves: 2, fade: 0.25 } },
  { id: 'gradient-bands', label: 'Gradient bands', params: {
    shape: 'prim:square', cols: 14, rows: 1, cell: 70, gap: 0, stretch: true,
    colorRule: 'none', color: PAL.violet, color2: PAL.sky, bg: PAL.noir,
    animAxis: 'col', animCycles: 1, animWaves: 1.4, colorMix: 0.9 } },

  // ── diagonal ──
  { id: 'twill', label: 'Twill', params: {
    shape: 'prim:square', cols: 4, rows: 4, cell: 90, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.forest, color2: PAL.oat, color3: PAL.moss, bg: PAL.ink,
    camAngle: 0, animAxis: 'diag', animWaves: 3, colorMix: 0.15 } },
  { id: 'barber', label: 'Barber', params: {
    shape: 'prim:square', cols: 3, rows: 3, cell: 110, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.red, color2: PAL.bone, color3: PAL.blue, bg: PAL.ink,
    camAngle: 18, animAxis: 'diag', animCycles: 1, animWaves: 2, colorMix: 0.1 } },
  { id: 'bias-bold', label: 'Bias bold', params: {
    shape: 'prim:square', cols: 2, rows: 2, cell: 180, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.char, color2: PAL.gold, color3: PAL.char, bg: PAL.gold,
    camAngle: 45, animAxis: 'diag', animWaves: 1, fade: 0.2 } },

  // ── spaced lines (bars) ──
  { id: 'pinstripe', label: 'Pinstripe', params: {
    shape: 'prim:bar', cols: 10, rows: 8, cell: 120, gap: -24, color: PAL.cream, bg: PAL.navy,
    rules: [R({ rotate: 90 })], animAxis: 'col', animWaves: 4, fade: 0.3 } },
  { id: 'double-pin', label: 'Double pin', params: {
    shape: 'prim:bar', cols: 12, rows: 8, cell: 110, gap: -22, color: PAL.bone, bg: PAL.ink,
    rules: [R({ rotate: 90 }), R({ selectKind: 'every-col', n: 2, hide: true })],
    animAxis: 'col', animWaves: 5, fade: 0.25 } },
  { id: 'venetian', label: 'Venetian', params: {
    shape: 'prim:bar', cols: 6, rows: 10, cell: 120, gap: -18, color: PAL.oat, bg: PAL.slate,
    rules: [], animAxis: 'row', animWaves: 4, fade: 0.45 } },
  { id: 'ladder', label: 'Ladder', params: {
    shape: 'prim:bar', cols: 8, rows: 8, cell: 120, gap: 10, color: PAL.amber, bg: PAL.noir,
    rules: [R({ rotate: 90 })], animAxis: 'col', animWaves: 4, pulse: 0.25 } },
  { id: 'morse', label: 'Morse', params: {
    shape: 'prim:bar', cols: 9, rows: 9, cell: 110, gap: 6, color: PAL.sky, bg: PAL.ink,
    rules: [R({ rotate: 90 }), R({ selectKind: 'expression', expression: 'sin(row * 1.7 + col)', hide: true })],
    animAxis: 'row', animWaves: 3, fade: 0.4, animCurveExpr: 'round(k)' } },
  { id: 'thick-thin', label: 'Thick / thin', params: {
    shape: 'prim:bar', cols: 12, rows: 6, cell: 110, gap: -16, color: PAL.coral, bg: PAL.char,
    rules: [R({ rotate: 90 }), R({ selectKind: 'every-col', n: 2, flipV: false, groupW: 1, opacity: 0.5 })],
    animAxis: 'col', animWaves: 4, fade: 0.3 } },

  // ── shape stripes ──
  { id: 'chevron', label: 'Chevron', params: {
    shape: 'prim:triangle', cols: 8, rows: 6, cell: 110, gap: 0, stretch: true,
    colorRule: 'rows', color: PAL.teal, color2: PAL.cream, color3: PAL.navy, bg: PAL.ink,
    rules: [R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'row', animWaves: 2, swing: 0, fade: 0.25 } },
  { id: 'sawtooth', label: 'Sawtooth', params: {
    shape: 'prim:triangle', cols: 10, rows: 4, cell: 100, gap: 0, stretch: true,
    colorRule: 'cols', color: PAL.gold, color2: PAL.rust, color3: PAL.amber, bg: PAL.noir,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true })],
    animAxis: 'col', animWaves: 3, colorMix: 0.2 } },
]
