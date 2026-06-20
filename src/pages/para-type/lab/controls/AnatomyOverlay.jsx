/* AnatomyOverlay — labels for x-height / cap-height / ascender / baseline
 * etc., drawn over the big-specimen glyph. Toggleable. Inspired by
 * Metaflop's anatomy overlay. */

export default function AnatomyOverlay({ params, totalW, baselineY, visible }) {
  if (!visible) return null
  const labelStyle = { font: '8px ui-monospace, monospace', fill: 'currentColor' }
  const lineStyle = { stroke: 'currentColor', strokeWidth: 0.4, strokeDasharray: '2 3', opacity: 0.6 }
  const lines = [
    { label: 'asc',   y: baselineY - params.ascender },
    { label: 'cap',   y: baselineY - params.capHeight },
    { label: 'x',     y: baselineY - params.xHeight },
    { label: 'base',  y: baselineY },
    { label: 'desc',  y: baselineY + params.descender },
  ]
  return (
    <g pointerEvents="none">
      {lines.map((l, i) => (
        <g key={i}>
          <line x1="0" y1={l.y} x2={totalW} y2={l.y} style={lineStyle} />
          <text x="4" y={l.y - 2} style={labelStyle}>{l.label}</text>
        </g>
      ))}
    </g>
  )
}
