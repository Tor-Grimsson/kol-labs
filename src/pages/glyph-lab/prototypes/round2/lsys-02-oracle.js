// Open L-System — SDF as environment oracle.
// Each F(l) module queries sdf(pos) before committing its step.
// Outside → fires a steer-back rule; inside → normal elongation + taper.
// One derivation generation per clock interval; string grows incrementally.
//
// Reference: Mech & Prusinkiewicz, SIGGRAPH 96 "Visual Models of Plants
//            Interacting with Their Environment".



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, inwardDir } from '../common'

const PARAMS          = [
  { key: 'angle',    type: 'range', min: 10,  max: 70,  default: 30,  step: 1,    label: 'branch angle °' },
  { key: 'genRate',  type: 'range', min: 0.1, max: 4,   default: 1.2, step: 0.1,  label: 'gens/sec' },
  { key: 'baseLen',  type: 'range', min: 3,   max: 20,  default: 10,  step: 0.5,  label: 'base length' },
  { key: 'taper',    type: 'range', min: 0.5, max: 0.98,default: 0.8, step: 0.01, label: 'length ratio' },
  { key: 'maxGen',   type: 'int',   min: 2,   max: 10,  default: 7,   step: 1,    label: 'max gens' },
]











export const r2_lsys_02_oracle            = {
  id: 'r2-lsys-02-oracle',
  name: 'OPEN L-SYSTEM SDF ORACLE',
  repo: 'Mech & Prusinkiewicz SIGGRAPH 96',
  summary: 'Each F module queries the SDF oracle before committing growth; outside the glyph it fires a reorientation rule back toward the interior.',
  helps: 'True open-environment L-system where boundary decisions are per-module, not post-clipped — gives organic edge-hugging with steering artefacts visible.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const mods           = []
    // Axiom: single upward-pointing trunk from centroid
    const cx = sdf.w / 2, cy = sdf.h / 2
    mods.push({ x: cx, y: cy, heading: -Math.PI / 2,
      gen: 0, parent: -1, length: 0, alive: true })

    // pending tips that haven't been derived yet (generation 0 = axiom endpoints)
    let pendingTips           = [0]
    let lastGen = clock.nowSeconds()

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const angleRad = (num(params, 'angle', 30) * Math.PI) / 180
      const genRate  = num(params, 'genRate', 1.2)
      const baseLen  = num(params, 'baseLen', 10)
      const taper    = num(params, 'taper', 0.8)
      const maxGen   = num(params, 'maxGen', 7)

      // --- One derivation step per interval ---
      const interval = 1 / genRate
      if (t - lastGen >= interval && pendingTips.length > 0) {
        lastGen = t
        const nextTips           = []

        for (const idx of pendingTips) {
          const m = mods[idx]
          if (m.gen >= maxGen) continue

          const len = baseLen * Math.pow(taper, m.gen)

          // Attempt to grow forward: query oracle
          const nx = m.x + Math.cos(m.heading) * len
          const ny = m.y + Math.sin(m.heading) * len

          if (sdf.sample(nx, ny) < 0) {
            // Inside — normal F production
            const ci = mods.length
            mods.push({ x: nx, y: ny, heading: m.heading, gen: m.gen + 1,
              parent: idx, length: len, alive: true })
            nextTips.push(ci)

            // Stochastic lateral bud
            if (rng() < 0.6) {
              const a = m.heading + (rng() < 0.5 ? -1 : 1) * angleRad * (0.7 + rng() * 0.6)
              const bx = m.x + Math.cos(a) * len * 0.9
              const by = m.y + Math.sin(a) * len * 0.9
              if (sdf.sample(bx, by) < 0) {
                const bi = mods.length
                mods.push({ x: bx, y: by, heading: a, gen: m.gen + 1,
                  parent: idx, length: len * 0.9, alive: true })
                nextTips.push(bi)
              }
            }
          } else {
            // Outside — steer-back rule: reorient toward interior, retry once
            const [ix, iy] = inwardDir(sdf, m.x, m.y)
            // blend heading 50% toward inward direction
            const steer = Math.atan2(
              Math.sin(m.heading) + iy,
              Math.cos(m.heading) + ix,
            )
            const rx = m.x + Math.cos(steer) * len * 0.6
            const ry = m.y + Math.sin(steer) * len * 0.6
            if (sdf.sample(rx, ry) < 0) {
              const ri = mods.length
              mods.push({ x: rx, y: ry, heading: steer, gen: m.gen + 1,
                parent: idx, length: len * 0.6, alive: true })
              nextTips.push(ri)
            }
            // no retry inside — module terminates
          }
        }

        pendingTips = nextTips
      }

      // --- Render ---
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.18)', 1)

      ctx.lineCap = 'round'
      for (let i = 1; i < mods.length; i++) {
        const m = mods[i]
        if (m.parent < 0) continue
        const p = mods[m.parent]
        const ageAlpha = 0.3 + 0.6 * (1 - m.gen / (maxGen || 1))
        ctx.strokeStyle = `rgba(200,220,245,${ageAlpha.toFixed(2)})`
        ctx.lineWidth = Math.max(0.5, 2.8 - m.gen * 0.35)
        ctx.beginPath()
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(m.x * sx, m.y * sy)
        ctx.stroke()
      }

      // Active tips in accent colour
      ctx.fillStyle = '#f3c9c4'
      for (const idx of pendingTips) {
        const m = mods[idx]
        ctx.beginPath()
        ctx.arc(m.x * sx, m.y * sy, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
