// Global artboard settings for Penrose — frame ratios, glyph fonts, and color
// themes. Mirrors the ratio-registry pattern used by pages/layout + pages/video
// so the frame selector reads like the rest of the labs.

// Frame (artboard) aspect ratios. The square glyph canvas is centered inside;
// for non-1:1 ratios the surround shows the themed background + grid.
export const FRAMES = [
  { id: '1:1', label: '1:1 — square', w: 1, h: 1 },
  { id: '5:4', label: '5:4', w: 5, h: 4 },
  { id: '4:5', label: '4:5 — portrait', w: 4, h: 5 },
  { id: '3:2', label: '3:2', w: 3, h: 2 },
  { id: '5:3', label: '5:3', w: 5, h: 3 },
  { id: '16:9', label: '16:9 — wide', w: 16, h: 9 },
  { id: '9:16', label: '9:16 — story', w: 9, h: 16 },
]

export const frameFor = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0]

// Glyph faces. All are @font-face-loaded by the labs shell, so the rasterizer
// (sdf.js → document.fonts.load) can bake any of them.
export const FONTS = [
  { id: 'TG Gullhamrar', label: 'TG Gullhamrar' },
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
