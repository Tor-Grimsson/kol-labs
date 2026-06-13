// Context-sensitive L-System — auxin signal propagation.
// A nutrient signal is emitted by modules deep inside the glyph and propagates
// acropetally (root-to-tip) each derivation step. Modules whose signal falls
// below threshold stop growing and begin to die. Modules at the glyph boundary
// are cut off first, so die-back ripples inward visibly across frames.
//
// Reference: Prusinkiewicz & Lindenmayer ABOP Ch.3 (2L-systems, map systems).
//            Signal wave: "B < A(x) > b : x > threshold → A(x * decay) B".



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'angle',     type: 'range', min: 10,  max: 70,  default: 30,  step: 1,    label: 'branch angle °' },
  { key: 'genRate',   type: 'range', min: 0.2, max: 4,   default: 1.0, step: 0.1,  label: 'gens/sec' },
  { key: 'decay',     type: 'range', min: 0.5, max: 0.99,default: 0.82,step: 0.01, label: 'signal decay' },
  { key: 'threshold', type: 'range', min: 0.01,max: 0.5, default: 0.1, step: 0.01, label: 'death threshold' },
  { key: 'maxGen',    type: 'int',   min: 2,   max: 10,  default: 7,   step: 1,    label: 'max gens' },
]













export const r2_lsys_05_signal            = {
  id: 'r2-lsys-05-signal',
  name: 'SIGNAL WAVE PROPAGATION',
  repo: 'Prusinkiewicz & Lindenmayer ABOP Ch.3 (2L-systems)',
  summary: 'Auxin signal emitted at interior nodes propagates root-to-tip each step; boundary modules are cut off first and die-back ripples inward, creating visible signal-wave expansion and retraction.',
  helps: 'Adds a temporal die-back mechanic not present in any other variant — the plant simultaneously grows forward and prunes backward from the boundary.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const nodes         = []
    const cx = sdf.w / 2, cy = sdf.h / 2
    nodes.push({
      x: cx, y: cy, heading: -Math.PI / 2,
      gen: 0, parent: -1, length: 0,
      signal: 1.0, alive: true, children: [], pendingGrowth: true,
    })

    let lastGen = clock.nowSeconds()

    // --- Propagate signal down the tree (acropetal pass) ---
    // Root signal = sdf_depth clamped to [0,1]; each child inherits parent * decay
    function propagateSignals(decay        ) {
      // BFS root → leaves
      const queue           = [0]
      while (queue.length > 0) {
        const idx = queue.shift()
        const n = nodes[idx]
        // Root signal from SDF
        if (n.parent < 0) {
          const d = -sdf.sample(n.x, n.y)   // positive inside
          n.signal = Math.min(1, Math.max(0, d / 30))
        } else {
          const p = nodes[n.parent]
          // Cut off if outside; decay from parent otherwise
          const d = sdf.sample(n.x, n.y)
          if (d >= 0) {
            n.signal = 0  // outside — no signal
          } else {
            n.signal = p.signal * decay
          }
        }
        for (const c of n.children) queue.push(c)
      }
    }

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const angleRad  = (num(params, 'angle', 30) * Math.PI) / 180
      const genRate   = num(params, 'genRate', 1.0)
      const decay     = num(params, 'decay', 0.82)
      const threshold = num(params, 'threshold', 0.1)
      const maxGen    = num(params, 'maxGen', 7)

      const interval = 1 / genRate
      if (t - lastGen >= interval) {
        lastGen = t

        // Step 1: propagate signals (context-sensitive pass)
        propagateSignals(decay)

        // Step 2: kill nodes below threshold
        for (const n of nodes) {
          if (n.signal < threshold) n.alive = false
        }

        // Step 3: grow from live pending tips
        const growable = nodes.reduce          ((acc, n, i) => {
          if (n.alive && n.pendingGrowth && n.gen < maxGen) acc.push(i)
          return acc
        }, [])

        for (const idx of growable) {
          const n = nodes[idx]
          n.pendingGrowth = false
          if (!n.alive) continue

          const baseLen = Math.max(3, 12 * Math.pow(0.78, n.gen))

          const spawn = (angOffset        , lenMul = 1) => {
            const a = n.heading + angOffset + (rng() - 0.5) * 0.15
            const len = baseLen * lenMul * (0.85 + rng() * 0.3)
            const nx = n.x + Math.cos(a) * len
            const ny = n.y + Math.sin(a) * len
            if (sdf.sample(nx, ny) < 0) {
              const ci = nodes.length
              nodes.push({
                x: nx, y: ny, heading: a, gen: n.gen + 1,
                parent: idx, length: len,
                signal: n.signal * decay,
                alive: true, children: [], pendingGrowth: true,
              })
              n.children.push(ci)
            }
          }

          spawn(0)
          if (n.signal > 0.3 && rng() < 0.55) spawn(-angleRad * (0.7 + rng() * 0.5))
          if (n.signal > 0.4 && rng() < 0.4)  spawn( angleRad * (0.7 + rng() * 0.5))
        }
      }

      // --- Render ---
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.18)', 1)

      ctx.lineCap = 'round'
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i]
        const p = nodes[n.parent]
        if (!n.alive) {
          // Dead branches: very faint grey
          ctx.strokeStyle = 'rgba(90,90,110,0.25)'
          ctx.lineWidth = 0.5
        } else {
          // Alive: hue shifts from warm (high signal) to cool (low signal)
          const hue = 240 - n.signal * 120   // 240=blue at low, 120=green/yellow at high
          const a = 0.3 + 0.65 * n.signal
          ctx.strokeStyle = `hsla(${hue.toFixed(0)},70%,72%,${a.toFixed(2)})`
          ctx.lineWidth = Math.max(0.5, 2.4 - n.gen * 0.28)
        }
        ctx.beginPath()
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(n.x * sx, n.y * sy)
        ctx.stroke()
      }

      // Root signal indicator
      const rootSig = nodes[0].signal
      ctx.fillStyle = `hsla(${(120 + rootSig * 80).toFixed(0)},80%,70%,0.9)`
      ctx.beginPath()
      ctx.arc(nodes[0].x * sx, nodes[0].y * sy, 2.5, 0, Math.PI * 2)
      ctx.fill()
    })
  },
}
