// Classical 2D wave equation — FDTD leapfrog ripple tank.
// ∂²u/∂t² = c²∇²u
// Leapfrog: u_next = 2·u_now − u_past + r²·∇²u_now  (r = c·dt/dx, r < 1/√2)
// Dirichlet BC: u=0 outside glyph (walls reflect). Mur ABC on canvas edges.
// Point sources driven as sin(ωt) oscillators inside the glyph.
//
// Reference: Strang MIT 18.086; beltoforion.de/2d-wave-equation



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,  max: 180, default: 140, step: 20,   label: 'grid res' },
  { key: 'c',     type: 'range', min: 0.2, max: 0.6, default: 0.4, step: 0.02, label: 'wave speed' },
  { key: 'damp',  type: 'range', min: 0.0, max: 0.02, default: 0.004, step: 0.001, label: 'damping' },
  { key: 'freq',  type: 'range', min: 0.01, max: 0.15, default: 0.05, step: 0.005, label: 'source freq' },
  { key: 'srcs',  type: 'int',   min: 1,   max: 3,   default: 2,   step: 1,    label: 'num sources' },
]

export const r2_wave_05_fdtd_ripple            = {
  id: 'r2-wave-05-fdtd-ripple',
  name: 'FDTD RIPPLE TANK',
  repo: 'Strang MIT 18.086 · Beltoforion',
  summary: 'Explicit leapfrog FDTD for the scalar wave equation. Point sources inside the glyph drive sinusoidal oscillations; walls reflect via Dirichlet BC; interference fringes encode the glyph cavity geometry.',
  helps: 'The clearest proof that the glyph IS the resonant cavity — caustics form at curved strokes, mode structure builds over time.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const G = num(params, 'res', 140)
    const N = G * G

    let uP = new Float32Array(N)  // u_past
    let uN = new Float32Array(N)  // u_now
    let uF = new Float32Array(N)  // u_future (scratch)
    const mask = new Uint8Array(N)

    const rebuild = () => {
      uP.fill(0); uN.fill(0); uF.fill(0)
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const sx = (x / G) * sdf.w
          const sy = (y / G) * sdf.h
          mask[y * G + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
        }
      }
    }
    rebuild()

    // Place sources: sample random inside points once
    const MAX_SRC = 3
    const srcX = new Float32Array(MAX_SRC)
    const srcY = new Float32Array(MAX_SRC)
    let seededSrcs = 0
    let attempts = 0
    while (seededSrcs < MAX_SRC && attempts < 2000) {
      attempts++
      const x = (rng() * (G - 4) + 2) | 0
      const y = (rng() * (G - 4) + 2) | 0
      if (mask[y * G + x]) { srcX[seededSrcs] = x; srcY[seededSrcs] = y; seededSrcs++ }
    }

    const img = ctx.createImageData(G, G)
    const tmpC = document.createElement('canvas')
    tmpC.width = G; tmpC.height = G
    const tctx = tmpC.getContext('2d')

    const STEPS_PER_FRAME = 4
    let stepCount = 0

    return wrapLoop(() => {
      const c    = num(params, 'c',    0.4)
      const damp = num(params, 'damp', 0.004)
      const freq = num(params, 'freq', 0.05)
      const srcs = Math.min(MAX_SRC, num(params, 'srcs', 2))

      // CFL: r = c*dt/dx must be < 1/sqrt(2). dx=1, dt=1 → r=c, stable if c < 0.707
      const r2 = c * c  // (c·dt/dx)²

      for (let s = 0; s < STEPS_PER_FRAME; s++) {
        stepCount++
        const t = stepCount * 1.0  // virtual time in grid units

        // Inject sources
        for (let si = 0; si < srcs; si++) {
          const sx = srcX[si] | 0, sy = srcY[si] | 0
          const idx = sy * G + sx
          if (mask[idx]) uN[idx] = Math.sin(2 * Math.PI * freq * t) * 2.5
        }

        for (let y = 1; y < G - 1; y++) {
          for (let x = 1; x < G - 1; x++) {
            const i = y * G + x
            if (!mask[i]) { uF[i] = 0; continue }
            const lap = uN[i-1] + uN[i+1] + uN[i-G] + uN[i+G] - 4 * uN[i]
            uF[i] = (2 - 4 * damp) * uN[i] - (1 - 2 * damp) * uP[i] + r2 * lap
          }
        }

        // Mur ABC on canvas edges (1st-order absorbing)
        // top/bottom
        for (let x = 0; x < G; x++) {
          const coeff = (c - 1) / (c + 1)
          uF[0 * G + x]       = uN[1 * G + x]       + coeff * (uF[1 * G + x]       - uN[0 * G + x])
          uF[(G-1)*G + x]     = uN[(G-2)*G + x]     + coeff * (uF[(G-2)*G + x]     - uN[(G-1)*G + x])
        }
        for (let y = 0; y < G; y++) {
          const coeff = (c - 1) / (c + 1)
          uF[y * G + 0]       = uN[y * G + 1]       + coeff * (uF[y * G + 1]       - uN[y * G + 0])
          uF[y * G + G - 1]   = uN[y * G + G - 2]   + coeff * (uF[y * G + G - 2]   - uN[y * G + G - 1])
        }

        // Enforce Dirichlet outside
        for (let i = 0; i < N; i++) if (!mask[i]) uF[i] = 0

        const swP = uP; uP = uN; uN = uF; uF = swP
      }

      // Render: signed u → bipolar color (blue=trough, red=crest)
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j+1] = bg; img.data[j+2] = bb; img.data[j+3] = 255
          continue
        }
        const v = Math.max(-1, Math.min(1, uN[i] * 0.6))
        // signed displacement → palette ramp: trough(−1)→0, rest(0)→0.5, crest(+1)→1
        const [r, g, b] = rampRGB(v * 0.5 + 0.5)
        img.data[j]   = r
        img.data[j+1] = g
        img.data[j+2] = b
        img.data[j+3] = 255
      }

      clear(ctx, W, H)
      tctx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmpC, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
