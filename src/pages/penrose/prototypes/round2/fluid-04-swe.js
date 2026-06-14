

import { num, bool } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'speed', type: 'range', min: 0.2, max: 2.5, default: 1.2, step: 0.1, label: 'wave speed c' },
  { key: 'damp', type: 'range', min: 0.990, max: 0.9999, default: 0.998, step: 0.001, label: 'damping' },
  { key: 'res', type: 'int', min: 80, max: 240, default: 160, step: 20, label: 'grid res' },
  { key: 'excite', type: 'range', min: 0.01, max: 0.5, default: 0.08, step: 0.01, label: 'excite rate' },
  { key: 'colormap', type: 'select', options: ['cyan', 'fire', 'mono'], default: 'cyan', label: 'colormap' },
]

export const r2_fluid_04_swe            = {
  id: 'r2-fluid-04-swe',
  name: 'Shallow Water Wave Resonance',
  repo: 'Linearized SWE / ripple tank · Tessendorf 2001',
  summary:
    'Linearized 2D wave equation (∂²h/∂t² = c²∇²h) with reflective SDF walls. Wave sources inside the glyph excite resonant standing-wave interference patterns unique to each letterform — a Chladni acoustic fingerprint.',
  helps:
    'Completely different aesthetic register — crystalline interference fringes instead of turbulent swirl; each glyph has a unique resonance mode.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const c = num(params, 'speed', 1.2)
    const damp = num(params, 'damp', 0.998)
    const N = num(params, 'res', 160)
    const exciteRate = num(params, 'excite', 0.08)
    const colormap = (params['colormap']          ) ?? 'cyan'

    const NY = Math.round(N * H / W)
    const size = N * NY
    const scaleX = W / N, scaleY = H / NY
    const cellW = Math.max(1, Math.ceil(scaleX))
    const cellH = Math.max(1, Math.ceil(scaleY))

    // h: current height, hPrev: previous, hNext: scratch
    const h = new Float32Array(size)
    const hPrev = new Float32Array(size)
    const solid = new Uint8Array(size)

    const IDX = (i        , j        ) => j * N + i

    // Build solid mask
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < N; i++) {
        const gx = (i + 0.5) / N * sdf.w
        const gy = (j + 0.5) / NY * sdf.h
        solid[IDX(i, j)] = sdf.sample(gx, gy) >= 0 ? 1 : 0
      }
    }

    // Random source positions inside glyph
    const sources                                                               = []
    for (let k = 0; k < 4; k++) {
      let tries = 0
      while (tries++ < 200) {
        const si = Math.floor(rng() * N), sj = Math.floor(rng() * NY)
        if (!solid[IDX(si, sj)]) {
          sources.push({ i: si, j: sj, phase: rng() * Math.PI * 2, freq: 0.4 + rng() * 1.2 })
          break
        }
      }
    }

    const dt = 0.016
    // CFL: dt*c/dx < 1. dx=1. So c must be < 1/dt = 62.5 in grid units.
    // We scale: effective grid c = c * dt (dimensionless courant)
    const img = ctx.createImageData(W, H)
    const pixels = img.data
    let prevT = clock.nowSeconds()
    let simT = 0

    return wrapLoop(() => {
      const now = clock.nowSeconds()
      const elapsed = Math.min(now - prevT, 0.05)
      prevT = now
      const steps = Math.max(1, Math.round(elapsed / dt))

      for (let _s = 0; _s < steps; _s++) {
        simT += dt

        // Excite sources
        for (const src of sources) {
          if (!solid[IDX(src.i, src.j)]) {
            h[IDX(src.i, src.j)] += exciteRate * Math.sin(src.freq * simT * Math.PI * 2 + src.phase)
          }
        }

        // Wave equation: h_next = 2h - h_prev + (c*dt)²*∇²h
        const alpha = (c * dt) * (c * dt)
        const hNext = new Float32Array(size)
        for (let j = 1; j < NY - 1; j++) {
          for (let i = 1; i < N - 1; i++) {
            const n = IDX(i, j)
            if (solid[n]) { hNext[n] = 0; continue }
            const left = solid[IDX(i - 1, j)] ? -h[n] : h[IDX(i - 1, j)]
            const right = solid[IDX(i + 1, j)] ? -h[n] : h[IDX(i + 1, j)]
            const top = solid[IDX(i, j - 1)] ? -h[n] : h[IDX(i, j - 1)]
            const bot = solid[IDX(i, j + 1)] ? -h[n] : h[IDX(i, j + 1)]
            const laplacian = left + right + top + bot - 4 * h[n]
            hNext[n] = (2 * h[n] - hPrev[n] + alpha * laplacian) * damp
          }
        }

        hPrev.set(h)
        h.set(hNext)
      }

      // Render
      clear(ctx, W, H)
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < N; i++) {
          const n = IDX(i, j)
          if (solid[n]) continue
          const val = Math.max(-1, Math.min(1, h[n] * 6))
          const t = (val + 1) * 0.5 // 0..1

          let r = 0, g = 0, b = 0, a = 0
          if (colormap === 'cyan') {
            // negative→dark blue, zero→black, positive→cyan/white
            if (val > 0) {
              r = Math.round(val * 200)
              g = Math.round(val * 255)
              b = Math.round(val * 255)
            } else {
              r = 0; g = 0; b = Math.round(-val * 180)
            }
            a = Math.round(40 + Math.abs(val) * 215)
          } else if (colormap === 'fire') {
            r = Math.round(t * 255)
            g = Math.round(Math.pow(t, 2) * 200)
            b = Math.round(Math.pow(t, 4) * 100)
            a = Math.round(50 + t * 205)
          } else {
            const v = Math.round(t * 230)
            r = v; g = v; b = v; a = Math.round(40 + t * 215)
          }

          const px0 = Math.round(i * scaleX), py0 = Math.round(j * scaleY)
          for (let dy = 0; dy < cellH; dy++) {
            for (let dx = 0; dx < cellW; dx++) {
              const pidx = ((py0 + dy) * W + (px0 + dx)) * 4
              if (pidx + 3 < pixels.length) {
                pixels[pidx] = r; pixels[pidx + 1] = g; pixels[pidx + 2] = b; pixels[pidx + 3] = a
              }
            }
          }
        }
      }
      ctx.putImageData(img, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
