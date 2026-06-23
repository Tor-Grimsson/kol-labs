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
    animAxis: 'diag', animWaves: 6, fade: 0.2 } },
  { id: 'terrazzo', label: 'Terrazzo', params: {
    shape: 'prim:diamond', cols: 26, rows: 26, cell: 46, gap: 6, stretch: true,
    colorRule: 'rows', color: PAL.oat, color2: PAL.teal, color3: PAL.rust, bg: PAL.char,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*1.3 + row*0.7)', opacity: 0.5 })],
    animAxis: 'radial', animWaves: 4, fade: 0.3 } },

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

  // ── checker / diamond / super-cell ──
  { id: 'diamond-grid', label: 'Diamond grid', params: {
    shape: 'prim:diamond', cols: 6, rows: 6, cell: 120, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.purple, color2: PAL.amber, color3: PAL.teal, bg: PAL.noir,
    animAxis: 'diag', animWaves: 2, colorMix: 0.15 } },
  { id: 'super-cells', label: 'Super cells', params: {
    shape: 'prim:square', cols: 8, rows: 8, cell: 90, gap: 5, stretch: true,
    colorRule: 'checker', color: PAL.ochre, color2: PAL.slate, bg: PAL.ink,
    rules: [
      R({ selectKind: 'checker', groupW: 2, groupH: 2, opacity: 0.8 }),
      R({ selectKind: 'every-nth', n: 7, offset: 3, groupW: 2, groupH: 2, hide: true }),
    ],
    animAxis: 'col', animWaves: 2, fade: 0.2 } },

  // ── cascade ──
  { id: 'cascade', label: 'Cascade', params: {
    shape: 'prim:square', cols: 10, rows: 6, cell: 100, gap: 4, stretch: true,
    colorRule: 'none', color: PAL.sky, bg: PAL.noir,
    rules: [
      R({ selectKind: 'every-col', n: 10, offset: 8, opacity: 0.35 }),
      R({ selectKind: 'every-col', n: 10, offset: 6, opacity: 0.55 }),
      R({ selectKind: 'every-col', n: 10, offset: 4, opacity: 0.75 }),
    ],
    animAxis: 'col', animWaves: 2, fade: 0.2 } },
]
