

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'N', type: 'int', min: 40, max: 300, default: 120, step: 10 },
  { key: 'stepsPerSec', type: 'int', min: 2, max: 80, default: 12, step: 2 },
  { key: 'segSteps', type: 'int', min: 4, max: 16, default: 6, step: 1, label: 'segCheck' },
]

export const r2_net_05_explperc            = {
  id: 'r2-net-05-explperc',
  name: 'EXPLOSIVE PERCOLATION',
  repo: 'Achlioptas, D\'Souza & Spencer, Science 323 (2009)',
  summary:
    'Achlioptas product rule: each step proposes two random edges, adds the one connecting the smaller-product component pair. Giant component is suppressed then erupts suddenly — an explosion inside the glyph.',
  helps: 'Stasis → explosion dynamic: the glyph is an archipelago for most of the run, then floods in a handful of frames.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    class UF {
      parent            ; size
      constructor(n        ) {
        this.parent = new Int32Array(n).map((_, i) => i)
        this.size = new Int32Array(n).fill(1)
      }
      find(x        )         {
        while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x] }
        return x
      }
      union(a        , b        ) {
        a = this.find(a); b = this.find(b)
        if (a === b) return
        if (this.size[a] < this.size[b]) [a, b] = [b, a]
        this.parent[b] = a; this.size[a] += this.size[b]
      }
      compSize(x        ) { return this.size[this.find(x)] }
      maxSize(n        ) {
        let max = 0
        for (let i = 0; i < n; i++) if (this.size[i] > max) max = this.size[i]
        return max
      }
    }

    function segInside(ax        , ay        , bx        , by        , steps        )          {
      for (let i = 1; i < steps; i++) {
        const t = i / steps
        if (sdf.sample(ax + (bx - ax) * t, ay + (by - ay) * t) >= 0) return false
      }
      return true
    }

    let nodes                                  = []
    let edges                                  = []
    let uf
    let lastAdd = 0
    let prevN = -1
    let step = 0

    function rebuild(N        ) {
      nodes = []
      for (let i = 0; i < N; i++) {
        const [x, y] = sampleInside(sdf, rng)
        nodes.push({ x, y })
      }
      edges = []
      uf = new UF(N)
      lastAdd = clock.nowSeconds()
      step = 0
    }

    function randomPair()                   {
      const a = Math.floor(rng() * nodes.length)
      let b = Math.floor(rng() * (nodes.length - 1))
      if (b >= a) b++
      return [a, b]
    }

    function achlioptasStep(segSteps        ) {
      const N = nodes.length
      if (N < 4) return

      // Propose two candidate edges
      let [a1, b1] = randomPair()
      let [a2, b2] = randomPair()

      // Ensure both segments are inside; try a few times
      let ok1 = segInside(nodes[a1].x, nodes[a1].y, nodes[b1].x, nodes[b1].y, segSteps)
      let ok2 = segInside(nodes[a2].x, nodes[a2].y, nodes[b2].x, nodes[b2].y, segSteps)

      for (let t = 0; t < 8 && (!ok1 || !ok2); t++) {
        if (!ok1) { [a1, b1] = randomPair(); ok1 = segInside(nodes[a1].x, nodes[a1].y, nodes[b1].x, nodes[b1].y, segSteps) }
        if (!ok2) { [a2, b2] = randomPair(); ok2 = segInside(nodes[a2].x, nodes[a2].y, nodes[b2].x, nodes[b2].y, segSteps) }
      }

      if (!ok1 && !ok2) return

      let chosenA        , chosenB
      if (!ok1) { chosenA = a2; chosenB = b2 }
      else if (!ok2) { chosenA = a1; chosenB = b1 }
      else {
        // Product rule: pick edge with smaller component-size product
        const s1 = uf.compSize(a1) * uf.compSize(b1)
        const s2 = uf.compSize(a2) * uf.compSize(b2)
        if (s1 <= s2) { chosenA = a1; chosenB = b1 }
        else { chosenA = a2; chosenB = b2 }
      }

      uf.union(chosenA, chosenB)
      edges.push({ a: chosenA, b: chosenB })
      step++
    }

    return wrapLoop(() => {
      const N = num(params, 'N', 120)
      const stepsPerSec = num(params, 'stepsPerSec', 12)
      const segSteps = num(params, 'segSteps', 6)

      if (N !== prevN) { rebuild(N); prevN = N }

      const now = clock.nowSeconds()
      const dt = now - lastAdd
      const toAdd = Math.floor(dt * stepsPerSec)

      if (toAdd > 0) {
        for (let i = 0; i < toAdd; i++) achlioptasStep(segSteps)
        lastAdd = now
      }

      // Reset after N*1.5 edges or 90% giant component
      const maxComp = uf.maxSize(N)
      if (step > N * 1.5 || maxComp / N > 0.9) rebuild(N)

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const giantFrac = maxComp / N
      const criticalFlash = giantFrac > 0.45 && giantFrac < 0.75

      // Edges — color by component membership
      ctx.lineWidth = criticalFlash ? 0.9 : 0.6
      for (const e of edges) {
        const inGiant = uf.compSize(e.a) === maxComp
        if (inGiant) {
          const flash = criticalFlash ? 0.8 : 0.3 + giantFrac * 0.4
          ctx.strokeStyle = `rgba(255,${Math.round(120 + giantFrac * 100)},60,${flash})`
        } else {
          ctx.strokeStyle = 'rgba(100,140,220,0.2)'
        }
        const na = nodes[e.a], nb = nodes[e.b]
        ctx.beginPath()
        ctx.moveTo(na.x * sx, na.y * sy)
        ctx.lineTo(nb.x * sx, nb.y * sy)
        ctx.stroke()
      }

      // Nodes
      for (let i = 0; i < nodes.length; i++) {
        const inGiant = uf.compSize(i) === maxComp
        const cs = uf.compSize(i)
        const t = cs / Math.max(maxComp, 1)
        if (inGiant) {
          ctx.fillStyle = `rgba(255,${Math.round(180 + giantFrac * 60)},80,0.85)`
        } else {
          ctx.fillStyle = `rgba(130,155,200,${0.3 + t * 0.4})`
        }
        ctx.beginPath()
        ctx.arc(nodes[i].x * sx, nodes[i].y * sy, inGiant ? 2 : 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
