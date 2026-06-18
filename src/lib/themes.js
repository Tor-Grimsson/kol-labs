// themes — one canonical theme set for the experiment pages (math, loops, 3D
// scene, penrose). Themes are PLAIN JS COLOR VALUES (not CSS vars) because
// WebGL/three pages can't read CSS vars into shaders/materials; DOM/canvas pages
// read the same values directly. `invert` flips light<->dark on top of any theme.
//
// Each theme: { id, label, bg, fg, accent, grid, gridOpacity }
//   bg  — background / clear colour
//   fg  — primary stroke / line / text colour
//   accent — secondary highlight colour
//   grid — axis/grid colour (drawn at gridOpacity)
//
// The first five ids (dark/paper/blueprint/mono/amber) match the legacy
// math `mathStyle` themes so re-exporting from here doesn't change any defaults.

export const THEMES = [
  { id: 'dark',      label: 'Dark',      bg: '#050506', fg: '#9ec1ff', accent: '#9ec1ff', grid: '#ffffff', gridOpacity: 0.10 },
  { id: 'paper',     label: 'Paper',     bg: '#f4f1ea', fg: '#16202e', accent: '#3b5b8a', grid: '#16202e', gridOpacity: 0.14 },
  { id: 'blueprint', label: 'Blueprint', bg: '#0b1d3a', fg: '#8fd3ff', accent: '#8fd3ff', grid: '#8fd3ff', gridOpacity: 0.20 },
  { id: 'mono',      label: 'Mono',      bg: '#0a0a0a', fg: '#ededed', accent: '#ededed', grid: '#ffffff', gridOpacity: 0.08 },
  { id: 'amber',     label: 'Amber',     bg: '#0c0a06', fg: '#ffb35c', accent: '#ffcf8a', grid: '#ffcf8a', gridOpacity: 0.12 },
  { id: 'ink',       label: 'Ink',       bg: '#0a0b14', fg: '#f0ead8', accent: '#8b8fd6', grid: '#f0ead8', gridOpacity: 0.07 },
  { id: 'slate',     label: 'Slate',     bg: '#12161d', fg: '#e7eef5', accent: '#7fb0d8', grid: '#e7eef5', gridOpacity: 0.07 },
  { id: 'plum',      label: 'Plum',      bg: '#120a17', fg: '#f0e6f3', accent: '#c08bd6', grid: '#f0e6f3', gridOpacity: 0.07 },
  { id: 'kol',       label: 'KOL',       bg: '#121215', fg: '#ffcf33', accent: '#ffcf33', grid: '#ffcf33', gridOpacity: 0.10 },
]

export const THEME_OPTIONS = THEMES.map((t) => ({ value: t.id, label: t.label }))

export const DEFAULT_THEME = 'dark'

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

/**
 * Resolve a theme id (+ invert flag) to a concrete colour set. Invert swaps
 * bg<->fg and re-points grid for contrast — its own inverse on the colours, so
 * toggling twice restores the original look.
 */
export function resolveTheme(id, inverted = false) {
  const t = themeById(id)
  if (!inverted) return { ...t }
  return { ...t, bg: t.fg, fg: t.bg, grid: t.bg }
}
