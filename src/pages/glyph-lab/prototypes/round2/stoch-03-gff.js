// Gaussian Free Field — Level-Set Animation
// Solve Δh = ξ (white noise) on the glyph interior with Dirichlet BCs at the
// SDF boundary (h=0). Animate by sweeping a height threshold from min→max,
// revealing nested fractal contour lines (Hausdorff dim = 3/2).
//
// Sheffield (2007) Prob. Theory Rel. Fields 139:521



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'res',      type: 'int',   min: 40,  max: 160, default: 90,  step: 10, label: 'grid res' },
  { key: 'sweepSpd', type: 'range', min: 0.1, max: 4.0, default: 1.0, step: 0.1, label: 'sweep speed' },
  { key: 'contrast', type: 'range', min: 0.5, max: 5.0, default: 2.0, step: 0.1, label: 'contrast' },
  { key: 'iters',    type: 'int',   min: 20,  max: 200, default: 80,  step: 10, label: 'solver iters' },
]

export const r2_stoch_03_gff            = {
  id: 'r2-stoch-03-gff',
  name: 'GAUSSIAN FREE FIELD',
  repo: 'Sheffield 2007 · Prob.Theory Rel.Fields 139:521',
  summary: 'Discrete GFF solved via Gauss-Seidel (Dirichlet BC = glyph boundary). Animated by sweeping a threshold through the height field — contour lines are SLE(4) curves with Hausdorff dimension 3/2.',
  helps: 'Static field revealed dynamically — produces iridescent interference-fringe motion unlike any iterative growth prototype.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    let G    = num(params, 'res', 90)
    let spd  = num(params, 'sweepSpd', 1.0)
    let cont = num(params, 'contrast', 2.0)
    let itr  = num(params, 'iters', 80)

    let field = buildField(G, itr)
    let tStart = clock.nowSeconds()

    function buildField(g        , iterations        ) {
      const N      = g * g
      const inside = new Uint8Array(N)
      const h      = new Float32Array(N)  // height field
      const rhs    = new Float32Array(N)  // white noise right-hand side

      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i = y * g + x
          const sx = (x + 0.5) / g * sdf.w
          const sy = (y + 0.5) / g * sdf.h
          if (sdf.sample(sx, sy) < 0) {
            inside[i] = 1
            // Box-Muller for Gaussian noise
            const u1 = Math.max(1e-10, rng()), u2 = rng()
            rhs[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
          }
        }
      }

      // Gauss-Seidel solve: -Δh = ξ  →  4h[i] - Σneighbors h[j] = ξ[i]
      // h[i] = (ξ[i] + Σh[j]) / deg
      for (let iter = 0; iter < iterations; iter++) {
        for (let y = 1; y < g - 1; y++) {
          for (let x = 1; x < g - 1; x++) {
            const i = y * g + x
            if (!inside[i]) continue
            let sum = 0, deg = 0
            for (const ni of [i-1, i+1, i-g, i+g]) {
              if (ni >= 0 && ni < N && inside[ni]) { sum += h[ni]; deg++ }
            }
            if (deg > 0) h[i] = (rhs[i] + sum) / deg
          }
        }
      }

      // normalize to [-1, 1]
      let mn = Infinity, mx = -Infinity
      for (let i = 0; i < N; i++) { if (inside[i]) { mn = Math.min(mn, h[i]); mx = Math.max(mx, h[i]) } }
      const range = mx - mn || 1
      for (let i = 0; i < N; i++) if (inside[i]) h[i] = (h[i] - mn) / range * 2 - 1

      return { inside, h, g, mn, mx }
    }

    function rebuild() {
      G    = num(params, 'res', 90)
      spd  = num(params, 'sweepSpd', 1.0)
      cont = num(params, 'contrast', 2.0)
      itr  = num(params, 'iters', 80)
      field = buildField(G, itr)
      tStart = clock.nowSeconds()
    }

    return wrapLoop(() => {
      spd  = num(params, 'sweepSpd', 1.0)
      cont = num(params, 'contrast', 2.0)

      const { inside, h, g } = field
      const sx = W / g, sy = H / g

      // threshold oscillates smoothly -1 → +1 → -1
      const t     = (clock.nowSeconds() - tStart) * spd
      const theta = Math.sin(t * 0.6) // -1..1

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(240,230,210,0.12)', 1)

      // render: color by (h[i] - theta) clamped — two-tone with band highlight
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i = y * g + x
          if (!inside[i]) continue
          const v    = h[i] - theta  // signed distance from threshold
          const band = Math.exp(-v * v * cont * cont * 4) // contour highlight
          // base: blue-teal fill for h > theta, dark for h < theta
          if (v > 0) {
            const bright = 0.3 + 0.5 * Math.min(1, v * cont)
            const b      = Math.round(120 + bright * 100)
            const g2     = Math.round(160 + bright * 80)
            const alpha  = 0.5 + band * 0.5
            ctx.fillStyle = `rgba(${Math.round(bright * 80)},${g2},${b},${alpha.toFixed(2)})`
          } else {
            ctx.fillStyle = `rgba(10,15,30,0.8)`
          }
          ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5)

          // contour line overlay
          if (band > 0.15) {
            const bv = Math.round(band * 255)
            ctx.fillStyle = `rgba(${bv},${bv},${Math.round(bv * 0.7)},0.9)`
            ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5)
          }
        }
      }
    })
  },
}
