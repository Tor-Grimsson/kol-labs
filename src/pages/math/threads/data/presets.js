// Five Threads looks. A 3-(or more)-wing windmill of BIG white balls that spreads
// across the surface, dragging a few colour loops around with it (the balls have
// influence — they pull the lines into them). Presets vary the wing structure,
// ball size, how hard the balls drag the lines, and the colourway.

export const THREADS_DEFAULTS = {
  form: 'loops', // which form the balls interrupt (see FORM_OPTIONS)
  wings: 3, // windmill spokes at t=0
  perWing: 3, // balls per spoke
  lines: 6, // form density (loops / rings / grid lines / spokes …)
  reach: 0.45, // size of the field (fraction of half-frame)
  ballSpeed: 1, // how fast the windmill spreads
  lineSpeed: 0.22, // base loop precession (slow)
  pull: 0.18, // how hard the balls drag the lines (influence)
  infR: 0.28, // ball influence radius
  weight: 2.4,
  glow: 10,
  ballR: 40, // BIG balls (max radius; graduated per ball)
  mono: false,
  heads: true,
  thread: '#ffffff',
  bg: '#050507',
  seed: 1,
}

const P = (id, label, params) => ({ id, label, params: { ...THREADS_DEFAULTS, ...params } })

export const THREADS_PRESETS = [
  // — original loop looks —
  P('mill', 'Windmill', { form: 'loops', wings: 3, perWing: 3, lines: 6, pull: 0.2, ballR: 40 }),
  P('drag', 'Heavy drag', { form: 'loops', wings: 3, perWing: 3, lines: 7, pull: 0.34, infR: 0.36, ballR: 46, ballSpeed: 0.8 }),
  P('five', 'Five-wing', { form: 'loops', wings: 5, perWing: 3, lines: 6, pull: 0.16, ballR: 34 }),
  P('mono', 'Mono', { form: 'loops', wings: 3, perWing: 3, lines: 6, pull: 0.22, mono: true, glow: 5, weight: 1.8, ballR: 38, bg: '#040405' }),
  P('swarm', 'Swarm', { form: 'loops', wings: 4, perWing: 3, lines: 7, pull: 0.12, infR: 0.22, ballSpeed: 1.5, ballR: 28 }),
  // — other forms the balls interrupt —
  P('rings', 'Rings', { form: 'rings', wings: 3, perWing: 3, lines: 7, pull: 0.26, infR: 0.32, ballR: 38 }),
  P('ripple', 'Ripple', { form: 'rings', wings: 3, perWing: 3, lines: 11, pull: 0.36, infR: 0.42, ballR: 34, ballSpeed: 0.7, weight: 1.8 }),
  P('grid', 'Grid', { form: 'grid', wings: 3, perWing: 3, lines: 7, pull: 0.24, infR: 0.3, weight: 1.8, ballR: 36 }),
  P('mesh', 'Mesh', { form: 'grid', wings: 4, perWing: 3, lines: 9, mono: true, glow: 5, weight: 1.4, pull: 0.26, ballR: 32, bg: '#040405' }),
  P('bands', 'Bands', { form: 'stripes', wings: 3, perWing: 3, lines: 9, pull: 0.3, infR: 0.32, weight: 2, ballR: 38 }),
  P('rays', 'Rays', { form: 'radial', wings: 3, perWing: 3, lines: 14, pull: 0.2, infR: 0.28, ballR: 34 }),
  P('starburst', 'Starburst', { form: 'radial', wings: 4, perWing: 3, lines: 24, pull: 0.16, ballR: 26, ballSpeed: 1.3, weight: 1.6 }),
  P('spiral', 'Spiral', { form: 'spiral', wings: 3, perWing: 3, lines: 3, pull: 0.22, ballR: 38 }),
  P('waves', 'Waves', { form: 'waves', wings: 3, perWing: 3, lines: 9, pull: 0.26, infR: 0.32, ballR: 36 }),
  P('web', 'Web', { form: 'web', wings: 3, perWing: 3, lines: 12, pull: 0.22, infR: 0.3, ballR: 34 }),
]

export const presetById = (id) => THREADS_PRESETS.find((p) => p.id === id) || THREADS_PRESETS[0]
