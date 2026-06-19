

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

// Olami-Feder-Christensen earthquake model. Real-valued stress field; uniform
// loading until some site hits threshold F_th=1; site relaxes to 0 and
// transfers alpha * F_old to each 4-connected neighbor. Cascade until stable.
// alpha=0.25 is conservative (lossless); alpha<0.25 is dissipative.
// SDF >= 0 cells have zero stress and act as free boundaries.
//
// Reference: Olami, Feder, Christensen (1992) PRL 68:1244.

const PARAMS          = [
  { key: 'res',        type: 'int',   min: 80,   max: 200, default: 140, step: 10    },
  { key: 'alpha',      type: 'range', min: 0.10, max: 0.25,default: 0.20,step: 0.005 },
  { key: 'driveStep',  type: 'range', min: 0.001,max: 0.02, default: 0.005, step: 0.001 },
  { key: 'maxCascade', type: 'int',   min: 50,   max: 3000, default: 800, step: 50   },
  { key: 'glow',       type: 'range', min: 0.0,  max: 1.0,  default: 0.4, step: 0.05 },
]

export const r2_soc_04_ofc            = {
  id: 'r2-soc-04-ofc',
  name: 'OFC EARTHQUAKE',
  repo: 'Olami-Feder-Christensen 1992',
  summary: 'Real-valued stress field loaded uniformly; sites rupture at threshold=1, transfer fraction alpha of stress to neighbors, cascade. Smooth gradient buildup + sharp stress-release ripples.',
  helps: 'Continuous field produces cinematic "tectonic breathing" — slow luminance build, sharp cascade shadows. More aesthetic flexibility than integer sandpile.',

  params: PARAMS,

  init({ ctx, sdf, W, H, params }) {
    const G        = num(params, 'res', 140)
    const alpha    = num(params, 'alpha', 0.20)
    const driveStep= num(params, 'driveStep', 0.005)
    const maxCasc  = num(params, 'maxCascade', 800)
    const glow     = num(params, 'glow', 0.4)

    const N    = G * G
    const isIn = new Uint8Array(N)
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        isIn[y * G + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
      }
    }

    // Each interior site gets a random initial stress in [0,1)
    const stress = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      if (isIn[i]) stress[i] = Math.random()
    }

    // afterglow accumulator — decays each frame, lit by recent quakes
    const glow_buf = new Float32Array(N)

    const img = ctx.createImageData(G, G)
    const tmp = document.createElement('canvas')
    tmp.width = G; tmp.height = G
    const tc  = tmp.getContext('2d')

    return wrapLoop(() => {
      // Drive: uniformly load all interior sites
      for (let i = 0; i < N; i++) {
        if (isIn[i]) stress[i] += driveStep
      }

      // Cascade: find and topple unstable sites
      for (let iter = 0; iter < maxCasc; iter++) {
        let toppled = false
        for (let y = 0; y < G; y++) {
          for (let x = 0; x < G; x++) {
            const i = y * G + x
            if (!isIn[i] || stress[i] < 1.0) continue
            toppled = true
            const transfer = alpha * stress[i]
            stress[i] = 0
            glow_buf[i] = 1.0   // flash on rupture
            if (x > 0     && isIn[i - 1]) stress[i - 1] += transfer
            if (x < G - 1 && isIn[i + 1]) stress[i + 1] += transfer
            if (y > 0     && isIn[i - G]) stress[i - G] += transfer
            if (y < G - 1 && isIn[i + G]) stress[i + G] += transfer
          }
        }
        if (!toppled) break
      }

      // Decay glow
      const decay = 0.92
      for (let i = 0; i < N; i++) glow_buf[i] *= decay

      // Render: deep blue (low stress) -> cyan -> white (near threshold)
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j + 1] = bg; img.data[j + 2] = bb; img.data[j + 3] = 255
          continue
        }
        const s  = Math.max(0, Math.min(1, stress[i]))
        const gl = Math.min(1, glow_buf[i] * glow)
        // stress 0..1 along the ramp, then blend toward warm on rupture flash
        const [sr, sg, sb] = rampRGB(s)
        const [wr, wg, wb] = roleRGB('warm')
        img.data[j]     = (sr + (wr - sr) * gl) | 0
        img.data[j + 1] = (sg + (wg - sg) * gl) | 0
        img.data[j + 2] = (sb + (wb - sb) * gl) | 0
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
