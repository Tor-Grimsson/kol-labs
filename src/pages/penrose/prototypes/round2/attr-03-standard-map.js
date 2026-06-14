

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Chirikov-Taylor Standard Map — area-preserving 2D map on a torus.
// K parameter animates from ordered KAM tori → stochastic sea.
// Ref: https://en.wikipedia.org/wiki/Standard_map

const TAU = Math.PI * 2

const PARAMS          = [
  { key: 'K', type: 'range', min: 0.1, max: 2.5, default: 0.97, step: 0.01, label: 'K (chaos)' },
  { key: 'drift', type: 'range', min: 0, max: 0.5, default: 0.12, step: 0.01, label: 'K drift speed' },
  { key: 'seeds', type: 'int', min: 10, max: 300, default: 120, label: 'orbit count' },
  { key: 'iters', type: 'int', min: 10, max: 300, default: 80, label: 'iters/frame' },
]

export const r2_attr_03_standard_map            = {
  id: 'r2-attr-03-standard-map',
  name: 'STANDARD MAP (KAM)',
  repo: 'Chirikov 1969 · en.wikipedia.org/wiki/Standard_map',
  summary: 'Chirikov-Taylor standard map; 120 orbits each colored by seed hue, clipped by glyph SDF. K drifts over time through KAM breakdown.',
  helps: 'The moment the last KAM torus shatters is one of the most dramatic readable transitions in dynamical systems — visible at glyph scale.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const maxSeeds = 300
    // State: each orbit has (p, x) on the torus [0, 2π]²
    const px = new Float64Array(maxSeeds)
    const pp = new Float64Array(maxSeeds)
    const hues = new Float32Array(maxSeeds)
    // Seed orbits spread across phase space
    for (let i = 0; i < maxSeeds; i++) {
      px[i] = rng() * TAU
      pp[i] = rng() * TAU
      hues[i] = (i / maxSeeds) * 360
    }

    // Map torus [0,2π]² → glyph canvas
    const margin = Math.min(W, H) * 0.05
    const rangeX = W - margin * 2
    const rangeY = H - margin * 2

    return wrapLoop(() => {
      const K = num(params, 'K', 0.97)
      const drift = num(params, 'drift', 0.12)
      const seeds = Math.min(maxSeeds, num(params, 'seeds', 120))
      const iters = num(params, 'iters', 80)

      // Slowly drift K via sin
      const t = clock.nowSeconds()
      const Keff = Math.max(0.05, Math.min(2.5, K + Math.sin(t * drift) * 0.4))

      clear(ctx, W, H, 'rgba(10,11,20,0.22)')
      strokeOutline(ctx, sdf, W, H)

      for (let si = 0; si < seeds; si++) {
        let p = pp[si], x = px[si]
        const hue = hues[si]
        for (let iter = 0; iter < iters; iter++) {
          p = ((p + Keff * Math.sin(x)) % TAU + TAU) % TAU
          x = ((x + p) % TAU + TAU) % TAU
          // Map to canvas
          const cx = margin + (x / TAU) * rangeX
          const cy = margin + (p / TAU) * rangeY
          // SDF gate: only draw inside glyph
          const sdx = cx * (sdf.w / W)
          const sdy = cy * (sdf.h / H)
          if (sdf.sample(sdx, sdy) >= 0) continue
          // Color by hue, alpha by local density approximation (fixed low)
          ctx.fillStyle = `hsla(${hue},75%,60%,0.55)`
          ctx.fillRect(cx, cy, 1.2, 1.2)
        }
        // Store last position
        pp[si] = p; px[si] = x
      }
    })
  },
}
