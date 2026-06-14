

import { num, bool } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// D2Q9 lattice vectors and weights
const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1]
const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1]
const W9 = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36]
// Bounce-back opposites: 0<->0, 1<->3, 2<->4, 5<->7, 6<->8
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6]

const PARAMS          = [
  { key: 'tau', type: 'range', min: 0.52, max: 1.2, default: 0.65, step: 0.01, label: 'τ (viscosity)' },
  { key: 'inflow', type: 'range', min: 0.0, max: 0.12, default: 0.04, step: 0.005, label: 'inflow speed' },
  { key: 'res', type: 'int', min: 60, max: 160, default: 100, step: 10, label: 'grid res' },
  { key: 'dye', type: 'boolean', default: true, label: 'show dye' },
  { key: 'vortvis', type: 'boolean', default: false, label: 'vorticity overlay' },
]

export const r2_fluid_01_lbm            = {
  id: 'r2-fluid-01-lbm',
  name: 'LBM D2Q9',
  repo: 'Lattice Boltzmann · Schroeder JS / D2Q9 BGK',
  summary:
    'Lattice-Boltzmann fluid solver with mid-way bounce-back on SDF boundaries. Kármán vortex streets shed off glyph stroke corners; dye advects with the velocity field.',
  helps:
    'Letter geometry directly drives vortex shedding — concave counters trap circulation, convex strokes shed alternating eddies.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const tau = num(params, 'tau', 0.65)
    const inflow = num(params, 'inflow', 0.04)
    const NX = num(params, 'res', 100)
    const showDye = bool(params, 'dye', true)
    const showVort = bool(params, 'vortvis', false)

    const NY = Math.round(NX * (H / W))
    const size = NX * NY
    const scaleX = W / NX
    const scaleY = H / NY
    const cellW = Math.max(1, Math.ceil(scaleX))
    const cellH = Math.max(1, Math.ceil(scaleY))

    // f[dir][cell] — two buffers for stream
    const f = Array.from({ length: 9 }, () => new Float32Array(size))
    const fTmp = Array.from({ length: 9 }, () => new Float32Array(size))
    const rho = new Float32Array(size)
    const ux = new Float32Array(size)
    const uy = new Float32Array(size)
    const dyeField = new Float32Array(size)
    const solid = new Uint8Array(size)

    // Map SDF → solid mask
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const sx = (i + 0.5) / NX * sdf.w
        const sy = (j + 0.5) / NY * sdf.h
        solid[j * NX + i] = sdf.sample(sx, sy) >= 0 ? 1 : 0
      }
    }

    // Init equilibrium with small rightward flow
    const feq = (dir        , r        , vx        , vy        ) => {
      const eu = EX[dir] * vx + EY[dir] * vy
      const uu = vx * vx + vy * vy
      return W9[dir] * r * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu)
    }
    for (let n = 0; n < size; n++) {
      if (solid[n]) continue
      rho[n] = 1.0
      for (let d = 0; d < 9; d++) f[d][n] = feq(d, 1.0, inflow * 0.5, 0)
      dyeField[n] = 0
    }
    // Inject dye stripe in left third
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX / 3; i++) {
        const n = j * NX + i
        if (!solid[n]) dyeField[n] = 1.0
      }
    }

    const img = ctx.createImageData(W, H)
    const px = img.data

    let prevT = clock.nowSeconds()

    return wrapLoop(() => {
      const now = clock.nowSeconds()
      const dt = Math.min(now - prevT, 0.05)
      prevT = now
      const steps = Math.max(1, Math.round(dt / 0.016))

      for (let _s = 0; _s < steps; _s++) {
        // --- Collide ---
        for (let n = 0; n < size; n++) {
          if (solid[n]) continue
          let r = 0
          for (let d = 0; d < 9; d++) r += f[d][n]
          rho[n] = r
          let vx = 0, vy = 0
          for (let d = 0; d < 9; d++) { vx += EX[d] * f[d][n]; vy += EY[d] * f[d][n] }
          vx /= r; vy /= r
          ux[n] = vx; uy[n] = vy
          for (let d = 0; d < 9; d++) {
            f[d][n] += (feq(d, r, vx, vy) - f[d][n]) / tau
          }
        }

        // --- Stream + bounce-back ---
        for (let d = 0; d < 9; d++) fTmp[d].fill(0)
        for (let j = 0; j < NY; j++) {
          for (let i = 0; i < NX; i++) {
            const n = j * NX + i
            if (solid[n]) continue
            for (let d = 0; d < 9; d++) {
              const ni = i + EX[d], nj = j + EY[d]
              if (ni < 0 || ni >= NX || nj < 0 || nj >= NY) continue
              const nn = nj * NX + ni
              if (solid[nn]) {
                fTmp[OPP[d]][n] += f[d][n] // bounce back
              } else {
                fTmp[d][nn] += f[d][n]
              }
            }
          }
        }
        for (let d = 0; d < 9; d++) { const t = f[d]; f[d] = fTmp[d]; fTmp[d] = t }

        // Inflow BC: left column, reinit to inflow velocity
        for (let j = 0; j < NY; j++) {
          const n = j * NX
          if (!solid[n]) {
            rho[n] = 1.0
            for (let d = 0; d < 9; d++) f[d][n] = feq(d, 1.0, inflow, 0)
            dyeField[n] = 0.9
          }
        }

        // Advect dye (semi-Lagrangian on the same grid)
        const dyeTmp = new Float32Array(size)
        for (let j = 0; j < NY; j++) {
          for (let i = 0; i < NX; i++) {
            const n = j * NX + i
            if (solid[n]) continue
            const pi = Math.round(i - ux[n])
            const pj = Math.round(j - uy[n])
            const pn = Math.max(0, Math.min(NY - 1, pj)) * NX + Math.max(0, Math.min(NX - 1, pi))
            dyeTmp[n] = solid[pn] ? 0 : dyeField[pn] * 0.997
          }
        }
        dyeField.set(dyeTmp)
      }

      // --- Render ---
      clear(ctx, W, H)

      // Draw velocity/dye as pixels
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const n = j * NX + i
          if (solid[n]) continue

          let r = 0, g = 0, b = 0, a = 0
          if (showVort && !showDye) {
            // vorticity = duy/dx - dux/dy
            const left = i > 0 ? uy[(j) * NX + (i - 1)] : 0
            const right = i < NX - 1 ? uy[(j) * NX + (i + 1)] : 0
            const top = j > 0 ? ux[(j - 1) * NX + i] : 0
            const bot = j < NY - 1 ? ux[(j + 1) * NX + i] : 0
            const vort = (right - left) - (bot - top)
            const v = Math.max(-1, Math.min(1, vort * 8))
            if (v > 0) { r = Math.round(v * 255); g = 0; b = Math.round((1 - v) * 120) }
            else { r = 0; g = Math.round(-v * 200); b = Math.round(-v * 255) }
            a = 220
          } else {
            const d = showDye ? dyeField[n] : Math.min(1, Math.hypot(ux[n], uy[n]) / (inflow * 2))
            const t = Math.min(1, d)
            // warm cyan → gold palette
            r = Math.round(t * 255 * 0.9)
            g = Math.round(t * 200)
            b = Math.round((1 - t * 0.6) * 180)
            a = Math.round(180 + t * 75)
          }

          const px0 = Math.round(i * scaleX)
          const py0 = Math.round(j * scaleY)
          for (let dy = 0; dy < cellH; dy++) {
            for (let dx = 0; dx < cellW; dx++) {
              const pidx = ((py0 + dy) * W + (px0 + dx)) * 4
              if (pidx + 3 < px.length) {
                px[pidx] = r; px[pidx + 1] = g; px[pidx + 2] = b; px[pidx + 3] = a
              }
            }
          }
        }
      }
      ctx.putImageData(img, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
