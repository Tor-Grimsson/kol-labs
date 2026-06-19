// Glaberish — Davis & Bongard (2022).
// Splits Lenia's growth function into separate genesis (birth) and persistence (survival)
// functions, mirroring Conway B/S rule structure in continuous form.
// Produces puffer-like structures that leave ink trails inside the glyph.
// arXiv:2205.10463



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,  max: 200, default: 128, step: 16, label: 'grid res' },
  { key: 'R',     type: 'int',   min: 5,   max: 18,  default: 12,            label: 'kernel radius' },
  { key: 'bmu',   type: 'range', min: 0.05, max: 0.4, default: 0.19, step: 0.005, label: 'birth mean' },
  { key: 'bsig',  type: 'range', min: 0.01, max: 0.1, default: 0.03, step: 0.005, label: 'birth sigma' },
  { key: 'smu',   type: 'range', min: 0.1,  max: 0.6, default: 0.35, step: 0.005, label: 'survival mean' },
  { key: 'dt',    type: 'range', min: 0.05, max: 0.5,  default: 0.18, step: 0.01,  label: 'timestep' },
]

// Smooth bell centered at mu with width sig
function bell(u        , mu        , sig        )         {
  const d = (u - mu) / sig
  return Math.exp(-(d * d) * 0.5)
}

export const r2_ca_05_glaberish            = {
  id: 'r2-ca-05-glaberish',
  name: 'GLABERISH',
  repo: 'Davis & Bongard 2022 · arXiv:2205.10463',
  summary: 'Continuous CA with split genesis and persistence functions mirroring Conway B/S structure. Produces puffer-like mobile patterns that deposit residue trails inside the glyph.',
  helps: 'Ink-smearing puffer trains — blobs that move and leave marks, turning the letterform interior into a living accumulation surface.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G    = num(params, 'res', 128)
    const R    = num(params, 'R', 12)
    const bmu  = num(params, 'bmu', 0.19)
    const bsig = num(params, 'bsig', 0.03)
    const smu  = num(params, 'smu', 0.35)
    const dt   = num(params, 'dt', 0.18)

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

    // Glaberish update:
    //   G = genesis(U) * (1 - A) + persistence(U) * A - decay * A
    // genesis: birth probability given neighborhood potential
    // persistence: survival probability given neighborhood potential
    // The (1-A) and A weighting interpolates between the two modes.
    function genesisG(u        )          { return bell(u, bmu, bsig) }
    function persistG(u        )          { return bell(u, smu, bsig * 1.5) }
    const decay = 0.05

    // Seed blobs
    const A = new Float32Array(G * G)
    for (let s = 0; s < 6; s++) {
      let sx        , sy        , tries = 0
      do { sx = (rng() * G) | 0; sy = (rng() * G) | 0; tries++ }
      while (!isIn[sy * G + sx] && tries < 200)
      const br = Math.max(2, R * 0.5) | 0
      for (let dy = -br; dy <= br; dy++) {
        for (let dx = -br; dx <= br; dx++) {
          const nx = sx + dx, ny = sy + dy
          if (nx < 0 || nx >= G || ny < 0 || ny >= G || !isIn[ny * G + nx]) continue
          const r = Math.hypot(dx, dy) / br
          A[ny * G + nx] = Math.max(A[ny * G + nx], 0.8 * Math.exp(-(r * r) / 0.3))
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
          const i = y * G + x
          if (!isIn[i]) { U[i] = 0; continue }
          let acc = 0
          for (let ky = -R; ky <= R; ky++) {
            const ny = y + ky; if (ny < 0 || ny >= G) continue
            for (let kx = -R; kx <= R; kx++) {
              const nx = x + kx; if (nx < 0 || nx >= G) continue
              acc += kernel[(ky + R) * kw + (kx + R)] * A[ny * G + nx]
            }
          }
          U[i] = acc
        }
      }

      // Glaberish split-function update
      for (let i = 0; i < G * G; i++) {
        if (!isIn[i]) { A[i] = 0; continue }
        const a = A[i]
        const u = U[i]
        const dA = genesisG(u) * (1 - a) + persistG(u) * a - decay * a
        A[i] = Math.max(0, Math.min(1, a + dt * dA))
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
