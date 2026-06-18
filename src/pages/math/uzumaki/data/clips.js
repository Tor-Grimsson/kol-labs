// ─────────────────────────────────────────────────────────────────────────────
// 22 reference clips, each scoped as FUNCTION + KEYFRAMES.
//
// A "clip" is the whole genre in one object: a parametric function (shaped by
// control arrays + repeat/spiral modifiers), drawn progressively with its
// construction shown (arms + joint dots), explored by a PERSPECTIVE CAMERA that
// orbits it in 3D along a keyframed timeline with easing between frames.
//
// THE SYSTEM
//   curve forms (the function):
//     { kind:'epicycle', turns:N, terms:[{amp,freq,phase}] }
//         z(s) = Σ amp·e^{i(freq·s + phase)},  s ∈ [0, turns·TAU]
//     { kind:'polar',   range:[a,b], r:'<expr in θ>' }      p = r·(cosθ, sinθ)
//     { kind:'param2d', range:[a,b], x:'<expr in t>', y:'…' }
//     { kind:'param3d', range:[a,b], x:'…', y:'…', z:'…' }
//     { kind:'points',  count:N, a:'<expr in k>', r:'<expr in k>' }  (k = 0..N)
//     { kind:'maurer',  n:N, d:DEG }
//   Every curve lives in 3D — 2D ones sit on z=0, so the camera can still tilt
//   them into perspective.
//
//   modifiers: { repeat:k (k rotated copies), spiral:g (radius winds outward) }
//   show:  { arms, dots, trace, axes }
//   style: { color, weight }
//
//   timeline: keyframes — the spine of the animation:
//     { at:seconds, draw:0..1, cam:{ yaw, pitch, zoom, dist? }, ease:'linear'|'in'|'out'|'inout' }
//       draw  = fraction of the curve drawn so far (progressive reveal)
//       cam   = PERSPECTIVE camera: yaw/pitch orbit (degrees), zoom, dist
//               (camera distance × extent; smaller = stronger perspective)
//       ease  = interpolation INTO this keyframe
//   "set timeframe → move camera → set timeframe → move camera" = successive
//   keyframes; the camera explores yaw AND pitch (multiple axes), not one.
//   staticCam (optional) = the frozen pose used when camera motion is toggled off.
// ─────────────────────────────────────────────────────────────────────────────

const PI = Math.PI
const TAU = 2 * PI
const PHI = 1.618033988749895
const SQRT2 = Math.SQRT2
const E = Math.E

