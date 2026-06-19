// Shared authoring helpers for the /pattern category files. Each category exports
// an array of subpage entries { id, label, params }, where `params` is a full
// patch over the patternLoop engine defaults (src/loops/pattern/patternLoop.js).
// registry.js stitches in the cat/path/route. Keep entries terse — lean on R()
// for rules and PAL for a coherent colour vocabulary.
//
// Param vocabulary (everything optional; unspecified falls back to the engine
// default):
//   shape      'prim:circle|square|triangle|diamond|hexagon|plus|bar|star'
//              | 'abstract:abstract-01|-02|-03|-06' | 'glyph' | 'custom'
//   cols rows  1–32 repeating block
//   cell       40–280 cell size (px)   gap   -40–80 (negative = overlap)
//   stretch    true → fill the cell ignoring shape aspect (square block)
//   showGrid   true → thin lattice overlay at the gaps (extra "threads")
//   bg color color2 color3   hex
//   colorRule  'none|checker|cols|rows|diag' — interleave the base fill:
//              checker = 2-colour (color / color2); cols|rows|diag = 3-colour
//              round-robin (color / color2 / color3) by col / row / col+row
//   rules      [R(...)] selectors composed in order over GROUP coords
//   camZoom 0.3–3   camFlow 0–4 (int, whole blocks/loop → seamless)
//   camAngle 0–360  spin 0–3 (int, whole turns/loop → seamless)
//   animAxis  'none|diag|col|row|radial'  the per-cell sweep axis
//   animCycles 1–4 (int)  animWaves 0–8  — set a gentle sweep so the gallery is
//   pulse 0–1 (size)  fade 0–1 (opacity)  swing 0–180° (rotation)  colorMix 0–1
//   → page loads PAUSED; the sweep only animates once the user hits play.

let rid = 0
// A rule = a selector + per-cell transform. Defaults match the engine's newRule
// shape; override only what the pattern needs.
export const R = (o = {}) => ({
  id: `pr${++rid}`,
  selectKind: 'all', n: 2, offset: 0, n2: 2, offset2: 0,
  expression: 'sin(col * 0.6) + cos(row * 0.6)',
  groupW: 1, groupH: 1, rotate: 0, flipH: false, flipV: false, hide: false, opacity: 1,
  ...o,
})

// Coherent colour vocabulary — warm earths, brights and inks. Categories may use
// these names or raw hex; this just keeps the 100 from drifting into mud.
export const PAL = {
  ink: '#0e0e11', char: '#1a1a1f', noir: '#06060a',
  paper: '#f3ede1', cream: '#e8e4dc', bone: '#fcfbf8', oat: '#d8cfbe',
  red: '#c2502e', rust: '#a83e22', brick: '#8c3a26', coral: '#e0664a',
  amber: '#f6c453', gold: '#e0a32e', ochre: '#c98a2b',
  teal: '#2a8f8f', sky: '#7fd1ff', blue: '#3a6ea5', navy: '#1b2a6b', ink2: '#13204a',
  purple: '#8f5ad0', plum: '#5b2a6b', violet: '#6d4aa8',
  green: '#3f7d4f', forest: '#27543a', olive: '#7d7d3f', moss: '#5c6b3a',
  pink: '#e08aa8', rose: '#c25b7a', grey: '#6b6b6b', slate: '#4a4f5a',
  // tartan grounds
  beige: '#d6c4a0', tan: '#c9b487', camel: '#b89b6a',
}
