

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'rMin', type: 'range', min: 2.5, max: 3.5, default: 2.8, step: 0.05, label: 'r window min' },
  { key: 'rMax', type: 'range', min: 3.5, max: 4.0, default: 4.0, step: 0.05, label: 'r window max' },
  { key: 'warmup', type: 'int', min: 100, max: 2000, default: 500, step: 100, label: 'warmup steps' },
  { key: 'display', type: 'int', min: 50, max: 400, default: 150, step: 50, label: 'display steps' },
  { key: 'palette', type: 'select', options: ['neon', 'ghost', 'heat'], default: 'neon' },
]

const RES_X = 200
const RES_Y = 160

function paletteCol(density        , name        , period        )                           {
  // Color by density + period hue
  const t = Math.max(0, Math.min(1, Math.log(density + 1) / Math.log(20)))
  const h = (period * 0.137) % 1  // period -> hue
  if (name === 'ghost') {
    const v = Math.floor(180 * t + 40)
    return [v, v, Math.floor(v * 1.3)]
  }
  if (name === 'heat') {
    return [
      Math.floor(255 * Math.min(1, t * 1.5)),
      Math.floor(180 * t * t),
      Math.floor(40 * t),
    ]
  }
  // neon: hue-rotate by period
  const r = Math.sin(h * Math.PI * 2) * 0.5 + 0.5
  const g = Math.sin(h * Math.PI * 2 + 2.1) * 0.5 + 0.5
  const b = Math.sin(h * Math.PI * 2 + 4.2) * 0.5 + 0.5
  return [
    Math.floor(r * 200 * t + 20 * t),
    Math.floor(g * 200 * t + 20 * t),
    Math.floor(b * 200 * t + 20 * t),
  ]
}

// Detect approximate period by collecting unique attractor values (rough)
function detectPeriod(values              , n        )         {
  // Check if last 2n values repeat the first n — crude period detector
  if (n < 4) return 1
  for (const p of [1, 2, 4, 8, 16, 32]) {
    if (p >= n) break
    let match = true
    for (let i = 0; i < p && i < n - p; i++) {
      if (Math.abs(values[i] - values[i + p]) > 0.01) { match = false; break }
    }
    if (match) return p
  }
  return 0 // chaotic
}

export const r2_frac_05_bifurcation            = {
  id: 'r2-frac-05-bifurcation',
  name: 'BIFURCATION DIAGRAM',
  repo: 'Feigenbaum 1978 — Logistic map / period-doubling cascade',
  summary: 'Logistic map xn+1 = r·xn·(1-xn) scanned across the r-axis, plotting the steady-state attractor values as a density histogram per column. r window slowly pans/zooms over time, revealing self-similar sub-cascades.',
  helps: 'Infinite self-similar zoom reward — every sub-cascade contains a complete bifurcation diagram. Animated r-window drift keeps it moving.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    // Persistent density buffer for additive accumulation
    const densityR = new Float32Array(RES_X * RES_Y)
    const densityG = new Float32Array(RES_X * RES_Y)
    const densityB = new Float32Array(RES_X * RES_Y)
    const periodBuf = new Float32Array(RES_X * RES_Y)
    let lastRMin = -1, lastRMax = -1

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const rMin = num(params, 'rMin', 2.8)
      const rMax = num(params, 'rMax', 4.0)
      const warmup = Math.round(num(params, 'warmup', 500))
      const display = Math.round(num(params, 'display', 150))
      const palette = String(params['palette'] ?? 'neon')

      // Slowly drift the r-window for animation
      const drift = Math.sin(t * 0.05) * (rMax - rMin) * 0.04
      const rWin0 = Math.max(2.5, rMin + drift)
      const rWin1 = Math.min(4.0, rMax + drift * 0.7)
      const rSpan = rWin1 - rWin0

      // Reset buffers when window changes significantly
      if (Math.abs(rWin0 - lastRMin) > 0.02 || Math.abs(rWin1 - lastRMax) > 0.02) {
        densityR.fill(0); densityG.fill(0); densityB.fill(0)
        lastRMin = rWin0; lastRMax = rWin1
      }

      const attractor = new Float32Array(display)

      for (let col = 0; col < RES_X; col++) {
        const r = rWin0 + (col / RES_X) * rSpan

        // Logistic map: warmup
        let x = 0.5 + Math.sin(t * 0.1 + col * 0.01) * 0.01 // slight time-vary of init
        for (let i = 0; i < warmup; i++) x = r * x * (1 - x)

        // Collect display attractor values
        for (let i = 0; i < display; i++) {
          x = r * x * (1 - x)
          attractor[i] = x
        }

        const period = detectPeriod(attractor, display)

        for (let i = 0; i < display; i++) {
          const xv = attractor[i]
          const row = Math.floor(xv * RES_Y)
          if (row < 0 || row >= RES_Y) continue

          const wx = (col / RES_X) * sdf.w
          const wy = ((RES_Y - 1 - row) / RES_Y) * sdf.h
          if (sdf.sample(wx, wy) >= 0) continue

          const idx = (RES_Y - 1 - row) * RES_X + col
          densityR[idx] += 1
          periodBuf[idx] = period
        }
      }

      // Gentle decay for temporal animation
      for (let i = 0; i < RES_X * RES_Y; i++) {
        densityR[i] *= 0.96
      }

      // Build image
      const img = ctx.createImageData(RES_X, RES_Y)
      for (let i = 0; i < RES_X * RES_Y; i++) {
        const d = densityR[i]
        if (d < 0.5) continue
        const [r, g, b] = paletteCol(d, palette, periodBuf[i])
        img.data[i * 4] = r
        img.data[i * 4 + 1] = g
        img.data[i * 4 + 2] = b
        img.data[i * 4 + 3] = Math.min(255, Math.floor(180 + d * 5))
      }

      clear(ctx, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = RES_X; tmp.height = RES_Y
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
