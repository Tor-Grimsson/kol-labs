

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Lissajous Knot Shadow — 3D Lissajous knot projected onto a rotating plane.
// As viewpoint angle α rotates, the 2D shadow changes topology: crossings appear/vanish.
// Ref: https://en.wikipedia.org/wiki/Lissajous_knot

const PARAMS          = [
  { key: 'nx', type: 'int', min: 1, max: 7, default: 3, label: 'freq X' },
  { key: 'ny', type: 'int', min: 1, max: 7, default: 5, label: 'freq Y' },
  { key: 'nz', type: 'int', min: 1, max: 7, default: 7, label: 'freq Z' },
  { key: 'omega', type: 'range', min: 0.01, max: 0.5, default: 0.12, step: 0.01, label: 'spin' },
  { key: 'trail', type: 'int', min: 200, max: 3000, default: 1200, step: 100 },
]

const TWO_PI = Math.PI * 2

export const r2_spec_02_lissajous_knot            = {
  id: 'r2-spec-02-lissajous-knot',
  name: 'LISSAJOUS KNOT SHADOW',
  repo: 'Cromwell 2004 · en.wikipedia.org/wiki/Lissajous_knot',
  summary: '3D Lissajous knot (nx,ny,nz coprime) projected onto a slowly rotating plane — shadow topology changes continuously.',
  helps: 'Delivers genuine "almost 3D" rotation without a 3D pipeline; two ints drive knot class, one float drives animation.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    // Fixed phase offsets per run to avoid degenerate projections at t=0
    const phiX = rng() * TWO_PI
    const phiY = rng() * TWO_PI
    const phiZ = rng() * TWO_PI

    const R = Math.min(W, H) * 0.44
    const CX = W / 2
    const CY = H / 2
    const STEPS = 600 // parametric resolution of one knot loop

    return wrapLoop(() => {
      const nx = num(params, 'nx', 3)
      const ny = num(params, 'ny', 5)
      const nz = num(params, 'nz', 7)
      const omega = num(params, 'omega', 0.12)
      const trail = num(params, 'trail', 1200)

      // Slow viewpoint rotation angle
      const alpha = clock.nowSeconds() * omega

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const DRAW = Math.min(STEPS, trail)
      ctx.lineWidth = 1.1

      for (let i = 0; i < DRAW - 1; i++) {
        const t0 = (i / STEPS) * TWO_PI
        const t1 = ((i + 1) / STEPS) * TWO_PI

        // 3D knot points
        const x0 = Math.cos(nx * t0 + phiX)
        const y0 = Math.cos(ny * t0 + phiY)
        const z0 = Math.cos(nz * t0 + phiZ)

        const x1 = Math.cos(nx * t1 + phiX)
        const y1 = Math.cos(ny * t1 + phiY)
        const z1 = Math.cos(nz * t1 + phiZ)

        // Project: rotate x,z by alpha, keep y
        const px0 = CX + R * (x0 * Math.cos(alpha) + z0 * Math.sin(alpha))
        const py0 = CY + R * y0
        const px1 = CX + R * (x1 * Math.cos(alpha) + z1 * Math.sin(alpha))
        const py1 = CY + R * y1

        if (sdf.sample(px0 * sdf.w / W, py0 * sdf.h / H) > 2) continue

        const age = i / DRAW
        const alpha01 = (1 - age) * 0.8
        const hue = 220 + (t0 / TWO_PI) * 100
        ctx.strokeStyle = `hsla(${hue.toFixed(0)},80%,70%,${alpha01.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(px0, py0)
        ctx.lineTo(px1, py1)
        ctx.stroke()
      }
    })
  },
}
