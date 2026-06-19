

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

const PARAMS          = [
  { key: 'maxIter', type: 'int', min: 32, max: 512, default: 128, step: 16, label: 'max iter' },
  { key: 'bailout', type: 'range', min: 2, max: 16, default: 4, step: 0.5, label: 'bailout' },
  { key: 'trapMode', type: 'select', options: ['glyph', 'cross', 'ring'], default: 'glyph', label: 'trap shape' },
  { key: 'cSpeed', type: 'range', min: 0, max: 0.5, default: 0.08, step: 0.01, label: 'c orbit speed' },
  { key: 'palette', type: 'select', options: ['fire', 'ice', 'gold'], default: 'fire' },
]

const RES = 140

function paletteCol(v        , name        )                           {
  const t = Math.max(0, Math.min(1, v))
  if (name === 'ice') return [
    Math.floor(20 + 180 * t * t),
    Math.floor(120 + 120 * t),
    Math.floor(200 + 55 * t),
  ]
  if (name === 'gold') return [
    Math.floor(200 + 55 * t),
    Math.floor(160 * t + 80 * t * t),
    Math.floor(20 * t),
  ]
  // fire
  const r = Math.floor(255 * Math.min(1, t * 2))
  const g = Math.floor(255 * Math.max(0, t * 2 - 0.2))
  const b = Math.floor(60 * Math.max(0, t - 0.7) * 3)
  return [r, g, b]
}

export const r2_frac_03_orbit_trap            = {
  id: 'r2-frac-03-orbit-trap',
  name: 'ORBIT TRAP',
  repo: 'Inigo Quilez — iquilezles.org/articles/ftrapsgeometric',
  summary: 'Julia set colored by minimum orbit distance to a trap shape (glyph SDF, cross, or ring). The c parameter orbits a slow circle over time so the Julia morphs continuously.',
  helps: 'Glyph-SDF as the trap makes fractal filaments literally emanate from letterform edges. Cross-scale detail at every zoom level — the canonical zoom-rewarding fractal.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const maxIter = num(params, 'maxIter', 128)
      const bailout = num(params, 'bailout', 4)
      const trapMode = String(params['trapMode'] ?? 'glyph')
      const cSpeed = num(params, 'cSpeed', 0.08)
      const palette = String(params['palette'] ?? 'fire')
      const b2 = bailout * bailout

      // Julia c parameter drifts on a small circle in interesting region
      const cAngle = t * cSpeed
      const cr = -0.7 + 0.3 * Math.cos(cAngle)
      const ci = 0.27 + 0.15 * Math.sin(cAngle * 1.3)

      const img = ctx.createImageData(RES, RES)

      for (let py = 0; py < RES; py++) {
        for (let px = 0; px < RES; px++) {
          // Map pixel to complex plane [-1.6, 1.6] x [-1.6, 1.6]
          let zr = (px / RES - 0.5) * 3.2
          let zi = (py / RES - 0.5) * 3.2

          // SDF check
          const wx = (px / RES) * sdf.w
          const wy = (py / RES) * sdf.h
          const sdfVal = sdf.sample(wx, wy)
          if (sdfVal >= 0) continue

          let trapMin = Infinity
          let n = 0

          for (; n < maxIter; n++) {
            const zr2 = zr * zr, zi2 = zi * zi
            if (zr2 + zi2 > b2) break

            // compute trap distance
            let d
            if (trapMode === 'glyph') {
              // Map z coords to glyph pixel space
              const gx = ((zr / 3.2) + 0.5) * sdf.w
              const gy = ((zi / 3.2) + 0.5) * sdf.h
              d = Math.abs(sdf.sample(gx, gy))
            } else if (trapMode === 'cross') {
              d = Math.min(Math.abs(zr), Math.abs(zi))
            } else {
              // ring trap
              d = Math.abs(Math.sqrt(zr2 + zi2) - 1.0)
            }
            if (d < trapMin) trapMin = d

            const nzr = zr2 - zi2 + cr
            zi = 2 * zr * zi + ci
            zr = nzr
          }

          const idx = (py * RES + px) * 4
          if (n === maxIter) {
            // interior: theme bg
            const [br, bg, bb] = roleRGB('bg')
            img.data[idx] = br
            img.data[idx + 1] = bg
            img.data[idx + 2] = bb
            img.data[idx + 3] = 200
          } else {
            // smooth trap color along the palette ramp
            const v = Math.exp(-trapMin * 3)
            const [r, g, b] = rampRGB(v)
            img.data[idx] = r
            img.data[idx + 1] = g
            img.data[idx + 2] = b
            img.data[idx + 3] = 230
          }
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
