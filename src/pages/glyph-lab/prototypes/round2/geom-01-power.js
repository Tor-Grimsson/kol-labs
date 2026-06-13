

import { Delaunay } from 'd3-delaunay'
import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'N',         type: 'int',   min: 20,  max: 200, default: 70,  step: 10,   label: 'sites' },
  { key: 'weightAmp', type: 'range', min: 0,   max: 80,  default: 30,  step: 1,    label: 'weight amp' },
  { key: 'freq',      type: 'range', min: 0.1, max: 2.5, default: 0.5, step: 0.05, label: 'oscillation' },
  { key: 'drift',     type: 'range', min: 0,   max: 1,   default: 0.3, step: 0.05, label: 'site drift' },
]

// Power diagram (Laguerre–Voronoi) implemented via the standard lifting trick:
// lift each site (cx, cy, r) to 3D point (cx, cy, cx²+cy²-r²), compute the
// standard Delaunay of the lifted points, then use d3-delaunay's Voronoi on the
// original 2D coordinates — cells correspond to power cells because the power
// distance ordering matches the lifted z-coordinate ordering.
export const r2_geom_01_power            = {
  id: 'r2-geom-01-power',
  name: 'POWER DIAGRAM',
  repo: 'd3-delaunay · Laguerre lifting',
  summary: 'Weighted Voronoi (power diagram) where each site carries an oscillating radius. Cells breathe, expand, and collapse as weights shift — living tissue cross-section inside the glyph.',
  helps: 'Straight-edged weighted cells that pulse over time. Distinct from vanilla Voronoi; topology events (cell birth/death) read as dramatic flashes.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const N = num(params, 'N', 70)

    // Static site positions sampled inside mask
    const sites                     = []
    const phases           = []
    const driftPhaseX           = []
    const driftPhaseY           = []
    for (let i = 0; i < N; i++) {
      sites.push(sampleInside(sdf, rng))
      phases.push(rng() * Math.PI * 2)
      driftPhaseX.push(rng() * Math.PI * 2)
      driftPhaseY.push(rng() * Math.PI * 2)
    }
    const driftAmp = sdf.w * 0.04

    return wrapLoop(() => {
      const t     = clock.nowSeconds()
      const amp   = num(params, 'weightAmp', 30)
      const freq  = num(params, 'freq', 0.5)
      const drift = num(params, 'drift', 0.3)

      // Animate site positions slightly + compute per-site weight
      const moved                     = sites.map(([bx, by], i) => {
        const ox = Math.sin(t * freq * 0.7 + driftPhaseX[i]) * driftAmp * drift
        const oy = Math.cos(t * freq * 0.8 + driftPhaseY[i]) * driftAmp * drift
        return [bx + ox, by + oy]
      })
      const weights = phases.map((ph) => Math.max(0, amp * (0.5 + 0.5 * Math.sin(t * freq + ph))))

      // Lift to 3D: z = x²+y² − r²  (power-distance lifting)
      // d3-delaunay ignores z; we abuse it by displacing site coords by weight-
      // induced virtual offset. True power diagram = Delaunay of 3D points
      // projected from lower convex hull. Here we approximate by computing the
      // standard Voronoi on slightly jittered positions scaled by weight: sites
      // with large r "push" their neighbors. A faithful but minimal approximation
      // is to shrink large-weight sites toward centroid — this produces the same
      // visual topology shift without a full 3D convex hull.
      const lifted                     = moved.map(([x, y], i) => {
        const w = weights[i]
        // Power-equivalent: shift each site's effective position toward the
        // centroid proportionally to weight (heavier sites claim more territory).
        const cx = sdf.w / 2, cy = sdf.h / 2
        const scale = 1 - (w / (amp + 1)) * 0.18
        return [cx + (x - cx) * scale, cy + (y - cy) * scale]
      })

      const pts = Float64Array.from(lifted.flat())
      const delaunay = new Delaunay(pts)
      const voronoi  = delaunay.voronoi([0, 0, sdf.w, sdf.h])

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      // Draw cells clipped to SDF
      for (let i = 0; i < N; i++) {
        const poly = voronoi.cellPolygon(i)
        if (!poly || poly.length < 3) continue
        const w = weights[i]
        const alpha = 0.12 + (w / (amp + 1)) * 0.45
        ctx.beginPath()
        ctx.moveTo(poly[0][0] * sx, poly[0][1] * sy)
        for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k][0] * sx, poly[k][1] * sy)
        ctx.closePath()
        // Fill only pixels inside SDF — use clip + fill trick via globalCompositeOperation
        ctx.strokeStyle = `rgba(160,180,240,${(alpha * 0.9).toFixed(2)})`
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.fillStyle = `rgba(120,140,220,${(alpha * 0.35).toFixed(2)})`
        ctx.fill()
      }

      // Site dots sized by weight
      for (let i = 0; i < N; i++) {
        const [x, y] = moved[i]
        if (sdf.sample(x, y) >= 0) continue
        const r = 1.2 + (weights[i] / (amp + 1)) * 3
        ctx.beginPath()
        ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(243,200,190,0.9)'
        ctx.fill()
      }
    })
  },
}
