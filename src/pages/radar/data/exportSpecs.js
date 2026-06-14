/**
 * Output standards for radar still-image exports.
 *
 * The effect is re-rendered at the chosen size rather than the display canvas
 * being scaled — so output is crisp at any standard. `source` = native source
 * resolution (no cap). Sizes are a width cap, matching the engines' own
 * `maxDisplay` semantics (renderDither / renderAscii cap by width).
 */
export const EXPORT_SPECS = [
  { value: 'source', label: 'Source resolution', longEdge: null },
  { value: '1080', label: '1080 px', longEdge: 1080 },
  { value: '1600', label: '1600 px', longEdge: 1600 },
  { value: '2048', label: '2048 px', longEdge: 2048 },
  { value: '4096', label: '4096 px', longEdge: 4096 },
]

// Default keeps parity with the previous 1600-cap display export.
export const DEFAULT_EXPORT_SPEC = '1600'

/** Width cap to render at for a spec value; Infinity => native source res. */
export function maxWidthFor(specValue) {
  const spec = EXPORT_SPECS.find((s) => s.value === specValue)
  return spec?.longEdge ?? Infinity
}
