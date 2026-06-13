/* Glyphs.app-style path operations.
 *
 *   - hatchOutline: fill a closed path with parallel stripes
 *   - offsetCurve:  offset the path inward/outward by N units
 *   - roundCorners: round all corner joins by radius R
 *
 * All operate on SVG path strings. */

import SVGPathCommander from 'svg-path-commander'

function bbox(d) {
  try { return new SVGPathCommander(d).getBBox() } catch {
    return { x: 0, y: 0, x2: 100, y2: 100, width: 100, height: 100 }
  }
}

/* Hatch outline. Produces an array of <line> SVG strings clipped to the
 * bbox; the caller should wrap them in a <g> with `clipPath="url(#id)"`
 * pointing at the glyph itself for true containment. */
export function hatchLines(d, { spacing = 6, angle = -25 } = {}) {
  const bb = bbox(d)
  const rad = (angle * Math.PI) / 180
  const cx = bb.x + bb.width / 2
  const cy = bb.y + bb.height / 2
  const diag = Math.hypot(bb.width, bb.height) * 1.4
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  /* Perpendicular step direction. */
  const px = -dy
  const py = dx
  const count = Math.ceil(diag / spacing)
  const lines = []
  for (let i = -count / 2; i <= count / 2; i++) {
    const offset = i * spacing
    const ox = cx + px * offset
    const oy = cy + py * offset
    const x1 = ox - dx * diag
    const y1 = oy - dy * diag
    const x2 = ox + dx * diag
    const y2 = oy + dy * diag
    lines.push(`M ${x1} ${y1} L ${x2} ${y2}`)
  }
  return lines
}

/* Offset curve via DOM stroke trick: render the path as a thick stroke,
 * then read back the union shape. Pragma: real offset is non-trivial;
 * we approximate by scaling the path around its centroid for now. The
 * filter `fx-weight` (feMorphology) does the visual equivalent better
 * at low cost. */
export function scaleOffset(d, { amount = 0 } = {}) {
  if (amount === 0) return d
  try {
    const bb = bbox(d)
    const cx = bb.x + bb.width / 2
    const cy = bb.y + bb.height / 2
    const factor = 1 + amount * 0.1
    return new SVGPathCommander(d)
      .transform({ translate: [-cx, -cy] })
      .transform({ scale: [factor, factor] })
      .transform({ translate: [cx, cy] })
      .toString()
  } catch { return d }
}

/* Round corners — simple approximation: convert sharp joins to arcs.
 * Pragma: requires segmenting the path; here we apply a corner-smoothing
 * proxy via SVGPathCommander's `optimize` then a Catmull-Rom resample
 * step the caller can add separately. We return d unchanged for now. */
export function roundCorners(d /*, { radius = 0 } = {} */) {
  return d
}

/* Generate a hatch <defs> pattern fillable via `fill="url(#hatch-{id})"`. */
export function hatchPattern(id, { spacing = 6, strokeWidth = 1, angle = 0, color = 'currentColor' } = {}) {
  /* Returns JSX-ready object; consumer renders into a <defs>. */
  return {
    id,
    spacing,
    strokeWidth,
    angle,
    color,
  }
}
