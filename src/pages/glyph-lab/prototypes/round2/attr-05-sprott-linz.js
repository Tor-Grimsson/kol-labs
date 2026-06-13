

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Sprott-Linz F — algebraically simplest known chaotic 3D ODE (5 terms).
// "Jerk" system. Single scroll visible in xz projection.
// Ref: https://sprott.physics.wisc.edu/pubs/PAPER229.HTM

const PARAMS          = [
  { key: 'a', type: 'range', min: 0.3, max: 0.7, default: 0.5, step: 0.005, label: 'a (Linz)' },
  { key: 'dt', type: 'range', min: 0.01, max: 0.1, default: 0.05, step: 0.005, label: 'step dt' },
  { key: 'trails', type: 'int', min: 1, max: 6, default: 3, label: 'trail count' },
  { key: 'tail', type: 'int', min: 200, max: 4000, default: 2500, label: 'tail length' },
  { key: 'jitter', type: 'range', min: 0, max: 0.01, default: 0.001, step: 0.0005, label: 'IC jitter' },
]

function rk4Linz(x        , y        , z        , a        , dt        )                           {
  // dx/dt=y, dy/dt=z, dz/dt=−a·z + y²−x
  const F = (x        , y        , z        )                           => [
    y, z, -a * z + y * y - x,
  ]
  const [k1x, k1y, k1z] = F(x, y, z)
  const [k2x, k2y, k2z] = F(x+dt/2*k1x, y+dt/2*k1y, z+dt/2*k1z)
  const [k3x, k3y, k3z] = F(x+dt/2*k2x, y+dt/2*k2y, z+dt/2*k2z)
  const [k4x, k4y, k4z] = F(x+dt*k3x, y+dt*k3y, z+dt*k3z)
  return [
    x + dt/6*(k1x+2*k2x+2*k3x+k4x),
    y + dt/6*(k1y+2*k2y+2*k3y+k4y),
    z + dt/6*(k1z+2*k2z+2*k3z+k4z),
  ]
}

export const r2_attr_05_sprott_linz            = {
  id: 'r2-attr-05-sprott-linz',
  name: 'LINZ-F JERK',
  repo: 'Sprott 1997 · sprott.physics.wisc.edu/pubs/PAPER229.HTM',
  summary: 'Sprott-Linz F jerk system — algebraically the simplest 3D chaotic ODE. xz-projected trail with IC perturbation shows sensitive dependence on initial conditions.',
  helps: 'Single-scroll roll wraps continuously; the chaotic jumps read as organic letterform motion without tangled hairball density.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const maxTail = 4000
    const maxTrails = 6
    const bufs = Array.from({ length: maxTrails }, (_, i) => ({
      xs: new Float32Array(maxTail),
      ys: new Float32Array(maxTail), // this is the z channel (xz projection)
      ds: new Float32Array(maxTail), // y-channel as depth cue
      head: 0, len: 0,
      cx: 0.1, cy: 0.0, cz: 0.0,
    }))
    // Warm up — each trail from same IC, will diverge via jitter
    for (let ti = 0; ti < maxTrails; ti++) {
      let [x, y, z] = [0.1, 0.0, 0.0]
      for (let i = 0; i < 500; i++) [x, y, z] = rk4Linz(x, y, z, 0.5, 0.05)
      bufs[ti].cx = x + (rng() - 0.5) * 0.002
      bufs[ti].cy = y + (rng() - 0.5) * 0.002
      bufs[ti].cz = z + (rng() - 0.5) * 0.002
    }

    // xz extent roughly [-2.5, 2.5] × [-5, 5]; scale to glyph
    const scX = Math.min(W, H) * 0.17
    const scZ = Math.min(W, H) * 0.085
    const OX = W * 0.5, OY = H * 0.5

    return wrapLoop(() => {
      const a = num(params, 'a', 0.5)
      const dt = num(params, 'dt', 0.05)
      const nTrails = Math.min(maxTrails, num(params, 'trails', 3))
      const tail = Math.min(maxTail, num(params, 'tail', 2500))
      const jitter = num(params, 'jitter', 0.001)
      const STEPS = 6

      clear(ctx, W, H, 'rgba(10,11,20,0.16)')
      strokeOutline(ctx, sdf, W, H)

      for (let ti = 0; ti < nTrails; ti++) {
        const tr = bufs[ti]
        for (let s = 0; s < STEPS; s++) {
          const [nx, ny, nz] = rk4Linz(tr.cx, tr.cy, tr.cz, a, dt)
          // Apply tiny IC jitter periodically to show sensitivity
          const pjit = jitter * Math.sin(clock.nowSeconds() * 0.3 + ti * 1.1)
          tr.cx = nx + pjit * 0.001
          tr.cy = ny; tr.cz = nz
          // xz projection: x → canvas x, z → canvas y
          tr.xs[tr.head] = nx
          tr.ys[tr.head] = nz
          tr.ds[tr.head] = ny // y as depth
          tr.head = (tr.head + 1) % maxTail
          if (tr.len < maxTail) tr.len++
        }

        const drawLen = Math.min(tr.len, tail)
        const hue = 280 + ti * 30
        for (let i = 0; i < drawLen - 1; i++) {
          const age = i / drawLen
          const i0 = (tr.head - 1 - i + maxTail) % maxTail
          const i1 = (tr.head - 2 - i + maxTail) % maxTail
          const px0 = OX + tr.xs[i0] * scX
          const py0 = OY + tr.ys[i0] * scZ
          const px1 = OX + tr.xs[i1] * scX
          const py1 = OY + tr.ys[i1] * scZ
          // y-channel depth: y in [-3, 3]
          const depth = Math.max(0, Math.min(1, (tr.ds[i0] + 3) / 6))
          const alpha = (1 - age) * (0.3 + depth * 0.6)
          ctx.strokeStyle = `hsla(${hue},75%,${45+depth*35}%,${alpha.toFixed(3)})`
          ctx.lineWidth = 0.5 + depth * 1.0
          ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke()
        }
      }
    })
  },
}
