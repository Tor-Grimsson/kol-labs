// Shared export-spec model — the /export-specs skill: a target ASPECT × @Nx
// scale, short side 1080 @1x (so @2x = 2160, @3x = 3240 on the short edge). One
// canonical source for every page that exports a framed image/video: the math
// views, the 3D/primitive scenes, and the radar raster effects.
//
// The seven ratio rows are identical everywhere; only the first "native" row
// differs by surface — math/3D call it "Fill" (fills the stage at native res),
// radar calls it "Source" (keeps the source's own aspect). Both mean ratio:null,
// scale ignored. Pick the matching alias below.
//
// (Replaces the three byte-identical copies that used to live under
//  math/data, radar/data and gradient/primitive/data.)

// The 7 ratio aspects — shared by every surface.
export const RATIO_ASPECTS = [
  { value: '9:16', label: '9:16 · story', ratio: 9 / 16 },
  { value: '4:5', label: '4:5 · portrait', ratio: 4 / 5 },
  { value: '2:3', label: '2:3 · photo', ratio: 2 / 3 },
  { value: '1:1', label: '1:1 · square', ratio: 1 },
  { value: '5:4', label: '5:4', ratio: 5 / 4 },
  { value: '3:2', label: '3:2 · photo', ratio: 3 / 2 },
  { value: '16:9', label: '16:9 · wide', ratio: 16 / 9 },
]

const withNative = (label, value) => [{ value, label, ratio: null }, ...RATIO_ASPECTS]

// Surface aliases — same 7 ratios, different native row + default.
export const VIEW_ASPECTS = withNative('Fill', 'fill') // math + 3D/primitive
export const DEFAULT_ASPECT = 'fill'
export const ASPECT_SPECS = withNative('Source', 'source') // radar raster
export const SOURCE_DEFAULT = 'source'

// @Nx scale — short side = 1080 × N. String values so the Dropdown round-trips
// cleanly; Number() at the call site.
export const SCALE_OPTIONS = [
  { value: '1', label: '@1x · 1080' },
  { value: '2', label: '@2x · 2160' },
  { value: '3', label: '@3x · 3240' },
]
export const DEFAULT_SCALE = '2'

// Radar raster only — how the source maps into a non-native frame.
export const FIT_OPTIONS = [
  { value: 'cover', label: 'Cover (crop)' },
  { value: 'fit', label: 'Fit (letterbox)' },
]

const RATIO_BY_VALUE = Object.fromEntries(RATIO_ASPECTS.map((a) => [a.value, a.ratio]))
const even = (n) => Math.max(2, Math.round(n / 2) * 2) // encoders want even dims

// On-screen frame aspect (width / height), or null for the native row.
export function ratioFor(aspectValue) {
  return RATIO_BY_VALUE[aspectValue] ?? null
}

// Target pixel dims for an aspect + @Nx scale (short side = 1080 × N). Returns
// null for a native row (caller exports the canvas/source at its native size).
export function dimsFor(aspectValue, scale = 1) {
  const r = ratioFor(aspectValue)
  if (r == null) return null
  const short = 1080 * scale
  return r >= 1
    ? { w: even(short * r), h: even(short) } // landscape → short is the height
    : { w: even(short), h: even(short / r) } // portrait  → short is the width
}
