// Tangent-Angle Diffusion / Curvature Diffusion (Crane et al. 2013 fairing)
// Evolves the tangent-angle array θ(s) via the 1D heat equation ∂θ/∂t = ∂²θ/∂s².
// Wiggles migrate along the curve arc rather than growing or shrinking —
// the global shape stays stable while local texture shimmers.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sdfGrad } from '../common'

const PARAMS          = [
  { key: 'N0',      type: 'int',   min: 60,  max: 500, default: 200, step: 20,   label: 'nodes' },
  { key: 'diff',    type: 'range', min: 0,   max: 1,   default: 0.3,  step: 0.02, label: 'diffusion rate' },
  { key: 'noiseAmp',type: 'range', min: 0,   max: 1.5, default: 0.6,  step: 0.05, label: 'init noise' },
  { key: 'sdfPull', type: 'range', min: 0,   max: 3,   default: 0.9,  step: 0.05, label: 'sdf pull' },
  { key: 'tensK',   type: 'range', min: 0,   max: 0.5, default: 0.08, step: 0.01, label: 'tension' },
]



export const r2_curve_04_tangent_angle            = {
  id: 'r2-curve-04-tangent-angle',
  name: 'TANGENT-ANGLE DIFFUSION',
  repo: 'Crane–de Goes–Desbrun–Schröder ACM TOG 2013',
  summary: 'Diffuses the tangent-angle array θ(s) via 1D heat equation. Wiggles travel along the arc like waves — global shape is stable while local texture shimmers endlessly.',
  helps: 'Most visually distinct of all flows. Zero shrinkage, pure wave-like shimmer.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const N0       = num(params, 'N0', 200)
    const diff     = num(params, 'diff', 0.3)
    const noiseAmp = num(params, 'noiseAmp', 0.6)
    const sdfPull  = num(params, 'sdfPull', 0.9)
    const tensK    = num(params, 'tensK', 0.08)

    // seed: glyph-centered oval with noise on tangent angles
    const cx = sdf.w * 0.5, cy = sdf.h * 0.5
    const rx = sdf.w * 0.3, ry = sdf.h * 0.3
    const pts       = []
    for (let i = 0; i < N0; i++) {
      const a = (i / N0) * Math.PI * 2
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
    }

    // inject noise into tangent angles by perturbing positions locally
    for (let i = 0; i < N0; i++) {
      pts[i].x += (rng() - 0.5) * 2 * noiseAmp * rx * 0.15
      pts[i].y += (rng() - 0.5) * 2 * noiseAmp * ry * 0.15
    }

    const dt = 0.4  // heat eq CFL: dt < ds²/2; ds≈1 so dt=0.4 is safe
    const RENORM = 50
    let step = 0

    return wrapLoop(() => {
      const n = pts.length

      // 1. Compute segment lengths and tangent angles
      const ds           = new Array(n)
      const theta           = new Array(n)
      for (let i = 0; i < n; i++) {
        const q = pts[(i+1)%n]
        ds[i] = Math.hypot(q.x-pts[i].x, q.y-pts[i].y) || 1e-9
        theta[i] = Math.atan2(q.y-pts[i].y, q.x-pts[i].x)
      }

      // 2. Unwrap angles to remove 2π jumps
      const thetaU = theta.slice()
      for (let i = 1; i < n; i++) {
        let diff2 = thetaU[i] - thetaU[i-1]
        while (diff2 > Math.PI)  { diff2 -= 2*Math.PI }
        while (diff2 < -Math.PI) { diff2 += 2*Math.PI }
        thetaU[i] = thetaU[i-1] + diff2
      }

      // 3. Diffuse tangent angles: θ_new[i] = θ[i] + diff * dt * (θ[i-1] - 2θ[i] + θ[i+1]) / ds²
      const thetaNew           = new Array(n)
      const dsAvg = ds.reduce((a,b)=>a+b,0) / n
      for (let i = 0; i < n; i++) {
        const prev = (i-1+n)%n, next = (i+1)%n
        const laplacian = (thetaU[prev] - 2*thetaU[i] + thetaU[next]) / (dsAvg * dsAvg)
        thetaNew[i] = thetaU[i] + diff * dt * laplacian
      }

      // 4. Reconstruct positions from diffused tangent angles
      // Fix first point, integrate tangent vectors
      const newPts       = [{ x: pts[0].x, y: pts[0].y }]
      for (let i = 0; i < n-1; i++) {
        const p = newPts[i]
        newPts.push({
          x: p.x + ds[i] * Math.cos(thetaNew[i]),
          y: p.y + ds[i] * Math.sin(thetaNew[i]),
        })
      }

      // 5. Centroid correction (reconstruction drifts)
      let meanX = 0, meanY = 0
      for (const p of newPts) { meanX += p.x; meanY += p.y }
      meanX /= n; meanY /= n
      const origMeanX = pts.reduce((a,p)=>a+p.x,0)/n
      const origMeanY = pts.reduce((a,p)=>a+p.y,0)/n
      const dcx = origMeanX - meanX, dcy = origMeanY - meanY
      for (const p of newPts) { p.x += dcx; p.y += dcy }

      // 6. Apply SDF pull + tension on reconstructed positions
      for (let i = 0; i < n; i++) {
        const p = newPts[i]

        // tension: keep arc from drifting too far from SDF center
        for (const oi of [(i-1+n)%n, (i+1)%n]) {
          const ex = newPts[oi].x-p.x, ey = newPts[oi].y-p.y
          const el = Math.hypot(ex,ey) || 1e-9
          const tgt = dsAvg
          p.x += (ex/el)*(el-tgt) * tensK
          p.y += (ey/el)*(el-tgt) * tensK
        }

        // SDF push inward
        const sv = sdf.sample(p.x, p.y)
        if (sv > -6) {
          const [gx, gy] = sdfGrad(sdf, p.x, p.y)
          const gm = Math.hypot(gx,gy) || 1
          p.x -= (gx/gm) * sdfPull * Math.max(0, sv+6) * 0.06
          p.y -= (gy/gm) * sdfPull * Math.max(0, sv+6) * 0.06
        }
      }

      // copy back
      for (let i = 0; i < n; i++) { pts[i].x = newPts[i].x; pts[i].y = newPts[i].y }

      step++
      // periodic renormalization: re-center over glyph SDF interior
      if (step % RENORM === 0) {
        const scx = pts.reduce((a,p)=>a+p.x,0)/n
        const scy = pts.reduce((a,p)=>a+p.y,0)/n
        const targetX = sdf.w*0.5, targetY = sdf.h*0.5
        const corr = 0.08
        for (const p of pts) {
          p.x += (targetX - scx) * corr
          p.y += (targetY - scy) * corr
        }
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      ctx.strokeStyle = '#80e8a0'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const p = pts[i]
        if (i === 0) ctx.moveTo(p.x*sx, p.y*sy)
        else ctx.lineTo(p.x*sx, p.y*sy)
      }
      ctx.closePath()
      ctx.stroke()
    })
  },
}
