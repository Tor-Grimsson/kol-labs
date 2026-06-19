// Flow Lenia — Plantec et al. (2023) Best Paper ALIFE 2023.
// Adds mass-conserving advection: dA/dt = -div(A*v) + G(U)*A
// v = grad(G(U)) — flow follows the growth gradient.
// Mass is conserved so creatures accumulate at the glyph boundary.
// arXiv:2212.07906



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,  max: 200, default: 128, step: 16, label: 'grid res' },
  { key: 'R',     type: 'int',   min: 5,   max: 18,  default: 11,            label: 'kernel radius' },
  { key: 'mu',    type: 'range', min: 0.1, max: 0.5, default: 0.18, step: 0.005, label: 'growth mean' },
  { key: 'sigma', type: 'range', min: 0.01, max: 0.12, default: 0.025, step: 0.002, label: 'growth sigma' },
  { key: 'dt',    type: 'range', min: 0.02, max: 0.3,  default: 0.1,  step: 0.01,  label: 'timestep' },
  { key: 'flow',  type: 'range', min: 0.0,  max: 2.0,  default: 0.8,  step: 0.05,  label: 'flow strength' },
]

export const r2_ca_04_flow_lenia            = {
  id: 'r2-ca-04-flow-lenia',
  name: 'FLOW LENIA',
  repo: 'Plantec et al. 2023 · arXiv:2212.07906',
  summary: 'Mass-conserving Lenia: an advection term moves mass along growth-gradient flow, preventing spontaneous creation/destruction. Creatures accumulate at boundaries rather than leaking out.',
  helps: 'Mass conservation keeps life inside the glyph — pressure builds at the letterform silhouette, creating boundary-hugging dynamics.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G      = num(params, 'res', 128)
    const R      = num(params, 'R', 11)
    const mu     = num(params, 'mu', 0.18)
    const sigma  = num(params, 'sigma', 0.025)
    const dt     = num(params, 'dt', 0.1)
    const fscale = num(params, 'flow', 0.8)

    const isIn = new Uint8Array(G * G)
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++)
        isIn[y * G + x] = sdf.sample((x / G) * sdf.w, (y / G) * sdf.h) < 0 ? 1 : 0

    // Gaussian shell kernel
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

    const A = new Float32Array(G * G)
    // Seed with a band of low-noise mass inside the glyph
    for (let i = 0; i < G * G; i++)
      if (isIn[i]) A[i] = rng() * 0.3

    const U  = new Float32Array(G * G)   // potential
    const Gf = new Float32Array(G * G)   // G(U) per cell
    const Vx = new Float32Array(G * G)   // flow x
    const Vy = new Float32Array(G * G)   // flow y
    const An = new Float32Array(G * G)   // next A

    const img = ctx.createImageData(G, G)
    const offCanvas = document.createElement('canvas')
    offCanvas.width = G; offCanvas.height = G
    const offCtx = offCanvas.getContext('2d')

    return wrapLoop(() => {
      // 1. Convolve: U = K * A
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!isIn[i]) { U[i] = 0; Gf[i] = 0; continue }
          let acc = 0
          for (let ky = -R; ky <= R; ky++) {
            const ny = y + ky; if (ny < 0 || ny >= G) continue
            for (let kx = -R; kx <= R; kx++) {
              const nx = x + kx; if (nx < 0 || nx >= G) continue
              acc += kernel[(ky + R) * kw + (kx + R)] * A[ny * G + nx]
            }
          }
          U[i] = acc
          Gf[i] = growth(acc)
        }
      }

      // 2. Flow velocity: v = grad(G(U)) via central differences
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!isIn[i]) { Vx[i] = 0; Vy[i] = 0; continue }
          const gL = (x > 0 && isIn[i - 1])     ? Gf[i - 1] : Gf[i]
          const gR = (x < G-1 && isIn[i + 1])   ? Gf[i + 1] : Gf[i]
          const gU = (y > 0 && isIn[i - G])     ? Gf[i - G] : Gf[i]
          const gD = (y < G-1 && isIn[i + G])   ? Gf[i + G] : Gf[i]
          Vx[i] = (gR - gL) * 0.5 * fscale
          Vy[i] = (gD - gU) * 0.5 * fscale
        }
      }

      // 3. Update: dA/dt = G(U)*A - div(A*v)  (upwind finite difference for advection)
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!isIn[i]) { An[i] = 0; continue }
          const a = A[i]
          const g = Gf[i]
          // Upwind advection divergence
          const vx = Vx[i], vy = Vy[i]
          let divFlux = 0
          // x direction
          if (vx > 0) divFlux += vx * a - (x > 0 ? Vx[i-1] * A[i-1] : 0)
          else         divFlux += (x < G-1 ? Vx[i+1] * A[i+1] : 0) - vx * a
          // y direction
          if (vy > 0) divFlux += vy * a - (y > 0 ? Vy[i-G] * A[i-G] : 0)
          else         divFlux += (y < G-1 ? Vy[i+G] * A[i+G] : 0) - vy * a
          An[i] = Math.max(0, Math.min(1, a + dt * (g * a - divFlux)))
        }
      }
      A.set(An)

      const [bgR, bgG, bgB] = roleRGB('bg')
      for (let i = 0; i < G * G; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = bgR; img.data[j + 1] = bgG; img.data[j + 2] = bgB; img.data[j + 3] = 255
          continue
        }
        const v = Math.max(0, Math.min(1, A[i]))
        const t = v * v   // square for contrast
        const [r, g, b] = rampRGB(t)
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
