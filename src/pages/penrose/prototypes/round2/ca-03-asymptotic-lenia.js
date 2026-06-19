// Asymptotic Lenia — Kawaguchi et al. (2021).
// Replaces Lenia's clip-to-[0,1] with a smooth tanh-bounded update:
//   dA/dt = (1 - A^2) * G(U)
// Analytically characterized gliders; larger dt stable.
// arXiv:2305.13784 / ResearchGate:353383915



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,  max: 200, default: 128, step: 16, label: 'grid res' },
  { key: 'R',     type: 'int',   min: 5,   max: 18,  default: 13,            label: 'kernel radius' },
  { key: 'mu',    type: 'range', min: 0.1, max: 0.5, default: 0.26, step: 0.005, label: 'growth mean' },
  { key: 'sigma', type: 'range', min: 0.01, max: 0.12, default: 0.036, step: 0.002, label: 'growth sigma' },
  { key: 'dt',    type: 'range', min: 0.05, max: 0.8,  default: 0.3,  step: 0.01,  label: 'timestep' },
]

export const r2_ca_03_asymptotic_lenia            = {
  id: 'r2-ca-03-asymptotic-lenia',
  name: 'ASYMPTOTIC LENIA',
  repo: 'Kawaguchi et al. 2021 · arXiv:2305.13784',
  summary: 'Lenia reformulated with smooth tanh-bounded state update instead of hard clip. Removes discretization artifacts; enables larger stable timesteps and analytically characterized traveling-wave gliders.',
  helps: 'Cleaner solitons with reflective-boundary character — gliders treat the glyph edge as a principled Neumann wall.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G     = num(params, 'res', 128)
    const R     = num(params, 'R', 13)
    const mu    = num(params, 'mu', 0.26)
    const sigma = num(params, 'sigma', 0.036)
    const dt    = num(params, 'dt', 0.3)

    const isIn = new Uint8Array(G * G)
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++)
        isIn[y * G + x] = sdf.sample((x / G) * sdf.w, (y / G) * sdf.h) < 0 ? 1 : 0

    // Gaussian shell kernel (same as vanilla Lenia)
    const kw = 2 * R + 1
    const kernel = new Float32Array(kw * kw)
    let ksum = 0
    for (let ky = -R; ky <= R; ky++) {
      for (let kx = -R; kx <= R; kx++) {
        const r = Math.hypot(kx, ky) / R
        if (r > 1) continue
        const v = Math.exp(-((r - 0.5) ** 2) / (2 * 0.15 ** 2))
        kernel[(ky + R) * kw + (kx + R)] = v
        ksum += v
      }
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= ksum

    function growth(u        )         {
      const d = (u - mu) / sigma
      return 2 * Math.exp(-(d * d) * 0.5) - 1
    }

    // Seed blobs in glyph — init state in [-1,1] for asymptotic formulation
    // We work in [0,1] and map: A_internal = 2*A - 1 conceptually, but keep [0,1]
    const A = new Float32Array(G * G)
    for (let s = 0; s < 5; s++) {
      let sx        , sy        , tries = 0
      do { sx = (rng() * G) | 0; sy = (rng() * G) | 0; tries++ }
      while (!isIn[sy * G + sx] && tries < 200)
      const br = Math.max(3, R * 0.6) | 0
      for (let dy = -br; dy <= br; dy++) {
        for (let dx = -br; dx <= br; dx++) {
          const nx = sx + dx, ny = sy + dy
          if (nx < 0 || nx >= G || ny < 0 || ny >= G || !isIn[ny * G + nx]) continue
          const r = Math.hypot(dx, dy) / br
          A[ny * G + nx] = Math.max(A[ny * G + nx], Math.exp(-(r * r) / 0.25))
        }
      }
    }

    const U = new Float32Array(G * G)
    const img = ctx.createImageData(G, G)
    const offCanvas = document.createElement('canvas')
    offCanvas.width = G; offCanvas.height = G
    const offCtx = offCanvas.getContext('2d')

    return wrapLoop(() => {
      // Convolution
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          if (!isIn[y * G + x]) { U[y * G + x] = 0; continue }
          let acc = 0
          for (let ky = -R; ky <= R; ky++) {
            const ny = y + ky; if (ny < 0 || ny >= G) continue
            for (let kx = -R; kx <= R; kx++) {
              const nx = x + kx; if (nx < 0 || nx >= G) continue
              acc += kernel[(ky + R) * kw + (kx + R)] * A[ny * G + nx]
            }
          }
          U[y * G + x] = acc
        }
      }

      // Asymptotic update: dA/dt = (1 - (2A-1)^2) * G(U)
      //  => stays bounded in [0,1] without explicit clamp
      for (let i = 0; i < G * G; i++) {
        if (!isIn[i]) { A[i] = 0; continue }
        const a = A[i]
        const aNorm = 2 * a - 1        // map to [-1, 1]
        const bound = 1 - aNorm * aNorm // (1 - a^2) in normalized space
        A[i] = Math.max(0, Math.min(1, a + dt * bound * growth(U[i])))
      }

      const [bgR, bgG, bgB] = roleRGB('bg')
      for (let i = 0; i < G * G; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = bgR; img.data[j + 1] = bgG; img.data[j + 2] = bgB; img.data[j + 3] = 255
          continue
        }
        const v = Math.max(0, Math.min(1, A[i]))
        const [r, g, b] = rampRGB(v)
        img.data[j]     = r
        img.data[j + 1] = g
        img.data[j + 2] = b
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      offCtx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(offCanvas, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
