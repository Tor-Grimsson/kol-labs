/**
 * Export output model — the /export-specs skill: a target ASPECT × @Nx scale,
 * short side 1080 @1x (so @2x = 2160, @3x = 3240 on the short edge). The effect
 * is re-rendered into the target frame (crisp at any size); the source is
 * cropped (cover) or letterboxed (fit) to it. 'source' keeps the source's own
 * aspect at native resolution (scale/fit ignored).
 */
export const ASPECT_SPECS = [
  { value: 'source', label: 'Source', ratio: null },
  { value: '9:16', label: '9:16 · story', ratio: 9 / 16 },
  { value: '4:5', label: '4:5 · portrait', ratio: 4 / 5 },
  { value: '2:3', label: '2:3 · photo', ratio: 2 / 3 },
  { value: '1:1', label: '1:1 · square', ratio: 1 },
  { value: '5:4', label: '5:4', ratio: 5 / 4 },
  { value: '3:2', label: '3:2 · photo', ratio: 3 / 2 },
  { value: '16:9', label: '16:9 · wide', ratio: 16 / 9 },
]
export const DEFAULT_ASPECT = 'source'

// @Nx scale — short side = 1080 × N. String values so the Dropdown round-trips
// cleanly; Number() at the call site.
export const SCALE_OPTIONS = [
  { value: '1', label: '@1x · 1080' },
  { value: '2', label: '@2x · 2160' },
  { value: '3', label: '@3x · 3240' },
]
export const DEFAULT_SCALE = '2'

export const FIT_OPTIONS = [
  { value: 'cover', label: 'Cover (crop)' },
  { value: 'fit', label: 'Fit (letterbox)' },
]

const even = (n) => Math.max(2, Math.round(n / 2) * 2) // encoders want even dims

/**
 * Target pixel dims for an aspect value + @Nx scale (short side = 1080 × N).
 * Returns null for 'source' (caller uses native resolution).
 */
export function dimsFor(aspectValue, scale = 1) {
  const spec = ASPECT_SPECS.find((a) => a.value === aspectValue)
  if (!spec || spec.ratio == null) return null
  const short = 1080 * scale
  const r = spec.ratio // width / height
  return r >= 1
    ? { w: even(short * r), h: even(short) }  // landscape → short is the height
    : { w: even(short), h: even(short / r) }  // portrait  → short is the width
}
