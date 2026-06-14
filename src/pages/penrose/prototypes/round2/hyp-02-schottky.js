

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Schottky IFS limit set.
// Two generator pairs (C1,C1') and (C2,C2'): Möbius maps sending exterior of Ci → interior of Ci'.
// IIS rendering: each pixel is repeatedly inverted through whichever generator circle it falls
// outside, coloring by inversion count. Limit set is the fractal boundary.

const PARAMS          = [
  { key: 'sep', type: 'range', min: 0.1, max: 0.9, default: 0.55, step: 0.01, label: 'circle sep' },
  { key: 'radius', type: 'range', min: 0.1, max: 0.45, default: 0.28, step: 0.01, label: 'gen radius' },
  { key: 'iters', type: 'int', min: 10, max: 120, default: 60, label: 'IIS depth' },
  { key: 'drift', type: 'range', min: 0, max: 1, default: 0.18, step: 0.01, label: 'drift speed' },
  { key: 'phase', type: 'range', min: 0, max: 1, default: 0.0, step: 0.01, label: 'phase offset' },
]

function invertCircle(zx        , zy        , cx        , cy        , r        ) {
  const dx = zx - cx, dy = zy - cy
  const d2 = dx * dx + dy * dy
  if (d2 < 1e-14) return [cx, cy]
  const s = r * r / d2
  return [cx + dx * s, cy + dy * s]
}

const PALETTE = [
  [20, 30, 80],
  [60, 120, 200],
  [140, 200, 255],
  [220, 180, 120],
  [255, 120, 60],
  [200, 60, 100],
  [120, 40, 160],
  [40, 120, 80],
]

export const r2_hyp_02_schottky            = {
  id: 'r2-hyp-02-schottky',
  name: 'SCHOTTKY LIMIT SET',
  repo: "Kleinian groups · IIS · Indra's Pearls",
  summary:
    'Fractal limit set of a Schottky group: two pairs of inversive circles generate a Möbius group whose accumulation set is a fractal curve or dust. Generator positions animate continuously.',
  helps: 'Dense fractal fill that follows stroke geometry — place generator circles on glyph axes.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const sep = num(params, 'sep', 0.55)
      const rad = num(params, 'radius', 0.28)
      const iters = Math.round(num(params, 'iters', 60))
      const drift = num(params, 'drift', 0.18)
      const phase = num(params, 'phase', 0.0)

      // Animate generator positions: slowly oscillate separation + slight rotation
      const angle = t * drift * 0.4 + phase * Math.PI * 2
      const wobble = 0.04 * Math.sin(t * drift * 0.7)

      // Four generator circles: (±sep, 0) and (0, ±sep) with wobble
      const circles                             = [
        [ sep + wobble, Math.sin(angle) * 0.06, rad],
        [-sep - wobble, -Math.sin(angle) * 0.06, rad],
        [Math.cos(angle) * 0.06,  sep + wobble * 0.5, rad * 0.95],
        [-Math.cos(angle) * 0.06, -sep - wobble * 0.5, rad * 0.95],
      ]

      clear(ctx, W, H)

      const idata = ctx.createImageData(W, H)
      const d = idata.data

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          if (sdf.sample(px / sx, py / sy) >= 0) continue

          let zx = (px / W) * 2 - 1
          let zy = (py / H) * 2 - 1

          let depth = 0
          let lastCircle = -1

          for (let i = 0; i < iters; i++) {
            let moved = false
            for (let ci = 0; ci < circles.length; ci++) {
              if (ci === lastCircle) continue
              const [cx, cy, r] = circles[ci]
              const dx = zx - cx, dy = zy - cy
              if (dx * dx + dy * dy < r * r) {
                // Invert through paired circle (ci^1 = partner)
                const partner = ci % 2 === 0 ? ci + 1 : ci - 1
                const [pcx, pcy, pr] = circles[partner]
                ;[zx, zy] = invertCircle(zx, zy, pcx, pcy, pr)
                depth++
                lastCircle = partner
                moved = true
                break
              }
            }
            if (!moved) break
          }

          if (depth === 0) continue

          const col = PALETTE[depth % PALETTE.length]
          const fade = Math.min(1, depth / 12)
          const idx = (py * W + px) * 4
          d[idx]     = col[0] * fade
          d[idx + 1] = col[1] * fade
          d[idx + 2] = col[2] * fade
          d[idx + 3] = 200
        }
      }

      ctx.putImageData(idata, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
