// Glass — preset + motion registry. PRESETS are curated full look-configs (the
// thumbnail grid); FRAME/FORM_PRESETS are the two motion axes. Look and motion
// are separate axes (Randomize all is look-only), mirroring the generator pages.

// Engine fallback — a render with these is the baseline (the hero Vertical Panes).
export const FALLBACK = {
  pattern: 'panes', xShift: 60, yShift: 0, scale: 1.5, angle: 0,
  chroma: 0, mix: 100, edge: 'clamp', mirror: false,
}

// Curated looks. params is a full patch over FALLBACK; selecting one loads it,
// editing any Style control flips the Preset selector to Custom.
export const PRESETS = [
  { id: 'panes', label: 'Vertical Panes', params: { pattern: 'panes', xShift: 60, yShift: 0, scale: 1.5, angle: 0, chroma: 0, mix: 100, edge: 'clamp', mirror: false } },
  { id: 'slivers', label: 'Tall Slivers', params: { pattern: 'panes', xShift: 22, yShift: 80, scale: 3, angle: 0, chroma: 0, mix: 100, edge: 'clamp', mirror: false } },
  { id: 'bands', label: 'Horizon Bands', params: { pattern: 'bands', xShift: 80, yShift: 24, scale: 1.2, angle: 0, chroma: 0, mix: 100, edge: 'clamp', mirror: false } },
  { id: 'frosted', label: 'Frosted', params: { pattern: 'glass', xShift: 40, yShift: 40, scale: 1.2, angle: 0, chroma: 0, mix: 100, edge: 'mirror', mirror: false } },
  { id: 'prismatic', label: 'Prismatic', params: { pattern: 'glass', xShift: 50, yShift: 50, scale: 1.6, angle: 0, chroma: 65, mix: 100, edge: 'mirror', mirror: false } },
  { id: 'ripple', label: 'Ripple', params: { pattern: 'ripple', xShift: 42, yShift: 42, scale: 1, angle: 0, chroma: 25, mix: 100, edge: 'mirror', mirror: false } },
  { id: 'prism-ripple', label: 'Prism Ripple', params: { pattern: 'ripple', xShift: 55, yShift: 55, scale: 1.4, angle: 0, chroma: 85, mix: 100, edge: 'mirror', mirror: false } },
  { id: 'waves', label: 'Waves', params: { pattern: 'waves', xShift: 30, yShift: 55, scale: 1, angle: 0, chroma: 20, mix: 100, edge: 'mirror', mirror: false } },
  { id: 'shear', label: 'Diagonal Shear', params: { pattern: 'diagonal', xShift: 70, yShift: 10, scale: 1.5, angle: 0, chroma: 0, mix: 100, edge: 'clamp', mirror: false } },
  { id: 'shattered', label: 'Shattered', params: { pattern: 'shards', xShift: 60, yShift: 60, scale: 1.3, angle: 0, chroma: 0, mix: 100, edge: 'clamp', mirror: false } },
  { id: 'grid', label: 'Tile Grid', params: { pattern: 'grid', xShift: 50, yShift: 50, scale: 1.6, angle: 0, chroma: 0, mix: 100, edge: 'clamp', mirror: false } },
  { id: 'lens', label: 'Lens Bulge', params: { pattern: 'lens', xShift: 85, yShift: 85, scale: 1, angle: 0, chroma: 45, mix: 100, edge: 'clamp', mirror: false } },
  { id: 'swirl', label: 'Swirl', params: { pattern: 'swirl', xShift: 60, yShift: 60, scale: 1.2, angle: 0, chroma: 30, mix: 100, edge: 'mirror', mirror: false } },
  { id: 'kaleido', label: 'Kaleidoscope', params: { pattern: 'shards', xShift: 50, yShift: 50, scale: 1.8, angle: 30, chroma: 20, mix: 100, edge: 'mirror', mirror: true } },
]
export const presetById = (id) => PRESETS.find((p) => p.id === id)

// Frame = the whole glass sheet moves (pan / spin). 'static' = off (defaults).
export const FRAME_PRESETS = [
  { id: 'static', label: 'Static', params: { panSpeedX: 0, panSpeedY: 0, spin: 0 } },
  { id: 'drift', label: 'Drift', params: { panSpeedX: 0.12, panSpeedY: 0, spin: 0 } },
  { id: 'rise', label: 'Rise', params: { panSpeedX: 0, panSpeedY: -0.12, spin: 0 } },
  { id: 'spin', label: 'Spin', params: { panSpeedX: 0, panSpeedY: 0, spin: 18 } },
  { id: 'orbit', label: 'Orbit', params: { panSpeedX: 0.08, panSpeedY: 0, spin: 14 } },
]
// Form = the pattern animates in place (internal phase / amplitude pulse).
export const FORM_PRESETS = [
  { id: 'static', label: 'Static', params: { phase: 0, pulse: 0 } },
  { id: 'flow', label: 'Flow', params: { phase: 1, pulse: 0 } },
  { id: 'pulse', label: 'Pulse', params: { phase: 0.5, pulse: 1 } },
  { id: 'surge', label: 'Surge', params: { phase: 2, pulse: 0.4 } },
]

const PATTERN_IDS = ['panes', 'bands', 'glass', 'ripple', 'waves', 'diagonal', 'shards', 'grid', 'lens', 'swirl']
const EDGE_IDS = ['clamp', 'wrap', 'mirror']
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const rnd = (lo, hi) => lo + Math.random() * (hi - lo)

// Look-only randomize (Randomize all / per-section). Keeps motion untouched.
export function randomizeGlass(section = 'all') {
  const all = section === 'all'
  const patch = {}
  if (all || section === 'pattern') patch.pattern = pick(PATTERN_IDS)
  if (all || section === 'displace') {
    patch.xShift = Math.round(rnd(-100, 100))
    patch.yShift = Math.round(rnd(-100, 100))
    patch.scale = +rnd(0.4, 3.5).toFixed(2)
    patch.angle = Math.round(rnd(0, 360))
    patch.mix = Math.round(rnd(60, 100))
  }
  if (all || section === 'glass') {
    patch.chroma = Math.round(rnd(0, 90))
    patch.edge = pick(EDGE_IDS)
    patch.mirror = Math.random() < 0.3
  }
  return patch
}
