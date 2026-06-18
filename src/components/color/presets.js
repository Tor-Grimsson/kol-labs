import { THEMES } from '../../lib/themes'
import { clampHex } from './hsv'

// Default swatch palette for the picker. kol-labs has no brand ramps (only a
// grey ramp), so — unlike the reference's brand pool — we seed the swatches
// from every theme's bg/fg/accent in `lib/themes.js`, plus pure white/black.
// Gives every ColorField a useful palette without each call site threading a
// theme in. Pass an explicit `presets` to override.
export const DEFAULT_PRESETS = (() => {
  const out = []
  const seen = new Set()
  const push = (c) => {
    const k = clampHex(c)
    if (!seen.has(k)) { seen.add(k); out.push(k) }
  }
  for (const t of THEMES) { push(t.bg); push(t.fg); push(t.accent) }
  push('#FFFFFF')
  push('#000000')
  return out
})()
