

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB } from '../common'

const PARAMS          = [
  { key: 'folds', type: 'int', min: 3, max: 8, default: 5, step: 1, label: 'fold count' },
  { key: 'scale', type: 'range', min: 1.5, max: 3.0, default: 2.0, step: 0.1, label: 'fold scale' },
  { key: 'rotSpeed', type: 'range', min: 0, max: 0.3, default: 0.06, step: 0.01, label: 'fold rotation' },
  { key: 'iters', type: 'int', min: 4, max: 24, default: 12, step: 1, label: 'iterations' },
  { key: 'palette', type: 'select', options: ['violet', 'teal', 'sand'], default: 'violet' },
]

const RES = 140

function paletteCol(v        , name        )                           {
  const t = Math.max(0, Math.min(1, v))
  if (name === 'teal') return [
    Math.floor(20 + 60 * t),
    Math.floor(160 + 80 * t * t),
    Math.floor(150 + 90 * t),
  ]
  if (name === 'sand') return [
    Math.floor(200 + 55 * t),
    Math.floor(160 + 70 * t),
    Math.floor(80 + 100 * t),
  ]
  // violet
  return [
    Math.floor(80 + 160 * t * t),
    Math.floor(20 + 80 * t),
    Math.floor(180 + 75 * t),
  ]
}

// Reflect p across normal n (normalized)
function reflectAcross(px        , py        , nx        , ny        )                   {
  const dot2 = 2 * (px * nx + py * ny)
  return [px - dot2 * nx, py - dot2 * ny]
}

export const r2_frac_04_kifs            = {
  id: 'r2-frac-04-kifs',
  name: 'KALEIDOSCOPIC IFS',
  repo: 'Niels Hvidtfeldt Thrane (Syntopia) — blog.hvidtfeldts.net',
  summary: 'Iterated fold planes (conditional reflections) applied per pixel as an orbit-count renderer. Fold plane normals rotate slowly over time producing symmetry-breathing kaleidoscopic fractals.',
  helps: 'Kaleidoscopic self-similarity at every zoom level — one of the premier zoom-rewarding 2D structures. Fold rotation animates smoothly. Entirely CPU 2D canvas.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const folds = Math.round(num(params, 'folds', 5))
      const scale = num(params, 'scale', 2.0)
      const rotSpeed = num(params, 'rotSpeed', 0.06)
      const iters = Math.round(num(params, 'iters', 12))
      const palette = String(params['palette'] ?? 'violet')

      // Build fold plane normals — evenly spaced angles, slowly rotating
      const normals                     = []
      for (let f = 0; f < folds; f++) {
        const angle = (f * Math.PI) / folds + t * rotSpeed
        normals.push([Math.cos(angle), Math.sin(angle)])
      }

      const offset = 0.5 // translation after scale

      const img = ctx.createImageData(RES, RES)

      for (let py = 0; py < RES; py++) {
        for (let px = 0; px < RES; px++) {
          const wx = (px / RES) * sdf.w
          const wy = (py / RES) * sdf.h
          if (sdf.sample(wx, wy) >= 0) continue

          let x = (px / RES - 0.5) * 2.4
          let y = (py / RES - 0.5) * 2.4
          let accumulated = 0

          for (let i = 0; i < iters; i++) {
            // Apply each fold plane: reflect if on negative side
            for (const [nx, ny] of normals) {
              if (x * nx + y * ny < 0) {
                const [rx, ry] = reflectAcross(x, y, nx, ny)
                x = rx; y = ry
              }
            }
            // Scale + translate
            x = scale * x - offset
            y = scale * y - offset
            accumulated += Math.sqrt(x * x + y * y) * Math.pow(scale, -i)
          }

          // Distance estimator proxy: use final orbit magnitude / accumulated scale
          const finalR = Math.sqrt(x * x + y * y)
          const de = finalR / Math.pow(scale, iters)
          const v = 1 - Math.exp(-de * 1.5) + accumulated * 0.003

          const t01 = v - Math.floor(v)
          const [rr, gg, bb] = rampRGB(t01)

          const idx = (py * RES + px) * 4
          img.data[idx] = rr
          img.data[idx + 1] = gg
          img.data[idx + 2] = bb
          img.data[idx + 3] = 230
        }
      }

      clear(ctx, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = RES; tmp.height = RES
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
