import { PROFILE_KEYS } from './fields/organicField.js'
import { SETTS } from './fields/setts.js'

// Randomizers for the Generate tab. Each section returns a PARTIAL patch merged over
// the current values, so randomizing one section leaves the others intact. The render
// kind (tiles / field+family / weave) is preserved — you stay in the same category.

const rnd = (a, b) => a + Math.random() * (b - a)
const rint = (a, b) => Math.round(rnd(a, b))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const chance = (p) => Math.random() < p

// Cohesive random palette via HSL: a dark ground + a few vivid, hue-spread inks.
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360 / 360
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const ch = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
  return '#' + hex2(ch(h + 1 / 3) * 255) + hex2(ch(h) * 255) + hex2(ch(h - 1 / 3) * 255)
}
function randColor() {
  const base = rnd(0, 360), spread = pick([26, 40, 120, 150, 180])
  return {
    color: hsl(base, rnd(0.5, 0.85), rnd(0.56, 0.74)),
    color2: hsl(base + spread, rnd(0.45, 0.85), rnd(0.5, 0.72)),
    color3: hsl(base + spread * 2, rnd(0.45, 0.8), rnd(0.5, 0.7)),
    bg: hsl(rnd(0, 360), rnd(0.12, 0.4), rnd(0.06, 0.14)),
  }
}

const SHAPES = ['prim:square', 'prim:circle', 'prim:diamond', 'prim:triangle', 'prim:hexagon', 'prim:plus']
const SETT_KEYS = Object.keys(SETTS)

// PATTERN — the structural look (render kind preserved).
function randPattern(v) {
  const render = v.render || 'tiles'
  if (render === 'field') {
    const field = v.field || 'stripes'
    if (field === 'stripes') return {
      stripeAngle: pick([0, 0, 45, 90, rint(0, 180)]), stripePitch: rint(18, 150),
      bandCount: rint(1, 3), duty: chance(0.5) ? 1 : +rnd(0.1, 0.7).toFixed(2),
      edgeSoftness: chance(0.6) ? 0 : +rnd(0.1, 1).toFixed(2),
      waveAmp: chance(0.5) ? 0 : +rnd(0.2, 0.6).toFixed(2), waveFreq: +rnd(0.6, 2.6).toFixed(2),
    }
    if (field === 'organic') return {
      stripeAngle: pick([45, 55, 70, 90, 90, 100, rint(0, 180)]), stripePitch: rint(56, 150),
      bandCount: rint(2, 3), waveAmp: +rnd(0.3, 0.8).toFixed(2), waveFreq: +rnd(0.6, 2.6).toFixed(2),
      waveProfile: pick(PROFILE_KEYS.filter((k) => k !== 'custom')),
    }
    if (field === 'tartan') return { sett: pick(SETT_KEYS), settScale: rint(3, 12), twill: +rnd(0, 0.3).toFixed(2) }
    return {}
  }
  if (render === 'weave') return {
    weaveType: pick(['plain', 'twill', 'satin', 'basket']), cols: rint(6, 16), rows: rint(6, 16),
    cell: rint(60, 120), strandWidth: +rnd(0.5, 0.85).toFixed(2),
  }
  // tiles
  const big = chance(0.4)
  return {
    shape: pick(SHAPES), cols: big ? rint(2, 5) : rint(8, 24), rows: big ? rint(2, 5) : rint(8, 24),
    cell: rint(60, 200), gap: rint(-20, 36), stretch: true,
    colorRule: pick(['none', 'checker', 'checker', 'cols', 'rows', 'diag']),
  }
}

// FRAME — the camera / field drift (across + along).
function randFrame(v) {
  const tiles = (v.render ?? 'tiles') === 'tiles'
  const p = {
    framePreset: 'custom', camFlow: rint(0, 3),
    camZoom: +rnd(0.7, 1.5).toFixed(2), camAngle: chance(0.6) ? 0 : rint(0, 360),
    panDir: tiles ? pick(['right', 'left', 'up', 'down', 'diag', 'anti']) : pick(['right', 'left', 'split']),
  }
  if (!tiles) p.waveFlow = rint(0, 3) // along-axis travel (organic wave / tartan weft / wavy stripes)
  return p
}

// MOTION — the per-cell (tiles) / per-band (field) animation.
function randMotion(v) {
  const render = v.render || 'tiles'
  if (render === 'field') {
    const field = v.field || 'stripes'
    if (field === 'tartan') return { formPreset: 'custom', fieldPulse: +rnd(0, 0.6).toFixed(2), fieldShimmer: +rnd(0, 0.5).toFixed(2), fieldCycles: rint(1, 3) }
    return { formPreset: 'custom', fieldSway: +rnd(0, 0.6).toFixed(2), fieldStagger: +rnd(0, 1).toFixed(2), fieldCycles: rint(1, 3) }
  }
  if (render === 'weave') return {}
  return {
    formPreset: 'custom', spin: pick([0, 0, 1]), animAxis: pick(['none', 'diag', 'col', 'row', 'radial']),
    animCycles: rint(1, 3), animWaves: +rnd(0, 6).toFixed(1),
    pulse: chance(0.5) ? 0 : +rnd(0.2, 0.8).toFixed(2), fade: chance(0.5) ? 0 : +rnd(0.2, 0.7).toFixed(2),
    swing: chance(0.6) ? 0 : rint(10, 90), colorMix: chance(0.6) ? 0 : +rnd(0.2, 1).toFixed(2),
  }
}

export function randomizeSection(v, section) {
  if (section === 'pattern') return randPattern(v)
  if (section === 'frame') return randFrame(v)
  if (section === 'motion') return randMotion(v)
  if (section === 'color') return randColor(v)
  return { ...randPattern(v), ...randMotion(v), ...randFrame(v), ...randColor(v) } // 'all'
}
