

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Torus Link T(p,q) — when gcd(p,q)=d>1 the torus knot formula yields d
// separate closed loops; each rendered as a separate colored strand.  Global
// depth-sort + over/under gap rendering gives mutual interlocking.
// Ref: Adams, The Knot Book ch.5; Wikipedia — Torus knot (torus link section)

const PARAMS          = [
  { key: 'p', type: 'int', min: 2, max: 8, default: 4, label: 'winding p' },
  { key: 'q', type: 'int', min: 2, max: 8, default: 6, label: 'winding q' },
  { key: 'spin', type: 'range', min: 0, max: 2, default: 0.3, step: 0.05, label: 'spin speed' },
  { key: 'samples', type: 'int', min: 200, max: 2000, default: 600, step: 100, label: 'samples/strand' },
  { key: 'R', type: 'range', min: 0.6, max: 2.5, default: 1.5, step: 0.1, label: 'major radius' },
]

// Simple Y-axis 3D rotation
function rotY(x        , y        , z        , a        )                           {
  const c = Math.cos(a), s = Math.sin(a)
  return [c * x + s * z, y, -s * x + c * z]
}
function rotX(x        , y        , z        , a        )                           {
  const c = Math.cos(a), s = Math.sin(a)
  return [x, c * y - s * z, s * y + c * z]
}

// Palette for strands
const STRAND_HUES = [280, 40, 160, 10, 210, 90, 330, 70]

export const r2_topo_04_toruslink            = {
  id: 'r2-topo-04-toruslink',
  name: 'TORUS LINK (p,q)',
  repo: 'Adams · The Knot Book ch.5 · en.wikipedia.org/wiki/Torus_knot',
  summary: 'Torus link with d=gcd(p,q) strands, each a phase-shifted T(p/d, q/d) knot; global z-sort + per-crossing gap render shows mutual interlocking.',
  helps: 'Multiple interlocked loops chase each other — "feels like a machine", strong coupled-constraint depth read.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const SC = Math.min(W, H) * 0.27
    const OX = W * 0.5, OY = H * 0.5
    const D = 4.5

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const p = num(params, 'p', 4)
      const q = num(params, 'q', 6)
      const spin = num(params, 'spin', 0.3)
      const N = num(params, 'samples', 600)
      const R = num(params, 'R', 1.5)
      const r = 0.55

      const ry = t * spin
      const rx = t * spin * 0.41

      // gcd to find strand count
      let a = Math.abs(p), b = Math.abs(q)
      while (b) { const tmp = b; b = a % b; a = tmp }
      const d = a
      const strands = d


      const allSegs        = []

      for (let k = 0; k < strands; k++) {
        const phaseOffset = (2 * Math.PI * k) / strands
        let prevPX = 0, prevPY = 0, prevZ = 0
        for (let i = 0; i <= N; i++) {
          const u = (i / N) * Math.PI * 2
          const lx = (R + r * Math.cos(q * u)) * Math.cos(p * u + phaseOffset)
          const ly = (R + r * Math.cos(q * u)) * Math.sin(p * u + phaseOffset)
          const lz = r * Math.sin(q * u)
          let [rx3, ry3, rz3] = rotY(lx, ly, lz, ry)
          ;[rx3, ry3, rz3] = rotX(rx3, ry3, rz3, rx)
          const w = 1 / (D - rz3)
          const px = OX + rx3 * SC * w
          const py = OY + ry3 * SC * w
          if (i > 0) {
            const zMid = (prevZ + rz3) * 0.5
            const depth = (zMid + r + R) / (2 * (r + R))
            allSegs.push({
              x0: prevPX, y0: prevPY, x1: px, y1: py,
              z: zMid, strand: k,
              alpha: 0.4 + depth * 0.55,
              lw: 0.7 + depth * 1.6,
            })
          }
          prevPX = px; prevPY = py; prevZ = rz3
        }
      }

      // Global depth sort back-to-front
      allSegs.sort((a, b) => a.z - b.z)

      for (const s of allSegs) {
        const mx = (s.x0 + s.x1) * 0.5
        const my = (s.y0 + s.y1) * 0.5
        const sx = mx / W * sdf.w, sy = my / H * sdf.h
        if (sdf.sample(sx, sy) > 4) continue
        const hue = STRAND_HUES[s.strand % STRAND_HUES.length]
        ctx.strokeStyle = `hsla(${hue},78%,68%,${s.alpha.toFixed(3)})`
        ctx.lineWidth = s.lw
        ctx.beginPath()
        ctx.moveTo(s.x0, s.y0)
        ctx.lineTo(s.x1, s.y1)
        ctx.stroke()
      }
    })
  },
}
