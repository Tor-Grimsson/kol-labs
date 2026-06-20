// Scanlines — ONE cumulative-sum engine (engine.js), two MODES:
//   · generator — source off; a procedural FIELD (noise/waves/radial) drives the
//                 scanline density. Pure params + time. Lives in Generative.
//   · filter    — source on; image/video/webcam LUMA drives the density. Lives in
//                 Effects (the source-in family, beside the halftone filters).
//
// Geometry (rows/columns/radial/rings/spiral) and Mark (dots/dash/lattice/glyph)
// are CONTROLS, not categories. The lists below are curated default combos picked
// in the rail's Preset dropdown and applied IN-PLACE — no per-preset routes.

export const GENERATOR_PRESETS = [
  { id: 'spaced',   label: 'Spaced',   defaults: { geometry: 'rows', mark: 'dots', field: 'noise', rows: 96, minGap: 5, maxGap: 26, contrast: 1.1 } },
  { id: 'undulate', label: 'Undulate', defaults: { geometry: 'rows', mark: 'dash', field: 'noise', rows: 84, minGap: 4, maxGap: 22, dashLen: 1.2 } },
  { id: 'glyph',    label: 'Glyph',    defaults: { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 56, minGap: 9, maxGap: 26, charset: 'ascii' } },
  { id: 'lattice',  label: 'Lattice',  defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 64, minGap: 7, maxGap: 18 } },
  { id: 'terrain',  label: 'Terrain',  defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 60, minGap: 7, maxGap: 16, displace: 0.7 } },
  { id: 'weave',    label: 'Weave',    defaults: { geometry: 'rows', mark: 'dash', field: 'noise', rows: 70, minGap: 5, maxGap: 18, weave: true, dashLen: 0.8 } },
  { id: 'rays',     label: 'Rays',     defaults: { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 220, minGap: 4, maxGap: 22 } },
  { id: 'rings',    label: 'Rings',    defaults: { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 60, minGap: 4, maxGap: 20, dashLen: 1 } },
  { id: 'spiral',   label: 'Spiral',   defaults: { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 8, arms: 1, minGap: 4, maxGap: 20 } },
  { id: 'lens',     label: 'Lens',     defaults: { geometry: 'rows', mark: 'dots', field: 'radial', rows: 96, minGap: 4, maxGap: 28, lens: 1.6 } },
  { id: 'vortex',   label: 'Vortex',   defaults: { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 240, minGap: 4, maxGap: 20, swirl: 0.8 } },
]

export const FILTER_PRESETS = [
  { id: 'photo',  label: 'Photo',  defaults: { geometry: 'rows', mark: 'dots', source: 'image', rows: 120, minGap: 3, maxGap: 22, contrast: 1.2, displace: 0 } },
  { id: 'lines',  label: 'Lines',  defaults: { geometry: 'rows', mark: 'dash', source: 'image', rows: 110, minGap: 3, maxGap: 20, dashLen: 1 } },
  { id: 'mesh',   label: 'Mesh',   defaults: { geometry: 'rows', mark: 'lattice', source: 'image', rows: 80, minGap: 5, maxGap: 16, displace: 0.45 } },
  { id: 'ascii',  label: 'ASCII',  defaults: { geometry: 'rows', mark: 'glyph', source: 'image', rows: 64, minGap: 7, maxGap: 18, charset: 'ascii', contrast: 1.3 } },
  { id: 'mirror', label: 'Mirror', defaults: { geometry: 'rows', mark: 'dots', source: 'webcam', rows: 120, minGap: 3, maxGap: 22, contrast: 1.2 } },
]

export const presetsFor = (mode) => (mode === 'filter' ? FILTER_PRESETS : GENERATOR_PRESETS)
