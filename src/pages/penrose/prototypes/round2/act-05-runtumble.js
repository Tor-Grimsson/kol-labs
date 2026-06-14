// Run-and-Tumble Particles with Quorum-Sensing Tumble Rate (Cates & Tailleur 2015)
// E. coli-style: constant-speed "runs" interrupted by random "tumbles" (new direction).
// Quorum sensing: tumble rate λ(ρ) = λ₀ / (1 + ρ/ρ*) → dense regions trap particles.
// Glyph curvature sorts phases: thick strokes collect clusters; thin strokes stay dilute.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common'

const PARAMS          = [
  { key: 'N',      type: 'int',   min: 400,  max: 5000, default: 2000, step: 100, label: 'bacteria' },
  { key: 'v0',     type: 'range', min: 0.2,  max: 3.0,  default: 1.0,  step: 0.1, label: 'run speed v₀' },
  { key: 'lambda', type: 'range', min: 0.005, max: 0.2, default: 0.04, step: 0.005, label: 'base tumble rate λ₀' },
  { key: 'rhoQS',  type: 'range', min: 0.5,  max: 10.0, default: 3.0,  step: 0.5,  label: 'quorum threshold ρ*' },
  { key: 'wall',   type: 'range', min: 0.0,  max: 1.0,  default: 0.5,  step: 0.1,  label: 'wall reflect vs. reset' },
]



export const r2_act_05_runtumble            = {
  id: 'r2-act-05-runtumble',
  name: 'RUN & TUMBLE / QUORUM',
  repo: 'Cates & Tailleur Annu. Rev. Condens. Matter 6 219 (2015)',
  summary: 'Bacteria-style run-and-tumble with density-dependent tumble rate. Dense clusters self-arrest; boundary accumulation highlights glyph curvature.',
  helps: 'Clusters nucleate in thick glyph regions; thin strokes stay dilute — geometry sorts the phases.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const scx = W / sdf.w, scy = H / sdf.h

    const bact              = []
    for (let i = 0; i < num(params, 'N', 2000); i++) {
      const [x, y] = sampleInside(sdf, rng)
      bact.push({ x, y, a: rng() * Math.PI * 2, runTicks: 0 })
    }

    // For run-length visualisation: track run streak
    const streak = new Float32Array(5000)

    return wrapLoop(() => {
      const N      = num(params, 'N', 2000)
      const v0     = num(params, 'v0', 1.0)
      const lambda = num(params, 'lambda', 0.04)
      const rhoQS  = num(params, 'rhoQS', 3.0)
      const wall   = num(params, 'wall', 0.5)

      while (bact.length < N) {
        const [x, y] = sampleInside(sdf, rng)
        bact.push({ x, y, a: rng() * Math.PI * 2, runTicks: 0 })
      }
      if (bact.length > N) bact.length = N

      // density grid for quorum sensing
      const cD = 10
      const gwD = Math.ceil(sdf.w / cD) + 1
      const ghD = Math.ceil(sdf.h / cD) + 1
      const density = new Float32Array(gwD * ghD)
      for (const b of bact) {
        const gx = Math.max(0, Math.min(gwD - 1, (b.x / cD) | 0))
        const gy = Math.max(0, Math.min(ghD - 1, (b.y / cD) | 0))
        density[gy * gwD + gx]++
      }

      for (let i = 0; i < bact.length; i++) {
        const b = bact[i]

        // quorum-sensing tumble rate
        const dgx = Math.max(0, Math.min(gwD - 1, (b.x / cD) | 0))
        const dgy = Math.max(0, Math.min(ghD - 1, (b.y / cD) | 0))
        const rhoLocal = density[dgy * gwD + dgx]
        const lam = lambda / (1 + rhoLocal / rhoQS)

        // Poisson tumble: probability λΔt per step (Δt=1 step)
        if (rng() < lam) {
          b.a = rng() * Math.PI * 2
          b.runTicks = 0
          streak[i] = 0
        } else {
          b.runTicks++
          streak[i] = Math.min(streak[i] + 1, 60)
        }

        // run
        const nx = b.x + Math.cos(b.a) * v0
        const ny = b.y + Math.sin(b.a) * v0

        if (sdf.sample(nx, ny) < 0) {
          b.x = nx; b.y = ny
        } else {
          // boundary: specular reflect OR reset direction based on `wall` param
          if (rng() < wall) {
            // specular reflect
            const [gX, gY] = sdfGrad(sdf, b.x, b.y)
            const gm = Math.hypot(gX, gY) || 1
            const dot = Math.cos(b.a) * gX / gm + Math.sin(b.a) * gY / gm
            const rx = Math.cos(b.a) - 2 * dot * gX / gm
            const ry = Math.sin(b.a) - 2 * dot * gY / gm
            b.a = Math.atan2(ry, rx)
          } else {
            // tumble (random reset) — bacteria often tumble on hitting a wall
            b.a = rng() * Math.PI * 2
            streak[i] = 0
          }
          // small inward nudge to avoid sticking outside
          const [gX, gY] = sdfGrad(sdf, b.x, b.y)
          const gm = Math.hypot(gX, gY) || 1
          b.x -= (gX / gm) * v0 * 0.6
          b.y -= (gY / gm) * v0 * 0.6
        }
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.12)', 1)

      for (let i = 0; i < bact.length; i++) {
        const b = bact[i]
        const s = streak[i] / 60 // 0 = just tumbled, 1 = long run

        // Just-tumbled: warm amber. Long run: cold blue-white.
        const r2 = Math.round(255 - s * 80)
        const g2 = Math.round(160 + s * 70)
        const b2 = Math.round(80 + s * 175)
        ctx.fillStyle = `rgba(${r2},${g2},${b2},0.6)`

        const cx2 = b.x * scx, cy2 = b.y * scy
        if (s > 0.3) {
          // running: draw tiny chevron
          const ang = b.a
          const sz = 3 + s * 1.5
          const sx2 = sz * 0.6
          ctx.beginPath()
          ctx.moveTo(cx2 + Math.cos(ang) * sz, cy2 + Math.sin(ang) * sz)
          ctx.lineTo(cx2 + Math.cos(ang + 2.6) * sx2, cy2 + Math.sin(ang + 2.6) * sx2)
          ctx.lineTo(cx2 + Math.cos(ang - 2.6) * sx2, cy2 + Math.sin(ang - 2.6) * sx2)
          ctx.closePath()
          ctx.fill()
        } else {
          // tumbling: round dot
          ctx.fillRect(cx2 - 1.5, cy2 - 1.5, 3, 3)
        }
      }
    })
  },
}
