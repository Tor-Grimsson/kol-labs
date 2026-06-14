
import { clear, strokeOutline, wrapLoop, sampleInside } from './common'

// Procedural branching tree using space-colonization-like growth rules.
// A pragmatic L-system substitute: interpret branching stochastically with
// angle jitter and SDF clamping. Produces recursive vector branches.
//
// Reference: algorithmicbotany.org (Prusinkiewicz canon) · Nature of Code ch. 8.
export const lSystem            = {
  id: '12-l-system',
  name: 'L-SYSTEM / FRACTAL BRANCH',
  repo: 'algorithmicbotany.org · Shiffman Nature of Code Ch.8',
  summary:
    'Recursive branching with stochastic angle + length rules. Each tick: pick a live tip; if SDF permits growth, spawn one or two children at angle jitter. Produces classical tree / lightning / coral branching. Research flagged this as a deprioritized candidate for glyph fill because branches naturally escape domains — here they are SDF-clamped to demonstrate the limit.',
  helps:
    'Branches stop at SDF → you see dead tips stranded inside. Space colonization (#03) does what L-systems can\'t: it grows branches that respect the shape. Keep for comparison.',
  init({ ctx, sdf, W, H, rng }) {
    const sx = W / sdf.w, sy = H / sdf.h


    const branches           = []
    const [x0, y0] = sampleInside(sdf, rng)
    branches.push({ x: x0, y: y0, a: -Math.PI / 2, depth: 0, parent: -1, length: 10, done: false })
    const maxDepth = 11
    const branchChance = 0.35
    const endpointAngleJitter = 0.4

    return wrapLoop(() => {
      // one growth step per frame: each "not-done" branch tries to grow one child
      const toGrow           = []
      for (let i = 0; i < branches.length; i++) if (!branches[i].done) toGrow.push(i)
      for (const idx of toGrow) {
        const b = branches[idx]
        b.done = true // we only grow each once
        if (b.depth >= maxDepth) continue
        const produce = (angOff        ) => {
          const ang = b.a + angOff + (rng() - 0.5) * endpointAngleJitter
          const len = b.length * (0.72 + rng() * 0.12)
          const nx = b.x + Math.cos(ang) * len
          const ny = b.y + Math.sin(ang) * len
          if (sdf.sample(nx, ny) >= 0) return
          branches.push({
            x: nx, y: ny, a: ang, depth: b.depth + 1, parent: idx, length: len, done: false,
          })
        }
        const forks = rng() < branchChance ? 2 : 1
        if (forks === 2) {
          produce(-0.45 + (rng() - 0.5) * 0.2)
          produce(0.45 + (rng() - 0.5) * 0.2)
        } else {
          produce(0)
        }
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.18)', 1)

      ctx.strokeStyle = 'rgba(210, 215, 235, 0.8)'
      ctx.lineWidth = 1.1
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const b of branches) {
        if (b.parent < 0) continue
        const p = branches[b.parent]
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(b.x * sx, b.y * sy)
      }
      ctx.stroke()

      ctx.fillStyle = '#f3c9c4'
      for (const b of branches) {
        ctx.beginPath()
        ctx.arc(b.x * sx, b.y * sy, 1.1, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
