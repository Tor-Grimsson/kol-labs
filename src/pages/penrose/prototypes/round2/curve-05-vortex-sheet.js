// Vortex Sheet / Birkhoff–Rott Evolution (Krasny 1986 blob regularization)
// Each node is a vortex blob; velocity = sum of Biot-Savart contributions from all others.
// The sheet spontaneously rolls up into Kelvin–Helmholtz spirals.
// Seeded along the glyph medial axis; Krasny δ² desingularizes the kernel.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sdfGrad } from '../common'

const PARAMS          = [
  { key: 'N0',       type: 'int',   min: 20, max: 200, default: 80,  step: 10,   label: 'vortex blobs' },
  { key: 'delta',    type: 'range', min: 0.5, max: 8,  default: 2.5, step: 0.25, label: 'blob radius δ' },
  { key: 'gamma',    type: 'range', min: 0.1, max: 5,  default: 1.2, step: 0.1,  label: 'circulation Γ' },
  { key: 'sdfPull',  type: 'range', min: 0,  max: 2,   default: 0.5, step: 0.05, label: 'sdf confinement' },
  { key: 'dt',       type: 'range', min: 0.01, max: 0.3, default: 0.08, step: 0.01, label: 'timestep' },
]



export const r2_curve_05_vortex_sheet            = {
  id: 'r2-curve-05-vortex-sheet',
  name: 'VORTEX SHEET ROLL-UP',
  repo: 'Birkhoff–Rott / Krasny JFM 1986',
  summary: 'Discretized vortex sheet evolving via Biot-Savart summation with Krasny δ-desingularization. Kelvin–Helmholtz instability spontaneously rolls the sheet into self-intersecting spirals inside the glyph.',
  helps: 'Esoteric in generative art — fractal spiraling roll-up like ink dropped in water.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const N0      = num(params, 'N0', 80)
    const delta   = num(params, 'delta', 2.5)
    const gamma0  = num(params, 'gamma', 1.2)
    const sdfPull = num(params, 'sdfPull', 0.5)
    const dt      = num(params, 'dt', 0.08)

    // seed: vortex blobs along a horizontal line through the glyph center
    // alternating circulation for roll-up instability
    const cy = sdf.h * 0.5
    const blobs         = []
    for (let i = 0; i < N0; i++) {
      const t = i / (N0 - 1)
      // find left/right extents at this scanline
      let x0 = sdf.w * 0.1, x1 = sdf.w * 0.9
      // narrow to glyph interior
      for (let xx = 0; xx < sdf.w; xx++) {
        if (sdf.sample(xx, cy) < 0) { x0 = xx; break }
      }
      for (let xx = sdf.w - 1; xx >= 0; xx--) {
        if (sdf.sample(xx, cy) < 0) { x1 = xx; break }
      }
      const x = x0 + t * (x1 - x0)
      // small jitter to seed instability
      const jitter = (rng() - 0.5) * delta * 0.5
      blobs.push({
        x,
        y: cy + jitter,
        gamma: gamma0 / N0 * (i % 2 === 0 ? 1 : -1),
      })
    }

    const delta2 = delta * delta
    // trail history for rendering roll-up paths
    const trail                            = blobs.map(b => [[b.x, b.y]])
    const MAX_TRAIL = 300

    return wrapLoop(() => {
      const n = blobs.length
      const vx = new Float64Array(n)
      const vy = new Float64Array(n)

      // Biot-Savart summation: u(z_k) = Σ_{j≠k} γ_j · (-Δy, Δx) / (|Δz|² + δ²)
      // (2D vortex blob kernel)
      for (let k = 0; k < n; k++) {
        let ux = 0, uy = 0
        for (let j = 0; j < n; j++) {
          if (j === k) continue
          const dx = blobs[k].x - blobs[j].x
          const dy = blobs[k].y - blobs[j].y
          const d2 = dx*dx + dy*dy + delta2
          const w = blobs[j].gamma / (2 * Math.PI * d2)
          ux += -dy * w
          uy +=  dx * w
        }
        vx[k] = ux
        vy[k] = uy
      }

      for (let k = 0; k < n; k++) {
        let fx = vx[k], fy = vy[k]

        // SDF soft confinement: push blobs away from boundary
        const sv = sdf.sample(blobs[k].x, blobs[k].y)
        if (sv > -6) {
          const [gx, gy] = sdfGrad(sdf, blobs[k].x, blobs[k].y)
          const gm = Math.hypot(gx, gy) || 1
          fx -= (gx/gm) * sdfPull * Math.max(0, sv+6) * 0.15
          fy -= (gy/gm) * sdfPull * Math.max(0, sv+6) * 0.15
        }

        blobs[k].x += fx * dt
        blobs[k].y += fy * dt

        trail[k].push([blobs[k].x, blobs[k].y])
        if (trail[k].length > MAX_TRAIL) trail[k].shift()
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      // draw trails for each blob
      for (let k = 0; k < n; k++) {
        const tr = trail[k]
        const len = tr.length
        if (len < 2) continue
        ctx.beginPath()
        ctx.moveTo(tr[0][0]*sx, tr[0][1]*sy)
        for (let t = 1; t < len; t++) ctx.lineTo(tr[t][0]*sx, tr[t][1]*sy)
        const alpha = 0.3 + 0.5 * (k / n)
        ctx.strokeStyle = blobs[k].gamma > 0
          ? `rgba(255, 160, 100, ${alpha})`
          : `rgba(120, 200, 255, ${alpha})`
        ctx.lineWidth = 0.9
        ctx.stroke()
      }

      // draw current blob positions
      for (let k = 0; k < n; k++) {
        const b = blobs[k]
        ctx.fillStyle = b.gamma > 0 ? '#ffa060' : '#78c8ff'
        ctx.beginPath()
        ctx.arc(b.x*sx, b.y*sy, 1.8, 0, Math.PI*2)
        ctx.fill()
      }
    })
  },
}