export const CLIPS = [
  // ── Epicycles — rotating vectors, arms + dots, tilted into perspective ───────
  {
    id: 'circle-to-sine',
    title: 'One circle → sine',
    ref: 'img #4 top — the atom of the genre',
    space: '2D',
    curve: { kind: 'epicycle', turns: 2, terms: [{ amp: 1, freq: 1, phase: 0 }] },
    show: { arms: true, dots: true },
    style: { color: '#9ec1ff', weight: 2 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -18, pitch: 18, zoom: 1 }, ease: 'inout' },
      { at: 4, draw: 1, cam: { yaw: 16, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 6.5, draw: 1, cam: { yaw: -10, pitch: 26, zoom: 1 }, ease: 'inout' },
    ],
  },
  {
    id: 'four-petal',
    title: 'Two vectors → 4-petal rosette',
    ref: 'img #4 middle',
    space: '2D',
    curve: { kind: 'epicycle', turns: 1, terms: [{ amp: 1, freq: 1 }, { amp: 0.5, freq: -3 }] },
    show: { arms: true, dots: true },
    style: { color: '#9ec1ff', weight: 2 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -22, pitch: 20, zoom: 1 }, ease: 'inout' },
      { at: 5, draw: 1, cam: { yaw: 20, pitch: 14, zoom: 1 }, ease: 'inout' },
      { at: 7.5, draw: 1, cam: { yaw: -16, pitch: 28, zoom: 1 }, ease: 'inout' },
    ],
  },
  {
    id: 'looped-square',
    title: 'Three vectors → looped square',
    ref: 'img #4 bottom',
    space: '2D',
    curve: {
      kind: 'epicycle',
      turns: 1,
      terms: [{ amp: 1, freq: 1 }, { amp: 0.5, freq: -3 }, { amp: 0.3, freq: 5 }],
    },
    show: { arms: true, dots: true },
    style: { color: '#9ec1ff', weight: 2 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -20, pitch: 18, zoom: 1 }, ease: 'inout' },
      { at: 6, draw: 1, cam: { yaw: 24, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 8.5, draw: 1, cam: { yaw: 0, pitch: 32, zoom: 1 }, ease: 'inout' },
    ],
  },
  {
    id: 'two-rotating-axes',
    title: '2 rotating axes — speed −5:7, length 1.75:1.25',
    ref: 'img #6 "2 rotating axes" — its exact ratios',
    space: '2D',
    curve: { kind: 'epicycle', turns: 1, terms: [{ amp: 1.75, freq: -5 }, { amp: 1.25, freq: 7 }] },
    show: { arms: true, dots: true },
    style: { color: '#ffb35c', weight: 2 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -18, pitch: 16, zoom: 1 }, ease: 'inout' },
      { at: 6, draw: 1, cam: { yaw: 18, pitch: 14, zoom: 1 }, ease: 'inout' },
      { at: 9, draw: 1, cam: { yaw: 55, pitch: 26, zoom: 1 }, ease: 'inout' },
    ],
  },

  // ── Irrational frequency ratios — never close (the big hitters) ──────────────
  {
    id: 'pi-irrational',
    title: 'e^{iθ} + e^{iπθ} — π never closes',
    ref: 'img #12 — visualization of π being irrational',
    space: '2D',
    curve: { kind: 'epicycle', turns: 60, terms: [{ amp: 1, freq: 1 }, { amp: 1, freq: PI }] },
    show: { arms: true, dots: true },
    style: { color: '#ffffff', weight: 1 },
    staticCam: { yaw: 22, pitch: 22, zoom: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -26, pitch: 26, zoom: 1.5 }, ease: 'in' },
      { at: 9, draw: 1, cam: { yaw: 22, pitch: 16, zoom: 1.0 }, ease: 'inout' },
      { at: 12, draw: 1, cam: { yaw: -14, pitch: 34, zoom: 1.0 }, ease: 'inout' },
    ],
  },
  {
    id: 'phi-irrational',
    title: 'e^{iθ} + e^{iφθ} — golden ratio',
    ref: 'φ — the most irrational ratio, densest weave',
    space: '2D',
    curve: { kind: 'epicycle', turns: 80, terms: [{ amp: 1, freq: 1 }, { amp: 1, freq: PHI }] },
    show: { arms: true, dots: true },
    style: { color: '#ffffff', weight: 1 },
    staticCam: { yaw: 20, pitch: 20, zoom: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -24, pitch: 24, zoom: 1.4 }, ease: 'in' },
      { at: 10, draw: 1, cam: { yaw: 20, pitch: 16, zoom: 1.0 }, ease: 'inout' },
      { at: 13, draw: 1, cam: { yaw: -12, pitch: 32, zoom: 1.0 }, ease: 'inout' },
    ],
  },
  {
    id: 'sqrt2-weave',
    title: 'e^{iθ} + e^{i√2 θ} — √2',
    ref: '√2 ratio',
    space: '2D',
    curve: { kind: 'epicycle', turns: 70, terms: [{ amp: 1, freq: 1 }, { amp: 1, freq: SQRT2 }] },
    show: { arms: true, dots: true },
    style: { color: '#ffffff', weight: 1 },
    staticCam: { yaw: 20, pitch: 20, zoom: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -24, pitch: 24, zoom: 1.4 }, ease: 'in' },
      { at: 9, draw: 1, cam: { yaw: 22, pitch: 16, zoom: 1.0 }, ease: 'inout' },
      { at: 12, draw: 1, cam: { yaw: -14, pitch: 30, zoom: 1.0 }, ease: 'inout' },
    ],
  },
  {
    id: 'spirograph-close',
    title: 'So close yet so far — 1 : 7.3',
    ref: 'img #7 "So close yet so far" — torus of circles',
    space: '2D',
    curve: { kind: 'epicycle', turns: 40, terms: [{ amp: 1, freq: 1 }, { amp: 0.7, freq: 7.3 }] },
    show: { arms: true, dots: true },
    style: { color: '#9ec1ff', weight: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -20, pitch: 18, zoom: 1 }, ease: 'in' },
      { at: 8, draw: 1, cam: { yaw: 20, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 11, draw: 1, cam: { yaw: -8, pitch: 30, zoom: 1 }, ease: 'inout' },
    ],
  },

  // ── Polar roses ──────────────────────────────────────────────────────────────
  {
    id: 'rose-24-25',
    title: 'r = 4·sin(24θ/25) + 10',
    ref: 'img #6 "The Beauty of Mathematics"',
    space: '2D',
    curve: { kind: 'polar', range: [0, 50 * TAU], r: '4*sin(24*θ/25) + 10' },
    show: { trace: true },
    style: { color: '#ffd23f', weight: 1.4 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -22, pitch: 18, zoom: 1 }, ease: 'inout' },
      { at: 8, draw: 1, cam: { yaw: 22, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 11, draw: 1, cam: { yaw: 0, pitch: 30, zoom: 1 }, ease: 'inout' },
    ],
  },
  {
    id: 'rose-608',
    title: 'r = 3·sin(6.08θ)',
    ref: 'img #7 "Math is an Art"',
    space: '2D',
    curve: { kind: 'polar', range: [0, 50 * TAU], r: '3*sin(6.08*θ)' },
    show: { trace: true },
    style: { color: '#ff5470', weight: 1.4 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -22, pitch: 18, zoom: 1 }, ease: 'inout' },
      { at: 8, draw: 1, cam: { yaw: 22, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 11, draw: 1, cam: { yaw: 0, pitch: 30, zoom: 1 }, ease: 'inout' },
    ],
  },
  {
    id: 'maurer-rose',
    title: 'Maurer rose — n=6, d=71°',
    ref: 'the rose-as-web genre staple',
    space: '2D',
    curve: { kind: 'maurer', n: 6, d: 71 },
    show: { trace: true },
    style: { color: '#9ec1ff', weight: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -18, pitch: 16, zoom: 1 }, ease: 'linear' },
      { at: 6, draw: 1, cam: { yaw: 18, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 9, draw: 1, cam: { yaw: -6, pitch: 28, zoom: 1 }, ease: 'inout' },
    ],
  },

  // ── Spirals ──────────────────────────────────────────────────────────────────
  {
    id: 'archimedean',
    title: 'Archimedean spiral — r = aθ',
    ref: 'the plain spiral, drawn from the centre out',
    space: '2D',
    curve: { kind: 'polar', range: [0, 10 * TAU], r: '0.5*θ' },
    show: { trace: true, dots: true },
    style: { color: '#9ec1ff', weight: 1.6 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -14, pitch: 20, zoom: 1.3 }, ease: 'in' },
      { at: 6, draw: 1, cam: { yaw: 16, pitch: 14, zoom: 1.0 }, ease: 'inout' },
      { at: 8.5, draw: 1, cam: { yaw: -8, pitch: 32, zoom: 1.0 }, ease: 'inout' },
    ],
  },
  {
    id: 'golden-spiral',
    title: 'Golden spiral — r = φ^(2θ/π)',
    ref: 'img #7 Fibonacci / golden-ratio growth',
    space: '2D',
    curve: { kind: 'polar', range: [0, 4 * TAU], r: 'pow(PHI, 2*θ/PI)' },
    show: { trace: true },
    style: { color: '#ffd23f', weight: 1.6 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -12, pitch: 18, zoom: 0.7 }, ease: 'in' },
      { at: 6, draw: 1, cam: { yaw: 14, pitch: 12, zoom: 1.0 }, ease: 'inout' },
      { at: 8.5, draw: 1, cam: { yaw: -6, pitch: 28, zoom: 1.0 }, ease: 'inout' },
    ],
  },
  {
    id: 'log-spiral-e',
    title: 'Logarithmic spiral — r = e^(0.15θ)',
    ref: "Euler's e as the growth base",
    space: '2D',
    curve: { kind: 'polar', range: [0, 6 * TAU], r: 'exp(0.15*θ)' },
    show: { trace: true },
    style: { color: '#9ec1ff', weight: 1.5 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -14, pitch: 20, zoom: 0.6 }, ease: 'in' },
      { at: 7, draw: 1, cam: { yaw: 16, pitch: 12, zoom: 1.0 }, ease: 'inout' },
      { at: 9.5, draw: 1, cam: { yaw: -6, pitch: 30, zoom: 1.0 }, ease: 'inout' },
    ],
  },

  // ── Scatter / phyllotaxis ────────────────────────────────────────────────────
  {
    id: 'phyllotaxis',
    title: 'Phyllotaxis — golden-angle seed packing',
    ref: "img #7 Nature's Flowers / Fibonacci bloom",
    space: '2D',
    curve: { kind: 'points', count: 1400, a: 'k * TAU / (PHI*PHI)', r: 'sqrt(k)' },
    show: { dots: true },
    style: { color: '#c9f29b', weight: 2 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -18, pitch: 22, zoom: 1 }, ease: 'linear' },
      { at: 5, draw: 1, cam: { yaw: 12, pitch: 16, zoom: 1 }, ease: 'out' },
      { at: 7.5, draw: 1, cam: { yaw: 40, pitch: 12, zoom: 1 }, ease: 'inout' },
    ],
  },

  // ── Modifier demos — repeat (mandala) and spiral (wind-out) ──────────────────
  {
    id: 'repeat-mandala',
    title: 'Rose ×6 repeated — mandala',
    ref: 'the repeat modifier (k rotated copies)',
    space: '2D',
    curve: { kind: 'polar', range: [0, TAU], r: '4 + 2*cos(5*θ)' },
    modifiers: { repeat: 6 },
    show: { trace: true },
    style: { color: '#b8a6ff', weight: 1.3 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: 0, pitch: 14, zoom: 1 }, ease: 'inout' },
      { at: 6, draw: 1, cam: { yaw: 0, pitch: 14, zoom: 1 }, ease: 'inout' },
      { at: 9, draw: 1, cam: { yaw: 45, pitch: 30, zoom: 1 }, ease: 'inout' },
    ],
  },
  {
    id: 'spiral-modifier',
    title: 'Rose + spiral wind-out',
    ref: 'the spiral modifier (radius winds outward — the uzumaki move, done right)',
    space: '2D',
    curve: { kind: 'polar', range: [0, 16 * TAU], r: '3 + sin(5*θ)' },
    modifiers: { spiral: 4 },
    show: { trace: true },
    style: { color: '#9ec1ff', weight: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -16, pitch: 20, zoom: 1.2 }, ease: 'in' },
      { at: 9, draw: 1, cam: { yaw: 18, pitch: 12, zoom: 1.0 }, ease: 'inout' },
      { at: 12, draw: 1, cam: { yaw: -8, pitch: 30, zoom: 1.0 }, ease: 'inout' },
    ],
  },

  // ── 3D + camera — the perspective orbit payoff ──────────────────────────────
  {
    id: 'helix-3d',
    title: '3D helix — (cos t, sin t, 0.3t)',
    ref: 'img #8–11 base — head-on a circle, side a wave, off-axis the helix',
    space: '3D',
    curve: { kind: 'param3d', range: [0, 6 * TAU], x: 'cos(t)', y: 'sin(t)', z: '0.3*t' },
    show: { trace: true, axes: true },
    style: { color: '#ffffff', weight: 1.6 },
    staticCam: { yaw: 38, pitch: 24, zoom: 0.95 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: 2, pitch: 6, zoom: 1 }, ease: 'inout' }, // near head-on → circle
      { at: 3.5, draw: 1, cam: { yaw: 2, pitch: 6, zoom: 1 }, ease: 'inout' },
      { at: 5.5, draw: 1, cam: { yaw: 90, pitch: 8, zoom: 1 }, ease: 'inout' }, // side → wave
      { at: 8, draw: 1, cam: { yaw: 38, pitch: 26, zoom: 0.95 }, ease: 'inout' }, // off-axis → helix
      { at: 11, draw: 1, cam: { yaw: -32, pitch: 16, zoom: 0.95 }, ease: 'inout' }, // orbit the other way
    ],
  },
  {
    id: 'imz-sin-pi-t',
    title: 'Im(z)=sin πt, Re(z)=cos πt, t∈[0,4]',
    ref: 'img #9–11 exactly — the off-axis reveal',
    space: '3D',
    curve: { kind: 'param3d', range: [0, 4], x: 'cos(PI*t)', y: 'sin(PI*t)', z: 't' },
    show: { trace: true, axes: true },
    style: { color: '#ffffff', weight: 1.6 },
    staticCam: { yaw: 34, pitch: 20, zoom: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: 34, pitch: 20, zoom: 1 }, ease: 'inout' }, // off-axis (img #9/#11)
      { at: 4, draw: 1, cam: { yaw: 34, pitch: 20, zoom: 1 }, ease: 'inout' },
      { at: 6, draw: 1, cam: { yaw: 90, pitch: 4, zoom: 1 }, ease: 'inout' }, // edge-on → flat wave (img #10)
      { at: 8, draw: 1, cam: { yaw: 6, pitch: 76, zoom: 1 }, ease: 'inout' }, // top-down
      { at: 10.5, draw: 1, cam: { yaw: 40, pitch: 24, zoom: 1 }, ease: 'inout' }, // back to perspective
    ],
  },
  {
    id: 'lissajous-3d',
    title: 'Lissajous 3D — (sin 3t, sin 4t, sin 5t)',
    ref: 'orbit the camera to unfold the knot',
    space: '3D',
    curve: { kind: 'param3d', range: [0, TAU], x: 'sin(3*t)', y: 'sin(4*t)', z: 'sin(5*t)' },
    show: { trace: true, axes: true },
    style: { color: '#9ec1ff', weight: 1.4 },
    staticCam: { yaw: 28, pitch: 24, zoom: 1 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -20, pitch: 14, zoom: 1 }, ease: 'inout' },
      { at: 4, draw: 1, cam: { yaw: -20, pitch: 14, zoom: 1 }, ease: 'inout' },
      { at: 9, draw: 1, cam: { yaw: 200, pitch: 34, zoom: 1 }, ease: 'inout' }, // long orbit
      { at: 12, draw: 1, cam: { yaw: 340, pitch: 12, zoom: 1 }, ease: 'inout' },
    ],
  },

  // ── 2D parametric showpieces ─────────────────────────────────────────────────
  {
    id: 'lissajous-2d',
    title: 'Lissajous — x=sin 3t, y=sin(2t + δ)',
    ref: 'classic 2:3 figure',
    space: '2D',
    curve: { kind: 'param2d', range: [0, TAU], x: 'sin(3*t)', y: 'sin(2*t + 0.6)' },
    show: { trace: true, dots: true },
    style: { color: '#9ec1ff', weight: 1.6 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -20, pitch: 18, zoom: 1 }, ease: 'inout' },
      { at: 5, draw: 1, cam: { yaw: 20, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 7.5, draw: 1, cam: { yaw: -8, pitch: 30, zoom: 1 }, ease: 'inout' },
    ],
  },
  {
    id: 'butterfly',
    title: 'Butterfly curve (Fay)',
    ref: 'elegant single parametric sweep',
    space: '2D',
    curve: {
      kind: 'param2d',
      range: [0, 12 * PI],
      x: 'sin(t) * (exp(cos(t)) - 2*cos(4*t) - pow(sin(t/12), 5))',
      y: 'cos(t) * (exp(cos(t)) - 2*cos(4*t) - pow(sin(t/12), 5))',
    },
    show: { trace: true },
    style: { color: '#ffd23f', weight: 1.3 },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -16, pitch: 16, zoom: 1 }, ease: 'in' },
      { at: 9, draw: 1, cam: { yaw: 16, pitch: 10, zoom: 1 }, ease: 'inout' },
      { at: 12, draw: 1, cam: { yaw: -6, pitch: 26, zoom: 1 }, ease: 'inout' },
    ],
  },
]

export const DEFAULT_CLIP = CLIPS[0]
