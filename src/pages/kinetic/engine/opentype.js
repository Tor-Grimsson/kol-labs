// OpenType feature toggles for a type instance. Rendered as a CSS
// `font-feature-settings` string on the per-glyph <text> elements (and the
// measure node, so advances reflect the active features). Per-instance (Edit tab).

export const OPENTYPE_FEATURES = [
  { tag: 'liga', label: 'Ligatures' },
  { tag: 'dlig', label: 'Discretionary ligatures' },
  { tag: 'smcp', label: 'Small caps' },
  { tag: 'case', label: 'Case-sensitive forms' },
  { tag: 'onum', label: 'Oldstyle figures' },
  { tag: 'tnum', label: 'Tabular figures' },
  { tag: 'frac', label: 'Fractions' },
  { tag: 'swsh', label: 'Swashes' },
  { tag: 'ss01', label: 'Stylistic set 1' },
  { tag: 'ss02', label: 'Stylistic set 2' },
]

// { liga: true, smcp: false } → `"liga" 1, "smcp" 0`. Empty → 'normal'.
export function featureString(ot) {
  if (!ot) return 'normal'
  const parts = []
  for (const [tag, on] of Object.entries(ot)) parts.push(`"${tag}" ${on ? 1 : 0}`)
  return parts.length ? parts.join(', ') : 'normal'
}
