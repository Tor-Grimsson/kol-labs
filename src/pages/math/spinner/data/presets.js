// The five Thread Spinner looks (the polyhop carousel). Each is a dozen-ish balls
// on big glowing loops that start ordered and slowly precess into a tangle; they
// differ in count / colourway / glow / how fast they fill. `persist:1` = threads
// never fade (full accumulation until reset).

export const SPINNER_DEFAULTS = {
  count: 12,
  drift: 0.05,
  span: 1,
  reach: 0.92,
  speed: 1,
  persist: 1,
  weight: 2,
  glow: 8,
  ballR: 9,
  mono: false,
  heads: true,
  thread: '#ffffff',
  bg: '#060608',
  seed: 1,
}

const P = (id, label, params) => ({ id, label, params: { ...SPINNER_DEFAULTS, ...params } })

export const SPINNER_PRESETS = [
  P('rainbow', 'Spinner', { count: 12, drift: 0.05, glow: 8, ballR: 9 }),
  P('weave', 'Weave', { count: 16, drift: 0.08, weight: 1.6, glow: 6, ballR: 8 }),
  P('mono', 'Mono', { count: 12, drift: 0.06, weight: 1.3, glow: 3, ballR: 8, mono: true, bg: '#050506' }),
  P('calm', 'Calm', { count: 8, drift: 0.03, span: 1.05, speed: 0.85, glow: 10, ballR: 10 }),
  P('bloom', 'Bloom', { count: 10, drift: 0.05, weight: 2.4, glow: 18, ballR: 12 }),
]

export const presetById = (id) => SPINNER_PRESETS.find((p) => p.id === id) || SPINNER_PRESETS[0]
