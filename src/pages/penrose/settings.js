// Global artboard settings for Penrose — frame ratios, glyph fonts, and color
// themes. Mirrors the ratio-registry pattern used by pages/layout + pages/video
// so the frame selector reads like the rest of the labs.

import { RATIO_ASPECTS } from '../_shared/exportSpecs.js'

// Frame (artboard) aspect ratios — DERIVED from the single canonical /export-specs
// list (same set/order/labels as every other aspect picker; no parallel copy to
// drift). Just reshapes `value` → `id` + integer `w`/`h`. The square glyph canvas
// is centered inside; for non-1:1 ratios the surround shows the bg + grid.
export const FRAMES = RATIO_ASPECTS.map((a) => {
  const [w, h] = a.value.split(':').map(Number)
  return { id: a.value, label: a.label, w, h }
})

export const frameFor = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0]

// Glyph faces. All are @font-face-loaded by the labs shell, so the rasterizer
// (sdf.js → document.fonts.load) can bake any of them. The full TG type library
// is exposed, plus Right Grotesk + JetBrains Mono.
export const FONTS = [
  { id: 'TG Gullhamrar', label: 'TG Gullhamrar' },
  { id: 'TG Dylgjur', label: 'TG Dylgjur' },
  { id: 'TG Malromur', label: 'TG Malromur' },
  { id: 'TG Ordspor', label: 'TG Ordspor' },
  { id: 'TG Rot', label: 'TG Rot' },
  { id: 'TG Silfurbarki', label: 'TG Silfurbarki' },
  { id: 'TG Trollatunga', label: 'TG Trollatunga' },
  { id: 'Right Grotesk', label: 'Right Grotesk' },
  { id: 'Right Grotesk Text', label: 'Right Grotesk Text' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono' },
]

// Color themes drive the artboard chrome — frame surround, grid overlay, and
// the UI accent — via CSS vars on .penrose-page. (Per-prototype stroke colors
// are baked into each prototype and aren't re-themed here.)
export const THEMES = [
  { id: 'ink',    label: 'Ink',    vars: { bg: '#0a0b14', fg: '#f0ead8', dim: '#4a4d60', accent: '#8b8fd6', warm: '#f3c9c4', grid: 'rgba(240, 234, 216, 0.07)' } },
  { id: 'carbon', label: 'Carbon', vars: { bg: '#070708', fg: '#e8e8ea', dim: '#52525b', accent: '#a1a1aa', warm: '#d4d4d8', grid: 'rgba(232, 232, 234, 0.07)' } },
  { id: 'slate',  label: 'Slate',  vars: { bg: '#12161d', fg: '#e7eef5', dim: '#566273', accent: '#7fb0d8', warm: '#cfe0ee', grid: 'rgba(231, 238, 245, 0.07)' } },
  { id: 'plum',   label: 'Plum',   vars: { bg: '#120a17', fg: '#f0e6f3', dim: '#5e4a66', accent: '#c08bd6', warm: '#f3c9e8', grid: 'rgba(240, 230, 243, 0.07)' } },
]

export const themeFor = (id) => THEMES.find((t) => t.id === id) || THEMES[0]

// Live palette singleton. The active theme writes here (setPalette) so the
// prototype draw helpers (common.js → clear/strokeOutline) retint their
// background + outline globally without editing all 115 prototype files.
// (Bespoke per-stroke hues stay authored in each prototype.)
export const PALETTE = { ...THEMES[0].vars }
export const setPalette = (vars) => Object.assign(PALETTE, vars)

// Live per-role opacity multipliers. The prototypes draw most elements at low
// authored alpha; these scale each role's alpha (1 = as authored) so the Edit
// tab can boost faint elements. Read live by pc() + the tint.
export const OPACITY = { fg: 1, accent: 1, dim: 1, warm: 1 }
export const setOpacity = (o) => Object.assign(OPACITY, o)
