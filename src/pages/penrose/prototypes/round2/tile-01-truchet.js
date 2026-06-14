

import { num, str } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'tileSize', type: 'range', min: 8, max: 64, default: 24, step: 2, label: 'tile size' },
  { key: 'arcB', type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: 'arc radius' },
  { key: 'drift', type: 'range', min: 0, max: 1, default: 0.3, step: 0.05, label: 'drift speed' },
  { key: 'strokeW', type: 'range', min: 0.5, max: 6, default: 1.5, step: 0.5, label: 'stroke width' },
  { key: 'mode', type: 'select', options: ['arcs', 'diagonal', 'mixed'], default: 'arcs' },
]

export const r2_tile_01_truchet            = {
  id: 'r2-tile-01-truchet',
  name: 'TRUCHET ARC GRID',
  repo: 'Smith 1987 curved Truchet',
  summary: 'N×N grid of quarter-circle arcs randomly rotated per cell; arc-radius parameter drifts per-cell via noise for a slow breathing morphology.',
  helps: 'Fills the glyph with a rhythmic continuous-curve ornament that reads at any scale; SDF-scaled cell resolution thickens detail at interior.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    // Build seeded grid of orientations (0 or 1) and noise offsets
    const tileSize = num(params, 'tileSize', 24)
    const cols = Math.ceil(W / tileSize) + 1
    const rows = Math.ceil(H / tileSize) + 1
    const orientations = new Uint8Array(cols * rows)
    const offsets = new Float32Array(cols * rows)
    for (let i = 0; i < cols * rows; i++) {
      orientations[i] = rng() < 0.5 ? 0 : 1
      offsets[i] = rng() * Math.PI * 2
    }

    function drawArcTile(
      cx        , cy        , s        ,
      orient        , b        ,
      sw        , mode        ,
    ) {
      const r = s * 0.5 * b
      ctx.lineWidth = sw
      if (mode === 'diagonal') {
        ctx.beginPath()
        if (orient === 0) {
          ctx.moveTo(cx - s / 2, cy - s / 2)
          ctx.lineTo(cx + s / 2, cy + s / 2)
        } else {
          ctx.moveTo(cx + s / 2, cy - s / 2)
          ctx.lineTo(cx - s / 2, cy + s / 2)
        }
        ctx.stroke()
        return
      }
      // Two arcs per tile (Smith variant)
      ctx.beginPath()
      if (orient === 0) {
        ctx.arc(cx - s / 2, cy - s / 2, r, 0, Math.PI / 2)
        ctx.moveTo(cx + s / 2 - r, cy + s / 2)
        ctx.arc(cx + s / 2, cy + s / 2, r, Math.PI, Math.PI * 1.5)
      } else {
        ctx.arc(cx + s / 2, cy - s / 2, r, Math.PI / 2, Math.PI)
        ctx.moveTo(cx - s / 2, cy + s / 2 - r)
        ctx.arc(cx - s / 2, cy + s / 2, r, Math.PI * 1.5, Math.PI * 2)
      }
      ctx.stroke()
    }

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const ts = num(params, 'tileSize', 24)
      const baseB = num(params, 'arcB', 0.5)
      const driftSpeed = num(params, 'drift', 0.3)
      const sw = num(params, 'strokeW', 1.5)
      const mode = str(params, 'mode', 'arcs')

      clear(ctx, W, H)
      ctx.strokeStyle = 'rgba(240,225,190,0.75)'

      const cs = Math.ceil(W / ts) + 1
      const rs = Math.ceil(H / ts) + 1

      for (let row = 0; row < rs; row++) {
        for (let col = 0; col < cs; col++) {
          const cx = col * ts + ts / 2
          const cy = row * ts + ts / 2
          // SDF pixel test at cell center
          const sx = cx / W * sdf.w
          const sy = cy / H * sdf.h
          if (sdf.sample(sx, sy) > ts * 0.1) continue

          const idx = (row % rows) * cols + (col % cols)
          const off = offsets[idx % offsets.length]
          const orient = orientations[idx % orientations.length]
          // Per-cell b drift via sin noise
          const b = Math.max(0.3, Math.min(1.0, baseB + 0.2 * Math.sin(t * driftSpeed * 0.7 + off)))

          drawArcTile(cx, cy, ts, orient, b, sw, mode)
        }
      }

      strokeOutline(ctx, sdf, W, H)
    })
  },
}
