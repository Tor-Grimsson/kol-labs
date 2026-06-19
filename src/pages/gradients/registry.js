// Gradient explorations — 3 categories × 4 sub-pages, all driven by one shader
// (engine.js) parameterized by (cat, type). The route picks the type; the page
// seeds the editor from that type's defaults. Nav + router derive from here so
// they never drift (mirrors Loops / Scanlines).

export const GRADIENT_CATEGORIES = [
  { id: 'field', label: 'Field' },   // flat 2D colour gradients
  { id: 'pole', label: 'Pole' },     // point-source / influence fields
  { id: 'volume', label: 'Volume' }, // glossy 3D-reading forms
]

const CAT_IDX = { field: 0, pole: 1, volume: 2 }
export const catIndex = (cat) => CAT_IDX[cat] ?? 0

// `type` = the sub-index inside the category's shader branch.
// `controls` = which form sliders the editor exposes for this type.
export const GRADIENT_TYPES = [
  // ── Field ──
  { id: 'linear', cat: 'field', label: 'Linear', type: 0, controls: ['angle'],
    defaults: { irid: 1, hue: 0, spectral: false, palette: 'spectrum', warp: 0 } },
  { id: 'stripe', cat: 'field', label: 'Stripe', type: 1, controls: ['angle', 'freq', 'spin'],
    defaults: { irid: 1, hue: 0, spectral: false, palette: 'iris', warp: 0.05, freq: 4, spin: 0 } },
  { id: 'radial', cat: 'field', label: 'Radial', type: 2, controls: ['freq'],
    defaults: { irid: 1, hue: 0, spectral: false, palette: 'aqua', warp: 0, freq: 1.4 } },
  { id: 'conic', cat: 'field', label: 'Conic', type: 3, controls: ['angle', 'spin'],
    defaults: { irid: 1, hue: 0, spectral: true, palette: 'spectrum', warp: 0, spin: 0.3 } },

  // ── Pole ──
  { id: 'monopole', cat: 'pole', label: 'Monopole', type: 0, controls: ['spread', 'freq'],
    defaults: { irid: 1.1, hue: 0.1, spectral: false, palette: 'magma', spread: 0.2, freq: 1.2, sheen: 0.7 } },
  { id: 'multipole', cat: 'pole', label: 'Multipole', type: 1, controls: ['count', 'spread'],
    defaults: { irid: 1, hue: 0, spectral: false, palette: 'spectrum', count: 5, spread: 0.42, sheen: 0.5 } },
  { id: 'mesh', cat: 'pole', label: 'Mesh', type: 2, controls: [],
    defaults: { spectral: false, palette: 'candy', warp: 0.18 } },
  { id: 'aurora', cat: 'pole', label: 'Aurora', type: 3, controls: [],
    defaults: { irid: 1, hue: 0.5, spectral: false, palette: 'aqua', warp: 0 } },

  // ── Volume ──
  { id: 'blobs', cat: 'volume', label: 'Blobs', type: 0, controls: ['count', 'size', 'spread', 'relief'],
    defaults: { count: 3, size: 0.62, spread: 0.42, irid: 1.15, hue: 0, spectral: true, palette: 'spectrum', sheen: 0.5, gloss: 24, relief: 0.9, warp: 0.25, backdrop: 'black' } },
  { id: 'spiral', cat: 'volume', label: 'Spiral', type: 1, controls: ['winds', 'pitch', 'petals', 'mouth', 'spin', 'relief'],
    defaults: { irid: 1, hue: 0.62, spectral: false, palette: 'iris', winds: 5, pitch: 2.4, petals: 9, spin: 1, mouth: 0.5, relief: 1, sheen: 0.5, gloss: 22, warp: 0.12, backdrop: 'plum' } },
  { id: 'dome', cat: 'volume', label: 'Dome', type: 2, controls: ['size', 'relief'],
    defaults: { size: 0.6, irid: 1.1, hue: 0.3, spectral: true, palette: 'spectrum', sheen: 0.6, gloss: 30, relief: 1, warp: 0.08, backdrop: 'black' } },
  { id: 'ripple', cat: 'volume', label: 'Ripple', type: 3, controls: ['freq', 'spin', 'relief'],
    defaults: { irid: 1, hue: 0.55, spectral: false, palette: 'aqua', freq: 3, spin: 1, relief: 1, sheen: 0.5, gloss: 20, warp: 0.05, backdrop: 'abyss' } },
]

export const TYPE_BY_ID = Object.fromEntries(GRADIENT_TYPES.map((t) => [t.id, t]))
export const DEFAULT_TYPE = 'blobs'

// Look presets — palette / iridescence variations applied on top of any type,
// so every sub-page has multiple looks in the dropdown.
export const LOOK_PRESETS = [
  { id: 'spectrum', label: 'Spectrum', p: { palette: 'spectrum', spectral: true, hue: 0, irid: 1.3 } },
  { id: 'iris', label: 'Iris', p: { palette: 'iris', spectral: false, hue: 0.1, irid: 1.1 } },
  { id: 'aqua', label: 'Aqua', p: { palette: 'aqua', spectral: false, hue: 0.5, irid: 1.0 } },
  { id: 'magma', label: 'Magma', p: { palette: 'magma', spectral: false, hue: 0.08, irid: 0.9 } },
  { id: 'candy', label: 'Candy', p: { palette: 'candy', spectral: false, hue: 0.8, irid: 1.2 } },
  { id: 'noir', label: 'Noir', p: { palette: 'spectrum', spectral: false, hue: 0, irid: 0.45, backdrop: 'black' } },
]

// Slider specs for the per-type form controls.
export const CTRL_SPEC = {
  angle: { label: 'Angle', min: 0, max: 6.2832, step: 0.01 },
  freq: { label: 'Frequency', min: 0.2, max: 8, step: 0.1 },
  count: { label: 'Points', min: 1, max: 5, step: 1 },
  size: { label: 'Size', min: 0.25, max: 1.2, step: 0.01 },
  spread: { label: 'Spread', min: 0, max: 0.8, step: 0.01 },
  winds: { label: 'Winds', min: 1, max: 12, step: 1 },
  pitch: { label: 'Pitch', min: 0.5, max: 6, step: 0.1 },
  petals: { label: 'Petals', min: 0, max: 24, step: 1 },
  mouth: { label: 'Mouth', min: 0.1, max: 1.2, step: 0.02 },
  spin: { label: 'Spin', min: -3, max: 3, step: 0.1 },
  relief: { label: 'Relief', min: 0.3, max: 1.6, step: 0.05 },
}

// Baseline param values; a type's `defaults` override these.
export const BASE_PARAMS = {
  angle: 0, freq: 2, count: 3, size: 0.62, spread: 0.42,
  winds: 5, pitch: 2.4, petals: 9, spin: 1, mouth: 0.5,
  relief: 0.9, warp: 0.2, irid: 1.15, hue: 0,
  spectral: true, palette: 'spectrum', sheen: 0.5, gloss: 24, grain: 0.03, backdrop: 'black',
}

// Param keys that animate (run through resolveDeep each frame).
export const NUMERIC_KEYS = ['angle', 'freq', 'count', 'size', 'spread', 'winds', 'pitch', 'petals', 'spin', 'mouth', 'relief', 'warp', 'irid', 'hue', 'sheen', 'gloss', 'grain']
