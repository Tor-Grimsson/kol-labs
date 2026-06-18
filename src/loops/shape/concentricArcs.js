import { TAU, mixHex } from '../lib/util.js'

// Concentric arcs — rings of broken arcs, alternate rings counter-rotating a
// whole number of turns per loop ⇒ seamless.
export default {
  id: 'concentric-arcs',
  label: 'Concentric arcs',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour · inner', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour · outer', type: 'color', role: 'accent', default: '#c2502e' },
    { key: 'rings', label: 'Rings', type: 'range', min: 2, max: 14, step: 1, default: 7, noRandom: true },
    { key: 'gap', label: 'Gap', type: 'range', min: 0.05, max: 0.6, step: 0.05, default: 0.3 },
    { key: 'spin', label: 'Spin', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 40, step: 0.5, default: 5 },
    { key: 'size', label: 'Reach', type: 'range', min: 0.6, max: 1, step: 0.02, default: 0.92 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2
    const maxR = Math.min(w, h) * 0.5 * p.size
    const rings = Math.round(p.rings)
    const spin = Math.round(p.spin)
    const span = TAU * (1 - p.gap)

    ctx.lineWidth = p.weight
    ctx.lineCap = 'round'
    for (let k = 0; k < rings; k++) {
      const f = rings === 1 ? 0 : k / (rings - 1)
      const r = maxR * ((k + 1) / rings)
      const dir = k % 2 === 0 ? 1 : -1
      const a0 = dir * u * TAU * spin - Math.PI / 2
      ctx.strokeStyle = mixHex(p.colA, p.colB, f)
      ctx.beginPath()
      ctx.arc(cx, cy, r, a0, a0 + span)
      ctx.stroke()
    }
  },
}
