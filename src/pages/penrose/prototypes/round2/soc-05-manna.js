

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Manna stochastic sandpile. Threshold=2; when a site topples it sends its 2
// grains to two *randomly chosen* neighbors (uniform, with replacement).
// This breaks the abelian determinism and produces softer, diffusion-like
// avalanche fronts — ink bleeding through paper rather than BTW's crisp waves.
// Universality class distinct from BTW.
//
// Reference: Manna (1991) J. Phys. A 24:L363.

const PARAMS          = [
  { key: 'res',           type: 'int',   min: 80,  max: 220, default: 150, step: 10 },
  { key: 'dropsPerFrame', type: 'int',   min: 1,   max: 100, default: 25,  step: 1  },
  { key: 'maxRelax',      type: 'int',   min: 50,  max: 2000,default: 500, step: 50 },
  { key: 'colorMode',     type: 'select', options: ['height', 'activity'], default: 'height' },
  { key: 'brightness',    type: 'range', min: 0.5, max: 2.5, default: 1.2, step: 0.05 },
]

export const r2_soc_05_manna            = {
  id: 'r2-soc-05-manna',
  name: 'MANNA SANDPILE',
  repo: 'Manna 1991',
  summary: 'Stochastic sandpile: sites topple at height>=2 sending both grains to random neighbors. Softer organic avalanche fronts than BTW; diffusion-like spreading sculpted by glyph geometry.',
  helps: 'Distinct SOC universality class — same criticality principle as BTW but visually naturalistic. Letterform strokes bias random walks, making geometry visible in the grain flow.',

  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const G         = num(params, 'res', 150)
    const drops     = num(params, 'dropsPerFrame', 25)
    const maxRelax  = num(params, 'maxRelax', 500)
    const colorMode = typeof params['colorMode'] === 'string' ? params['colorMode'] : 'height'
    const bright    = num(params, 'brightness', 1.2)

    const N    = G * G
    const isIn = new Uint8Array(N)
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        isIn[y * G + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
      }
    }

    const grid     = new Int32Array(N)
    const activity = new Float32Array(N)   // decaying activity heatmap

    const interior           = []
    for (let i = 0; i < N; i++) if (isIn[i]) interior.push(i)

    // Build per-cell neighbor list (only interior neighbors can receive grains)
    const nbrs             = new Array(N)
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const i = y * G + x
        if (!isIn[i]) { nbrs[i] = []; continue }
        const n           = []
        if (x > 0     && isIn[i - 1]) n.push(i - 1)
        if (x < G - 1 && isIn[i + 1]) n.push(i + 1)
        if (y > 0     && isIn[i - G]) n.push(i - G)
        if (y < G - 1 && isIn[i + G]) n.push(i + G)
        nbrs[i] = n
      }
    }

    const img = ctx.createImageData(G, G)
    const tmp = document.createElement('canvas')
    tmp.width = G; tmp.height = G
    const tc  = tmp.getContext('2d')

    return wrapLoop(() => {
      // Drop grains at random interior sites
      for (let d = 0; d < drops; d++) {
        const idx = interior[(rng() * interior.length) | 0]
        grid[idx]++
      }

      // Relax — sequential, stochastic redistribution
      for (let iter = 0; iter < maxRelax; iter++) {
        let any = false
        for (let i = 0; i < N; i++) {
          if (!isIn[i] || grid[i] < 2) continue
          any = true
          grid[i] -= 2
          activity[i] = Math.min(1, activity[i] + 0.6)
          const nn = nbrs[i]
          if (nn.length === 0) continue   // isolated sink — lose both grains
          // Send 2 grains to random neighbors (with replacement)
          for (let g = 0; g < 2; g++) {
            const target = nn[(rng() * nn.length) | 0]
            grid[target]++
          }
        }
        if (!any) break
      }

      // Decay activity
      for (let i = 0; i < N; i++) activity[i] *= 0.88

      // Render
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = 10; img.data[j + 1] = 11; img.data[j + 2] = 20; img.data[j + 3] = 255
          continue
        }

        let r = 0, g = 0, b = 0
        if (colorMode === 'activity') {
          const a = Math.min(1, activity[i])
          r = (20  + a * 220 * bright) | 0
          g = (15  + a * 120 * bright) | 0
          b = (40  + a * 30  * bright) | 0
        } else {
          // height mode: 0=bg, 1=teal, >=2=amber
          const h = Math.min(grid[i], 2)
          const t = h / 2
          r = (10  + t * 230 * bright) | 0
          g = (40  + t * 160 * bright) | 0
          b = (60  + t * 30  * bright) | 0
        }

        img.data[j]     = Math.min(255, r)
        img.data[j + 1] = Math.min(255, g)
        img.data[j + 2] = Math.min(255, b)
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
