import {
  forceSimulation,
  forceCollide,
  forceManyBody,


} from 'd3-force'

import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from './common'









// d3-force particle simulation with a custom SDF-boundary force that keeps
// all nodes trapped inside the glyph. Node-level collision + many-body
// repulsion produces a self-organizing sphere pack that settles into the
// shape.
//
// Reference: d3/d3-force, 1wheel/d3-force-container (arbitrary-shape containment).
export const forceContainer            = {
  id: '09-force-container',
  name: 'D3-FORCE · SDF CONTAINER',
  repo: 'd3/d3-force + 1wheel/d3-force-container',
  summary:
    'd3-force simulation (collision + many-body) with a custom SDF-inward force. Nodes settle into a self-organizing pack that fills the glyph. Adding new nodes (additional layer) triggers a fresh settle. Perfect physics backbone for interactive layers.',
  helps:
    'The physics backbone. Add nodes on trigger → they settle; cross-layer rules become d3 forces (repel layer-A from layer-B, etc). This is the most composable foundation for the multi-layer vision.',
  init({ ctx, sdf, W, H, rng }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const nodes      = []
    const count = 380
    for (let i = 0; i < count; i++) {
      const [x, y] = sampleInside(sdf, rng)
      nodes.push({
        x, y, vx: 0, vy: 0,
        r: 4 + rng() * 10,
      })
    }

    const sdfForce = (alpha        ) => {
      const margin = 6
      for (const n of nodes) {
        const s = sdf.sample(n.x, n.y)
        if (s > -margin) {
          const [gX, gY] = sdfGrad(sdf, n.x, n.y)
          const m = Math.hypot(gX, gY) || 1e-6
          const push = Math.max(0, s + margin) * 0.6 * alpha
          n.vx -= (gX / m) * push
          n.vy -= (gY / m) * push
        }
      }
    }
    sdfForce.initialize = () => {}

    const sim                           = forceSimulation(nodes)
      .alphaDecay(0.004)
      .velocityDecay(0.35)
      .force('collide', forceCollide   ().radius((d) => d.r + 1))
      .force('charge', forceManyBody   ().strength(-6).distanceMax(40))
      .force('sdf', sdfForce)

    return wrapLoop(() => {
      sim.tick(1)
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.18)', 1)

      // connecting edges (collision-neighbors)
      ctx.strokeStyle = 'rgba(170, 174, 220, 0.28)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          const sum = a.r + b.r + 4
          if (d2 < sum * sum) {
            ctx.moveTo(a.x * sx, a.y * sy)
            ctx.lineTo(b.x * sx, b.y * sy)
          }
        }
      }
      ctx.stroke()

      // node circles
      ctx.strokeStyle = 'rgba(210, 215, 235, 0.7)'
      ctx.lineWidth = 0.9
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x * sx, n.y * sy, n.r * Math.min(sx, sy), 0, Math.PI * 2)
        ctx.stroke()
      }

      // centers
      ctx.fillStyle = '#f3c9c4'
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x * sx, n.y * sy, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
