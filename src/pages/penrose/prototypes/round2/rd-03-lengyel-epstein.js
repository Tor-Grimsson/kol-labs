// Lengyel-Epstein (CIMA/CDIMA reaction).
// First RD system to produce experimentally confirmed Turing patterns.
// Single parameter w sweeps continuously from labyrinthine mazes to clean bubbles.
// Reference: Lengyel & Epstein, Science 251:650 (1991).



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,  max: 220, default: 160, step: 20,  label: 'grid' },
  { key: 'a',     type: 'range', min: 4,   max: 14,  default: 9.0, step: 0.2, label: 'feed a' },
  { key: 'b',     type: 'range', min: 0.1, max: 2.0, default: 0.9, step: 0.05, label: 'coupling b' },
  { key: 'sigma', type: 'range', min: 10,  max: 100, default: 50,  step: 5,   label: 'sigma' },
  { key: 'c',     type: 'range', min: 0.5, max: 4.0, default: 2.0, step: 0.1, label: 'diffRatio c' },
  { key: 'dt',    type: 'range', min: 0.2, max: 1.0, default: 0.5, step: 0.05, label: 'dt' },
]

export const r2_rd_03_le            = {
  id: 'r2-rd-03-le',
  name: 'LENGYEL-EPSTEIN',
  repo: 'Lengyel & Epstein 1991 (CIMA reaction)',
  summary: 'CIMA reaction Turing patterns: parameter b sweeps labyrinthine mazes ↔ hexagonal bubbles inside the glyph.',
  helps: 'Long rich coarsening transient; single slider transforms the letter from maze corridors to dot grid.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const res   = num(params, 'res',   160)
    const a     = num(params, 'a',     9.0)
    const b     = num(params, 'b',     0.9)
    const sigma = num(params, 'sigma', 50)
    const c     = num(params, 'c',     2.0)
    const dt    = num(params, 'dt',    0.5)

    const N = res * res
    const U  = new Float32Array(N)
    const V  = new Float32Array(N)
    const U2 = new Float32Array(N)
    const V2 = new Float32Array(N)
    const isIn = new Uint8Array(N)

    // Steady-state: U_ss = a/5, V_ss = 1 + (a/5)²
    const uss = a / 5
    const vss = 1 + uss * uss

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const sx = (x / res) * sdf.w
        const sy = (y / res) * sdf.h
        const inside = sdf.sample(sx, sy) < 0
        isIn[y * res + x] = inside ? 1 : 0
        if (inside) {
          U[y * res + x] = uss + (rng() - 0.5) * 0.5
          V[y * res + x] = vss + (rng() - 0.5) * 0.5
        } else {
          U[y * res + x] = uss
          V[y * res + x] = vss
        }
      }
    }

    const img = ctx.createImageData(res, res)
    const tmp = document.createElement('canvas')
    tmp.width = res; tmp.height = res
    const tc = tmp.getContext('2d')

    const lap = (buf              , x        , y        )         => {
      const i = y * res + x
      const l  = x > 0       ? buf[i - 1]   : buf[i]
      const r  = x < res - 1 ? buf[i + 1]   : buf[i]
      const up = y > 0       ? buf[i - res]  : buf[i]
      const dn = y < res - 1 ? buf[i + res]  : buf[i]
      return l + r + up + dn - 4 * buf[i]
    }

    return wrapLoop(() => {
      for (let it = 0; it < 2; it++) {
        for (let y = 0; y < res; y++) {
          for (let x = 0; x < res; x++) {
            const i = y * res + x
            if (!isIn[i]) { U2[i] = U[i]; V2[i] = V[i]; continue }
            const u = U[i], v = Math.max(1e-9, V[i])
            const uv = u * v / (1 + u * u)
            // dU/dt = ∇²U + a − U − 4uv/(1+u²)
            const dUdt = lap(U, x, y) + a - u - 4 * uv
            // dV/dt = sigma[c∇²V + b(U − uv/(1+u²))]
            const dVdt = sigma * (c * lap(V, x, y) + b * (u - uv))
            U2[i] = u + dt * dUdt
            V2[i] = v + dt * dVdt
          }
        }
        U.set(U2)
        V.set(V2)
      }

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = 10; img.data[j + 1] = 11; img.data[j + 2] = 20; img.data[j + 3] = 255
          continue
        }
        const t = Math.max(0, Math.min(1, (U[i] - (uss - 3)) / 6))
        img.data[j]     = (255 * t  + 8  * (1 - t)) | 0
        img.data[j + 1] = (200 * t  + 60 * (1 - t)) | 0
        img.data[j + 2] = (80  * t  + 80 * (1 - t)) | 0
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
