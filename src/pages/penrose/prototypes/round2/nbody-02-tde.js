// Tidal Disruption Event — Stellar Spaghettification
// A compact cluster of particles ("star") on a parabolic orbit past a central
// black hole. Differential tidal forces shear it into streams; near half falls
// back and orbits; far half escapes. Multiple events layer into a disk.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'starN',  type: 'int',   min: 20,   max: 120,  default: 60,   step: 5,    label: 'star particles' },
  { key: 'G',      type: 'range', min: 0.1,  max: 8,    default: 3,    step: 0.1,  label: 'G' },
  { key: 'dt',     type: 'range', min: 0.001, max: 0.05, default: 0.008, step: 0.001, label: 'timestep' },
  { key: 'eps',    type: 'range', min: 0.5,  max: 8,    default: 1.5,  step: 0.5,  label: 'softening' },
  { key: 'trail',  type: 'range', min: 0,    max: 1,    default: 0.82, step: 0.02, label: 'trail' },
]



function spawnStar(cx        , cy        , rng              , N        , starR        )             {
  // Plummer sphere (2D) with parabolic approach velocity
  // Approach from right side with pericenter near the black hole
  const approachX = cx * 1.7
  const approachY = cy * 0.15
  const vImpact = -1.8 // leftward approach
  const ps             = []
  for (let i = 0; i < N; i++) {
    // Uniform disk sampling for star body
    const r = starR * Math.sqrt(rng())
    const a = rng() * Math.PI * 2
    ps.push({
      x: approachX + Math.cos(a) * r,
      y: approachY + Math.sin(a) * r,
      vx: vImpact + (rng() - 0.5) * 0.1,
      vy: (rng() - 0.5) * 0.1,
      age: 0,
    })
  }
  return ps
}

export const r2_nbody_02_tde            = {
  id: 'r2-nbody-02-tde',
  name: 'TIDAL DISRUPTION EVENT',
  repo: 'Evans & Kochanek 1989; Rees 1988',
  summary: 'A stellar cluster on a parabolic orbit past a central black hole is sheared into streams by differential tidal gravity. Near-side stream falls back to disk; far-side escapes.',
  helps: 'Single dramatic event per cycle — stretching, stream formation, disk coagulation — perfect title-card beat.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const cx = sdf.w / 2, cy = sdf.h / 2
    const BH_MASS = 500 // effective black-hole mass (relative)
    const starR = Math.min(sdf.w, sdf.h) * 0.06

    let particles             = []
    let resetTimer = 0
    const RESET_INTERVAL = 420 // frames between new star events

    function reset() {
      const N = num(params, 'starN', 60) | 0
      particles = spawnStar(cx, cy, rng, N, starR)
      resetTimer = 0
    }
    reset()

    return wrapLoop(() => {
      const G = num(params, 'G', 3)
      const dt = num(params, 'dt', 0.008)
      const eps2 = Math.pow(num(params, 'eps', 1.5), 2)
      const trailA = 1 - num(params, 'trail', 0.82) * 0.92

      // Leapfrog — black hole at (cx,cy), fixed
      const halfDt = dt * 0.5
      for (const p of particles) {
        // half-kick
        const dx = cx - p.x, dy = cy - p.y
        const r2 = dx * dx + dy * dy + eps2
        const r3 = r2 * Math.sqrt(r2)
        const f = G * BH_MASS / r3
        p.vx += f * dx * halfDt
        p.vy += f * dy * halfDt
        // drift
        p.x += p.vx * dt
        p.y += p.vy * dt
        // second half-kick
        const dx2 = cx - p.x, dy2 = cy - p.y
        const r2b = dx2 * dx2 + dy2 * dy2 + eps2
        const r3b = r2b * Math.sqrt(r2b)
        const fb = G * BH_MASS / r3b
        p.vx += fb * dx2 * halfDt
        p.vy += fb * dy2 * halfDt
        p.age++
      }

      // Remove particles that escape far outside glyph
      const limit = Math.max(sdf.w, sdf.h) * 1.6
      particles = particles.filter(p =>
        Math.abs(p.x - cx) < limit && Math.abs(p.y - cy) < limit,
      )

      resetTimer++
      if (resetTimer >= RESET_INTERVAL) reset()

      // Trail fade
      ctx.fillStyle = `rgba(10,11,20,${trailA.toFixed(3)})`
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.10)', 1)

      // Central black hole
      ctx.beginPath()
      ctx.arc(cx * sx, cy * sy, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx * sx, cy * sy, 10, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Particles — colour by age (young=hot white, old=dim orange)
      for (const p of particles) {
        const t = Math.min(1, p.age / 300)
        const r2 = (p.x - cx) ** 2 + (p.y - cy) ** 2
        const bright = Math.max(0.2, 1 - Math.sqrt(r2) / (sdf.w * 0.6))
        const hue = 30 + t * 20
        const lum = 55 + bright * 30
        ctx.fillStyle = `hsla(${hue},90%,${lum.toFixed(0)}%,0.75)`
        ctx.fillRect(p.x * sx - 1, p.y * sy - 1, 2, 2)
      }
    })
  },
}
