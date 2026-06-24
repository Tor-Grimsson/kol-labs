import { PROFILE_KEYS } from './fields/organicField.js'
import { SETTS } from './fields/setts.js'
import { randomRule } from './rules.js'

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

// Split-gap fill — randomized from its own control (Frame → Fill), only meaningful
// when Direction = Split. Returns a type + a fresh colour when solid.
export function randFill() {
  const mode = pick(['off', 'extend', 'solid'])
  const p = { fillMode: mode }
  if (mode === 'solid') p.fillColor = hsl(rnd(0, 360), rnd(0.5, 0.85), rnd(0.45, 0.66))
  return p
}

const SHAPES = ['prim:square', 'prim:circle', 'prim:diamond', 'prim:triangle', 'prim:hexagon', 'prim:plus']
const SETT_KEYS = Object.keys(SETTS)

// PATTERN is split across two buttons (there are more knobs than one roll wants
// to touch): PATTERN 1 = the form/layout (shape + grid · band geometry · weave
// grid); PATTERN 2 = the detail (band edge · wave/profile · twill · tile
// colour-rule + the rule stack). Both preserve the render kind.
function randPattern1(v) {
  const render = v.render || 'tiles'
  if (render === 'field') {
    const field = v.field || 'stripes'
    if (field === 'stripes') return { stripeAngle: pick([0, 0, 45, 90, rint(0, 180)]), stripePitch: rint(18, 150), bandCount: rint(1, 3) }
    if (field === 'organic') return { stripeAngle: pick([45, 55, 70, 90, 90, 100, rint(0, 180)]), stripePitch: rint(56, 150), bandCount: rint(2, 3) }
    if (field === 'tartan') return { sett: pick(SETT_KEYS), settScale: rint(3, 12) }
    return {}
  }
  if (render === 'weave') return { weaveType: pick(['plain', 'twill', 'satin', 'basket']), cols: rint(6, 16), rows: rint(6, 16) }
  // tiles
  const big = chance(0.4)
  return {
    shape: pick(SHAPES), cols: big ? rint(2, 5) : rint(8, 24), rows: big ? rint(2, 5) : rint(8, 24),
    cell: rint(60, 200), gap: rint(-20, 36), stretch: true,
  }
}

function randPattern2(v) {
  const render = v.render || 'tiles'
  if (render === 'field') {
    const field = v.field || 'stripes'
    if (field === 'stripes') return {
      duty: chance(0.5) ? 1 : +rnd(0.1, 0.7).toFixed(2), edgeSoftness: chance(0.6) ? 0 : +rnd(0.1, 1).toFixed(2),
      waveAmp: chance(0.5) ? 0 : +rnd(0.2, 0.6).toFixed(2), waveFreq: +rnd(0.6, 2.6).toFixed(2),
    }
    if (field === 'organic') return {
      waveAmp: +rnd(0.3, 0.8).toFixed(2), waveFreq: +rnd(0.6, 2.6).toFixed(2),
      waveProfile: pick(PROFILE_KEYS.filter((k) => k !== 'custom')), waveCurve: null,
    }
    if (field === 'tartan') return { twill: +rnd(0, 0.3).toFixed(2) }
    return {}
  }
  if (render === 'weave') return { cell: rint(60, 120), strandWidth: +rnd(0.5, 0.85).toFixed(2) }
  // tiles
  return {
    colorRule: pick(['none', 'checker', 'checker', 'cols', 'rows', 'diag']),
    rules: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => randomRule()),
  }
}

const randPattern = (v) => ({ ...randPattern1(v), ...randPattern2(v) })

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

// MOTION — the per-cell (tiles) / per-band (field) / per-crossing (weave) animation.
function randMotion(v) {
  const render = v.render || 'tiles'
  if (render === 'field') {
    // All field families animate PER-BAND (Sway shifts/pulses each band, Stagger
    // phases it across band index). Same model for stripes/organic/tartan.
    return { formPreset: 'custom', fieldSway: +rnd(0, 0.6).toFixed(2), fieldStagger: +rnd(0, 1).toFixed(2), fieldCycles: rint(1, 3) }
  }
  if (render === 'weave') return {
    formPreset: 'custom', animAxis: pick(['none', 'diag', 'col', 'row', 'radial']),
    animCycles: rint(1, 3), animWaves: +rnd(0, 6).toFixed(1),
    pulse: chance(0.5) ? 0 : +rnd(0.2, 0.7).toFixed(2), fade: chance(0.5) ? 0 : +rnd(0.2, 0.6).toFixed(2),
  }
  return {
    formPreset: 'custom', spin: pick([0, 0, 1]), animAxis: pick(['none', 'diag', 'col', 'row', 'radial']),
    animCycles: rint(1, 3), animWaves: +rnd(0, 6).toFixed(1),
    pulse: chance(0.5) ? 0 : +rnd(0.2, 0.8).toFixed(2), fade: chance(0.5) ? 0 : +rnd(0.2, 0.7).toFixed(2),
    swing: chance(0.6) ? 0 : rint(10, 90), colorMix: chance(0.6) ? 0 : +rnd(0.2, 1).toFixed(2),
  }
}

// PROFILE — the organic band-edge silhouette only (a named profile, curve cleared).
function randProfile() {
  return { waveProfile: pick(PROFILE_KEYS.filter((k) => k !== 'custom')), waveCurve: null }
}

// Per-control rerollers (used by the inline reroll buttons in PatternControls).
export const randShape = () => ({ shape: pick(SHAPES) })            // Blocks/tiles — a primitive
export const randWeaveType = () => ({ weaveType: pick(['plain', 'twill', 'satin', 'basket']) }) // Interlace weave

export function randomizeSection(v, section) {
  if (section === 'pattern') return randPattern(v)
  if (section === 'pattern1') return randPattern1(v)
  if (section === 'pattern2') return randPattern2(v)
  if (section === 'frame') return randFrame(v)
  if (section === 'motion') return randMotion(v)
  if (section === 'profile') return randProfile()
  if (section === 'color') return randColor(v)
  return { ...randPattern(v), ...randMotion(v), ...randFrame(v), ...randColor(v) } // 'all'
}
