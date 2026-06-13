// Willmore Flow (Bobenko–Schröder 2005 discrete formulation)
// Minimizes ∫κ² ds — bending energy, not length.
// Corners round without global shrinkage; curve hunts a min-bending config
// inside the glyph forever when SDF spring prevents escape.
// Initialize with a jagged high-frequency polyline for rich transient motion.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sdfGrad } from '../common'

const PARAMS          = [
  { key: 'N0',      type: 'int',   min: 40,  max: 400, default: 160, step: 20,   label: 'nodes' },
  { key: 'bendK',   type: 'range', min: 0,   max: 2,   default: 0.4,  step: 0.02, label: 'bending stiffness' },
  { key: 'tensK',   type: 'range', min: 0,   max: 1,   default: 0.15, step: 0.01, label: 'tension' },
  { key: 'sdfPull', type: 'range', min: 0,   max: 3,   default: 1.0,  step: 0.05, label: 'sdf pull' },
  { key: 'noiseAmp',type: 'range', min: 0,   max: 30,  default: 12,   step: 1,    label: 'init noise' },
]



function curvatureAt(pts      , i        )         {
  const n = pts.length
  const prev = pts[(i - 1 + n) % n]
  const curr = pts[i]
  const next = pts[(i + 1) % n]
  const l1 = Math.hypot(curr.x - prev.x, curr.y - prev.y) || 1e-9
  const l2 = Math.hypot(next.x - curr.x, next.y - curr.y) || 1e-9
  const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x)
  return cross / (l1 * l2 * (l1 + l2) * 0.5 + 1e-12)
}

function normalAt(pts      , i        )                   {
  const n = pts.length
  const prev = pts[(i - 1 + n) % n]
  const next = pts[(i + 1) % n]
  const tx = next.x - prev.x, ty = next.y - prev.y
  const tl = Math.hypot(tx, ty) || 1
  return [-ty / tl, tx / tl]
}

export const r2_curve_02_willmore            = {
  id: 'r2-curve-02-willmore',
  name: 'WILLMORE FLOW',
  repo: 'Bobenko–Schröder SGP 2005',
  summary: 'Closed curve minimizes total squared curvature ∫κ² ds. Sharp bends melt without global shrinkage; the curve breathes inside the SDF-walled glyph seeking its minimum-bending configuration.',
  helps: 'Slow contemplative relaxation — unlike any existing prototype. Best seeded jagged.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const N0       = num(params, 'N0', 160)
    const bendK    = num(params, 'bendK', 0.4)
    const tensK    = num(params, 'tensK', 0.15)
    const sdfPull  = num(params, 'sdfPull', 1.0)
    const noiseAmp = num(params, 'noiseAmp', 12)

    // seed: oval scaled to fit inside sdf, then perturbed
    const cx = sdf.w * 0.5, cy = sdf.h * 0.5
    const rx = sdf.w * 0.28, ry = sdf.h * 0.28
    const pts       = []
    for (let i = 0; i < N0; i++) {
      const a = (i / N0) * Math.PI * 2
      const noise = (rng() - 0.5) * 2 * noiseAmp
      const r = 1 + noise * 0.04
      pts.push({
        x: cx + Math.cos(a) * rx * r + (rng() - 0.5) * noiseAmp,
        y: cy + Math.sin(a) * ry * r + (rng() - 0.5) * noiseAmp,
      })
    }

    const dt = 0.08
    const REMESH = 40
    let step = 0

    function remesh(p      )       {
      const n = p.length
      let total = 0
      const ls           = []
      for (let i = 0; i < n; i++) {
        const l = Math.hypot(p[(i+1)%n].x - p[i].x, p[(i+1)%n].y - p[i].y)
        ls.push(l); total += l
      }
      const seg = total / N0
      const out       = []
      let acc = 0, idx = 0
      for (let k = 0; k < N0; k++) {
        const tgt = k * seg
        while (acc + ls[idx] < tgt && idx < n - 1) { acc += ls[idx]; idx++ }
        const t = ls[idx] > 1e-9 ? (tgt - acc) / ls[idx] : 0
        const a = p[idx], b = p[(idx+1)%n]
        out.push({ x: a.x + t*(b.x-a.x), y: a.y + t*(b.y-a.y) })
      }
      return out
    }

    return wrapLoop(() => {
      const n = pts.length

      // compute curvature array
      const kappa           = new Array(n)
      for (let i = 0; i < n; i++) kappa[i] = curvatureAt(pts, i)

      const dx           = new Array(n).fill(0)
      const dy           = new Array(n).fill(0)

      for (let i = 0; i < n; i++) {
        const prev = (i - 1 + n) % n, next = (i + 1) % n
        const lm = (Math.hypot(pts[i].x-pts[prev].x, pts[i].y-pts[prev].y) +
                    Math.hypot(pts[next].x-pts[i].x, pts[next].y-pts[i].y)) * 0.5 || 1e-9

        // discrete Willmore: -(d²κ/ds² + ½κ³) along normal
        const d2k = (kappa[next] - 2 * kappa[i] + kappa[prev]) / (lm * lm)
        const will = d2k + 0.5 * kappa[i] * kappa[i] * kappa[i]
        const [nx, ny] = normalAt(pts, i)
        dx[i] -= bendK * will * nx * dt
        dy[i] -= bendK * will * ny * dt

        // tension: spring toward arc-length neighbors
        for (const oi of [prev, next]) {
          const ex = pts[oi].x - pts[i].x, ey = pts[oi].y - pts[i].y
          const el = Math.hypot(ex, ey) || 1e-9
          const tgt = Math.hypot(sdf.w, sdf.h) * 0.5 / N0 * 2
          dx[i] += (ex / el) * (el - tgt) * tensK * dt
          dy[i] += (ey / el) * (el - tgt) * tensK * dt
        }

        // SDF boundary push
        const sv = sdf.sample(pts[i].x, pts[i].y)
        if (sv > -6) {
          const [gx, gy] = sdfGrad(sdf, pts[i].x, pts[i].y)
          const gm = Math.hypot(gx, gy) || 1
          dx[i] -= (gx / gm) * sdfPull * Math.max(0, sv + 6) * 0.06
          dy[i] -= (gy / gm) * sdfPull * Math.max(0, sv + 6) * 0.06
        }
      }

      for (let i = 0; i < n; i++) {
        pts[i].x += dx[i]; pts[i].y += dy[i]
      }

      step++
      if (step % REMESH === 0) {
        const r = remesh(pts)
        pts.splice(0, pts.length, ...r)
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      ctx.strokeStyle = '#d4a0e8'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        if (i === 0) ctx.moveTo(p.x * sx, p.y * sy)
        else ctx.lineTo(p.x * sx, p.y * sy)
      }
      ctx.closePath()
      ctx.stroke()
    })
  },
}
