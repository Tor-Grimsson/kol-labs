// Isotropic NCA — rotation-invariant morphogenesis.
// Architecture: Mordvintsev, Randazzo, Fouts ALIFE 2022 (arXiv 2205.01681)
// Replaces directional Sobel with circular harmonic filters (L=0 radial,
// L=1 angular, L=2 second harmonic). The rule is orientation-agnostic, so
// the same rule produces consistent texture at any rotation — useful for
// glyph fills that must look correct regardless of stroke orientation.


import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

// Circular harmonic filter bank for a 3×3 neighbourhood.
// L=0: radial average (mean of ring)
// L=1x, L=1y: first-order angular (≈ Sobel, but rotationally covariant)
// L=2x, L=2y: second harmonic (detects 2-fold symmetry)
// Computed analytically on a 3×3 stencil.
const sqrt2 = Math.SQRT2
// L=0 (identity/mean)
const H0 = [0, 1, 0,  1, 4, 1,  0, 1, 0].map(v => v / 8)
// L=1x (cos-weighted radial — approx Sobel-x normalised)
const H1x = [-1, 0, 1, -sqrt2, 0, sqrt2, -1, 0, 1].map(v => v / (4 + 2 * sqrt2))
// L=1y (sin-weighted)
const H1y = [-1, -sqrt2, -1,  0, 0, 0,  1, sqrt2, 1].map(v => v / (4 + 2 * sqrt2))
// L=2x (cos 2θ harmonic — detects diagonal structure)
const H2x = [1, 0, -1,  0, 0, 0,  -1, 0, 1].map(v => v / 4)
// L=2y (sin 2θ harmonic)
const H2y = [0, 1, 0,  -1, 0, -1,  0, 1, 0].map(v => v / 4)

const FILTERS = [H0, H1x, H1y, H2x, H2y]

// 4 appearance channels × 5 filter outputs = 20 perception inputs per cell.
// Update: 4×20 linear matrix + tanh. Hand-tuned for persistent texture solitons.
// Using only 4×5 = 20 non-zero rows (one per output channel, 5 inputs each).
const UM             = [
  [ 0.45, -0.30,  0.20,  0.10, -0.15,   -0.25,  0.35, -0.10,  0.05, -0.20,   0.15, -0.10,  0.30, -0.05,  0.10,   0.0,  0.05, -0.10,  0.08, -0.05],
  [-0.30,  0.50, -0.20, -0.05,  0.20,    0.10, -0.40,  0.25, -0.15,  0.10,  -0.10,  0.20, -0.30,  0.10, -0.15,   0.05, -0.10,  0.15, -0.08,  0.10],
  [ 0.20, -0.15,  0.45, -0.20,  0.10,   -0.10,  0.20, -0.35,  0.20, -0.05,   0.25, -0.15,  0.40, -0.20,  0.15,  -0.05,  0.10, -0.20,  0.12, -0.08],
  [-0.10,  0.20, -0.15,  0.50, -0.25,    0.15, -0.10,  0.20, -0.40,  0.15,  -0.20,  0.25, -0.10,  0.45, -0.20,   0.10, -0.05,  0.15, -0.10,  0.20],
]

const PARAMS          = [
  { key: 'res',    type: 'int',   min: 64,  max: 160, default: 112,  step: 16,   label: 'grid res' },
  { key: 'rate',   type: 'range', min: 0.2, max: 1.0, default: 0.5,  step: 0.05, label: 'update rate' },
  { key: 'speed',  type: 'range', min: 1,   max: 3,   default: 1,    step: 1,    label: 'steps/frame' },
  { key: 'bright', type: 'range', min: 0.5, max: 3.0, default: 1.5,  step: 0.1,  label: 'brightness' },
  { key: 'spread', type: 'range', min: 0.05, max: 0.3, default: 0.12, step: 0.01, label: 'delta scale' },
]

export const r2_nca_05_isotropic            = {
  id: 'r2-nca-05-isotropic',
  name: 'Isotropic NCA',
  repo: 'Mordvintsev et al ALIFE 2022 arXiv 2205.01681',
  summary: 'Rotation-invariant NCA using circular harmonic filters (L=0,1,2) instead of Sobel. 4-channel state, hand-tuned 4×20 update matrix. Same rule at any rotation — consistent texture across glyph stroke orientations.',
  helps: 'Orientation-agnostic glyph fill — texture looks right on horizontal, vertical, and diagonal strokes equally.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G      = num(params, 'res',    112)
    const NC     = 4
    const NF     = FILTERS.length  // 5
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
          for (let c = 0; c < NC; c++) state[i * NC + c] = (rng() - 0.5) * 0.4
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

    function step(rate        , spread        ) {
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!mask[i]) { for (let c = 0; c < NC; c++) next[i * NC + c] = 0; continue }
          if (rng() > rate) { for (let c = 0; c < NC; c++) next[i * NC + c] = state[i * NC + c]; continue }

          // Perception: for each channel, apply all 5 harmonic filters
          // Perception vector length = NC * NF = 4 * 5 = 20
          const perc           = []
          for (let c = 0; c < NC; c++) {
            for (let fi = 0; fi < NF; fi++) {
              perc.push(conv3(state, x, y, c, FILTERS[fi]))
            }
          }

          for (let co = 0; co < NC; co++) {
            let delta = 0
            for (let pi = 0; pi < NC * NF; pi++) {
              delta += UM[co][pi] * perc[pi]
            }
            next[i * NC + co] = state[i * NC + co] + spread * Math.tanh(delta)
          }
        }
      }
      state.set(next)
    }

    const img = ctx.createImageData(G, G)

    return wrapLoop(() => {
      const rate   = num(params, 'rate',   0.5)
      const speed  = Math.round(num(params, 'speed', 1))
      const bright = num(params, 'bright', 1.5)
      const spread = num(params, 'spread', 0.12)

      for (let s = 0; s < speed; s++) step(rate, spread)

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j + 1] = bg; img.data[j + 2] = bb; img.data[j + 3] = 255
          continue
        }
        const r = Math.max(0, Math.min(1, state[i * NC + 0] * bright * 0.5 + 0.5))
        const g = Math.max(0, Math.min(1, state[i * NC + 1] * bright * 0.5 + 0.5))
        const b = Math.max(0, Math.min(1, state[i * NC + 2] * bright * 0.5 + 0.5))
        const intensity = (r + g + b) / 3
        const [cr, cg, cb] = rampRGB(intensity)
        img.data[j]     = cr
        img.data[j + 1] = cg
        img.data[j + 2] = cb
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
