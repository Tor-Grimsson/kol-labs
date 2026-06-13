

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Quasicrystal wave interference (de Bruijn / Pentagrid method).
// CPU pixel-by-pixel: sum N cosines at angles k*π/N, threshold, colorize.
// Animate phase offsets φ_k for phason drift.

const PARAMS          = [
  { key: 'N', type: 'int', min: 3, max: 9, default: 5, label: 'symmetry N' },
  { key: 'scale', type: 'range', min: 20, max: 200, default: 60, step: 5, label: 'wave scale' },
  { key: 'driftSpeed', type: 'range', min: 0, max: 2, default: 0.4, step: 0.05, label: 'phason drift' },
  { key: 'bands', type: 'int', min: 2, max: 6, default: 3, label: 'color bands' },
]

export const r2_tile_03_quasiwave            = {
  id: 'r2-tile-03-quasiwave',
  name: 'QUASICRYSTAL WAVE',
  repo: 'de Bruijn 1981 pentagrid; wave-superposition interpretation',
  summary: 'N sinusoidal waves at angles k·π/N summed and thresholded per pixel; phason drift via animated phase offsets φ_k produces continuous quasicrystal tile-flip worms.',
  helps: 'Pure pixel-math aperiodic pattern — no polygon geometry, scales to any resolution, trivial SDF integration via per-pixel discard.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    // ImageData for direct pixel write
    let imgData = ctx.createImageData(W, H)

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const N = Math.max(3, Math.round(num(params, 'N', 5)))
      const scale = num(params, 'scale', 60)
      const driftSpeed = num(params, 'driftSpeed', 0.4)
      const bands = Math.max(2, Math.round(num(params, 'bands', 3)))

      // Recreate ImageData if size changed (shouldn't, but safe)
      if (imgData.width !== W || imgData.height !== H) {
        imgData = ctx.createImageData(W, H)
      }

      const d = imgData.data
      // Pre-compute wave directions
      const dirs                     = []
      for (let k = 0; k < N; k++) {
        const ang = (k * Math.PI) / N
        dirs.push([Math.cos(ang), Math.sin(ang)])
      }
      // Animated phase offsets — each wave drifts at slightly different speed
      const phases           = []
      for (let k = 0; k < N; k++) {
        phases.push(t * driftSpeed * (0.8 + 0.4 * ((k * 1.618) % 1)))
      }

      const cx = W / 2
      const cy = H / 2

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const idx = (py * W + px) * 4
          // SDF test
          const sx = (px / W) * sdf.w
          const sy = (py / H) * sdf.h
          const sdfVal = sdf.sample(sx, sy)
          if (sdfVal > 0) {
            d[idx] = 10; d[idx + 1] = 11; d[idx + 2] = 20; d[idx + 3] = 255
            continue
          }

          const x = (px - cx) / scale
          const y = (py - cy) / scale
          let f = 0
          for (let k = 0; k < N; k++) {
            f += Math.cos(x * dirs[k][0] + y * dirs[k][1] + phases[k])
          }
          f /= N  // normalize to [-1, 1]

          // Map to color bands
          const band = Math.floor(((f + 1) / 2) * bands) % bands
          const bright = 0.5 + 0.5 * Math.cos(f * Math.PI)
          // Fade near SDF edge
          const edgeFade = Math.max(0, Math.min(1, -sdfVal / 8))

          // Color by band (golden-ratio hue rotation)
          const hue = (band / bands + t * 0.02) % 1
          const [r, g, b] = hslToRgb(hue, 0.55, 0.25 + bright * 0.35)

          d[idx]     = (r * edgeFade) | 0
          d[idx + 1] = (g * edgeFade) | 0
          d[idx + 2] = (b * edgeFade) | 0
          d[idx + 3] = 255
        }
      }

      ctx.putImageData(imgData, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}

function hslToRgb(h        , s        , l        )                           {
  const a = s * Math.min(l, 1 - l)
  const f = (n        ) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
