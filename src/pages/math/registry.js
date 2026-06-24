// Math catalog — Page › Category › Preset, mirroring the scanlines/pattern model
// so nav + routes can't drift. The CATEGORIES are the sidebar entries; the
// visualisers inside each become PRESETS picked in the rail's Preset dropdown
// (NOT the sidebar). Each preset's `defaults` is a full patch over that category's
// engine FALLBACK.
//
// Expression is SEPARATE: the unique text-DSL tool, no presets, so it is not a
// category. It owns the /math index (a standalone nav leaf above the categories);
// every category routes to /math/<cat>.
//
// Build status (categories ported to the generator shell one at a time):
//   surfaces  — DONE  (Viewport3D: surface z=f(x,y) + attractor trajectories)
//   waveforms · parametric · fields — pending (still on their per-page editors,
//     routed below so the nav resolves without 404s).

export const CATEGORIES = [
  { id: 'waveforms', label: 'Waveforms' },
  { id: 'parametric', label: 'Parametric' },
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'fields', label: 'Fields' },
]

// Expression owns the /math index; every category is /math/<cat>.
export const catRoute = (id) => `/math/${id}`
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]

// Surfaces — one Viewport3D shell, two render kinds. `kind:'surface'` draws a
// z=f(x,y) wireframe/fill; `kind:'attractor'` integrates a strange attractor.
// Presets are cheap configs over SURFACE_FALLBACK (see surfaces/SurfacesEditor).
export const SURFACE_PRESETS = [
  { id: 'ripple', label: 'Ripple', defaults: { kind: 'surface', expr: 'sin(x*1.6)*cos(y*1.6)', mode: 'wire', height: 1, low: '#1b2b4a', high: '#ffd23f' } },
  { id: 'saddle', label: 'Saddle', defaults: { kind: 'surface', expr: '(x*x - y*y)*0.25', mode: 'fill', height: 1, low: '#1a0b2e', high: '#ff5470' } },
  { id: 'bell',   label: 'Bell',   defaults: { kind: 'surface', expr: 'cos(x)*cos(y)*exp(-(x*x+y*y)*0.08)', mode: 'wire', height: 1.6, domain: 4, low: '#04140f', high: '#c9f29b' } },
  { id: 'lorenz', label: 'Lorenz', defaults: { kind: 'attractor', attractor: 'lorenz', stroke: '#9ec1ff', gradient: true } },
  { id: 'rossler', label: 'Rössler', defaults: { kind: 'attractor', attractor: 'rossler', stroke: '#ffd23f', steps: 9000 } },
  { id: 'aizawa', label: 'Aizawa', defaults: { kind: 'attractor', attractor: 'aizawa', stroke: '#ff5470' } },
]

// Fields — one 2D pan/zoom shell, two render kinds. `kind:'scalar'` is an f(x,y)
// heatmap (+ flow particles); `kind:'complex'` is domain coloring of f(z).
export const FIELD_PRESETS = [
  { id: 'waves',   label: 'Waves',   defaults: { kind: 'scalar', expr: 'sin(x)*cos(y)', range: 8, low: '#0b1530', high: '#ffce54' } },
  { id: 'ripples', label: 'Ripples', defaults: { kind: 'scalar', expr: 'sin(hypot(x,y)*2)', range: 10, low: '#1a0b2e', high: '#ff5470' } },
  { id: 'saddle',  label: 'Saddle',  defaults: { kind: 'scalar', expr: 'x*x - y*y', range: 8, low: '#04140f', high: '#c9f29b' } },
  { id: 'roots2',  label: 'z² − 1',  defaults: { kind: 'complex', funcId: 'z2-1', range: 6, coloring: 'rings' } },
  { id: 'recip',   label: '1 / z',   defaults: { kind: 'complex', funcId: 'inv', range: 4, coloring: 'smooth' } },
  { id: 'sinz',    label: 'sin z',   defaults: { kind: 'complex', funcId: 'sin', range: 6, coloring: 'contour' } },
]

// Parametric — heterogeneous engines, hosted in one shell (the Preset dropdown
// switches engine). Curves is the rich Uzumaki ClipEditor (kept whole); the rest
// are canvas engines hosted into the 3-tab rail.
export const PARAMETRIC_PRESETS = [
  { id: 'curves', label: 'Curves' },
  { id: 'orbits', label: 'Orbits' },
  { id: 'spinner', label: 'Spinner' },
  { id: 'threads', label: 'Threads' },
]

// Waveforms — Fourier epicycle synthesis. Each preset is a full curated patch
// (function f(t) + harmonics + palette + motion) over the editor's WF_FALLBACK;
// `palette` seeds bg/fg. The wave is an editable function, so the preset NAMES use
// Fourier vocabulary. Each carries its own motion personality (Frame drift / Form
// modulation). Animate is the special tool (the rich ClipEditor) — no defaults.
export const WAVEFORM_PRESETS = [
  { id: 'epicycle',  label: 'Epicycle',  defaults: { func: 'sign(sin(t))',      harmonics: 8,  palette: 'amber',     speed: 0.3,  rolloff: 0 } },
  { id: 'harmonic',  label: 'Harmonic',  defaults: { func: '2/PI*asin(sin(t))', harmonics: 6,  palette: 'paper',     speed: 0.25, rolloff: 0 } },
  { id: 'overtone',  label: 'Overtone',  defaults: { func: 'mod(t/PI, 2) - 1',  harmonics: 16, palette: 'mono',      speed: 0.6,  rolloff: 0.4 } },
  { id: 'phasor',    label: 'Phasor',    defaults: { func: 'sign(sin(t))',      harmonics: 4,  palette: 'blueprint', speed: 0.2,  swing: 24 } },
  { id: 'spectrum',  label: 'Spectrum',  defaults: { func: 'mod(t/PI, 2) - 1',  harmonics: 12, palette: 'dark',      speed: 0.45, stagger: 0.45 } },
  { id: 'resonance', label: 'Resonance', defaults: { func: '2/PI*asin(sin(t))', harmonics: 9,  palette: 'amber',     speed: 0.3,  pulse: 0.6 } },
  { id: 'animate',   label: 'Animate' },
]

const PRESETS = {
  surfaces: SURFACE_PRESETS,
  fields: FIELD_PRESETS,
  parametric: PARAMETRIC_PRESETS,
  waveforms: WAVEFORM_PRESETS,
}

export const presetsForCat = (id) => PRESETS[id] || []
