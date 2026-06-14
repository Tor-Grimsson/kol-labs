// First-Passage Percolation — Hammersley & Welsh 1965
// Assign i.i.d. random edge weights to the glyph lattice once. Run Dijkstra
// from a seed to compute arrival times T(x). Animate by revealing all pixels
// where T(x) ≤ current threshold t, incremented each frame. The wavefront
// ∂B(t) is a KPZ-class rough frontier; geodesics form a visible spanning tree.
//
// Hammersley & Welsh (1965) J.Royal Stat.Soc.B 27:305
// Auffinger, Damron, Hanson (2017) AMS Univ. Lec. Series 68



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'lattice',    type: 'int',   min: 60,  max: 200, default: 120, step: 20,  label: 'lattice size' },
  { key: 'sweepSpd',  type: 'range', min: 0.2, max: 5.0, default: 1.5, step: 0.1, label: 'sweep speed' },
  { key: 'edgePow',   type: 'range', min: 0.3, max: 3.0, default: 1.0, step: 0.1, label: 'edge weight pow' },
  { key: 'showTree',  type: 'boolean',                    default: true,           label: 'show geodesic tree' },
]

// Min-heap for Dijkstra
class PQ {
          h                     = []
  push(dist        , idx        ) { this.h.push([dist, idx]); this._up(this.h.length - 1) }
  pop()                               {
    if (!this.h.length) return undefined
    const top = this.h[0]; const last = this.h.pop()
    if (this.h.length) { this.h[0] = last; this._down(0) }
    return top
  }
  get size() { return this.h.length }
          _up(i        ) {
    while (i > 0) { const p = (i-1)>>1; if (this.h[p][0] <= this.h[i][0]) break; [this.h[p],this.h[i]]=[this.h[i],this.h[p]]; i=p }
  }
          _down(i        ) {
    const n = this.h.length
    while (true) {
      let s=i, l=2*i+1, r=2*i+2
      if (l<n && this.h[l][0]<this.h[s][0]) s=l
      if (r<n && this.h[r][0]<this.h[s][0]) s=r
      if (s===i) break; [this.h[s],this.h[i]]=[this.h[i],this.h[s]]; i=s
    }
  }
}

export const r2_stoch_05_fpp            = {
  id: 'r2-stoch-05-fpp',
  name: 'FIRST-PASSAGE PERCOLATION',
  repo: 'Hammersley & Welsh 1965 · Auffinger+Damron+Hanson 2017',
  summary: 'Random edge weights define a random metric on the glyph lattice. Dijkstra computes arrival times T(x) from a seed once; animation reveals B(t)={x:T(x)≤t} as a growing KPZ-rough wavefront.',
  helps: 'Pre-computed growth — animate a static Dijkstra field. Geodesic tree visible as skeleton; wavefront is KPZ-class rough. Esoteric, zero prior art in creative coding.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    let G        = num(params, 'lattice', 120)
    let spd      = num(params, 'sweepSpd', 1.5)
    let ePow     = num(params, 'edgePow', 1.0)

    let computed = buildFPP(G, ePow)
    let tStart   = clock.nowSeconds()

    function buildFPP(g        , ep        ) {
      const N      = g * g
      const inside = new Uint8Array(N)
      // horizontal edges: weight[i] = weight of edge between i and i+1
      // vertical edges:   weight[N + i] = weight of edge between i and i+g
      const edgeH  = new Float32Array(N)
      const edgeV  = new Float32Array(N)
      const cells           = []

      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i  = y * g + x
          const sx = (x + 0.5) / g * sdf.w
          const sy = (y + 0.5) / g * sdf.h
          if (sdf.sample(sx, sy) < 0) { inside[i] = 1; cells.push(i) }
          edgeH[i] = Math.pow(Math.max(1e-6, rng()), ep)
          edgeV[i] = Math.pow(Math.max(1e-6, rng()), ep)
        }
      }

      // Dijkstra from a random interior seed
      const dist   = new Float32Array(N).fill(Infinity)
      const parent = new Int32Array(N).fill(-1)
      const pq     = new PQ()

      if (cells.length > 0) {
        const seed = cells[Math.floor(rng() * cells.length)]
        dist[seed] = 0
        pq.push(0, seed)
      }

      const DIRS                                         = [
        [-1, 0, (i) => edgeH[i - 1]],
        [ 1, 0, (i) => edgeH[i]],
        [ 0,-1, (i) => edgeV[i - g]],
        [ 0, 1, (i) => edgeV[i]],
      ]

      while (pq.size > 0) {
        const entry = pq.pop()
        if (!entry) break
        const [d, i] = entry
        if (d > dist[i]) continue  // stale

        const x0 = i % g, y0 = (i / g) | 0
        for (const [dx, dy, w] of DIRS) {
          const nx = x0 + dx, ny = y0 + dy
          if (nx < 0 || nx >= g || ny < 0 || ny >= g) continue
          const ni = ny * g + nx
          if (!inside[ni]) continue
          const nd = d + w(i)
          if (nd < dist[ni]) { dist[ni] = nd; parent[ni] = i; pq.push(nd, ni) }
        }
      }

      // normalize dist to [0, 1]
      let maxD = 0
      for (let i = 0; i < N; i++) if (dist[i] < Infinity) maxD = Math.max(maxD, dist[i])
      if (maxD > 0) for (let i = 0; i < N; i++) if (dist[i] < Infinity) dist[i] /= maxD

      return { inside, dist, parent, g, cells }
    }

    return wrapLoop(() => {
      spd  = num(params, 'sweepSpd', 1.5)
      const showTree = params['showTree'] !== false

      const { inside, dist, parent, g } = computed
      const sx = W / g, sy = H / g

      // threshold oscillates 0 → 1 → 0 at sweep speed
      const elapsed = (clock.nowSeconds() - tStart) * spd * 0.25
      const t       = (Math.sin(elapsed) + 1) * 0.5  // 0..1

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(240,230,210,0.12)', 1)

      // filled region B(t)
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i = y * g + x
          if (!inside[i] || dist[i] > t) continue
          const d   = dist[i]
          // heat-map: early arrival = cool blue, late = warm red
          const hue = Math.round(200 - d * 180)  // 200 blue → 20 red
          ctx.fillStyle = `hsl(${hue},70%,45%)`
          ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5)
        }
      }

      // wavefront highlight
      ctx.fillStyle = 'rgba(255,240,180,0.8)'
      const bw = 0.03
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i = y * g + x
          if (!inside[i]) continue
          const d = dist[i]
          if (d > t && d <= t + bw) ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5)
        }
      }

      // geodesic tree skeleton
      if (showTree) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth   = 0.7
        ctx.beginPath()
        for (let i = 0; i < g * g; i++) {
          if (!inside[i] || dist[i] > t || parent[i] < 0) continue
          const p = parent[i]
          ctx.moveTo((i % g + 0.5) * sx, ((i / g | 0) + 0.5) * sy)
          ctx.lineTo((p % g + 0.5) * sx, ((p / g | 0) + 0.5) * sy)
        }
        ctx.stroke()
      }
    })
  },
}
