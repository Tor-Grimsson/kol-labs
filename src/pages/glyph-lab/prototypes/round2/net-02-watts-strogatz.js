

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'N', type: 'int', min: 20, max: 200, default: 60, step: 5 },
  { key: 'k', type: 'int', min: 2, max: 12, default: 4, step: 2 },
  { key: 'sweepSpeed', type: 'range', min: 0.005, max: 0.2, default: 0.02, step: 0.005 },
  { key: 'p', type: 'range', min: 0, max: 1, default: 0, step: 0.005, label: 'p (manual)' },
]

export const r2_net_02_ws            = {
  id: 'r2-net-02-ws',
  name: 'WATTS-STROGATZ REWIRING',
  repo: 'Watts & Strogatz, Nature 393 (1998)',
  summary:
    'Ring lattice slowly morphs to random graph via p-sweep. Shortcut edges fire across the glyph interior, creating the small-world transition live.',
  helps: 'Structural phase transition: ring → small-world → random, animated as a continuous sweep over rewiring probability.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    // Find perimeter points by marching along glyph boundary
    function buildPerimeterNodes(N        )                                  {
      const pts                                  = []
      // Collect all sign-change x-coords at center height to estimate perimeter positions
      // Use angular sweep sampling the glyph boundary
      const cx = sdf.w / 2, cy = sdf.h / 2
      const R = Math.min(sdf.w, sdf.h) * 0.48
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2
        // Binary search for SDF=0 along this ray
        let lo = 0, hi = R
        for (let step = 0; step < 20; step++) {
          const mid = (lo + hi) / 2
          const x = cx + Math.cos(angle) * mid
          const y = cy + Math.sin(angle) * mid
          if (sdf.sample(x, y) < 0) lo = mid; else hi = mid
        }
        const finalR = (lo + hi) / 2 * 0.88 // slightly inward so nodes are inside
        pts.push({ x: cx + Math.cos(angle) * finalR, y: cy + Math.sin(angle) * finalR })
      }
      return pts
    }

    let prevN = -1, prevK = -1
    let nodes                                  = []
    let edges                                  = []
    let originalEdges                                  = []
    let sweepP = 0
    let lastTime = clock.nowSeconds()

    function rebuild(N        , k        ) {
      nodes = buildPerimeterNodes(N)
      edges = []
      for (let i = 0; i < N; i++) {
        for (let j = 1; j <= Math.floor(k / 2); j++) {
          edges.push({ a: i, b: (i + j) % N })
        }
      }
      originalEdges = edges.map(e => ({ ...e }))
      sweepP = 0
      prevN = N; prevK = k
    }

    function rewire(p        ) {
      edges = originalEdges.map(e => ({ ...e }))
      for (let i = 0; i < edges.length; i++) {
        if (rng() < p) {
          const a = edges[i].a
          const neighbors = new Set(edges.filter(e => e.a === a || e.b === a).map(e => e.a === a ? e.b : e.a))
          neighbors.add(a)
          let newB = -1
          for (let t = 0; t < 100; t++) {
            const candidate = Math.floor(rng() * nodes.length)
            if (!neighbors.has(candidate)) { newB = candidate; break }
          }
          if (newB >= 0) edges[i] = { a, b: newB }
        }
      }
    }

    return wrapLoop(() => {
      const N = num(params, 'N', 60)
      const k = num(params, 'k', 4)
      const sweepSpeed = num(params, 'sweepSpeed', 0.02)
      const manualP = num(params, 'p', 0)

      if (N !== prevN || k !== prevK) rebuild(N, k)

      const now = clock.nowSeconds()
      const dt = now - lastTime
      lastTime = now

      // If manual p moved, use it; otherwise sweep
      sweepP = (sweepP + dt * sweepSpeed) % 1.05
      const activeP = manualP > 0.001 ? manualP : Math.min(sweepP, 1)

      rewire(activeP)

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      // Draw edges — hue shifts by "shortcuttiness" (distance in ring)
      ctx.lineWidth = 0.7
      for (const e of edges) {
        const ringDist = Math.min(Math.abs(e.a - e.b), N - Math.abs(e.a - e.b))
        const isShortcut = ringDist > Math.floor(k / 2) + 1
        if (isShortcut) {
          ctx.strokeStyle = `rgba(255,160,80,${0.15 + activeP * 0.5})`
          ctx.lineWidth = 0.8
        } else {
          ctx.strokeStyle = 'rgba(140,180,240,0.4)'
          ctx.lineWidth = 0.5
        }
        const na = nodes[e.a], nb = nodes[e.b]
        ctx.beginPath()
        ctx.moveTo(na.x * sx, na.y * sy)
        ctx.lineTo(nb.x * sx, nb.y * sy)
        ctx.stroke()
      }

      // Nodes
      ctx.fillStyle = 'rgba(210,220,245,0.9)'
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x * sx, n.y * sy, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
