

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Torus knot T(p,q) — parametric curve on a torus surface, depth-sorted and
// rendered with over/under gap rendering as it rotates.
// Ref: Wolfram MathWorld — Torus Knot; blackpawn.com PQ-Torus

const PARAMS          = [
  { key: 'p', type: 'int', min: 2, max: 7, default: 3, label: 'winding p' },
  { key: 'q', type: 'int', min: 2, max: 7, default: 2, label: 'winding q' },
  { key: 'spin', type: 'range', min: 0, max: 2, default: 0.35, step: 0.05, label: 'spin speed' },
  { key: 'samples', type: 'int', min: 300, max: 2000, default: 900, step: 100, label: 'samples' },
  { key: 'R', type: 'range', min: 0.5, max: 2.5, default: 1.6, step: 0.1, label: 'major radius' },
  { key: 'r', type: 'range', min: 0.1, max: 1.2, default: 0.6, step: 0.05, label: 'minor radius' },
]

// 3D rotation around Y then X axes given angles
function rotYX(x        , y        , z        , ry        , rx        )                           {
  // rotate around Y
  const cx1 = Math.cos(ry), sx1 = Math.sin(ry)
  const x1 = cx1 * x + sx1 * z
  const z1 = -sx1 * x + cx1 * z
  // rotate around X
  const cx2 = Math.cos(rx), sx2 = Math.sin(rx)
  const y2 = cx2 * y - sx2 * z1
  const z2 = sx2 * y + cx2 * z1
  return [x1, y2, z2]
}

export const r2_topo_01_torusknot            = {
  id: 'r2-topo-01-torusknot',
  name: 'TORUS KNOT (p,q)',
  repo: 'Rolfsen · Knots and Links · blackpawn.com/texts/pqtorus',
  summary: 'Torus knot T(p,q) sampled as a parametric curve, rotated in 3D each frame, projected perspective; depth-sorted segments with over/under gap rendering.',
  helps: '3D-projected knot rolling inside the glyph — textbook "almost 3D" motion, crossing gaps read as woven depth.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const SC = Math.min(W, H) * 0.28
    const OX = W * 0.5, OY = H * 0.5
    const D = 4.5 // perspective camera distance

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const p = num(params, 'p', 3)
      const q = num(params, 'q', 2)
      const spin = num(params, 'spin', 0.35)
      const N = num(params, 'samples', 900)
      const R = num(params, 'R', 1.6)
      const r = num(params, 'r', 0.6)

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const ry = t * spin
      const rx = t * spin * 0.37

      // Build point array

      const segs        = []

      let prevX = 0, prevY = 0, prevZ = 0, prevPX = 0, prevPY = 0
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * Math.PI * 2
        const lx = (R + r * Math.cos(q * u)) * Math.cos(p * u)
        const ly = (R + r * Math.cos(q * u)) * Math.sin(p * u)
        const lz = r * Math.sin(q * u)
        const [rx3, ry3, rz3] = rotYX(lx, ly, lz, ry, rx)
        const w = 1 / (D - rz3)
        const px = OX + rx3 * SC * w
        const py = OY + ry3 * SC * w
        if (i > 0) {
          const zMid = (prevZ + rz3) * 0.5
          const depth = (zMid + r + R) / (2 * (r + R))
          const alpha = 0.35 + depth * 0.6
          const width = 0.6 + depth * 1.8
          segs.push({ x0: prevPX, y0: prevPY, x1: px, y1: py, z: zMid, alpha, width })
        }
        prevX = lx; prevY = ly; prevZ = rz3
        prevPX = px; prevPY = py
      }

      // Depth sort back-to-front
      segs.sort((a, b) => a.z - b.z)

      // Draw with SDF clip
      for (const s of segs) {
        const mx = (s.x0 + s.x1) * 0.5
        const my = (s.y0 + s.y1) * 0.5
        const sx = mx / W * sdf.w, sy = my / H * sdf.h
        if (sdf.sample(sx, sy) > 4) continue
        ctx.strokeStyle = `rgba(210,185,255,${s.alpha.toFixed(3)})`
        ctx.lineWidth = s.width
        ctx.beginPath()
        ctx.moveTo(s.x0, s.y0)
        ctx.lineTo(s.x1, s.y1)
        ctx.stroke()
      }
    })
  },
}
