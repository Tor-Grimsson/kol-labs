import { useState } from 'react'

// Shared style model for the math visualisers: background, stroke/foreground,
// weight, and a reference-axis system, plus one-click themes. Each page threads
// these into its engine; complex (whose colours ARE the data) uses only axis.

export const AXIS_3D = [
  { value: 'none', label: 'None' },
  { value: 'axes', label: 'Axes' },
  { value: 'grid', label: 'Grid' },
  { value: 'box', label: 'Box' },
]
export const AXIS_2D = [
  { value: 'none', label: 'None' },
  { value: 'axes', label: 'Axes' },
  { value: 'grid', label: 'Grid' },
]

// Theme = bg + stroke + grid colour/opacity in one click (axis type + weight stay
// independent user choices).
export const THEMES = [
  { id: 'dark', label: 'Dark', bg: '#050506', stroke: '#9ec1ff', gridColor: '#ffffff', gridOpacity: 0.10 },
  { id: 'paper', label: 'Paper', bg: '#f4f1ea', stroke: '#16202e', gridColor: '#16202e', gridOpacity: 0.14 },
  { id: 'blueprint', label: 'Blueprint', bg: '#0b1d3a', stroke: '#8fd3ff', gridColor: '#8fd3ff', gridOpacity: 0.20 },
  { id: 'mono', label: 'Mono', bg: '#0a0a0a', stroke: '#ededed', gridColor: '#ffffff', gridOpacity: 0.08 },
  { id: 'amber', label: 'Amber', bg: '#0c0a06', stroke: '#ffb35c', gridColor: '#ffcf8a', gridOpacity: 0.12 },
]

export const DEFAULT_STYLE = {
  bg: '#050506',
  stroke: '#9ec1ff',
  weight: 1.2,
  axis: 'none',
  plane: 'xz', // grid plane for 3D pages ('xz' floor, 'xy' wall)
  gridColor: '#ffffff',
  gridOpacity: 0.10,
}

// '#rrggbb' -> 'r,g,b' for rgba() strings.
export function hexToRgb(hex) {
  const s = (hex || '#000000').replace('#', '')
  const r = parseInt(s.slice(0, 2), 16) || 0
  const g = parseInt(s.slice(2, 4), 16) || 0
  const b = parseInt(s.slice(4, 6), 16) || 0
  return `${r},${g},${b}`
}

// Page-level style state + helpers. `overrides` seed per-page defaults (e.g. a
// page's natural stroke colour).
export function useMathStyle(overrides) {
  const [style, setStyle] = useState({ ...DEFAULT_STYLE, ...overrides })
  const patch = (p) => setStyle((s) => ({ ...s, ...p }))
  const applyTheme = (id) => {
    const t = THEMES.find((x) => x.id === id)
    if (t) setStyle((s) => ({ ...s, bg: t.bg, stroke: t.stroke, gridColor: t.gridColor, gridOpacity: t.gridOpacity }))
  }
  return [style, patch, applyTheme]
}
