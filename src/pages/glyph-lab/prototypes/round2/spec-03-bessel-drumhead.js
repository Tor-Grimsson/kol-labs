

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Bessel Drumhead Modes — circular Chladni patterns as a standing-wave scalar field.
// u(r,θ,t) = J_m(k_mn·r)·cos(mθ)·cos(ωt). Two modes mixed for a beating interference.
// Ref: https://en.wikipedia.org/wiki/Vibrations_of_a_circular_membrane

const PARAMS          = [
  { key: 'm1', type: 'int', min: 0, max: 5, default: 2, label: 'mode m1' },
  { key: 'n1', type: 'int', min: 1, max: 4, default: 1, label: 'mode n1' },
  { key: 'm2', type: 'int', min: 0, max: 5, default: 3, label: 'mode m2' },
  { key: 'speed', type: 'range', min: 0.1, max: 4.0, default: 1.0, step: 0.1 },
  { key: 'detune', type: 'range', min: 0, max: 0.4, default: 0.07, step: 0.01, label: 'beat detune' },
]

// Zeros Z[m][n] of Bessel J_m — precomputed to 4th zero for m=0..5
const BESSEL_ZEROS             = [
  [2.4048, 5.5201, 8.6537, 11.7915],
  [3.8317, 7.0156, 10.1735, 13.3237],
  [5.1356, 8.4172, 11.6198, 14.7960],
  [6.3802, 9.7610, 13.0152, 16.2235],
  [7.5883, 11.0647, 14.3725, 17.6160],
  [8.7715, 12.3386, 15.7002, 19.0094],
]

// Bessel J_m(x) via iterative series (stable for x < 25)
function besselJ(m        , x        )         {
  if (x === 0) return m === 0 ? 1 : 0
  let sum = 0
  let term = 1
  // leading factor (x/2)^m / m!
  for (let k = 1; k <= m; k++) term *= (x / 2) / k
  sum = term
  for (let s = 1; s <= 30; s++) {
    term *= -(x / 2) * (x / 2) / (s * (s + m))
    sum += term
    if (Math.abs(term) < 1e-10) break
  }
  return sum
}

export const r2_spec_03_bessel_drumhead            = {
  id: 'r2-spec-03-bessel-drumhead',
  name: 'BESSEL DRUMHEAD',
  repo: 'Chladni 1787 · en.wikipedia.org/wiki/Vibrations_of_a_circular_membrane',
  summary: 'Circular Chladni modes rendered as a sign-coloured scalar field; two modes mixed at detuned frequencies produce beating.',
  helps: 'Per-pixel field evaluation fills the glyph with nodal lines — visually distinctive, nothing else in the gallery looks like this.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const img = ctx.createImageData(W, H)
    const d = img.data

    return wrapLoop(() => {
      const m1 = Math.max(0, Math.min(5, num(params, 'm1', 2)))
      const n1 = Math.max(1, Math.min(4, num(params, 'n1', 1))) - 1
      const m2 = Math.max(0, Math.min(5, num(params, 'm2', 3)))
      const speed = num(params, 'speed', 1.0)
      const detune = num(params, 'detune', 0.07)

      const t = clock.nowSeconds() * speed

      // k_mn = Z_mn / R_disk (normalised so R_disk=1)
      const k1 = BESSEL_ZEROS[m1][n1]
      const k2 = BESSEL_ZEROS[m2][0]  // n2=1 always
      const w1 = k1
      const w2 = k2 * (1 + detune)

      const CX = W / 2
      const CY = H / 2
      const R = Math.min(W, H) * 0.46

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const idx = (py * W + px) * 4
          const sx = (px / W) * sdf.w
          const sy = (py / H) * sdf.h
          const inside = sdf.sample(sx, sy) < 0

          if (!inside) {
            d[idx] = 10; d[idx + 1] = 11; d[idx + 2] = 20; d[idx + 3] = 255
            continue
          }

          const dx = (px - CX) / R
          const dy = (py - CY) / R
          const r = Math.hypot(dx, dy)
          const theta = Math.atan2(dy, dx)

          const u1 = besselJ(m1, k1 * r) * Math.cos(m1 * theta) * Math.cos(w1 * t)
          const u2 = besselJ(m2, k2 * r) * Math.cos(m2 * theta) * Math.cos(w2 * t)
          const u = u1 + 0.6 * u2

          // Sign colouring: warm for positive, cool for negative, dark at nodes
          const norm = Math.tanh(u * 3) // compress range
          const bright = Math.abs(norm)
          let R8        , G8        , B8
          if (norm > 0) {
            R8 = Math.round(30 + bright * 200)
            G8 = Math.round(60 + bright * 120)
            B8 = Math.round(100 + bright * 60)
          } else {
            R8 = Math.round(30 + bright * 60)
            G8 = Math.round(60 + bright * 80)
            B8 = Math.round(100 + bright * 180)
          }
          d[idx] = R8; d[idx + 1] = G8; d[idx + 2] = B8; d[idx + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
