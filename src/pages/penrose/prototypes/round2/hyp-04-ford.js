

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Ford Circles / Farey Tessellation.
// Ford circle for p/q (in lowest terms): center (p/q, 1/(2q²)), radius 1/(2q²).
// Generated via Stern-Brocot tree BFS. Mapped from upper half-plane to Poincaré disk
// via z → (z - i)/(z + i). Animated by parabolic shift along real axis.

const PARAMS          = [
  { key: 'depth', type: 'int', min: 3, max: 9, default: 6, label: 'tree depth' },
  { key: 'drift', type: 'range', min: 0, max: 2, default: 0.3, step: 0.02, label: 'parabolic drift' },
  { key: 'minR', type: 'range', min: 0.001, max: 0.02, default: 0.004, step: 0.001, label: 'min circle r' },
  { key: 'stroke', type: 'range', min: 0.3, max: 2.5, default: 1.0, step: 0.1, label: 'stroke width' },
]

// GCD for canonicalization (Euclidean)
function gcd(a        , b        )         { return b === 0 ? a : gcd(b, a % b) }

// Möbius transform z → (z - i)/(z + i) mapping UHP → disk
// z = (x, y) complex: result = ((x + (y-1)*i)) / (x + (y+1)*i) ... let me do it properly
function uhpToDisk(x        , y        )                   {
  // (z - i)/(z + i) where z = x+iy
  const num_re = x, num_im = y - 1
  const den_re = x, den_im = y + 1
  const d = den_re * den_re + den_im * den_im
  return [
    (num_re * den_re + num_im * den_im) / d,
    (num_im * den_re - num_re * den_im) / d,
  ]
}



export const r2_hyp_04_ford            = {
  id: 'r2-hyp-04-ford',
  name: 'FORD CIRCLES / FAREY',
  repo: 'Stern-Brocot · Ford circles · Farey tessellation',
  summary:
    'Ford circles (horocycles above each rational p/q) mapped into the Poincaré disk via Möbius. Stern-Brocot tree drives hierarchical subdivision; parabolic drift animates the whole packing.',
  helps: 'Hierarchical nested circles with natural zoom-in structure — ideal for closed glyph counters.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const depth = Math.round(num(params, 'depth', 6))
      const drift = num(params, 'drift', 0.3)
      const minRad = num(params, 'minR', 0.004)
      const strokeW = num(params, 'stroke', 1.0)

      // Parabolic shift: translate real axis by t*drift
      const shift = t * drift * 0.5

      // Generate Ford circles via Stern-Brocot tree BFS
      // Fraction stored as [p, q] (numerator, denominator)
      const circles               = []

      // Stack: [left_p, left_q, right_p, right_q, current_depth]

      const stack          = [[0, 1, 1, 1, 0]]

      // Also add the boundary circles for 0/1 and 1/1
      circles.push({ px: 0, py: 0.5, r: 0.5, depth: 0 })
      circles.push({ px: 1, py: 0.5, r: 0.5, depth: 0 })

      while (stack.length > 0) {
        const [lp, lq, rp, rq, d] = stack.pop()
        if (d >= depth) continue

        // Mediant
        const mp = lp + rp, mq = lq + rq
        const g = gcd(mp, mq)
        const cp = mp / g, cq = mq / g

        const r = 1 / (2 * cq * cq)
        const cx = cp / cq
        const cy = r  // Ford circle: center at (p/q, 1/(2q²)), radius 1/(2q²)

        if (r >= minRad) {
          circles.push({ px: cx, py: cy, r, depth: d })
          stack.push([lp, lq, cp, cq, d + 1])
          stack.push([cp, cq, rp, rq, d + 1])
        }
      }

      clear(ctx, W, H)

      // Clip to SDF
      ctx.save()
      // Build clip path from SDF outline
      ctx.beginPath()
      let first = true
      for (let y = 0; y < sdf.h; y += 2) {
        for (let x = 0; x < sdf.w; x++) {
          if (sdf.sample(x, y) < 0) {
            if (first) { ctx.moveTo(x * sx, y * sy); first = false }
            else ctx.lineTo(x * sx, y * sy)
          }
        }
      }
      ctx.clip()

      // Draw mapped circles
      for (const fc of circles) {
        // Apply parabolic shift in UHP: z → z + shift
        const shiftedX = fc.px + shift

        // Map center and two edge points to disk, compute disk circle from UHP circle
        // For Ford circle in UHP, top and bottom map differently — approximate by mapping center
        // and a radial point, then computing disk circle radius
        const [dcx, dcy] = uhpToDisk(shiftedX, fc.py)
        const [dpx, _] = uhpToDisk(shiftedX + fc.r * 0.5, fc.py)

        // Skip circles outside the disk
        if (dcx * dcx + dcy * dcy > 1.1) continue

        // Estimate disk radius from mapped edge points
        const dr = Math.hypot(dpx - dcx, _ - dcy) * 2

        if (dr < 1.5 / W) continue // too small to draw

        // Map disk coords [-1,1] to canvas
        const canX = (dcx + 1) * 0.5 * W
        const canY = (dcy + 1) * 0.5 * H
        const canR = dr * 0.5 * W

        const hue = (fc.depth / depth + t * 0.04) % 1
        const r2 = Math.sin(hue * Math.PI * 2) * 0.4 + 0.6
        const g2 = Math.sin(hue * Math.PI * 2 + 2.094) * 0.4 + 0.6
        const b2 = Math.sin(hue * Math.PI * 2 + 4.189) * 0.4 + 0.6
        const alpha = Math.max(0.1, 1 - fc.depth / (depth + 2))

        ctx.strokeStyle = `rgba(${r2 * 255 | 0},${g2 * 255 | 0},${b2 * 255 | 0},${alpha})`
        ctx.lineWidth = strokeW
        ctx.beginPath()
        ctx.arc(canX, canY, canR, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.restore()
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
