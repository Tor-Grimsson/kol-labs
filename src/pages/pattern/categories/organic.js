import { R, PAL } from './_helpers.js'

// ORGANIC — soft natural marks, not hard grids. Reliable techniques:
//   · dots/bubbles  = a `circle` field; gap sets density (positive = polka spacing,
//     negative = overlapping cells/foam); colorRule checker/diag for two-tone fills
//   · scatter       = an expression rule with hide:true thins a dense field to a
//     sparse confetti/spore field (composeCell can only hide, never un-hide)
//   · honeycomb     = a `hexagon` field with a small positive gap so cells near-tile
//   · petals/blossom= the abstract:* blob marks, given life via spin / swing
// Organic is the one category where slightly MORE life is good — radial sweeps with
// gentle fade/pulse breathe; still seamless (whole-int spin/flow, paused on load).

export default [
  // ── dots & polka ──
  { id: 'polka', label: 'Polka', params: {
    shape: 'prim:circle', cols: 6, rows: 6, cell: 120, gap: 14,
    colorRule: 'checker', color: PAL.cream, color2: PAL.red, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.25 } },
  { id: 'pin-dots', label: 'Pin dots', params: {
    shape: 'prim:circle', cols: 14, rows: 14, cell: 70, gap: 18,
    color: PAL.bone, bg: PAL.navy,
    animAxis: 'radial', animWaves: 3, fade: 0.3 } },
  { id: 'caviar', label: 'Caviar', params: {
    shape: 'prim:circle', cols: 24, rows: 24, cell: 46, gap: 10,
    color: PAL.ink, bg: PAL.oat,
    animAxis: 'radial', animWaves: 4, fade: 0.2 } },
  { id: 'moons', label: 'Moons', params: {
    shape: 'prim:circle', cols: 8, rows: 6, cell: 110, gap: 16,
    colorRule: 'checker', color: PAL.amber, color2: PAL.ochre, bg: PAL.noir,
    rules: [R({ selectKind: 'every-col', n: 2, opacity: 0.55 })],
    animAxis: 'col', animWaves: 2, fade: 0.3 } },

  // ── bubbles & foam (overlap) ──
  { id: 'bubbles', label: 'Bubbles', params: {
    shape: 'prim:circle', cols: 7, rows: 7, cell: 140, gap: -28,
    color: PAL.sky, bg: PAL.ink2,
    rules: [R({ selectKind: 'checker', opacity: 0.6 })],
    animAxis: 'radial', animWaves: 2, pulse: 0.35, fade: 0.3, animCurveExpr: '1-(1-k)*(1-k)' } },
  { id: 'foam', label: 'Foam', params: {
    shape: 'prim:circle', cols: 18, rows: 18, cell: 70, gap: -22,
    color: PAL.bone, bg: PAL.teal,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*3.1 + row*1.7)', opacity: 0.5 })],
    animAxis: 'radial', animWaves: 4, pulse: 0.2, fade: 0.35 } },
  { id: 'pebbles', label: 'Pebbles', params: {
    shape: 'prim:circle', cols: 9, rows: 9, cell: 120, gap: -10,
    colorRule: 'checker', color: PAL.camel, color2: PAL.tan, bg: PAL.char,
    rules: [R({ selectKind: 'expression', expression: 'cos(col*2.3 + row*4.1)', opacity: 0.7 })],
    animAxis: 'diag', animWaves: 2, fade: 0.25 } },

  // ── halftone & screen ──
  { id: 'halftone', label: 'Halftone', params: {
    shape: 'prim:circle', cols: 22, rows: 22, cell: 52, gap: 6,
    color: PAL.ink, bg: PAL.bone,
    animAxis: 'radial', animWaves: 3, pulse: 0.4, animCurveExpr: 'pow(sin(PI*k),2)' } },
  { id: 'dot-screen', label: 'Dot screen', params: {
    shape: 'prim:circle', cols: 20, rows: 20, cell: 54, gap: 8,
    color: PAL.coral, bg: PAL.noir,
    animAxis: 'radial', animCycles: 1, animWaves: 4, pulse: 0.35, fade: 0.3 } },
  { id: 'dappled', label: 'Dappled', params: {
    shape: 'prim:circle', cols: 10, rows: 10, cell: 100, gap: 8,
    colorRule: 'diag', color: PAL.green, color2: PAL.moss, color3: PAL.olive, bg: PAL.forest,
    animAxis: 'diag', animWaves: 2, colorMix: 0.3, fade: 0.2 } },

  // ── scatter & confetti ──
  { id: 'scatter', label: 'Scatter', params: {
    shape: 'prim:circle', cols: 16, rows: 16, cell: 80, gap: 8,
    color: PAL.gold, bg: PAL.ink,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*12.9 + row*7.3) - 0.2', hide: true })],
    animAxis: 'radial', animWaves: 3, fade: 0.35, animCurveExpr: 'round(k)' } },
  { id: 'confetti', label: 'Confetti', params: {
    shape: 'prim:star', cols: 12, rows: 12, cell: 90, gap: 10,
    colorRule: 'diag', color: PAL.coral, color2: PAL.amber, color3: PAL.sky, bg: PAL.noir,
    rules: [R({ selectKind: 'expression', expression: 'cos(col*9.7 + row*4.3) - 0.1', hide: true })],
    animAxis: 'diag', animWaves: 3, swing: 30, colorMix: 0.3 } },
  { id: 'spores', label: 'Spores', params: {
    shape: 'prim:circle', cols: 20, rows: 20, cell: 56, gap: 12,
    color: PAL.purple, bg: PAL.plum,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*8.3 + row*11.1) - 0.3', hide: true })],
    animAxis: 'radial', animWaves: 4, pulse: 0.3, fade: 0.4 } },
  { id: 'sparkle', label: 'Sparkle', params: {
    shape: 'prim:star', cols: 18, rows: 18, cell: 64, gap: 12,
    color: PAL.amber, bg: PAL.ink2,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*6.1 + row*9.7) - 0.4', hide: true })],
    animAxis: 'radial', animWaves: 4, pulse: 0.4, swing: 25, animCurveExpr: 'pow(sin(PI*k),2)' } },

  // ── honeycomb & cells ──
  { id: 'honeycomb', label: 'Honeycomb', params: {
    shape: 'prim:hexagon', cols: 8, rows: 8, cell: 120, gap: 6,
    color: PAL.gold, bg: PAL.ochre,
    animAxis: 'radial', animWaves: 2, fade: 0.2 } },
  { id: 'cells', label: 'Cells', params: {
    shape: 'prim:hexagon', cols: 6, rows: 6, cell: 140, gap: 4,
    colorRule: 'checker', color: PAL.teal, color2: PAL.green, bg: PAL.ink,
    animAxis: 'radial', animWaves: 2, fade: 0.4, colorMix: 0.25 } },

  // ── petals, blossom, coral (abstract blobs) ──
  { id: 'petals', label: 'Petals', params: {
    shape: 'abstract:abstract-01', cols: 6, rows: 6, cell: 150, gap: 8,
    colorRule: 'checker', color: PAL.pink, color2: PAL.rose, bg: PAL.plum,
    spin: 1, animAxis: 'diag', animWaves: 2, swing: 35, fade: 0.25 } },
  { id: 'blossom', label: 'Blossom', params: {
    shape: 'abstract:abstract-06', cols: 5, rows: 5, cell: 170, gap: 10,
    colorRule: 'checker', color: PAL.coral, color2: PAL.amber, bg: PAL.brick,
    animAxis: 'radial', animWaves: 2, pulse: 0.4, swing: 30, fade: 0.3 } },
  { id: 'coral', label: 'Coral', params: {
    shape: 'abstract:abstract-03', cols: 7, rows: 7, cell: 130, gap: -8,
    colorRule: 'diag', color: PAL.rose, color2: PAL.red, color3: PAL.coral, bg: PAL.noir,
    spin: 1, animAxis: 'radial', animWaves: 3, swing: 20, colorMix: 0.3 } },
  { id: 'lily-pads', label: 'Lily pads', params: {
    shape: 'abstract:abstract-02', cols: 4, rows: 4, cell: 200, gap: 12,
    colorRule: 'checker', color: PAL.green, color2: PAL.forest, bg: PAL.ink2,
    spin: 1, animAxis: 'radial', animWaves: 2, pulse: 0.3, fade: 0.35 } },
]
