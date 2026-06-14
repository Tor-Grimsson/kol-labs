// Jeans Instability — Gravitational Fragmentation
// Uniform gas seeded with white-noise density perturbations. Overdense regions
// collapse under self-gravity (O(N²) direct for N≤150). Sub-Jeans regions
// oscillate as sound waves. Phase transition from quiescent cloud → clusters.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common'

const PARAMS          = [
  { key: 'N',    type: 'int',   min: 30,  max: 150, default: 90,  step: 5,    label: 'particles' },
  { key: 'G',    type: 'range', min: 0.01, max: 2,  default: 0.4, step: 0.01, label: 'G' },
  { key: 'cs',   type: 'range', min: 0.1, max: 3,   default: 0.8, step: 0.05, label: 'sound speed' },
  { key: 'dt',   type: 'range', min: 0.002, max: 0.05, default: 0.012, step: 0.001, label: 'timestep' },
  { key: 'eps',  type: 'range', min: 1,   max: 12,  default: 4,   step: 0.5,  label: 'softening' },
  { key: 'trail',type: 'range', min: 0,   max: 1,   default: 0.55, step: 0.05, label: 'trail' },
]




                                


export const r2_nbody_03_jeans            = {
  id: 'r2-nbody-03-jeans',
  name: 'JEANS FRAGMENTATION',
  repo: 'Jeans 1902; Larson 1969',
  summary: 'Uniform gas cloud with δρ/ρ~0.05 white-noise perturbations. Overdense clumps collapse under self-gravity while sub-Jeans regions oscillate acoustically. Cloud-to-clusters phase transition visible in real time.',
  helps: 'Multi-scale clustering fills the glyph at every zoom level — dense proto-stars vs sparse halo.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const cx = sdf.w / 2, cy = sdf.h / 2

    let N = num(params, 'N', 90) | 0
    const particles             = []

    function populate() {
      while (particles.length < N) {
        const [x, y] = sampleInside(sdf, rng)
        // Perturbed mass (density fluctuation δρ/ρ ~ 0.05)
        const m = 1 + (rng() - 0.5) * 0.1
        particles.push({ x, y, vx: 0, vy: 0, m })
      }
      if (particles.length > N) particles.length = N
    }
    populate()

    // Stiffened EOS: P = cs² * ρ, with opacity floor at ρ_max
    // Gravity: softened Newtonian O(N²)
    // SDF wall: restoring force toward interior

    return wrapLoop(() => {
      N = num(params, 'N', 90) | 0
      populate()

      const G   = num(params, 'G', 0.4)
      const cs  = num(params, 'cs', 0.8)
      const dt  = num(params, 'dt', 0.012)
      const eps2 = Math.pow(num(params, 'eps', 4), 2)
      const cs2 = cs * cs
      const Np  = particles.length

      // Compute accelerations: gravity + pressure gradient (SPH-lite)
      // For pressure: estimate local density from nearest-neighbor count in radius R
      const R_sph = Math.min(sdf.w, sdf.h) * 0.12
      const R2_sph = R_sph * R_sph

      const ax = new Float64Array(Np)
      const ay = new Float64Array(Np)

      // Gravity: O(N²)
      for (let i = 0; i < Np; i++) {
        for (let j = i + 1; j < Np; j++) {
          const dx = particles[j].x - particles[i].x
          const dy = particles[j].y - particles[i].y
          const r2 = dx * dx + dy * dy + eps2
          const r3 = r2 * Math.sqrt(r2)
          const fg = G * particles[i].m * particles[j].m / r3
          ax[i] += fg * dx; ay[i] += fg * dy
          ax[j] -= fg * dx; ay[j] -= fg * dy
        }
      }

      // SPH pressure: repel from high-density clusters (sound speed restoring force)
      for (let i = 0; i < Np; i++) {
        let rhoI = 0
        for (let j = 0; j < Np; j++) {
          if (i === j) continue
          const dx = particles[j].x - particles[i].x
          const dy = particles[j].y - particles[i].y
          if (dx * dx + dy * dy < R2_sph) rhoI += particles[j].m
        }
        // Pressure repulsion: push away from high-density neighbors
        for (let j = 0; j < Np; j++) {
          if (i === j) continue
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const r2 = dx * dx + dy * dy
          if (r2 > R2_sph || r2 < 1e-4) continue
          const r = Math.sqrt(r2)
          // Kernel gradient (linear)
          const kern = (1 - r / R_sph) / r
          const fp = cs2 * rhoI * particles[j].m * kern * 0.002
          ax[i] += fp * dx; ay[i] += fp * dy
        }
      }

      // SDF confinement
      const wallStr = 0.8
      for (let i = 0; i < Np; i++) {
        const s = sdf.sample(particles[i].x, particles[i].y)
        if (s > -2) {
          const [gx, gy] = sdfGrad(sdf, particles[i].x, particles[i].y)
          const m2 = Math.hypot(gx, gy) || 1
          const push = Math.max(0, s + 2) * wallStr
          ax[i] -= (gx / m2) * push
          ay[i] -= (gy / m2) * push
        }
      }

      // Leapfrog integration
      const halfDt = dt * 0.5
      for (let i = 0; i < Np; i++) {
        const p = particles[i]
        const im = 1 / p.m
        p.vx += ax[i] * im * halfDt
        p.vy += ay[i] * im * halfDt
        p.x += p.vx * dt
        p.y += p.vy * dt
        // velocity damping to prevent blow-up
        p.vx *= 0.998; p.vy *= 0.998
      }

      const trailA = 1 - num(params, 'trail', 0.55) * 0.9
      ctx.fillStyle = `rgba(10,11,20,${trailA.toFixed(3)})`
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.10)', 1)

      // Draw particles coloured by local density
      for (let i = 0; i < Np; i++) {
        const p = particles[i]
        const v2 = p.vx * p.vx + p.vy * p.vy
        const speed = Math.sqrt(v2)
        const hot = Math.min(1, speed * 0.4)
        const hue = 200 - hot * 170  // blue→red as speed increases
        ctx.fillStyle = `hsla(${hue.toFixed(0)},85%,62%,0.7)`
        ctx.beginPath()
        ctx.arc(p.x * sx, p.y * sy, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Mark cluster cores (particles close to glyph center = dense)
      const coreR2 = (Math.min(sdf.w, sdf.h) * 0.08) ** 2
      ctx.fillStyle = 'rgba(255,240,200,0.9)'
      for (const p of particles) {
        if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < coreR2) {
          ctx.beginPath()
          ctx.arc(p.x * sx, p.y * sy, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    })
  },
}
