

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Dehn Twist Lattice Shear — SL₂(R) continuous shear applied to a foliation
// on the flat torus T²=[0,1]²/~.  Slope animates around the golden ratio
// (irrational) → lines fill the torus densely.  At rational slopes the lines
// lock into closed bundles.  Glyph SDF clips the flat torus.
// Ref: Thurston, Three-Dimensional Geometry and Topology ch.2; Wikipedia — Dehn twist

const PHI = (1 + Math.sqrt(5)) * 0.5 // golden ratio

const PARAMS          = [
  { key: 'lines', type: 'int', min: 10, max: 80, default: 36, step: 2, label: 'line count' },
  { key: 'speed', type: 'range', min: 0, max: 1.5, default: 0.22, step: 0.02, label: 'shear speed' },
  { key: 'amp', type: 'range', min: 0, max: 3, default: 1.2, step: 0.1, label: 'slope amplitude' },
  { key: 'steps', type: 'int', min: 200, max: 3000, default: 1200, step: 100, label: 'steps/line' },
  { key: 'alpha', type: 'range', min: 0.05, max: 0.7, default: 0.28, step: 0.02, label: 'line alpha' },
]

// How close is slope m to a rational p/q with |p|,|q| ≤ maxD?
// Returns 0 (far/irrational) .. 1 (exactly rational)
function rationalProximity(m        , maxD        )         {
  let best = Infinity
  for (let q = 1; q <= maxD; q++) {
    const p = Math.round(m * q)
    const d = Math.abs(m - p / q)
    if (d < best) best = d
  }
  return Math.max(0, 1 - best * maxD * 8)
}

export const r2_topo_05_dehntwist            = {
  id: 'r2-topo-05-dehntwist',
  name: 'DEHN TWIST SHEAR',
  repo: 'Thurston · 3D Geometry ch.2 · en.wikipedia.org/wiki/Dehn_twist',
  summary: 'SL₂(R) shear applied to a line foliation on T²=[0,1]²; slope oscillates around the golden ratio — irrational→dense fill, rational→closed stripe bundles.',
  helps: 'Phase-transition from dense grain to ordered stripes reads as a material crystallizing inside the glyph — wholly distinct motion from any curve prototype.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const NL = num(params, 'lines', 36)
      const speed = num(params, 'speed', 0.22)
      const amp = num(params, 'amp', 1.2)
      const STEPS = num(params, 'steps', 1200)
      const baseAlpha = num(params, 'alpha', 0.28)

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      // Slope oscillates around golden ratio; at rational values lines lock
      const slope = PHI + amp * Math.sin(t * speed)
      const ratProx = rationalProximity(slope, 8)

      // Map flat torus [0,1]² to canvas, centred on sdf bounds
      // sdf coords → canvas: multiply by W/sdf.w, H/sdf.h
      const sw = sdf.w, sh = sdf.h
      const scX = W, scY = H

      // brightness pulse: near rational → lines brighten (structure visible)
      const brightness = 50 + ratProx * 30

      for (let li = 0; li < NL; li++) {
        const s0 = li / NL // starting y-intercept on left edge of torus

        ctx.beginPath()
        let firstPoint = true
        const dx = 1 / STEPS

        for (let i = 0; i <= STEPS; i++) {
          // torus coords: x in [0,1], y = (slope*x + s0) mod 1
          const tx = i * dx
          const ty = ((slope * tx + s0) % 1 + 1) % 1

          // canvas coords
          const cx = tx * scX
          const cy = ty * scY

          // SDF clip
          const sdx = cx / W * sw
          const sdy = cy / H * sh
          if (sdf.sample(sdx, sdy) > 0) {
            firstPoint = true
            continue
          }

          if (firstPoint) { ctx.moveTo(cx, cy); firstPoint = false }
          else ctx.lineTo(cx, cy)
        }

        // Color: hue shifts with slope distance from golden ratio
        const hue = 200 + li * (360 / NL)
        const alpha = baseAlpha * (0.6 + ratProx * 0.4)
        ctx.strokeStyle = `hsla(${hue % 360},65%,${brightness}%,${alpha.toFixed(3)})`
        ctx.lineWidth = 0.6 + ratProx * 0.6
        ctx.stroke()
      }
    })
  },
}
