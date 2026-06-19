import { R, PAL } from './_helpers.js'

// BLOCKS — rectangular tilings. This category owns the SCALE axis: deliberately
// span big-and-few (cols 2–4, big cells) ↔ small-and-many (cols 18–28, fine).
// Core moves:
//   · solid block   = `prim:square` + stretch (fills the cell, ignores aspect)
//   · 2/3-tone       = colorRule checker / cols·rows·diag (always set its colours)
//   · super-cells    = groupW/groupH rules (Mondrian / Bauhaus look)
//   · grout / mortar = positive gap → bg shows between blocks
//   · negative space = hide a SUBSET (checker / every-nth / expression), never all
//   · diamond block  = rotate 45 (or prim:diamond) + stretch
// Sweeps stay subtle so the static read stays crisp (page loads paused).

export default [
  // ── big-and-few ──
  { id: 'mega-quad', label: 'Mega quad', params: {
    shape: 'prim:square', cols: 2, rows: 2, cell: 240, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.red, color2: PAL.amber, color3: PAL.navy, bg: PAL.ink,
    animAxis: 'diag', animWaves: 1, fade: 0.2 } },
  { id: 'bauhaus', label: 'Bauhaus', params: {
    shape: 'prim:square', cols: 3, rows: 3, cell: 200, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.red, color2: PAL.gold, color3: PAL.blue, bg: PAL.ink,
    rules: [R({ selectKind: 'every-nth', n: 5, offset: 2, hide: true })],
    animAxis: 'diag', animWaves: 1.5, colorMix: 0.15 } },
  { id: 'windowpane-block', label: 'Windowpane block', params: {
    shape: 'prim:square', cols: 3, rows: 3, cell: 210, gap: 6, stretch: true, showGrid: true,
    colorRule: 'checker', color: PAL.teal, color2: PAL.cream, bg: PAL.ink,
    animAxis: 'diag', animWaves: 1, fade: 0.2 } },
  { id: 'half-and-half', label: 'Half and half', params: {
    shape: 'prim:square', cols: 2, rows: 2, cell: 230, gap: 0, stretch: true,
    colorRule: 'checker', color: PAL.char, color2: PAL.coral, bg: PAL.ink,
    animAxis: 'diag', animWaves: 1, swing: 0, fade: 0.25 } },
  { id: 'mondrian', label: 'Mondrian', params: {
    shape: 'prim:square', cols: 6, rows: 6, cell: 95, gap: 6, stretch: true,
    colorRule: 'cols', color: PAL.bone, color2: PAL.red, color3: PAL.blue, bg: PAL.ink,
    rules: [
      R({ selectKind: 'both', n: 3, n2: 3, groupW: 2, groupH: 2 }),
      R({ selectKind: 'both', n: 6, n2: 6, offset: 4, offset2: 2, groupW: 3, groupH: 2, opacity: 0.85 }),
      R({ selectKind: 'expression', expression: 'col===4 && row===1', hide: true }),
    ],
    animAxis: 'col', animWaves: 1, fade: 0.15 } },

  // ── small-and-many ──
  { id: 'pixel-check', label: 'Pixel check', params: {
    shape: 'prim:square', cols: 24, rows: 24, cell: 50, gap: 0, stretch: true,
    colorRule: 'checker', color: PAL.ink, color2: PAL.bone, bg: PAL.ink,
    animAxis: 'diag', animWaves: 6, fade: 0.2, animCurveExpr: 'round(k)' } },
  { id: 'brutgrid', label: 'Brutgrid', params: {
    shape: 'prim:square', cols: 22, rows: 22, cell: 52, gap: 3, stretch: true,
    colorRule: 'none', color: PAL.cream, bg: PAL.noir,
    rules: [R({ selectKind: 'checker', groupW: 2, groupH: 2, hide: true })],
    animAxis: 'diag', animWaves: 5, fade: 0.25 } },
  { id: 'confetti-grid', label: 'Confetti grid', params: {
    shape: 'prim:square', cols: 20, rows: 20, cell: 56, gap: 4, stretch: true,
    colorRule: 'diag', color: PAL.coral, color2: PAL.sky, color3: PAL.amber, bg: PAL.ink,
    animAxis: 'diag', animWaves: 4, colorMix: 0.18 } },
  { id: 'terrazzo', label: 'Terrazzo', params: {
    shape: 'prim:diamond', cols: 26, rows: 26, cell: 46, gap: 6, stretch: true,
    colorRule: 'rows', color: PAL.oat, color2: PAL.teal, color3: PAL.rust, bg: PAL.char,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*1.3 + row*0.7)', opacity: 0.5 })],
    animAxis: 'radial', animWaves: 4, fade: 0.3 } },
  { id: 'static-field', label: 'Static field', params: {
    shape: 'prim:square', cols: 28, rows: 28, cell: 45, gap: 0, stretch: true,
    colorRule: 'checker', color: PAL.slate, color2: PAL.bone, bg: PAL.ink,
    rules: [R({ selectKind: 'expression', expression: 'cos(col*2.1) + sin(row*1.9)', hide: true })],
    animAxis: 'diag', animWaves: 8, fade: 0.35, animCurveExpr: 'round(k)' } },

  // ── grout / mortar / courses ──
  { id: 'mortar', label: 'Mortar', params: {
    shape: 'prim:square', cols: 8, rows: 8, cell: 110, gap: 12, stretch: true,
    colorRule: 'none', color: PAL.rust, bg: PAL.cream,
    animAxis: 'diag', animWaves: 2, fade: 0.2 } },
  { id: 'brick-courses', label: 'Brick courses', params: {
    shape: 'prim:square', cols: 10, rows: 12, cell: 100, gap: 5, stretch: true,
    colorRule: 'rows', color: PAL.brick, color2: PAL.rust, color3: PAL.coral, bg: PAL.char,
    rules: [R({ selectKind: 'every-row', n: 2, offset: 1, opacity: 0.82 })],
    animAxis: 'row', animWaves: 3, fade: 0.2 } },
  { id: 'tiles', label: 'Tiles', params: {
    shape: 'prim:square', cols: 9, rows: 9, cell: 100, gap: 8, stretch: true,
    colorRule: 'checker', color: PAL.navy, color2: PAL.sky, bg: PAL.ink,
    animAxis: 'diag', animWaves: 3, fade: 0.2 } },
  { id: 'quilt', label: 'Quilt', params: {
    shape: 'prim:square', cols: 7, rows: 7, cell: 110, gap: 7, stretch: true,
    colorRule: 'diag', color: PAL.forest, color2: PAL.gold, color3: PAL.coral, bg: PAL.ink,
    animAxis: 'diag', animWaves: 3, colorMix: 0.18 } },

  // ── checker / diamond / super-cell ──
  { id: 'checkerboard', label: 'Checkerboard', params: {
    shape: 'prim:square', cols: 8, rows: 8, cell: 105, gap: 0, stretch: true,
    colorRule: 'checker', color: PAL.ink, color2: PAL.bone, bg: PAL.ink,
    animAxis: 'diag', animWaves: 4, fade: 0.18 } },
  { id: 'diamond-grid', label: 'Diamond grid', params: {
    shape: 'prim:diamond', cols: 6, rows: 6, cell: 120, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.purple, color2: PAL.amber, color3: PAL.teal, bg: PAL.noir,
    animAxis: 'diag', animWaves: 2, colorMix: 0.15 } },
  { id: 'argyle-block', label: 'Argyle block', params: {
    shape: 'prim:square', cols: 6, rows: 6, cell: 110, gap: 0, stretch: true,
    colorRule: 'checker', color: PAL.plum, color2: PAL.cream, bg: PAL.ink,
    rules: [R({ selectKind: 'checker', rotate: 45 })],
    animAxis: 'diag', animWaves: 2, swing: 0, fade: 0.2 } },
  { id: 'super-cells', label: 'Super cells', params: {
    shape: 'prim:square', cols: 8, rows: 8, cell: 90, gap: 5, stretch: true,
    colorRule: 'checker', color: PAL.ochre, color2: PAL.slate, bg: PAL.ink,
    rules: [
      R({ selectKind: 'checker', groupW: 2, groupH: 2, opacity: 0.8 }),
      R({ selectKind: 'every-nth', n: 7, offset: 3, groupW: 2, groupH: 2, hide: true }),
    ],
    animAxis: 'col', animWaves: 2, fade: 0.2 } },

  // ── stacked / cascade ──
  { id: 'stacked', label: 'Stacked', params: {
    shape: 'prim:square', cols: 4, rows: 14, cell: 60, gap: 4, stretch: true,
    colorRule: 'cols', color: PAL.teal, color2: PAL.coral, color3: PAL.amber, bg: PAL.ink,
    animAxis: 'row', animWaves: 4, fade: 0.25 } },
  { id: 'cascade', label: 'Cascade', params: {
    shape: 'prim:square', cols: 10, rows: 6, cell: 100, gap: 4, stretch: true,
    colorRule: 'none', color: PAL.sky, bg: PAL.noir,
    rules: [
      R({ selectKind: 'every-col', n: 10, offset: 8, opacity: 0.35 }),
      R({ selectKind: 'every-col', n: 10, offset: 6, opacity: 0.55 }),
      R({ selectKind: 'every-col', n: 10, offset: 4, opacity: 0.75 }),
    ],
    animAxis: 'col', animWaves: 2, fade: 0.2, animCurveExpr: 'k*k' } },
]
