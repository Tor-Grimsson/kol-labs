// FitzHugh-Nagumo excitable medium — rotating spiral waves.
// ∂u/∂t = D∇²u + u − u³/3 − v + I
// ∂v/∂t = ε(u + β − γv)
// Neumann BC at glyph walls. Seeded with an asymmetric step to nucleate spirals.
//
// Reference: FitzHugh 1961; Scholarpedia fitzhugh-nagumo-model



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,  max: 160, default: 120, step: 20,    label: 'grid res' },
  { key: 'eps',   type: 'range', min: 0.02, max: 0.2, default: 0.08, step: 0.01, label: 'ε (timescale)' },
  { key: 'beta',  type: 'range', min: 0.4,  max: 1.0, default: 0.7,  step: 0.05, label: 'β' },
  { key: 'D',     type: 'range', min: 0.1,  max: 2.0, default: 1.0,  step: 0.1,  label: 'diffusion D' },
  { key: 'steps', type: 'int',   min: 1,   max: 8,   default: 4,    step: 1,    label: 'steps/frame' },
]

export const r2_wave_03_fitzhugh_nagumo            = {
  id: 'r2-wave-03-fitzhugh-nagumo',
  name: 'FITZHUGH-NAGUMO SPIRALS',
  repo: 'FitzHugh 1961 · Scholarpedia',
  summary: 'Two-variable excitable medium on the glyph domain. An asymmetric seed nucleates a rotating spiral; activation (bright) and refractory (dark) tissue sweep the interior, shaped by the letterform geometry.',
  helps: 'Narrow strokes channel wavefronts longitudinally; open bowls allow full spiral rotation — the glyph anatomy becomes visible as wave plumbing.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G = num(params, 'res', 120)
    const N = G * G

    let u  = new Float32Array(N)
    let v  = new Float32Array(N)
    let u2 = new Float32Array(N)
    let v2 = new Float32Array(N)
    const mask = new Uint8Array(N)

    // Build mask; find centroid for seeding
    let cx = 0, cy = 0, cnt = 0
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        if (sdf.sample(sx, sy) < 0) {
          mask[y * G + x] = 1
          cx += x; cy += y; cnt++
        }
      }
    }
    if (cnt > 0) { cx /= cnt; cy /= cnt }

    // Asymmetric step-function seed — upper-left half = excited, rest = rest state
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const i = y * G + x
        if (!mask[i]) continue
        if (x < cx && y < cy) {
          u[i] = 2.0 + (rng() - 0.5) * 0.4  // excited
          v[i] = 0.5 + (rng() - 0.5) * 0.2
        } else {
          u[i] = -1.5 + (rng() - 0.5) * 0.2  // rest
          v[i] = -0.6 + (rng() - 0.5) * 0.1
        }
      }
    }

    const img = ctx.createImageData(G, G)
    const tmpC = document.createElement('canvas')
    tmpC.width = G; tmpC.height = G
    const tctx = tmpC.getContext('2d')

    const dt = 0.03  // stable for D≤2, dx=1, CFL: dt < dx²/(2D) = 0.5/D
    const gamma = 0.5

    const lap = (buf              , i        , x        , y        )         => {
      const l = x > 0     ? buf[i - 1] : buf[i + 1]
      const r = x < G - 1 ? buf[i + 1] : buf[i - 1]
      const up = y > 0    ? buf[i - G] : buf[i + G]
      const d = y < G - 1 ? buf[i + G] : buf[i - G]
      return l + r + up + d - 4 * buf[i]
    }

    return wrapLoop(() => {
      const eps   = num(params, 'eps',   0.08)
      const beta  = num(params, 'beta',  0.7)
      const D     = num(params, 'D',     1.0)
      const steps = num(params, 'steps', 4)

      for (let s = 0; s < steps; s++) {
        for (let y = 0; y < G; y++) {
          for (let x = 0; x < G; x++) {
            const i = y * G + x
            if (!mask[i]) { u2[i] = 0; v2[i] = 0; continue }
            const ui = u[i], vi = v[i]
            const luU = lap(u, i, x, y)
            u2[i] = ui + dt * (D * luU + ui - (ui * ui * ui) / 3 - vi)
            v2[i] = vi + dt * eps * (ui + beta - gamma * vi)
          }
        }
        const swU = u; u = u2; u2 = swU
        const swV = v; v = v2; v2 = swV
      }

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j+1] = bg; img.data[j+2] = bb; img.data[j+3] = 255
          continue
        }
        // u ranges roughly −2..2; map to 0..1 activation intensity
        const bright = Math.max(0, Math.min(1, (u[i] + 2) / 4))
        const [r, g, b] = rampRGB(bright)
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
