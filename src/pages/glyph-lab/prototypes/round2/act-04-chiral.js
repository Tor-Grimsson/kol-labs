// Chiral Active Matter — Circle Swimmers (Liebchen & Levis PRL 2017)
// Intrinsic torque ω₀ makes each particle swim in circles.
// At intermediate density: synchronised microflocks each orbiting in phase.
// At high density: spontaneous vortex lattice — co-rotating clusters tile the glyph.
// Bimodal ω₀ = ±ω creates counter-rotating pairs.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common'

const PARAMS          = [
  { key: 'N',      type: 'int',   min: 300,  max: 3000, default: 1000, step: 100, label: 'particles' },
  { key: 'v0',     type: 'range', min: 0.2,  max: 3.0,  default: 0.9,  step: 0.1, label: 'self-prop speed' },
  { key: 'omega',  type: 'range', min: 0.01, max: 0.5,  default: 0.08, step: 0.01, label: 'chirality ω₀' },
  { key: 'Dr',     type: 'range', min: 0.0,  max: 0.15, default: 0.02, step: 0.005, label: 'noise Dr' },
  { key: 'mixed',  type: 'range', min: 0.0,  max: 1.0,  default: 0.0,  step: 0.1, label: 'mixed hand %' },
]



export const r2_act_04_chiral            = {
  id: 'r2-act-04-chiral',
  name: 'CHIRAL CIRCLE SWIMMERS',
  repo: 'Liebchen & Levis Phys. Rev. Lett. 119 058002 (2017)',
  summary: 'Circle swimmers with intrinsic torque ω₀. Low ω₀: large vortex structures. High ω₀: micro-vortex lattice tiles the glyph. Mixed chirality produces counter-rotating pairs.',
  helps: 'Stable rotating clusters — no chaos, periodic vortex rotation follows glyph geometry.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const scx = W / sdf.w, scy = H / sdf.h

    const swimmers            = []
    const mkSwimmer = (mixedFrac        )          => {
      const [x, y] = sampleInside(sdf, rng)
      const hand         = rng() < mixedFrac ? -1 : 1
      return { x, y, a: rng() * Math.PI * 2, hand }
    }

    const SIGMA = 3.5
    const SIGMA2 = SIGMA * SIGMA

    return wrapLoop(() => {
      const N     = num(params, 'N', 1000)
      const v0    = num(params, 'v0', 0.9)
      const omega = num(params, 'omega', 0.08)
      const Dr    = num(params, 'Dr', 0.02)
      const mixed = num(params, 'mixed', 0.0)

      while (swimmers.length < N) swimmers.push(mkSwimmer(mixed))
      if (swimmers.length > N) swimmers.length = N

      // repulsion grid
      const cs = SIGMA * 2
      const gw = Math.ceil(sdf.w / cs) + 1
      const gh = Math.ceil(sdf.h / cs) + 1
      const grid             = Array.from({ length: gw * gh }, () => [])
      for (let i = 0; i < swimmers.length; i++) {
        const gx = Math.max(0, Math.min(gw - 1, (swimmers[i].x / cs) | 0))
        const gy = Math.max(0, Math.min(gh - 1, (swimmers[i].y / cs) | 0))
        grid[gy * gw + gx].push(i)
      }

      const DT = 0.2
      for (let i = 0; i < swimmers.length; i++) {
        const s = swimmers[i]

        // intrinsic rotation
        s.a += s.hand * omega * DT + Math.sqrt(2 * Dr) * (rng() - 0.5) * 2 * Math.PI * DT

        // soft repulsion
        let fx = 0, fy = 0
        const gx = (s.x / cs) | 0, gy = (s.y / cs) | 0
        for (let dj = -1; dj <= 1; dj++) {
          const row = gy + dj
          if (row < 0 || row >= gh) continue
          for (let di = -1; di <= 1; di++) {
            const col = gx + di
            if (col < 0 || col >= gw) continue
            for (const j of grid[row * gw + col]) {
              if (j === i) continue
              const dx = s.x - swimmers[j].x, dy = s.y - swimmers[j].y
              const d2 = dx * dx + dy * dy
              if (d2 < 1e-6 || d2 > SIGMA2) continue
              const d = Math.sqrt(d2)
              const f = 0.6 * (SIGMA / d - 1)
              fx += (dx / d) * f
              fy += (dy / d) * f
            }
          }
        }

        const nx = s.x + (Math.cos(s.a) * v0 + fx) * DT
        const ny = s.y + (Math.sin(s.a) * v0 + fy) * DT

        if (sdf.sample(nx, ny) < 0) {
          s.x = nx; s.y = ny
        } else {
          // reverse chirality at boundary (concave corners trap opposite-hand)
          s.a += Math.PI * (1 + (rng() - 0.5) * 0.4)
          const [gX, gY] = sdfGrad(sdf, s.x, s.y)
          const gm = Math.hypot(gX, gY) || 1
          s.x -= (gX / gm) * v0 * DT * 0.5
          s.y -= (gY / gm) * v0 * DT * 0.5
        }
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.12)', 1)

      for (const s of swimmers) {
        // CW = warm (coral), CCW = cool (cyan)
        const col = s.hand === 1
          ? `rgba(255,140,100,0.55)`
          : `rgba(100,220,255,0.55)`
        ctx.fillStyle = col
        const ang = s.a
        const cx2 = s.x * scx, cy2 = s.y * scy
        const sz = 4, sz2 = 2.5
        const x0 = cx2 + Math.cos(ang) * sz
        const y0 = cy2 + Math.sin(ang) * sz
        const x1 = cx2 + Math.cos(ang + 2.5) * sz2
        const y1 = cy2 + Math.sin(ang + 2.5) * sz2
        const x2 = cx2 + Math.cos(ang - 2.5) * sz2
        const y2 = cy2 + Math.sin(ang - 2.5) * sz2
        ctx.beginPath()
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath()
        ctx.fill()
      }
    })
  },
}
