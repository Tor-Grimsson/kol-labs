// NoiseNCA — uniform-noise initialization, scale-invariant texture CA.
// Architecture: Pajouheshgar, Xu, Süsstrunk ALIFE 2024 (Best Student Paper)
// Key insight: full-grid noise init (no single seed) lets the same rule work
// at any resolution. Perception: Sobel-x + Sobel-y + Laplacian. 3-channel state.
// Deterministic update (mask probability = 1.0 as in paper). Permanent motion.


import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Fixed 3×3 filter bank: [Sobel-x, Sobel-y, Laplacian] (classic NCA perception)
const FX = [ -1, 0, 1, -2, 0, 2, -1, 0, 1 ]  // Sobel-x
const FY = [ -1,-2,-1,  0, 0, 0,  1, 2, 1 ]   // Sobel-y
const FL = [  0, 1, 0,  1,-4, 1,  0, 1, 0 ]   // Laplacian

// 3-input (one per filter output) × 3-output linear update matrix.
// Hand-designed to couple channels with sign changes → perpetual solitons.
const UM = [
  [ 0.55, -0.40,  0.30],
  [-0.35,  0.60, -0.45],
  [ 0.20, -0.30,  0.65],
]

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 64,  max: 160, default: 120, step: 16,   label: 'grid res' },
  { key: 'noise', type: 'range', min: 0.1, max: 1.5, default: 0.6, step: 0.05, label: 'noise scale' },
  { key: 'speed', type: 'range', min: 1,   max: 4,   default: 2,   step: 1,    label: 'steps/frame' },
  { key: 'gain',  type: 'range', min: 0.5, max: 3.0, default: 1.5, step: 0.1,  label: 'color gain' },
]

export const r2_nca_02_noisenca            = {
  id: 'r2-nca-02-noisenca',
  name: 'NoiseNCA',
  repo: 'Pajouheshgar et al ALIFE 2024',
  summary: 'Noise-seeded 3-channel NCA (Sobel + Laplacian perception). Scale-invariant: pattern fills from every point simultaneously, no visible growth front. Permanent motion.',
  helps: 'Scale-free letterform fill — pattern emerges everywhere at once like fog condensing.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G     = num(params, 'res',   120)
    const ns    = num(params, 'noise', 0.6)
    const speed = num(params, 'speed', 2)
    const gain  = num(params, 'gain',  1.5)
    const NC = 3
    const N  = G * G

    const state = new Float32Array(N * NC)
    const next  = new Float32Array(N * NC)
    const mask  = new Uint8Array(N)

    // Full-grid noise init — the defining NoiseNCA difference
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const i = y * G + x
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        mask[i] = sdf.sample(sx, sy) < 0 ? 1 : 0
        for (let c = 0; c < NC; c++) {
          state[i * NC + c] = mask[i] ? (rng() - 0.5) * ns : 0
        }
      }
    }

    function conv3(buf              , x        , y        , ch        , f          )         {
      let s = 0, k = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(G - 1, x + dx))
          const ny = Math.max(0, Math.min(G - 1, y + dy))
          s += f[k++] * buf[(ny * G + nx) * NC + ch]
        }
      }
      return s
    }

    function step() {
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!mask[i]) { for (let c = 0; c < NC; c++) next[i * NC + c] = 0; continue }
          // Perception: for each output channel, use one filter on that channel
          const px = conv3(state, x, y, 0, FX)
          const py = conv3(state, x, y, 1, FY)
          const pl = conv3(state, x, y, 2, FL)
          const perc = [px, py, pl]
          for (let co = 0; co < NC; co++) {
            let delta = 0
            for (let ci = 0; ci < NC; ci++) delta += UM[co][ci] * perc[ci]
            next[i * NC + co] = state[i * NC + co] + 0.12 * Math.tanh(delta)
          }
        }
      }
      state.set(next)
    }

    const img = ctx.createImageData(G, G)

    return wrapLoop(() => {
      const steps = Math.round(speed)
      for (let s = 0; s < steps; s++) step()

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          img.data[j] = 10; img.data[j + 1] = 11; img.data[j + 2] = 20; img.data[j + 3] = 255
          continue
        }
        const r = Math.max(0, Math.min(1, state[i * NC + 0] * gain * 0.5 + 0.5))
        const g = Math.max(0, Math.min(1, state[i * NC + 1] * gain * 0.5 + 0.5))
        const b = Math.max(0, Math.min(1, state[i * NC + 2] * gain * 0.5 + 0.5))
        img.data[j]     = (r * 190 + 30)  | 0
        img.data[j + 1] = (g * 160 + 50)  | 0
        img.data[j + 2] = (b * 220 + 20)  | 0
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = G; tmp.height = G
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tmp, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
