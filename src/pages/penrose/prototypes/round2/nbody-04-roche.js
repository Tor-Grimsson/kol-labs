// Roche Lobe Equipotentials — Binary Mass Transfer
// Effective potential in the co-rotating binary frame: Φ_eff = -GM1/r1 - GM2/r2 - Ω²ρ²/2
// Marching-squares contour extraction reveals the figure-8 Roche lobe.
// Stream tracer particles released at L1 flow into accretor.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'q',       type: 'range', min: 0.1, max: 10,  default: 1.0,  step: 0.05, label: 'mass ratio q=M2/M1' },
  { key: 'sep',     type: 'range', min: 0.2, max: 0.9, default: 0.55, step: 0.05, label: 'separation' },
  { key: 'contours',type: 'int',   min: 4,   max: 24,  default: 12,   step: 1,    label: 'iso-contours' },
  { key: 'streams', type: 'int',   min: 0,   max: 60,  default: 30,   step: 5,    label: 'stream particles' },
  { key: 'speed',   type: 'range', min: 0.1, max: 3,   default: 1.0,  step: 0.1,  label: 'orbit speed' },
]



export const r2_nbody_04_roche            = {
  id: 'r2-nbody-04-roche',
  name: 'ROCHE LOBE EQUIPOTENTIALS',
  repo: 'Roche 1849; Paczyński 1971',
  summary: 'Effective potential of a co-rotating binary. Marching-squares extracts the figure-8 Roche lobe and nested equipotentials. Stream particles injected at L1 follow the mass-transfer stream.',
  helps: 'No heavy N-body needed — pure field evaluation. The figure-8 lobe topology is directly isomorphic to letterforms with two enclosed bowls.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params }) {
    const GW = 96, GH = 96  // evaluation grid (low-res for speed)
    const phi = new Float64Array(GW * GH)
    const streams                   = []

    let t = 0

    // Evaluate Φ_eff on grid given mass positions
    function evalPhi(
      x1        , y1        , m1        ,
      x2        , y2        , m2        ,
      Omega2        ,
      ox        , oy        ,  // grid origin in sdf-space
      gsx        , gsy         // cell size
    ) {
      for (let gy = 0; gy < GH; gy++) {
        for (let gx = 0; gx < GW; gx++) {
          const px = ox + gx * gsx
          const py = oy + gy * gsy
          const r1 = Math.hypot(px - x1, py - y1) + 0.5
          const r2 = Math.hypot(px - x2, py - y2) + 0.5
          const cx2 = (m1 * x1 + m2 * x2) / (m1 + m2)
          const cy2 = (m1 * y1 + m2 * y2) / (m1 + m2)
          const rho2 = (px - cx2) ** 2 + (py - cy2) ** 2
          phi[gy * GW + gx] = -m1 / r1 - m2 / r2 - 0.5 * Omega2 * rho2
        }
      }
    }

    // Find L1 point (saddle between the masses) via 1D bisection along x-axis
    function findL1(
      x1        , y1        , m1        ,
      x2        , y2        , m2        ,
      Omega2        ,
    )                   {
      const cy = (m1 * y1 + m2 * y2) / (m1 + m2)
      // Search along horizontal line through center of mass
      let lo = Math.min(x1, x2), hi = Math.max(x1, x2)
      for (let iter = 0; iter < 50; iter++) {
        const xm = (lo + hi) * 0.5
        // dΦ/dx = m1(xm-x1)/r1³ + m2(xm-x2)/r2³ - Ω²(xm-cx)
        const r1 = Math.hypot(xm - x1, cy - y1) + 0.1
        const r2 = Math.hypot(xm - x2, cy - y2) + 0.1
        const cxm = (m1 * x1 + m2 * x2) / (m1 + m2)
        const dPhi = m1 * (xm - x1) / (r1 ** 3) + m2 * (xm - x2) / (r2 ** 3) - Omega2 * (xm - cxm)
        if (Math.abs(hi - lo) < 0.2) break
        if (dPhi > 0) hi = xm; else lo = xm
      }
      return [(lo + hi) * 0.5, cy]
    }

    return wrapLoop(() => {
      const speed = num(params, 'speed', 1.0)
      t += 0.012 * speed

      const q     = num(params, 'q', 1.0)
      const sep   = num(params, 'sep', 0.55)
      const nCont = num(params, 'contours', 12) | 0
      const nStr  = num(params, 'streams', 30) | 0

      const W2 = sdf.w, H2 = sdf.h
      const cx2 = W2 / 2, cy2 = H2 / 2
      const d = sep * Math.min(W2, H2)

      const m1 = 1, m2 = q
      const mtot = m1 + m2
      // Kepler angular velocity: Ω² = G(m1+m2)/d³, G=1
      const Omega2 = mtot / (d * d * d)

      // Positions of masses in co-rotating frame (centered on CoM)
      const x1 = cx2 - d * m2 / mtot
      const x2 = cx2 + d * m1 / mtot
      const y1 = cy2, y2 = cy2

      // Grid cell sizes
      const gsx = W2 / GW, gsy = H2 / GH
      evalPhi(x1, y1, m1, x2, y2, m2, Omega2, 0, 0, gsx, gsy)

      const sx = W / W2, sy = H / H2

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.12)', 1)

      // Marching-squares contours
      // Find phi range, pick nCont levels between phi(L1) and min
      const phiMin = Math.min(...phi                       )
      const [lx, ly] = findL1(x1, y1, m1, x2, y2, m2, Omega2)
      const phiL1ix = Math.max(0, Math.min(GW - 1, (lx / gsx) | 0))
      const phiL1iy = Math.max(0, Math.min(GH - 1, (ly / gsy) | 0))
      const phiL1 = phi[phiL1iy * GW + phiL1ix]
      const phiRange = phiL1 - phiMin

      for (let c = 0; c < nCont; c++) {
        const level = phiMin + (c / nCont) * phiRange * 1.1
        const t2 = c / nCont
        const alpha = 0.08 + t2 * 0.35
        ctx.strokeStyle = `rgba(160,190,255,${alpha.toFixed(2)})`
        ctx.lineWidth = t2 < 0.6 ? 0.5 : 1.0
        ctx.beginPath()
        // Marching squares (simplified — draw line segments per cell)
        for (let gy2 = 0; gy2 < GH - 1; gy2++) {
          for (let gx2 = 0; gx2 < GW - 1; gx2++) {
            const v00 = phi[gy2 * GW + gx2]
            const v10 = phi[gy2 * GW + (gx2 + 1)]
            const v01 = phi[(gy2 + 1) * GW + gx2]
            const v11 = phi[(gy2 + 1) * GW + (gx2 + 1)]
            const b = ((v00 > level) ? 8 : 0) | ((v10 > level) ? 4 : 0) |
                      ((v11 > level) ? 2 : 0) | ((v01 > level) ? 1 : 0)
            if (b === 0 || b === 15) continue
            // Interpolate edge crossings
            function lerp(a        , b2        , v00        , v11        ) {
              return a + (b2 - a) * (level - v00) / (v11 - v00 + 1e-9)
            }
            const x00 = gx2 * gsx, x10 = (gx2 + 1) * gsx
            const y00 = gy2 * gsy, y01 = (gy2 + 1) * gsy
            const e_top    = [lerp(x00, x10, v00, v10), y00]
            const e_bot    = [lerp(x00, x10, v01, v11), y01]
            const e_left   = [x00, lerp(y00, y01, v00, v01)]
            const e_right  = [x10, lerp(y00, y01, v10, v11)]
            const pts                     = []
            if ((b & 8) !== (b & 4)) pts.push(e_top                    )
            if ((b & 4) !== (b & 2)) pts.push(e_right                    )
            if ((b & 2) !== (b & 1)) pts.push(e_bot                    )
            if ((b & 1) !== (b & 8)) pts.push(e_left                    )
            if (pts.length >= 2) {
              ctx.moveTo(pts[0][0] * sx, pts[0][1] * sy)
              ctx.lineTo(pts[1][0] * sx, pts[1][1] * sy)
            }
          }
        }
        ctx.stroke()
      }

      // L1 stream particles
      while (streams.length < nStr) {
        streams.push({ x: lx, y: ly, vx: (Math.random() - 0.5) * 0.3, vy: 0.5, age: 0 })
      }
      if (streams.length > nStr) streams.length = nStr

      const Omega = Math.sqrt(Omega2)
      for (const p of streams) {
        // Coriolis + centrifugal + gravity in rotating frame
        const r1p = Math.hypot(p.x - x1, p.y - y1) + 0.5
        const r2p = Math.hypot(p.x - x2, p.y - y2) + 0.5
        const gcx = (m1 * x1 + m2 * x2) / mtot
        const gcy2 = (m1 * y1 + m2 * y2) / mtot
        const axg = m1 * (x1 - p.x) / (r1p ** 3) + m2 * (x2 - p.x) / (r2p ** 3) +
          Omega2 * (p.x - gcx) + 2 * Omega * p.vy
        const ayg = m1 * (y1 - p.y) / (r1p ** 3) + m2 * (y2 - p.y) / (r2p ** 3) +
          Omega2 * (p.y - gcy2) - 2 * Omega * p.vx
        p.vx += axg * 0.008
        p.vy += ayg * 0.008
        p.x += p.vx * 0.008; p.y += p.vy * 0.008
        p.age++
        if (p.age > 280 || Math.hypot(p.x - cx2, p.y - cy2) > W2 * 0.8) {
          p.x = lx; p.y = ly; p.vx = (Math.random() - 0.5) * 0.3; p.vy = 0.5; p.age = 0
        }
      }

      ctx.fillStyle = 'rgba(255,230,150,0.7)'
      for (const p of streams) {
        ctx.fillRect(p.x * sx - 1, p.y * sy - 1, 1.5, 1.5)
      }

      // Mass centres
      const mColors = ['#e87cb8', '#7cb8e8']
      const masses = [[x1, y1, m1], [x2, y2, m2]]
      for (let i = 0; i < 2; i++) {
        const [mx, my, mm] = masses[i]
        ctx.beginPath()
        ctx.arc(mx * sx, my * sy, 2 + mm * 1.5, 0, Math.PI * 2)
        ctx.fillStyle = mColors[i]
        ctx.fill()
      }

      // L1 point indicator
      ctx.beginPath()
      ctx.arc(lx * sx, ly * sy, 3, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1; ctx.stroke()
    })
  },
}
