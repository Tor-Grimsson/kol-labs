

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'N', type: 'int', min: 40, max: 300, default: 120, step: 10 },
  { key: 'edgesPerSec', type: 'int', min: 1, max: 60, default: 8, step: 1 },
  { key: 'segSteps', type: 'int', min: 4, max: 20, default: 8, step: 1, label: 'segmentCheck' },
]

export const r2_net_03_er            = {
  id: 'r2-net-03-er',
  name: 'ERDŐS-RÉNYI GIANT COMPONENT',
  repo: 'Erdős & Rényi, Publ. Math. Inst. Hung. 5 (1960)',
  summary:
    'N nodes scattered inside glyph. Edges added one at a time; union-find tracks components. At edge count ≈ N/2 the giant component erupts — the letter materializes from a field of dots.',
  helps: 'Dramatic phase transition: glyph is invisible (dots) → threshold → spanning web reveals the letterform.',
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
    }

    function segInside(ax        , ay        , bx        , by        , steps        )          {
      for (let i = 1; i < steps; i++) {
        const t = i / steps
        if (sdf.sample(ax + (bx - ax) * t, ay + (by - ay) * t) >= 0) return false
      }
      return true
    }

    let nodes                                  = []
    let candidatePairs                                  = []
    let edges                                                = []
    let uf
    let pairIdx = 0
    let lastAdd = 0

    function rebuild(N        ) {
      nodes = []
      for (let i = 0; i < N; i++) {
        const [x, y] = sampleInside(sdf, rng)
        nodes.push({ x, y })
      }
      // Generate candidate pairs in random order
      const pairs                                  = []
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++)
          pairs.push({ a: i, b: j })
      // Fisher-Yates shuffle
      for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pairs[i], pairs[j]] = [pairs[j], pairs[i]]
      }
      candidatePairs = pairs
      edges = []
      uf = new UF(N)
      pairIdx = 0
      lastAdd = clock.nowSeconds()
    }

    let prevN = -1

    return wrapLoop(() => {
      const N = num(params, 'N', 120)
      const edgesPerSec = num(params, 'edgesPerSec', 8)
      const segSteps = num(params, 'segSteps', 8)

      if (N !== prevN) { rebuild(N); prevN = N }

      const now = clock.nowSeconds()
      const dt = now - lastAdd
      const toAdd = Math.floor(dt * edgesPerSec)

      if (toAdd > 0 && pairIdx < candidatePairs.length) {
        let added = 0
        while (added < toAdd && pairIdx < candidatePairs.length) {
          const { a, b } = candidatePairs[pairIdx++]
          const na = nodes[a], nb = nodes[b]
          if (segInside(na.x, na.y, nb.x, nb.y, segSteps)) {
            uf.union(a, b)
            edges.push({ a, b, comp: uf.find(a) })
            added++
          }
        }
        lastAdd = now
      }

      // Cycle: reset when all pairs consumed
      if (pairIdx >= candidatePairs.length) {
        rebuild(N)
        prevN = N
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const maxComp = nodes.length > 0
        ? Math.max(...nodes.map((_, i) => uf ? uf.compSize(i) : 1))
        : 1
      const giantFrac = maxComp / N

      // Edges — giant-component edges in warm color
      ctx.lineWidth = 0.6
      for (const e of edges) {
        const inGiant = uf.compSize(e.a) === maxComp
        if (inGiant) {
          ctx.strokeStyle = `rgba(255,200,100,${0.2 + giantFrac * 0.5})`
        } else {
          ctx.strokeStyle = 'rgba(130,160,220,0.25)'
        }
        const na = nodes[e.a], nb = nodes[e.b]
        ctx.beginPath()
        ctx.moveTo(na.x * sx, na.y * sy)
        ctx.lineTo(nb.x * sx, nb.y * sy)
        ctx.stroke()
      }

      // Nodes
      for (let i = 0; i < nodes.length; i++) {
        const inGiant = uf ? uf.compSize(i) === maxComp : false
        ctx.fillStyle = inGiant
          ? `rgba(255,210,120,${0.5 + giantFrac * 0.4})`
          : 'rgba(180,190,220,0.5)'
        ctx.beginPath()
        ctx.arc(nodes[i].x * sx, nodes[i].y * sy, inGiant ? 2.2 : 1.3, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
