

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Detuned / Phase-Drifting Lissajous — nearly rational frequency ratio causes
// the figure to slowly rotate and morph, sweeping all topologies for that ratio family.
// Ref: https://mathworld.wolfram.com/LissajousCurve.html

const PARAMS          = [
  { key: 'a', type: 'range', min: 1, max: 7, default: 3, step: 0.1, label: 'freq A' },
  { key: 'b', type: 'range', min: 1, max: 7, default: 4, step: 0.1, label: 'freq B' },
  { key: 'eps', type: 'range', min: 0, max: 0.05, default: 0.007, step: 0.001, label: 'detune ε' },
  { key: 'phi', type: 'range', min: 0, max: 6.28, default: 1.57, step: 0.05, label: 'phase' },
  { key: 'trail', type: 'int', min: 200, max: 4000, default: 2000, step: 100 },
]

const TWO_PI = Math.PI * 2

export const r2_spec_05_detuned_lissajous            = {
  id: 'r2-spec-05-detuned-lissajous',
  name: 'DETUNED LISSAJOUS',
  repo: 'Lissajous 1857 · Bowditch 1815 · mathworld.wolfram.com/LissajousCurve',
  summary: 'Near-rational ωₓ/ω_y causes the Lissajous figure to slowly precess, cycling through all topologies of that ratio family.',
  helps: 'No damping needed — slow precession provides continuous motion, filling the glyph with a different cross-section each loop.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const R = Math.min(W, H) * 0.44
    const CX = W / 2
    const CY = H / 2

    return wrapLoop(() => {
      const a = num(params, 'a', 3)
      const b = num(params, 'b', 4)
      const eps = num(params, 'eps', 0.007)
      const phi = num(params, 'phi', 1.57)
      const trail = num(params, 'trail', 2000)

      // Detuned frequency pair
      const wa = a
      const wb = b + eps

      // t0 is the "head" of the trail in parametric time
      // One full nominal period = 2π / gcd(a,b) — approximate with 2π for display
      // Advance slowly so the precession is visible
      const t0 = clock.nowSeconds() * 0.8

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const dt = (TWO_PI / a) / trail
      ctx.lineWidth = 1.0

      for (let i = 0; i < trail - 1; i++) {
        const ta = t0 - i * dt
        const tb = ta - dt

        const x0 = CX + R * Math.sin(wa * ta + phi)
        const y0 = CY + R * Math.sin(wb * ta)
        const x1 = CX + R * Math.sin(wa * tb + phi)
        const y1 = CY + R * Math.sin(wb * tb)

        if (sdf.sample(x0 * sdf.w / W, y0 * sdf.h / H) > 2) continue

        const age = i / trail
        // Colour cycles with phase difference — slow hue drift across the trail
        const phaseDiff = ((wa - wb) * ta) % TWO_PI
        const hue = 200 + (phaseDiff / TWO_PI) * 140
        const lightness = 60 + age * 10
        const alpha = (1 - age) * 0.78
        ctx.strokeStyle = `hsla(${hue.toFixed(0)},78%,${lightness.toFixed(0)}%,${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }
    })
  },
}
