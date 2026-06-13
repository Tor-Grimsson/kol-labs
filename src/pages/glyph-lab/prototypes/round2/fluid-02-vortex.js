

import { num, bool } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'count', type: 'int', min: 50, max: 1200, default: 400, step: 50, label: 'vortex count' },
  { key: 'delta', type: 'range', min: 2, max: 30, default: 10, step: 1, label: 'core radius δ' },
  { key: 'inject', type: 'range', min: 0, max: 4, default: 1.0, step: 0.1, label: 'inject rate' },
  { key: 'diffuse', type: 'range', min: 0, max: 0.8, default: 0.15, step: 0.05, label: 'diffusion' },
  { key: 'trails', type: 'boolean', default: true, label: 'trails' },
]

export const r2_fluid_02_vortex            = {
  id: 'r2-fluid-02-vortex',
  name: 'Vortex Particle Method',
  repo: 'Cottet & Koumoutsakos · Vortex Methods · Rosenhead-Moore kernel',
  summary:
    'Pure Lagrangian vortex blobs; velocity recovered via regularized Biot-Savart sum. No grid, no pressure solve — vortices wander, coalesce, and orbit each other inside the SDF glyph.',
  helps:
    'No-grid swirling persistence — individual vortex orbits visible at zoom, global circulation at full scale.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const N = num(params, 'count', 400)
    const delta = num(params, 'delta', 10) / sdf.w * W // convert to canvas space
    const injectRate = num(params, 'inject', 1.0)
    const diffuse = num(params, 'diffuse', 0.15)
    const trails = bool(params, 'trails', true)

    const sx = W / sdf.w, sy = H / sdf.h
    const delta2 = delta * delta

    // Vortex state in canvas coords
    const px = new Float32Array(N)
    const py = new Float32Array(N)
    const gamma = new Float32Array(N) // circulation

    // Seed vortices inside glyph
    for (let i = 0; i < N; i++) {
      const [x, y] = sampleInside(sdf, rng)
      px[i] = x * sx
      py[i] = y * sy
      gamma[i] = (rng() - 0.5) * 2.0 * injectRate
    }

    // Tmp velocity buffers
    const vx = new Float32Array(N)
    const vy = new Float32Array(N)

    let prevT = clock.nowSeconds()
    const TWO_PI = Math.PI * 2

    return wrapLoop(() => {
      const now = clock.nowSeconds()
      const dt = Math.min(now - prevT, 0.05)
      prevT = now

      // Biot-Savart: O(N²) velocity for each vortex
      vx.fill(0); vy.fill(0)
      for (let i = 0; i < N; i++) {
        const xi = px[i], yi = py[i]
        for (let j = 0; j < N; j++) {
          if (i === j) continue
          const dx = xi - px[j]
          const dy = yi - py[j]
          const r2 = dx * dx + dy * dy + delta2
          const fac = gamma[j] / (TWO_PI * r2)
          // K_delta: velocity from vortex j at i = gamma_j/(2π) * r_perp / (|r|²+δ²)
          vx[i] += fac * (-dy)
          vy[i] += fac * dx
        }
      }

      // Advect + SDF boundary enforcement
      for (let i = 0; i < N; i++) {
        // Random walk for diffusion
        const ang = rng() * TWO_PI
        const rwAmp = diffuse * Math.sqrt(dt) * 20
        const nx = px[i] + (vx[i] + Math.cos(ang) * rwAmp) * dt * 60
        const ny = py[i] + (vy[i] + Math.sin(ang) * rwAmp) * dt * 60

        // SDF check in glyph space
        const gx = nx / sx, gy = ny / sy
        if (sdf.sample(gx, gy) < 0) {
          px[i] = nx
          py[i] = ny
        } else {
          // Reflect toward interior
          const [ix, iy] = sampleInside(sdf, rng)
          px[i] = ix * sx
          py[i] = iy * sy
          gamma[i] = (rng() - 0.5) * 2.0 * injectRate
        }
      }

      // Periodically inject fresh vortices to maintain energy
      if (injectRate > 0.01) {
        const injectN = Math.ceil(injectRate * dt * 5)
        for (let k = 0; k < injectN; k++) {
          const idx = Math.floor(rng() * N)
          const [x, y] = sampleInside(sdf, rng)
          px[idx] = x * sx
          py[idx] = y * sy
          gamma[idx] = (rng() - 0.5) * 2.0 * injectRate
        }
      }

      // Render
      if (trails) {
        ctx.fillStyle = 'rgba(10, 11, 20, 0.18)'
        ctx.fillRect(0, 0, W, H)
      } else {
        clear(ctx, W, H)
      }
      strokeOutline(ctx, sdf, W, H)

      // Draw vortices colored by circulation sign
      for (let i = 0; i < N; i++) {
        const g = gamma[i]
        const t = Math.min(1, Math.abs(g) / injectRate)
        const r2 = delta * t
        if (g > 0) {
          ctx.fillStyle = `rgba(${Math.round(80 + 175 * t)},${Math.round(120 + 80 * t)},255,${0.5 + 0.4 * t})`
        } else {
          ctx.fillStyle = `rgba(255,${Math.round(80 + 120 * t)},${Math.round(40 + 100 * t)},${0.5 + 0.4 * t})`
        }
        ctx.beginPath()
        ctx.arc(px[i], py[i], Math.max(0.8, r2 * 0.3), 0, TWO_PI)
        ctx.fill()
      }
    })
  },
}
