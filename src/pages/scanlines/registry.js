// Scanlines catalog — single source of truth for the category's sub-pages.
// /scanlines is a router shell with one routed sub-page per entry; nav + routes
// both derive from this list so they can't drift (mirrors the loops registry).
//
// THREE categories, each a family of the one shared engine (engine.js):
//   · Lines  — horizontal/vertical scan-paths (the canonical look)
//   · Radial — polar geometries (rays · rings · spiral · lens · vortex)
//   · Source — presets tuned to start from an image/video/webcam
//
// Every sub-page exposes the FULL control set (geometry · mark · field · source
// · spacing · displace · colour); an entry just seeds different defaults. Source
// (image/video/webcam) is available on every page — `defaults.source` only sets
// where it starts.

export const CATEGORIES = [
  { id: 'lines', label: 'Lines', route: '/scanlines' },
  { id: 'radial', label: 'Radial', route: '/scanlines/radial' },
  { id: 'source', label: 'Source', route: '/scanlines/source' },
]
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]

// `path` is relative to /scanlines ('' = the Lines index = the category root).
// `route` is the absolute sidebar link. First entry of each category owns the
// category route.
export const SUBPAGES = {
  lines: [
    { id: 'spaced', label: 'Spaced', path: '', route: '/scanlines',
      defaults: { geometry: 'rows', mark: 'dots', field: 'noise', source: 'none', rows: 96, minGap: 5, maxGap: 26, contrast: 1.1 } },
    { id: 'undulate', label: 'Undulate', path: 'undulate', route: '/scanlines/undulate',
      defaults: { geometry: 'rows', mark: 'dash', field: 'noise', source: 'none', rows: 84, minGap: 4, maxGap: 22, dashLen: 1.2 } },
    { id: 'glyph', label: 'Glyph', path: 'glyph', route: '/scanlines/glyph',
      defaults: { geometry: 'rows', mark: 'glyph', field: 'noise', source: 'none', rows: 56, minGap: 9, maxGap: 26, charset: 'ascii' } },
    { id: 'lattice', label: 'Lattice', path: 'lattice', route: '/scanlines/lattice',
      defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', source: 'none', rows: 64, minGap: 7, maxGap: 18 } },
    { id: 'terrain', label: 'Terrain', path: 'terrain', route: '/scanlines/terrain',
      defaults: { geometry: 'rows', mark: 'lattice', field: 'noise', source: 'none', rows: 60, minGap: 7, maxGap: 16, displace: 0.7 } },
    { id: 'weave', label: 'Weave', path: 'weave', route: '/scanlines/weave',
      defaults: { geometry: 'rows', mark: 'dash', field: 'noise', source: 'none', rows: 70, minGap: 5, maxGap: 18, weave: true, dashLen: 0.8 } },
  ],
  radial: [
    { id: 'rays', label: 'Rays', path: 'radial', route: '/scanlines/radial',
      defaults: { geometry: 'radial', mark: 'dots', field: 'noise', source: 'none', rayCount: 220, minGap: 4, maxGap: 22 } },
    { id: 'rings', label: 'Rings', path: 'radial/rings', route: '/scanlines/radial/rings',
      defaults: { geometry: 'rings', mark: 'dash', field: 'noise', source: 'none', ringCount: 60, minGap: 4, maxGap: 20, dashLen: 1 } },
    { id: 'spiral', label: 'Spiral', path: 'radial/spiral', route: '/scanlines/radial/spiral',
      defaults: { geometry: 'spiral', mark: 'dots', field: 'noise', source: 'none', turns: 8, arms: 1, minGap: 4, maxGap: 20 } },
    { id: 'lens', label: 'Lens', path: 'radial/lens', route: '/scanlines/radial/lens',
      defaults: { geometry: 'rows', mark: 'dots', field: 'radial', source: 'none', rows: 96, minGap: 4, maxGap: 28, lens: 1.6 } },
    { id: 'vortex', label: 'Vortex', path: 'radial/vortex', route: '/scanlines/radial/vortex',
      defaults: { geometry: 'radial', mark: 'dots', field: 'noise', source: 'none', rayCount: 240, minGap: 4, maxGap: 20, swirl: 0.8 } },
  ],
  source: [
    { id: 'photo', label: 'Photo', path: 'source', route: '/scanlines/source',
      defaults: { geometry: 'rows', mark: 'dots', source: 'image', rows: 120, minGap: 3, maxGap: 22, contrast: 1.2, displace: 0 } },
    { id: 'src-lines', label: 'Lines', path: 'source/lines', route: '/scanlines/source/lines',
      defaults: { geometry: 'rows', mark: 'dash', source: 'image', rows: 110, minGap: 3, maxGap: 20, dashLen: 1 } },
    { id: 'src-mesh', label: 'Mesh', path: 'source/mesh', route: '/scanlines/source/mesh',
      defaults: { geometry: 'rows', mark: 'lattice', source: 'image', rows: 80, minGap: 5, maxGap: 16, displace: 0.45 } },
    { id: 'src-ascii', label: 'ASCII', path: 'source/ascii', route: '/scanlines/source/ascii',
      defaults: { geometry: 'rows', mark: 'glyph', source: 'image', rows: 64, minGap: 7, maxGap: 18, charset: 'ascii', contrast: 1.3 } },
    { id: 'mirror', label: 'Mirror', path: 'source/mirror', route: '/scanlines/source/mirror',
      defaults: { geometry: 'rows', mark: 'dots', source: 'webcam', rows: 120, minGap: 3, maxGap: 22, contrast: 1.2 } },
  ],
}

export const ALL_SUBPAGES = [...SUBPAGES.lines, ...SUBPAGES.radial, ...SUBPAGES.source]
export const subpageById = (id) => ALL_SUBPAGES.find((s) => s.id === id) || ALL_SUBPAGES[0]
