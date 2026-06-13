// Active Nematics — apolar SPP proxy (Doostmohammadi et al. 2018)
// Head-tail symmetric rods: nematic alignment rule (angle mod π).
// At low noise: +½ comet defects self-propel; −½ trefoils stay put.
// Alignment uses the 2θ trick: average e^{2iθ} then halve back.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common'

const PARAMS          = [
  { key: 'N',       type: 'int',   min: 300,  max: 3000, default: 1400, step: 100, label: 'rods' },
  { key: 'v0',      type: 'range', min: 0.1,  max: 2.5,  default: 0.7,  step: 0.1, label: 'self-prop speed' },
  { key: 'align',   type: 'range', min: 0.0,  max: 1.0,  default: 0.85, step: 0.05, label: 'align strength' },
  { key: 'noise',   type: 'range', min: 0.0,  max: 1.0,  default: 0.15, step: 0.02, label: 'orient noise Dr' },
  { key: 'R',       type: 'range', min: 4,    max: 35,   default: 14,   step: 2,   label: 'interact radius' },
]

                                                  // a in [0, π) — head-tail symmetric

export const r2_act_02_nematics            = {
  id: 'r2-act-02-nematics',
  name: 'ACTIVE NEMATICS',
  repo: 'Doostmohammadi et al. Nat. Commun. 9 3246 (2018)',
  summary: 'Apolar rods with nematic (±) alignment. +½ defect comets self-propel; −½ trefoils anchor. Continuous nucleation/annihilation generates active turbulence.',
  helps: 'Defect trajectories trace the letterform; chaos regime fills glyph with churning eddies.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const scx = W / sdf.w, scy = H / sdf.h

    const rods        = []
    const init = (r     ) => {
      const [x, y] = sampleInside(sdf, rng)
      r.x = x; r.y = y
      r.a = rng() * Math.PI // only [0, π) — head-tail symmetry
    }
    for (let i = 0; i < num(params, 'N', 1400); i++) {
      const r      = { x: 0, y: 0, a: 0 }
      init(r)
      rods.push(r)
    }

    return wrapLoop(() => {
      const N     = num(params, 'N', 1400)
      const v0    = num(params, 'v0', 0.7)
      const align = num(params, 'align', 0.85)
      const noise = num(params, 'noise', 0.15)
      const R     = num(params, 'R', 14)
      const R2    = R * R

      while (rods.length < N) { const r      = { x: 0, y: 0, a: 0 }; init(r); rods.push(r) }
      if (rods.length > N) rods.length = N

      // grid
      const cs = Math.max(R, 8)
      const gw = Math.ceil(sdf.w / cs) + 1
      const gh = Math.ceil(sdf.h / cs) + 1
      const grid             = Array.from({ length: gw * gh }, () => [])
      for (let i = 0; i < rods.length; i++) {
        const gx = Math.max(0, Math.min(gw - 1, (rods[i].x / cs) | 0))
        const gy = Math.max(0, Math.min(gh - 1, (rods[i].y / cs) | 0))
        grid[gy * gw + gx].push(i)
      }

      for (let i = 0; i < rods.length; i++) {
        const rod = rods[i]
        // nematic average: use 2θ trick
        let cx2 = 0, cy2 = 0
        const gx = (rod.x / cs) | 0, gy = (rod.y / cs) | 0
        for (let dj = -1; dj <= 1; dj++) {
          const row = gy + dj
          if (row < 0 || row >= gh) continue
          for (let di = -1; di <= 1; di++) {
            const col = gx + di
            if (col < 0 || col >= gw) continue
            for (const j of grid[row * gw + col]) {
              const dx = rods[j].x - rod.x, dy = rods[j].y - rod.y
              if (dx * dx + dy * dy > R2) continue
              cx2 += Math.cos(2 * rods[j].a)
              cy2 += Math.sin(2 * rods[j].a)
            }
          }
        }
        const nemAngle = Math.atan2(cy2, cx2) / 2 // back to [0, π)
        const dr = noise * (rng() - 0.5) * Math.PI
        rod.a = rod.a * (1 - align) + nemAngle * align + dr

        // self-propel along rod head direction
        const nx = rod.x + Math.cos(rod.a) * v0
        const ny = rod.y + Math.sin(rod.a) * v0

        if (sdf.sample(nx, ny) < 0) {
          rod.x = nx; rod.y = ny
        } else {
          // reflect: try flipping head — apolar rods can reverse
          const rx = rod.x - Math.cos(rod.a) * v0 * 0.5
          const ry = rod.y - Math.sin(rod.a) * v0 * 0.5
          if (sdf.sample(rx, ry) < 0) {
            rod.x = rx; rod.y = ry
            rod.a += Math.PI // flip direction
          } else {
            // push inward along SDF gradient
            const [gX, gY] = sdfGrad(sdf, rod.x, rod.y)
            const gm = Math.hypot(gX, gY) || 1
            rod.x -= (gX / gm) * v0
            rod.y -= (gY / gm) * v0
          }
        }
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(200,230,255,0.15)', 1)

      // Draw rods as short oriented line segments; colour by orientation
      for (const rod of rods) {
        const hue = ((rod.a / Math.PI) * 180) % 360
        ctx.strokeStyle = `hsla(${hue.toFixed(0)},75%,70%,0.6)`
        ctx.lineWidth = 1.1
        const len = 4
        const cx = rod.x * scx, cy = rod.y * scy
        const dx = Math.cos(rod.a) * len, dy = Math.sin(rod.a) * len
        ctx.beginPath()
        ctx.moveTo(cx - dx, cy - dy)
        ctx.lineTo(cx + dx, cy + dy)
        ctx.stroke()
      }
    })
  },
}
