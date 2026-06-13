// Steerable NCA — chirality and self-orienting cells.
// Architecture: Randazzo, Mordvintsev, Fouts ALIFE 2023 (arXiv 2302.10197)
// Each cell carries an orientation angle θ (stored as sin/cos pair).
// Perception: standard Sobel + orientation-aware projection. MLP outputs
// appearance delta + dθ/dt (angular velocity). Cells form co-oriented domains
// that slowly churn — iron-filing alignment driven by local rules.


import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const SX = [-0.125, 0, 0.125, -0.25, 0, 0.25, -0.125, 0, 0.125]
const SY = [-0.125, -0.25, -0.125, 0, 0, 0, 0.125, 0.25, 0.125]

// 5-channel: 3 appearance (R,G,B) + 2 orientation (sin θ, cos θ)
// Update matrix: perceives Sobel-projected channels → updates all 5
// Chirality baked in: asymmetric coupling between sin/cos and appearance
const UM = [
  [ 0.5, -0.3,  0.2, -0.4,  0.3],
  [-0.3,  0.6, -0.2,  0.3, -0.4],
  [ 0.2, -0.2,  0.5, -0.2,  0.2],
  [-0.3,  0.2, -0.1,  0.7, -0.3],  // sin channel — chirality coupling
  [ 0.4, -0.3,  0.2, -0.2,  0.6],  // cos channel
]

const PARAMS          = [
  { key: 'res',     type: 'int',   min: 64,  max: 160, default: 112,  step: 16,   label: 'grid res' },
  { key: 'chiral',  type: 'range', min: -1,  max: 1,   default: 0.6,  step: 0.05, label: 'chirality' },
  { key: 'rate',    type: 'range', min: 0.2, max: 1.0, default: 0.5,  step: 0.05, label: 'update rate' },
  { key: 'speed',   type: 'range', min: 1,   max: 3,   default: 1,    step: 1,    label: 'steps/frame' },
  { key: 'bright',  type: 'range', min: 0.5, max: 3.0, default: 1.8,  step: 0.1,  label: 'brightness' },
]

export const r2_nca_04_steerable            = {
  id: 'r2-nca-04-steerable',
  name: 'Steerable NCA',
  repo: 'Randazzo et al ALIFE 2023 arXiv 2302.10197',
  summary: '5-channel NCA (3 RGB + sin/cos orientation). Each cell carries an angle; chirality parameter biases angular velocity. Co-oriented domains form, merge, and churn continuously.',
  helps: 'Orientation domain dynamics — cells self-align like iron filings, tracing glyph topology.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G      = num(params, 'res',    112)
    const NC     = 5   // 3 appearance + sin θ + cos θ
    const N      = G * G

    const state = new Float32Array(N * NC)
    const next  = new Float32Array(N * NC)
    const mask  = new Uint8Array(N)

    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const i = y * G + x
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        mask[i] = sdf.sample(sx, sy) < 0 ? 1 : 0
        if (mask[i]) {
          for (let c = 0; c < 3; c++) state[i * NC + c] = (rng() - 0.5) * 0.4
          const th = rng() * Math.PI * 2
          state[i * NC + 3] = Math.sin(th)
          state[i * NC + 4] = Math.cos(th)
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

    function step(chiral        , rate        ) {
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!mask[i]) { for (let c = 0; c < NC; c++) next[i * NC + c] = 0; continue }
          if (rng() > rate) { for (let c = 0; c < NC; c++) next[i * NC + c] = state[i * NC + c]; continue }

          // Orientation-aware perception: project Sobel along cell's own axis
          const sinTh = state[i * NC + 3]
          const cosTh = state[i * NC + 4]

          const perc           = new Array(NC)
          for (let c = 0; c < 3; c++) {
            const gx = conv3(state, x, y, c, SX)
            const gy = conv3(state, x, y, c, SY)
            // Project gradient along orientation direction
            perc[c] = gx * cosTh + gy * sinTh
          }
          // Perceive orientation channel alignment with neighbors
          perc[3] = conv3(state, x, y, 3, SX) * cosTh + conv3(state, x, y, 3, SY) * sinTh
          perc[4] = conv3(state, x, y, 4, SX) * (-sinTh) + conv3(state, x, y, 4, SY) * cosTh

          for (let co = 0; co < NC; co++) {
            let delta = 0
            for (let ci = 0; ci < NC; ci++) delta += UM[co][ci] * perc[ci]
            if (co >= 3) {
              // Angular velocity with chirality bias
              delta = delta + chiral * 0.1
            }
            next[i * NC + co] = state[i * NC + co] + 0.1 * Math.tanh(delta)
          }

          // Re-normalise orientation vector to unit circle
          const s2 = next[i * NC + 3], c2 = next[i * NC + 4]
          const mag = Math.hypot(s2, c2) || 1
          next[i * NC + 3] = s2 / mag
          next[i * NC + 4] = c2 / mag
        }
      }
      state.set(next)
    }

    const img = ctx.createImageData(G, G)

    return wrapLoop(() => {
      const chiral = num(params, 'chiral', 0.6)
      const rate   = num(params, 'rate',   0.5)
      const speed  = Math.round(num(params, 'speed', 1))
      const bright = num(params, 'bright', 1.8)

      for (let s = 0; s < speed; s++) step(chiral, rate)

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          img.data[j] = 10; img.data[j + 1] = 11; img.data[j + 2] = 20; img.data[j + 3] = 255
          continue
        }
        // Encode orientation as hue overlay on top of RGB appearance
        const th = Math.atan2(state[i * NC + 3], state[i * NC + 4])
        const hue = ((th / (Math.PI * 2)) + 1) % 1
        const r = Math.max(0, Math.min(1, state[i * NC + 0] * bright * 0.5 + 0.5 + hue * 0.15))
        const g = Math.max(0, Math.min(1, state[i * NC + 1] * bright * 0.5 + 0.5 - hue * 0.05))
        const b = Math.max(0, Math.min(1, state[i * NC + 2] * bright * 0.5 + 0.5 - hue * 0.1))
        img.data[j]     = (r * 220 + 15) | 0
        img.data[j + 1] = (g * 180 + 20) | 0
        img.data[j + 2] = (b * 210 + 25) | 0
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
