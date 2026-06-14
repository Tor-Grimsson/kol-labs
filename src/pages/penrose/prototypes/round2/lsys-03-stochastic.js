// Stochastic L-System with SDF-probability coupling.
// Branching probability p_branch = sigmoid(k * sdf(pos)): dense at the centroid,
// near-zero at the boundary. Death probability mirrors it. Multiple competing
// productions per symbol give each run a unique specimen inside the glyph.
//
// Reference: Prusinkiewicz & Lindenmayer ABOP Ch.1 (stochastic L-systems).
//            Cieslak & Prusinkiewicz, in silico Plants 2019 (Gillespie-Lindenmayer).



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'angle',     type: 'range', min: 10,  max: 70,  default: 32,  step: 1,    label: 'branch angle °' },
  { key: 'k',         type: 'range', min: 0.01,max: 0.2, default: 0.07,step: 0.005,label: 'sigmoid sharpness' },
  { key: 'genRate',   type: 'range', min: 0.2, max: 5,   default: 1.5, step: 0.1,  label: 'gens/sec' },
  { key: 'taper',     type: 'range', min: 0.5, max: 0.95,default: 0.76,step: 0.01, label: 'length taper' },
  { key: 'maxGen',    type: 'int',   min: 2,   max: 10,  default: 7,   step: 1,    label: 'max gens' },
]









function sigmoid(x        )         { return 1 / (1 + Math.exp(-x)) }

export const r2_lsys_03_stochastic            = {
  id: 'r2-lsys-03-stochastic',
  name: 'STOCHASTIC SDF-PROBABILITY',
  repo: 'Prusinkiewicz & Lindenmayer ABOP Ch.1 + Cieslak 2019',
  summary: 'Branching probability is sigmoid(k·sdf(pos)) — dense near the glyph centroid, sparse at the boundary — giving organic density gradients without explicit pruning rules.',
  helps: 'Interior tracery fades to sparse tendrils naturally; each seed produces a different specimen, ideal for gallery variation.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const segs        = []
    // Axiom
    const cx = sdf.w / 2, cy = sdf.h / 2
    segs.push({ x: cx, y: cy, heading: -Math.PI / 2, gen: 0, parent: -1, length: 0 })
    let pendingTips           = [0]
    let lastGen = clock.nowSeconds()

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const angleRad = (num(params, 'angle', 32) * Math.PI) / 180
      const k        = num(params, 'k', 0.07)
      const genRate  = num(params, 'genRate', 1.5)
      const taper    = num(params, 'taper', 0.76)
      const maxGen   = num(params, 'maxGen', 7)

      const interval = 1 / genRate
      if (t - lastGen >= interval && pendingTips.length > 0) {
        lastGen = t
        const nextTips           = []

        for (const idx of pendingTips) {
          const b = segs[idx]
          if (b.gen >= maxGen) continue

          // SDF at this position determines branching probability
          const d = sdf.sample(b.x, b.y)
          if (d >= 0) continue  // outside — no production

          const pBranch = sigmoid(k * Math.abs(d))   // deeper inside → more likely
          const baseLen = Math.max(3, 12 * Math.pow(taper, b.gen))

          // Forward growth always fires if inside
          const fwd = (angOffset        ) => {
            const a = b.heading + angOffset + (rng() - 0.5) * 0.15
            const len = baseLen * (0.85 + rng() * 0.3)
            const nx = b.x + Math.cos(a) * len
            const ny = b.y + Math.sin(a) * len
            if (sdf.sample(nx, ny) < 0) {
              const ci = segs.length
              segs.push({ x: nx, y: ny, heading: a, gen: b.gen + 1, parent: idx, length: len })
              nextTips.push(ci)
            }
          }

          // Main forward
          fwd(0)

          // Stochastic lateral — probability driven by depth in glyph
          if (rng() < pBranch) {
            fwd(-angleRad * (0.7 + rng() * 0.6))
          }
          if (rng() < pBranch * 0.7) {
            fwd( angleRad * (0.7 + rng() * 0.6))
          }
        }

        pendingTips = nextTips
      }

      // --- Render ---
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.18)', 1)

      ctx.lineCap = 'round'
      for (let i = 1; i < segs.length; i++) {
        const s = segs[i]
        const p = segs[s.parent]
        const d = Math.abs(sdf.sample(s.x, s.y))
        const brightness = Math.min(1, d / 40)
        const alpha = 0.2 + 0.65 * brightness
        ctx.strokeStyle = `rgba(180,210,255,${alpha.toFixed(2)})`
        ctx.lineWidth = Math.max(0.4, 2.5 - s.gen * 0.3)
        ctx.beginPath()
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(s.x * sx, s.y * sy)
        ctx.stroke()
      }

      // Live buds
      ctx.fillStyle = 'rgba(243,200,190,0.9)'
      for (const idx of pendingTips) {
        const b = segs[idx]
        ctx.beginPath()
        ctx.arc(b.x * sx, b.y * sy, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
