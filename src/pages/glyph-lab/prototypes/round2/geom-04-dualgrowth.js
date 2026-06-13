

import { Delaunay } from 'd3-delaunay'
import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'N',       type: 'int',   min: 40,  max: 300, default: 140, step: 20,   label: 'points' },
  { key: 'rate',    type: 'int',   min: 1,   max: 20,  default: 4,   step: 1,    label: 'BFS steps/frame' },
  { key: 'roots',   type: 'int',   min: 1,   max: 6,   default: 2,   step: 1,    label: 'root count' },
  { key: 'fade',    type: 'range', min: 0,   max: 1,   default: 0.4, step: 0.05, label: 'trail fade' },
]

// Delaunay dual growth skeleton: BFS over triangle adjacency via circumcenters.
// Each triangle's circumcenter is a Voronoi vertex; adjacent triangles share a
// Voronoi edge. We traverse BFS outward from seed triangles, emitting
// circumcenter-to-circumcenter segments as a growing vascular tree.
// When fully traversed, restarts with a fresh triangulation.
export const r2_geom_04_dualgrowth            = {
  id: 'r2-geom-04-dualgrowth',
  name: 'DELAUNAY DUAL GROWTH',
  repo: 'd3-delaunay · circumcenter BFS',
  summary: 'BFS propagation along the dual Voronoi graph — circumcenter to circumcenter. Grows a vascular skeleton through the glyph interior, constrained by the SDF mask. Restarts with a fresh triangulation each cycle.',
  helps: 'Structurally predetermined growth (unlike space colonisation) that reveals the topology of the point cloud as a branching animation.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h



    let edges         = []
    let queue           = []       // triangle indices in BFS frontier
    let visited                    = null
    let triangles                    = null
    let halfedges                    = null
    let circumcenters                      = null
    let triCount = 0

    const rebuild = () => {
      const N = num(params, 'N', 140)
      const rootCount = Math.min(num(params, 'roots', 2), 6)
      const pts                     = []
      for (let i = 0; i < N; i++) pts.push(sampleInside(sdf, rng))

      const d = Delaunay.from(pts)
      const v = d.voronoi([0, 0, sdf.w, sdf.h])
      triangles = d.triangles
      halfedges = d.halfedges
      circumcenters = v.circumcenters
      triCount = triangles.length / 3

      visited = new Uint8Array(triCount)
      edges = []
      queue = []

      // Pick root triangles whose circumcenter is inside the SDF
      const candidates           = []
      for (let i = 0; i < triCount; i++) {
        const cx = circumcenters[2 * i], cy = circumcenters[2 * i + 1]
        if (sdf.sample(cx, cy) < 0) candidates.push(i)
      }
      for (let r = 0; r < rootCount && candidates.length; r++) {
        const idx = Math.floor(rng() * candidates.length)
        const ti = candidates.splice(idx, 1)[0]
        if (!visited [ti]) { visited [ti] = 1; queue.push(ti) }
      }
    }
    rebuild()

    const step = (stepsPerFrame        ) => {
      if (!triangles || !halfedges || !circumcenters || !visited) return
      let steps = stepsPerFrame
      while (steps-- > 0 && queue.length > 0) {
        // Weighted BFS: process a random frontier element (not strictly FIFO)
        const qi = Math.floor(rng() * queue.length)
        const ti = queue[qi]
        queue.splice(qi, 1)

        const cax = circumcenters[2 * ti]
        const cay = circumcenters[2 * ti + 1]

        for (let e = ti * 3; e < ti * 3 + 3; e++) {
          const opp = halfedges[e]
          if (opp < 0) continue
          const tj = Math.floor(opp / 3)
          if (visited [tj]) continue
          const cbx = circumcenters[2 * tj]
          const cby = circumcenters[2 * tj + 1]
          // Gate: both endpoints inside SDF
          if (sdf.sample(cax, cay) >= 0 || sdf.sample(cbx, cby) >= 0) continue
          visited [tj] = 1
          queue.push(tj)
          edges.push({ ax: cax, ay: cay, bx: cbx, by: cby, depth: edges.length })
        }
      }
    }

    return wrapLoop(() => {
      const rate = num(params, 'rate', 4)
      const fade = num(params, 'fade', 0.4)

      step(rate)
      if (queue.length === 0 && edges.length > 0) {
        // Cycle complete — restart after a beat
        const t = clock.nowSeconds()
        if ((t % 3.5) < 0.05) rebuild()   // restart roughly every 3.5s
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const total = edges.length || 1
      ctx.lineWidth = 0.8
      for (const e of edges) {
        const age = e.depth / total                   // 0=oldest, 1=newest
        const alpha = (fade + (1 - fade) * (1 - age)) * 0.85
        ctx.strokeStyle = `rgba(140,190,255,${alpha.toFixed(2)})`
        ctx.beginPath()
        ctx.moveTo(e.ax * sx, e.ay * sy)
        ctx.lineTo(e.bx * sx, e.by * sy)
        ctx.stroke()
      }

      // Frontier dots
      if (circumcenters && queue.length) {
        ctx.fillStyle = 'rgba(243,200,160,0.9)'
        for (const ti of queue) {
          const cx = circumcenters[2 * ti] * sx
          const cy = circumcenters[2 * ti + 1] * sy
          ctx.beginPath()
          ctx.arc(cx, cy, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    })
  },
}
