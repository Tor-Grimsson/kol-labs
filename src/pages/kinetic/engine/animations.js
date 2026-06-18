// Per-glyph animation — pure functions of u∈[0,1]. Each returns deltas the engine
// layers onto a glyph's base placement on the path:
//   { dLen, dNormal, scale, dRot, opacity, vf }
//   dLen     extra arc-length along the path (march/orbit)
//   dNormal  offset perpendicular to the path (px)
//   scale    multiplier · dRot  extra rotation (deg) · opacity 0..1
//   vf       per-glyph variable-axis overrides, e.g. { wght: 720 }
// All u-dependence is via `u·TAU·cycles` with integer cycles ⇒ frame(0)≡frame(1).

const TAU = Math.PI * 2
const lerp = (a, b, t) => a + (b - a) * t
const IDENTITY = { dLen: 0, dNormal: 0, scale: 1, dRot: 0, opacity: 1, vf: null }

// c = { i, n, u, m (motion params), sizePx, pathLen, axisTag, axisMin, axisMax }
export const MOTIONS = {
  none: () => IDENTITY,

  // Text scrolls along the path. Seamless on closed paths (wraps cleanly).
  march: (c) => ({ ...IDENTITY, dLen: c.u * c.pathLen * Math.max(1, Math.round(c.m.cycles || 1)) }),

  // Text rides a closed path once (or N times) per loop.
  orbit: (c) => ({ ...IDENTITY, dLen: c.u * c.pathLen * Math.max(1, Math.round(c.m.cycles || 1)) }),

  // A variable-axis pulse travels through the word — the headline VF effect.
  vfwave: (c) => {
    const cyc = Math.max(1, Math.round(c.m.cycles || 1))
    const k = 0.5 + 0.5 * Math.sin(c.u * TAU * cyc - c.i * (c.m.phase ?? 0.5))
    return { ...IDENTITY, vf: { [c.axisTag]: lerp(c.axisMin, c.axisMax, k) } }
  },

  // Each glyph rides a travelling sine perpendicular to the path (flag/ripple).
  glyphwave: (c) => {
    const cyc = Math.max(1, Math.round(c.m.cycles || 1))
    const sw = Math.sin(c.u * TAU * cyc - c.i * (c.m.phase ?? 0.5))
    return { ...IDENTITY, dNormal: (c.m.amp ?? 0.3) * c.sizePx * sw }
  },

  // Scale/opacity reveal phased by glyph index (cascade in & out per loop).
  cascade: (c) => {
    const cyc = Math.max(1, Math.round(c.m.cycles || 1))
    const k = 0.5 + 0.5 * Math.sin(c.u * TAU * cyc - c.i * (c.m.phase ?? 0.6))
    return { ...IDENTITY, scale: lerp(0.25, 1, k), opacity: lerp(0.15, 1, k) }
  },
}

export const MOTION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'march', label: 'March' },
  { value: 'orbit', label: 'Orbit' },
  { value: 'vfwave', label: 'VF wave' },
  { value: 'glyphwave', label: 'Glyph wave' },
  { value: 'cascade', label: 'Cascade' },
]

export function glyphAnim(mode, c) {
  return (MOTIONS[mode] || MOTIONS.none)(c)
}
