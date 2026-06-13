// Oregonator — 2-variable reduced model of the Belousov-Zhabotinsky reaction.
// Field & Noyes 1974. Produces sharp high-contrast spiral wavefronts.
// The stoichiometry knob f sweeps from clean spirals to spatiotemporal chaos.
// Reference: scholarpedia.org/article/Oregonator; Winfree "When Time Breaks Down" (1987).



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'res', type: 'int',   min: 80,    max: 200, default: 140,  step: 20,    label: 'grid' },
  { key: 'dU',  type: 'range', min: 0.5,   max: 3.0, default: 1.5,  step: 0.1,   label: 'diffU' },
  { key: 'dV',  type: 'range', min: 0.0,   max: 0.5, default: 0.0,  step: 0.01,  label: 'diffV' },
  { key: 'eps', type: 'range', min: 0.005, max: 0.1, default: 0.02, step: 0.005, label: 'epsilon' },
  { key: 'f',   type: 'range', min: 0.5,   max: 3.0, default: 1.4,  step: 0.05,  label: 'stoich f' },
  { key: 'q',   type: 'range', min: 0.0002, max: 0.02, default: 0.002, step: 0.0002, label: 'threshold q' },
]

export const r2_rd_02_oregonator            = {
  id: 'r2-rd-02-oregonator',
  name: 'OREGONATOR / BZ',
  repo: 'Field & Noyes 1974 (Belousov-Zhabotinsky)',
  summary: 'BZ-reaction minimal model: sharp excitation wavefronts sweep the glyph; stoichiometry f sweeps spirals into chaos.',
  helps: 'Higher-contrast wavefronts than FHN — thinner reaction front, photogenic refractory wake, perpetually dynamic.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const res = num(params, 'res', 140)
    const dU  = num(params, 'dU',  1.5)
    const dV  = num(params, 'dV',  0.0)
    const eps = num(params, 'eps', 0.02)
    const f   = num(params, 'f',   1.4)
    const q   = num(params, 'q',   0.002)
    const dt  = 0.001

    const N = res * res
    const U  = new Float32Array(N)
    const V  = new Float32Array(N)
    const U2 = new Float32Array(N)
    const V2 = new Float32Array(N)
    const isIn = new Uint8Array(N)

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const sx = (x / res) * sdf.w
        const sy = (y / res) * sdf.h
        const inside = sdf.sample(sx, sy) < 0
        isIn[y * res + x] = inside ? 1 : 0
        if (inside) {
          U[y * res + x] = rng() * 0.5
          V[y * res + x] = rng() * 0.5
        }
      }
    }

    // Seed a small wavefront seed near center
    const cx = (res / 2) | 0, cy = (res / 2) | 0
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const i = (cy + dy) * res + (cx + dx)
        if (i >= 0 && i < N && isIn[i]) { U[i] = 0.8; V[i] = 0.1 }
      }
    }

    const img = ctx.createImageData(res, res)
    const tmp = document.createElement('canvas')
    tmp.width = res; tmp.height = res
    const tc = tmp.getContext('2d')

    const lap = (buf              , x        , y        )         => {
      const i = y * res + x
      const l = x > 0       ? buf[i - 1]   : buf[i]
      const r = x < res - 1 ? buf[i + 1]   : buf[i]
      const up = y > 0       ? buf[i - res] : buf[i]
      const dn = y < res - 1 ? buf[i + res] : buf[i]
      return l + r + up + dn - 4 * buf[i]
    }

    // Steps per frame: many because dt is small
    const STEPS = 8

    return wrapLoop(() => {
      for (let it = 0; it < STEPS; it++) {
        for (let y = 0; y < res; y++) {
          for (let x = 0; x < res; x++) {
            const i = y * res + x
            if (!isIn[i]) { U2[i] = U[i]; V2[i] = V[i]; continue }
            const u = Math.max(0, U[i])
            const v = Math.max(1e-9, V[i])
            const denom = u + q
            // du/dt = (1/eps)[u(1−u) − (f·v·(u−q))/(u+q)] + dU∇²u
            const react_u = (1 / eps) * (u * (1 - u) - (f * v * (u - q)) / denom)
            // dv/dt = u − v + dV∇²v
            const react_v = u - v
            U2[i] = u + dt * (dU * lap(U, x, y) + react_u)
            V2[i] = v + dt * (dV * lap(V, x, y) + react_v)
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
        const t = Math.max(0, Math.min(1, U[i]))
        img.data[j]     = (240 * t + 20 * (1 - t)) | 0
        img.data[j + 1] = (120 * t + 15 * (1 - t)) | 0
        img.data[j + 2] = (40  * t + 60 * (1 - t)) | 0
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
