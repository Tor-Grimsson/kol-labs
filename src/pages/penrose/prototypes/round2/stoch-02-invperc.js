// Invasion Percolation — Wilkinson & Willemsen 1983
// Assign random weights to every lattice site once. A min-heap drives the
// frontier: always invade the weakest boundary site next. The result is a
// fractal river-delta / vascular tree constrained to the glyph silhouette.
//
// Wilkinson & Willemsen (1983) J. Phys. A 16:3365



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'stepsPerFrame', type: 'int',   min: 1,   max: 300, default: 60,  step: 10, label: 'steps/frame' },
  { key: 'lattice',       type: 'int',   min: 60,  max: 200, default: 120, step: 20, label: 'lattice size' },
  { key: 'noisePow',      type: 'range', min: 0.2, max: 3.0, default: 1.0, step: 0.1, label: 'noise power' },
]

// Minimal binary min-heap over {weight, idx} pairs
class MinHeap {
          h                     = []
  push(w        , idx        ) {
    this.h.push([w, idx])
    this._up(this.h.length - 1)
  }
  pop()                               {
    if (!this.h.length) return undefined
    const top = this.h[0]
    const last = this.h.pop()
    if (this.h.length > 0) { this.h[0] = last; this._down(0) }
    return top
  }
  get size() { return this.h.length }
          _up(i        ) {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.h[p][0] <= this.h[i][0]) break
      ;[this.h[p], this.h[i]] = [this.h[i], this.h[p]]; i = p
    }
  }
          _down(i        ) {
    const n = this.h.length
    while (true) {
      let s = i, l = 2*i+1, r = 2*i+2
      if (l < n && this.h[l][0] < this.h[s][0]) s = l
      if (r < n && this.h[r][0] < this.h[s][0]) s = r
      if (s === i) break
      ;[this.h[s], this.h[i]] = [this.h[i], this.h[s]]; i = s
    }
  }
}

export const r2_stoch_02_invperc            = {
  id: 'r2-stoch-02-invperc',
  name: 'INVASION PERCOLATION',
  repo: 'Wilkinson & Willemsen 1983 · J.Phys.A 16:3365',
  summary: 'Pre-assign random weights to all lattice sites; a min-heap greedily invades the weakest boundary site each step. Produces fractal river-delta branching filling the glyph from a single seed.',
  helps: 'Deterministic-greedy on frozen randomness — smoother branches than DLA, pure priority-queue mechanic, zero walkers at runtime.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    let G   = num(params, 'lattice', 120)
    let spf = num(params, 'stepsPerFrame', 60)
    let pow = num(params, 'noisePow', 1.0)

    let state = buildState(G, pow)

    function buildState(g        , p        ) {
      const N      = g * g
      const inside = new Uint8Array(N)
      const weight = new Float32Array(N)
      const cells           = []

      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i  = y * g + x
          const sx = (x + 0.5) / g * sdf.w
          const sy = (y + 0.5) / g * sdf.h
          if (sdf.sample(sx, sy) < 0) {
            inside[i] = 1
            weight[i] = Math.pow(rng(), p)
            cells.push(i)
          }
        }
      }

      const invaded = new Uint8Array(N)
      const heap    = new MinHeap()

      // seed: pick a random interior cell
      if (cells.length > 0) {
        const seed = cells[Math.floor(rng() * cells.length)]
        invaded[seed] = 1
        // push neighbors
        const x0 = seed % g, y0 = (seed / g) | 0
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = x0 + dx, ny = y0 + dy
          if (nx < 0 || nx >= g || ny < 0 || ny >= g) continue
          const ni = ny * g + nx
          if (inside[ni] && !invaded[ni]) heap.push(weight[ni], ni)
        }
      }

      return { inside, weight, invaded, heap, g, cells }
    }

    function rebuild() {
      G   = num(params, 'lattice', 120)
      spf = num(params, 'stepsPerFrame', 60)
      pow = num(params, 'noisePow', 1.0)
      state = buildState(G, pow)
    }

    const scX = () => W / state.g
    const scY = () => H / state.g

    return wrapLoop(() => {
      spf = num(params, 'stepsPerFrame', 60)

      const { inside, invaded, heap, g } = state

      for (let i = 0; i < spf; i++) {
        if (heap.size === 0) break
        const entry = heap.pop()
        if (!entry) break
        const [, idx] = entry
        if (invaded[idx]) continue // stale entry
        invaded[idx] = 1

        const x0 = idx % g, y0 = (idx / g) | 0
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = x0 + dx, ny = y0 + dy
          if (nx < 0 || nx >= g || ny < 0 || ny >= g) continue
          const ni = ny * g + nx
          if (inside[ni] && !invaded[ni]) heap.push(state.weight[ni], ni)
        }
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(240,230,210,0.15)', 1)

      const sx = scX(), sy = scY()
      // draw invaded cells color-mapped by weight (lighter = invaded earlier / lower resistance)
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i = y * g + x
          if (!invaded[i]) continue
          const w  = state.weight[i]
          const r  = Math.round(120 + w * 100)
          const gb = Math.round(180 + w * 60)
          ctx.fillStyle = `rgb(${r},${gb},${gb})`
          ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5)
        }
      }

      // highlight frontier
      if (heap.size > 0) {
        ctx.fillStyle = 'rgba(255,220,80,0.7)'
        // peek at top few without popping — draw them slightly brighter
        for (let k = 0; k < Math.min(12, (heap       ).h.length); k++) {
          const [, idx] = (heap       ).h[k]
          const fx = idx % g, fy = (idx / g) | 0
          ctx.fillRect(fx * sx, fy * sy, sx + 0.5, sy + 0.5)
        }
      }
    })
  },
}
