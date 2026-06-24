// Scanlines — ONE cumulative-sum engine (engine.js), two MODES:
//   · generator — source off; a procedural FIELD drives the scanline density.
//   · filter    — source on; image/video/webcam LUMA drives it (Effects).
//
// Generator is organised Page › Category › Preset (mirrors Pattern): each CATEGORY
// is a geometry/mark family (Spaced…Spiral); its PRESETS are curated variations
// picked in the rail's Preset dropdown. Geometry/Mark/Field stay live CONTROLS, so
// a preset is just a starting point. Categories list in the sidebar; the first
// category owns the /scanlines index, the rest route to /scanlines/<cat>.

export const SCANLINE_CATEGORIES = [
  { id: 'spaced', label: 'Spaced' },
  { id: 'glyph', label: 'Glyph' },
  { id: 'lattice', label: 'Lattice' },
  { id: 'vortex', label: 'Vortex' },
  { id: 'rings', label: 'Rings' },
  { id: 'spiral', label: 'Spiral' },
]

// Per-category presets. Each `defaults` is a full patch over the engine FALLBACK.
export const SCANLINE_PRESETS = {
  spaced: [
    { id: 'drift',  label: 'Drift',  defaults: { geometry: 'rows', mark: 'dots', field: 'noise', rows: 96, minGap: 5, maxGap: 26, contrast: 1.1 } },
    { id: 'fine',   label: 'Fine',   defaults: { geometry: 'rows', mark: 'dots', field: 'noise', rows: 132, minGap: 3, maxGap: 18, contrast: 1.2 } },
    { id: 'coarse', label: 'Coarse', defaults: { geometry: 'rows', mark: 'dots', field: 'noise', rows: 54, minGap: 8, maxGap: 34, markSize: 1.3 } },
    { id: 'waves',  label: 'Waves',  defaults: { geometry: 'rows', mark: 'dots', field: 'waves', rows: 90, minGap: 4, maxGap: 24, freq: 1.4 } },
    { id: 'columns', label: 'Columns', defaults: { geometry: 'columns', mark: 'dots', field: 'noise', rows: 96, minGap: 5, maxGap: 26 } },
  ],
  glyph: [
    { id: 'ascii',  label: 'ASCII',  defaults: { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 56, minGap: 9, maxGap: 26, charset: 'ascii' } },
    { id: 'blocks', label: 'Blocks', defaults: { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 64, minGap: 7, maxGap: 22, charset: 'blocks' } },
    { id: 'binary', label: 'Binary', defaults: { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 60, minGap: 8, maxGap: 24, charset: 'binary' } },
    { id: 'dotset', label: 'Dots',   defaults: { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 56, minGap: 9, maxGap: 26, charset: 'dots' } },
    { id: 'dense',  label: 'Dense',  defaults: { geometry: 'rows', mark: 'glyph', field: 'waves', rows: 84, minGap: 5, maxGap: 18, charset: 'ascii', fontScale: 0.8 } },
  ],
  lattice: [
    { id: 'mesh',    label: 'Mesh',    defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 64, minGap: 7, maxGap: 18 } },
    { id: 'weave',   label: 'Weave',   defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 70, minGap: 5, maxGap: 18, weave: true } },
    { id: 'terrain', label: 'Terrain', defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 60, minGap: 7, maxGap: 16, displace: 0.7 } },
    { id: 'fine',    label: 'Fine',    defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 100, minGap: 5, maxGap: 14, markSize: 0.7 } },
    { id: 'bold',    label: 'Bold',    defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 48, minGap: 8, maxGap: 22, markSize: 1.6 } },
  ],
  vortex: [
    { id: 'swirl',    label: 'Swirl',    defaults: { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 220, minGap: 4, maxGap: 22, swirl: 0.8 } },
    { id: 'straight', label: 'Straight', defaults: { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 220, minGap: 4, maxGap: 22, swirl: 0 } },
    { id: 'dense',    label: 'Dense',    defaults: { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 360, minGap: 3, maxGap: 18, swirl: 0.5 } },
    { id: 'wide',     label: 'Wide',     defaults: { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 150, minGap: 5, maxGap: 26, swirl: 1, markSize: 1.3 } },
    { id: 'dash',     label: 'Dash',     defaults: { geometry: 'radial', mark: 'dash', field: 'noise', rayCount: 200, minGap: 4, maxGap: 22, swirl: 0.6, dashLen: 1 } },
  ],
  rings: [
    { id: 'concentric', label: 'Concentric', defaults: { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 60, minGap: 4, maxGap: 20, dashLen: 1 } },
    { id: 'fine',       label: 'Fine',       defaults: { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 100, minGap: 3, maxGap: 16, dashLen: 0.8 } },
    { id: 'bold',       label: 'Bold',       defaults: { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 36, minGap: 5, maxGap: 24, dashLen: 1.4, markSize: 1.4 } },
    { id: 'dotted',     label: 'Dotted',     defaults: { geometry: 'rings', mark: 'dots', field: 'noise', ringCount: 60, minGap: 4, maxGap: 20 } },
    { id: 'swirl',      label: 'Swirl',      defaults: { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 60, minGap: 4, maxGap: 20, swirl: 0.5, dashLen: 1 } },
  ],
  spiral: [
    { id: 'single', label: 'Single', defaults: { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 8, arms: 1, minGap: 4, maxGap: 20 } },
    { id: 'double', label: 'Double', defaults: { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 6, arms: 2, minGap: 4, maxGap: 20 } },
    { id: 'triple', label: 'Triple', defaults: { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 5, arms: 3, minGap: 4, maxGap: 18 } },
    { id: 'tight',  label: 'Tight',  defaults: { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 14, arms: 1, minGap: 3, maxGap: 14 } },
    { id: 'galaxy', label: 'Galaxy', defaults: { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 6, arms: 4, minGap: 4, maxGap: 22, markSize: 1.2 } },
  ],
}

// First category owns /scanlines; the rest are /scanlines/<cat>.
export const catRoute = (id) => (id === SCANLINE_CATEGORIES[0].id ? '/scanlines' : `/scanlines/${id}`)
export const categoryById = (id) => SCANLINE_CATEGORIES.find((c) => c.id === id) || SCANLINE_CATEGORIES[0]
export const presetsForCat = (id) => SCANLINE_PRESETS[id] || SCANLINE_PRESETS[SCANLINE_CATEGORIES[0].id]

export const FILTER_PRESETS = [
  { id: 'photo',  label: 'Photo',  defaults: { geometry: 'rows', mark: 'dots', source: 'image', rows: 120, minGap: 3, maxGap: 22, contrast: 1.2, displace: 0 } },
  { id: 'lines',  label: 'Lines',  defaults: { geometry: 'rows', mark: 'dash', source: 'image', rows: 110, minGap: 3, maxGap: 20, dashLen: 1 } },
  { id: 'mesh',   label: 'Mesh',   defaults: { geometry: 'rows', mark: 'lattice', source: 'image', rows: 80, minGap: 5, maxGap: 16, displace: 0.45 } },
  { id: 'ascii',  label: 'ASCII',  defaults: { geometry: 'rows', mark: 'glyph', source: 'image', rows: 64, minGap: 7, maxGap: 18, charset: 'ascii', contrast: 1.3 } },
  { id: 'mirror', label: 'Mirror', defaults: { geometry: 'rows', mark: 'dots', source: 'webcam', rows: 120, minGap: 3, maxGap: 22, contrast: 1.2 } },
]
