

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Poincaré disk {p,q} tiling via escape-time coset reduction.
// Geodesic reflection: invert point across each of three Schwarz-triangle mirror circles.
// Each pixel gets classified to a fundamental domain coset; coset index → palette.

const PARAMS          = [
  { key: 'p', type: 'int', min: 3, max: 8, default: 5, label: 'tile sides p' },
  { key: 'q', type: 'int', min: 3, max: 8, default: 4, label: 'vertex order q' },
  { key: 'depth', type: 'int', min: 4, max: 60, default: 28, label: 'iterations' },
  { key: 'rot', type: 'range', min: 0, max: 1, default: 0.12, step: 0.01, label: 'rot speed' },
  { key: 'bright', type: 'range', min: 0.2, max: 1.0, default: 0.7, step: 0.05, label: 'brightness' },
]

// Complex number helpers (inline for speed)
function cAdd(ax        , ay        , bx        , by        ) { return [ax + bx, ay + by] }
function cMul(ax        , ay        , bx        , by        ) { return [ax * bx - ay * by, ax * by + ay * bx] }
function cDiv(ax        , ay        , bx        , by        ) {
  const d = bx * bx + by * by
  return [(ax * bx + ay * by) / d, (ay * bx - ax * by) / d]
}
// Inversion of point z across circle (cx,cy,r)
function invertCircle(zx        , zy        , cx        , cy        , r        ) {
  const dx = zx - cx, dy = zy - cy
  const d2 = dx * dx + dy * dy
  if (d2 < 1e-14) return [cx, cy]
  const s = r * r / d2
  return [cx + dx * s, cy + dy * s]
}
// Möbius rotation of disk: z -> e^{it}*z
function diskRot(zx        , zy        , t        ) {
  const c = Math.cos(t), s = Math.sin(t)
  return [c * zx - s * zy, c * zy + s * zx]
}

export const r2_hyp_01_pqr_tiling            = {
  id: 'r2-hyp-01-pqr-tiling',
  name: 'HYPERBOLIC {p,q} TILING',
  repo: 'Poincaré disk · Wythoff · Schwarz triangle',
  summary:
    'Regular hyperbolic {p,q} tiling via escape-time coset reduction in the Poincaré disk. Tiles shrink exponentially toward the boundary, flooding the glyph edge with fractal detail.',
  helps: 'Cross-scale detail — tile density naturally explodes toward the glyph silhouette.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    // Build Schwarz triangle mirrors for (π/p, π/q, π/2) triangle
    // Following Bulatov's construction: mirrors are geodesic arcs on Poincaré disk
    function buildMirrors(p        , q        ) {
      // Vertex angles of fundamental Schwarz triangle: π/p, π/q, π/2
      const ang_p = Math.PI / p
      const ang_q = Math.PI / q
      // Distance from center to p-vertex (hyperbolic)
      const cp = Math.cos(ang_p), cq = Math.cos(ang_q)
      const sp = Math.sin(ang_p), sq = Math.sin(ang_q)
      // r = distance from origin to vertex along x-axis (Euclidean in Poincaré disk)
      const r_p = Math.sqrt((cq * cq - sp * sp) / (1 - sp * sp * sq * sq)) // simplified
      // Three mirror circles of the Schwarz triangle:
      // M0: real axis (y=0), M1: through p-vertex, M2: circle arc
      // Use Coxeter-Schwarz approach: three geodesics forming the (π/p,π/q,π/2) triangle
      // Mirror 0: y=0 line (geodesic = x-axis). Encoded as huge circle centered at (0,1e9,0).
      // Mirror 1: circle orthogonal to unit circle, cutting at angle π/p from center
      // Mirror 2: circle orthogonal to unit circle, cutting at angle π/q
      const cos2p = Math.cos(2 * ang_p), cos2q = Math.cos(2 * ang_q)
      // Center of mirror circle 1 (on x-axis), radius computed so it's orthogonal to ∂D
      const c1x = 1 / Math.cos(ang_p)
      const r1 = Math.tan(ang_p)
      // Approximate c2 by reflection: center on y-axis
      const c2y = 1 / Math.cos(ang_q)
      const r2c = Math.tan(ang_q)
      return { c1x, r1, c2y, r2: r2c }
    }

    // Palette: 6 hues cycling
    const HUE = [
      [0.55, 0.75, 1.0],
      [1.0, 0.65, 0.3],
      [0.3, 1.0, 0.6],
      [1.0, 0.3, 0.5],
      [0.9, 0.9, 0.2],
      [0.5, 0.3, 1.0],
    ]

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const p = Math.max(3, Math.round(num(params, 'p', 5)))
      const q = Math.max(3, Math.round(num(params, 'q', 4)))
      const depth = Math.round(num(params, 'depth', 28))
      const rotSpd = num(params, 'rot', 0.12)
      const bright = num(params, 'bright', 0.7)

      // Only rebuild mirrors if p/q changed (cheap enough to rebuild each frame here)
      const { c1x, r1, c2y, r2: r2c } = buildMirrors(p, q)
      const rotAngle = t * rotSpd * Math.PI * 2

      clear(ctx, W, H)

      const idata = ctx.createImageData(W, H)
      const d = idata.data

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          // SDF clip
          const sx2 = px / sx, sy2 = py / sy
          if (sdf.sample(sx2, sy2) >= 0) continue

          // Map pixel to Poincaré disk [-1,1]²
          // Fit disk to glyph bounding box
          let zx = (px / W) * 2 - 1
          let zy = (py / H) * 2 - 1
          const r2 = zx * zx + zy * zy
          if (r2 >= 0.98) continue

          // Apply disk rotation
          ;[zx, zy] = diskRot(zx, zy, rotAngle)

          // Escape-time coset reduction: apply reflections across Schwarz triangle mirrors
          let coset = 0
          let lastMirror = -1
          for (let iter = 0; iter < depth; iter++) {
            // Mirror 0: y=0 reflection (if zy<0, flip)
            if (zy < 0 && lastMirror !== 0) { zy = -zy; coset ^= 1; lastMirror = 0; continue }
            // Mirror 1: inversion across circle (c1x, 0, r1)
            const d1x = zx - c1x, d1y = zy
            if (d1x * d1x + d1y * d1y < r1 * r1 && lastMirror !== 1) {
              ;[zx, zy] = invertCircle(zx, zy, c1x, 0, r1)
              coset = (coset + 2) % 6; lastMirror = 1; continue
            }
            // Mirror 2: inversion across circle (0, c2y, r2c)
            const d2x = zx, d2y = zy - c2y
            if (d2x * d2x + d2y * d2y < r2c * r2c && lastMirror !== 2) {
              ;[zx, zy] = invertCircle(zx, zy, 0, c2y, r2c)
              coset = (coset + 4) % 6; lastMirror = 2; continue
            }
            break
          }

          const col = HUE[coset % HUE.length]
          // Fade by distance to disk boundary
          const rr = zx * zx + zy * zy
          const fade = bright * (1 - rr * 0.5)
          const idx = (py * W + px) * 4
          d[idx]     = col[0] * fade * 220
          d[idx + 1] = col[1] * fade * 200
          d[idx + 2] = col[2] * fade * 255
          d[idx + 3] = 255
        }
      }

      ctx.putImageData(idata, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
