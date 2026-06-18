import { mulberry32 } from '../../engine/prng.js'
import { PRIMITIVES, PRESETS } from './primitives.js'
import { ARRANGEMENTS } from './composition.js'
import { MATERIAL_TYPES } from './materials.js'

// Seeded scene generator (house model) — a seed → a full, reproducible config
// the page applies to its state. Only the visually impactful knobs are rolled;
// camera / view / audio / keyframes are left as the user set them.

const PRIM_IDS = PRIMITIVES.map((p) => p.id)
const PRESET_IDS = PRESETS.map((p) => p.id)
const ARR_VALS = ARRANGEMENTS.map((a) => a.value).filter((v) => v !== 'single')
const MAT_VALS = MATERIAL_TYPES.map((m) => m.value)

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  const to = (v) => `0${Math.round((v + m) * 255).toString(16)}`.slice(-2)
  return `#${to(r)}${to(g)}${to(b)}`
}

export function randomScene(seed) {
  const r = mulberry32(seed >>> 0)
  const pick = (a) => a[Math.floor(r() * a.length)]
  const count = r() < 0.35 ? 1 : 2 + Math.floor(r() * 7) // 35% single, else 2–8
  return {
    primitive: pick(PRIM_IDS),
    preset: pick(PRESET_IDS),
    arrangement: count === 1 ? 'single' : pick(ARR_VALS),
    count,
    spread: 1.6 + r() * 2.4,
    objectSize: count === 1 ? 1 : 0.5 + r() * 0.5,
    stagger: r(),
    color: hslToHex(Math.floor(r() * 360), 0.35 + r() * 0.4, 0.45 + r() * 0.2),
    materialType: r() < 0.6 ? 'standard' : pick(MAT_VALS),
    roughness: 0.15 + r() * 0.6,
    metalness: r() * 0.7,
    flatShading: r() < 0.3,
  }
}
