

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Bak-Tang-Wiesenfeld abelian sandpile. Grains dropped randomly inside the
// glyph; sites topple when grain count >= threshold (default 4), distributing
// to 4-connected neighbors. SDF >= 0 pixels are sinks — grains that topple
// there are absorbed. The glyph silhouette sculpts avalanche shape.
//
// Reference: Bak, Tang, Wiesenfeld (1987) PRL 59:381.

const PARAMS          = [
  { key: 'res',           type: 'int',   min: 80,  max: 220, default: 150, step: 10 },
  { key: 'dropsPerFrame', type: 'int',   min: 1,   max: 120, default: 30,  step: 1  },
  { key: 'threshold',     type: 'int',   min: 2,   max: 8,   default: 4,   step: 1  },
  { key: 'maxRelax',      type: 'int',   min: 50,  max: 2000,default: 400, step: 50 },
  { key: 'brightness',    type: 'range', min: 0.5, max: 2.0, default: 1.0, step: 0.05 },
]

export const r2_soc_01_btw            = {
  id: 'r2-soc-01-btw',
  name: 'BTW SANDPILE',
  repo: 'Bak-Tang-Wiesenfeld 1987',
  summary: 'Sand grains dropped randomly inside the glyph; cells with height >= threshold topple to neighbors; dramatic power-law avalanches shaped by the letterform.',
  helps: 'Long quiescence punctuated by cascading avalanches — pure self-organized criticality. Narrow strokes create bottlenecks; counters form isolated basins.',

  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const G      = num(params, 'res', 150)
    const thresh = num(params, 'threshold', 4)
    const drops  = num(params, 'dropsPerFrame', 30)
    const maxRel = num(params, 'maxRelax', 400)
    const bright = num(params, 'brightness', 1.0)

    const N = G * G
    const grid   = new Int32Array(N)
    const isIn   = new Uint8Array(N)   // 1 = interior (active), 0 = sink

    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        isIn[y * G + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
      }
    }

    // Collect interior indices for fast random drop targeting
    const interior           = []
    for (let i = 0; i < N; i++) if (isIn[i]) interior.push(i)

    const img = ctx.createImageData(G, G)
    const tmp = document.createElement('canvas')
    tmp.width = G; tmp.height = G
    const tc  = tmp.getContext('2d')

    // 4-color BTW palette: 0=bg, 1=dim, 2=mid, 3=bright
    const PALETTE = [
      [10, 11, 20],
      [40, 60, 120],
      [80, 140, 220],
      [230, 200, 120],
    ]

    return wrapLoop(() => {
      // Drop grains
      for (let d = 0; d < drops; d++) {
        const idx = interior[(rng() * interior.length) | 0]
        grid[idx]++
      }

      // Relax (sequential toppling, bounded)
      for (let iter = 0; iter < maxRel; iter++) {
        let toppled = false
        for (let y = 0; y < G; y++) {
          for (let x = 0; x < G; x++) {
            const i = y * G + x
            if (!isIn[i] || grid[i] < thresh) continue
            toppled = true
            grid[i] -= thresh
            const neighbors = [
              x > 0     ? i - 1 : -1,
              x < G - 1 ? i + 1 : -1,
              y > 0     ? i - G : -1,
              y < G - 1 ? i + G : -1,
            ]
            for (const ni of neighbors) {
              if (ni >= 0 && isIn[ni]) grid[ni]++
              // grains to sinks or out-of-bounds are simply lost
            }
          }
        }
        if (!toppled) break
      }

      // Render
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = 10; img.data[j + 1] = 11; img.data[j + 2] = 20; img.data[j + 3] = 255
          continue
        }
        const v = Math.min(grid[i], 3)
        const [r, g, b] = PALETTE[v]
        img.data[j]     = Math.min(255, (r * bright) | 0)
        img.data[j + 1] = Math.min(255, (g * bright) | 0)
        img.data[j + 2] = Math.min(255, (b * bright) | 0)
        img.data[j + 3] = 255
      }

      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tmp, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
