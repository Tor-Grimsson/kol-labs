

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Rössler attractor (1976) — xy-plane projection as animated trail.
// Trail of N particles continuously integrated via RK4; depth (z) cues alpha.
// Ref: https://en.wikipedia.org/wiki/R%C3%B6ssler_attractor

const PARAMS          = [
  { key: 'a', type: 'range', min: 0.05, max: 0.4, default: 0.2, step: 0.005 },
  { key: 'b', type: 'range', min: 0.05, max: 0.4, default: 0.2, step: 0.005 },
  { key: 'c', type: 'range', min: 3.0, max: 14.0, default: 5.7, step: 0.1 },
  { key: 'dt', type: 'range', min: 0.005, max: 0.08, default: 0.025, step: 0.005, label: 'step dt' },
  { key: 'trails', type: 'int', min: 1, max: 8, default: 4, label: 'trail count' },
  { key: 'tail', type: 'int', min: 200, max: 5000, default: 2000, label: 'tail length' },
]

function rk4Rossler(
  x        , y        , z        ,
  a        , b        , c        , dt        ,
)                           {
  const f = (x        , y        , z        ) =>
    [-y - z, x + a * y, b + z * (x - c)]
  const [k1x, k1y, k1z] = f(x, y, z)
  const [k2x, k2y, k2z] = f(x + dt / 2 * k1x, y + dt / 2 * k1y, z + dt / 2 * k1z)
  const [k3x, k3y, k3z] = f(x + dt / 2 * k2x, y + dt / 2 * k2y, z + dt / 2 * k2z)
  const [k4x, k4y, k4z] = f(x + dt * k3x, y + dt * k3y, z + dt * k3z)
  return [
    x + dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x),
    y + dt / 6 * (k1y + 2 * k2y + 2 * k3y + k4y),
    z + dt / 6 * (k1z + 2 * k2z + 2 * k3z + k4z),
  ]
}

export const r2_attr_01_rossler            = {
  id: 'r2-attr-01-rossler',
  name: 'RÖSSLER TRAIL',
  repo: 'Rössler 1976 · en.wikipedia.org/wiki/Rössler_attractor',
  summary: '3D Rössler attractor integrated per-frame via RK4; xy-projected trails rendered inside the glyph with z-depth alpha cue.',
  helps: 'Sweeping ribbon arm and z-pop reset create clear rhythmic motion — one of the most legible animated attractors at glyph scale.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const nTrails = Math.max(1, num(params, 'trails', 4))
    // Each trail: circular buffer of [x, y, z] in attractor space
    const maxTail = 5000
    const bufs = Array.from({ length: nTrails }, (_, i) => ({
      xs: new Float32Array(maxTail),
      ys: new Float32Array(maxTail),
      zs: new Float32Array(maxTail),
      head: 0,
      len: 0,
      // spread ICs slightly
      cx: 0.1 + (i - nTrails / 2) * 0.07,
      cy: (i - nTrails / 2) * 0.05,
      cz: 0.0,
    }))
    // Warm up
    for (const tr of bufs) {
      let [x, y, z] = [tr.cx, tr.cy, tr.cz]
      for (let i = 0; i < 500; i++) [x, y, z] = rk4Rossler(x, y, z, 0.2, 0.2, 5.7, 0.025)
      tr.cx = x; tr.cy = y; tr.cz = z
    }
    // Rössler xy extent ~[-11,13]×[-10,12]; normalise to glyph
    const SC = Math.min(W, H) * 0.038
    const OX = W * 0.5, OY = H * 0.52

    return wrapLoop(() => {
      const a = num(params, 'a', 0.2)
      const b = num(params, 'b', 0.2)
      const c = num(params, 'c', 5.7)
      const dt = num(params, 'dt', 0.025)
      const tail = Math.min(maxTail, num(params, 'tail', 2000))
      const STEPS = 6 // integrate 6 steps per frame

      clear(ctx, W, H, 'rgba(10,11,20,0.18)')
      strokeOutline(ctx, sdf, W, H)

      for (let ti = 0; ti < nTrails; ti++) {
        const tr = bufs[ti]
        for (let s = 0; s < STEPS; s++) {
          const [nx, ny, nz] = rk4Rossler(tr.cx, tr.cy, tr.cz, a, b, c, dt)
          tr.cx = nx; tr.cy = ny; tr.cz = nz
          tr.xs[tr.head] = nx; tr.ys[tr.head] = ny; tr.zs[tr.head] = nz
          tr.head = (tr.head + 1) % maxTail
          if (tr.len < maxTail) tr.len++
        }
        // Draw trail
        const len = Math.min(tr.len, tail)
        const hue = 200 + ti * 40
        for (let i = 0; i < len - 1; i++) {
          const age = i / len
          const idx0 = (tr.head - 1 - i + maxTail) % maxTail
          const idx1 = (tr.head - 2 - i + maxTail) % maxTail
          const px0 = OX + tr.xs[idx0] * SC
          const py0 = OY + tr.ys[idx0] * SC
          const px1 = OX + tr.xs[idx1] * SC
          const py1 = OY + tr.ys[idx1] * SC
          // z depth cue: z in [-2,10], normalise to [0,1]
          const z = tr.zs[idx0]
          const depth = Math.max(0, Math.min(1, (z + 2) / 12))
          const alpha = (1 - age) * (0.4 + depth * 0.55)
          ctx.strokeStyle = `hsla(${hue},80%,${55 + depth * 25}%,${alpha.toFixed(3)})`
          ctx.lineWidth = 0.8 + depth * 0.8
          ctx.beginPath()
          ctx.moveTo(px0, py0)
          ctx.lineTo(px1, py1)
          ctx.stroke()
        }
      }
    })
  },
}
