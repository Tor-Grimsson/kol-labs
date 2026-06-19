

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

// Abelian sandpile identity element. The identity of the sandpile group on the
// glyph domain is a unique fractal that exactly fills the letterform silhouette.
// Computed by iterating: start from all-0, add max-stable config twice and
// relax, repeat until fixed point. Then drive continuously to animate deformation
// away from the identity.
//
// Reference: Levine, Pegden, Smart — Apollonian Structure in the Abelian Sandpile. GAFA 2016.

const PARAMS          = [
  { key: 'res',        type: 'int',   min: 80,  max: 200, default: 130, step: 10  },
  { key: 'buildSteps', type: 'int',   min: 50,  max: 800, default: 300, step: 50  },
  { key: 'driveRate',  type: 'int',   min: 0,   max: 60,  default: 8,   step: 1   },
  { key: 'maxRelax',   type: 'int',   min: 50,  max: 2000,default: 500, step: 50  },
  { key: 'palette',    type: 'select', options: ['classic', 'fire', 'ice'], default: 'classic' },
]

function relax(grid            , isIn            , G        , thresh        , maxIter        ) {
  for (let iter = 0; iter < maxIter; iter++) {
    let any = false
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const i = y * G + x
        if (!isIn[i] || grid[i] < thresh) continue
        any = true
        grid[i] -= thresh
        if (x > 0     && isIn[i - 1]) grid[i - 1]++
        if (x < G - 1 && isIn[i + 1]) grid[i + 1]++
        if (y > 0     && isIn[i - G]) grid[i - G]++
        if (y < G - 1 && isIn[i + G]) grid[i + G]++
      }
    }
    if (!any) break
  }
}

export const r2_soc_02_identity            = {
  id: 'r2-soc-02-identity',
  name: 'SANDPILE IDENTITY',
  repo: 'Levine-Pegden-Smart 2016',
  summary: 'Computes the identity element of the sandpile group on the glyph domain — a self-similar fractal that perfectly fills the letterform. Then live-drives it to show continuous deformation.',
  helps: 'The most mathematically esoteric of the SOC set. The identity fractal is zoomable and gorgeous; its deformation under drive shows the recurrent group orbit.',

  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const G        = num(params, 'res', 130)
    const buildSt  = num(params, 'buildSteps', 300)
    const driveRate= num(params, 'driveRate', 8)
    const maxRelax = num(params, 'maxRelax', 500)
    const thresh   = 4

    const N    = G * G
    const isIn = new Uint8Array(N)
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        isIn[y * G + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
      }
    }

    // Build identity: add max-stable config (all 3s inside) and relax, repeat
    const identity = new Int32Array(N)
    for (let s = 0; s < buildSt; s++) {
      for (let i = 0; i < N; i++) if (isIn[i]) identity[i] += thresh - 1
      relax(identity, isIn, G, thresh, maxRelax)
    }

    // Live grid starts at identity
    const grid = new Int32Array(identity)

    const interior           = []
    for (let i = 0; i < N; i++) if (isIn[i]) interior.push(i)

    const img = ctx.createImageData(G, G)
    const tmp = document.createElement('canvas')
    tmp.width = G; tmp.height = G
    const tc  = tmp.getContext('2d')

    return wrapLoop(() => {
      for (let d = 0; d < driveRate; d++) {
        const idx = interior[(rng() * interior.length) | 0]
        grid[idx]++
      }
      relax(grid, isIn, G, thresh, maxRelax)

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j + 1] = bg; img.data[j + 2] = bb; img.data[j + 3] = 255
          continue
        }
        const [r, g, b] = rampRGB(Math.min(grid[i], 3) / 3)   // height 0..3 → palette ramp
        img.data[j] = r; img.data[j + 1] = g; img.data[j + 2] = b; img.data[j + 3] = 255
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
