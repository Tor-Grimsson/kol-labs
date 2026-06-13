// Complex Ginzburg-Landau Equation — spiral defects & vortex turbulence.
// A = Re + i*Im; update: ∂A/∂t = A + (1+ib1)∇²A − (1+ib3)|A|²A
// Neumann BC at glyph walls; pixels outside SDF are zeroed each step.
// Phase → hue, amplitude → luminance. Vortex cores appear as dark holes.
//
// Reference: Aranson & Kramer (2002) Rev. Mod. Phys. 74:99



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'res',  type: 'int',   min: 80, max: 180, default: 120, step: 20,   label: 'grid res' },
  { key: 'b1',   type: 'range', min: -3, max: 3,   default: -1.4, step: 0.1, label: 'b1 (linear disp)' },
  { key: 'b3',   type: 'range', min: -3, max: 3,   default:  0.5, step: 0.1, label: 'b3 (nonlinear freq)' },
  { key: 'dt',   type: 'range', min: 0.02, max: 0.15, default: 0.07, step: 0.01, label: 'Δt' },
  { key: 'steps', type: 'int',  min: 1, max: 6,    default: 3, step: 1,      label: 'steps/frame' },
]

export const r2_wave_01_cgle            = {
  id: 'r2-wave-01-cgle',
  name: 'CGLE — VORTEX TURBULENCE',
  repo: 'Aranson & Kramer 2002',
  summary: 'Complex Ginzburg-Landau equation on the glyph domain. Phase field (arg A) drives hue; amplitude |A| drives luminance. Spiral vortex pairs nucleate, orbit, and annihilate continuously.',
  helps: 'Turns the glyph interior into a vortex-gas aquarium — never settles, hue wraps around the letterform topology.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G = num(params, 'res', 120)
    let b1 = num(params, 'b1', -1.4)
    let b3 = num(params, 'b3',  0.5)
    let dt = num(params, 'dt', 0.07)
    let steps = num(params, 'steps', 3)

    const N = G * G
    let re  = new Float32Array(N)
    let im  = new Float32Array(N)
    let re2 = new Float32Array(N)
    let im2 = new Float32Array(N)
    const mask = new Uint8Array(N)

    // Build mask and seed with noise
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        const inside = sdf.sample(sx, sy) < 0
        const i = y * G + x
        mask[i] = inside ? 1 : 0
        if (inside) {
          const phase = rng() * Math.PI * 2
          const amp = 0.5 + rng() * 0.5
          re[i] = amp * Math.cos(phase)
          im[i] = amp * Math.sin(phase)
        }
      }
    }

    const img = ctx.createImageData(G, G)
    const tmp = document.createElement('canvas')
    tmp.width = G; tmp.height = G
    const tctx = tmp.getContext('2d')

    const laplace = (buf              , i        , x        , y        )         => {
      const l = x > 0     ? buf[i - 1] : buf[i + 1]
      const r = x < G - 1 ? buf[i + 1] : buf[i - 1]
      const u = y > 0     ? buf[i - G] : buf[i + G]
      const d = y < G - 1 ? buf[i + G] : buf[i - G]
      return l + r + u + d - 4 * buf[i]
    }

    return wrapLoop(() => {
      b1    = num(params, 'b1', -1.4)
      b3    = num(params, 'b3',  0.5)
      dt    = num(params, 'dt', 0.07)
      steps = num(params, 'steps', 3)

      for (let s = 0; s < steps; s++) {
        for (let y = 0; y < G; y++) {
          for (let x = 0; x < G; x++) {
            const i = y * G + x
            if (!mask[i]) { re2[i] = 0; im2[i] = 0; continue }
            const r = re[i], m = im[i]
            const mod2 = r * r + m * m
            const lapR = laplace(re, i, x, y)
            const lapI = laplace(im, i, x, y)
            // (1+ib1)∇²A = lapR + b1*lapI, i*(lapI - b1*lapR)
            const diffR = lapR - b1 * lapI
            const diffI = lapI + b1 * lapR
            // −(1+ib3)|A|²A = −mod2*(r + i*(m)) − i*b3*mod2*(r + im)
            const nlR = -(1 + b3 * 0) * mod2 * r + b3 * mod2 * m  // real of −(1+ib3)|A|²A
            const nlI = -(1 + b3 * 0) * mod2 * m - b3 * mod2 * r  // imag
            // ∂A/∂t = A + (1+ib1)∇²A − (1+ib3)|A|²A
            // expand −(1+ib3)|A|²A: real = −mod2*r + b3*mod2*m; imag = −mod2*m − b3*mod2*r
            re2[i] = r + dt * (r + diffR - mod2 * r + b3 * mod2 * m)
            im2[i] = m + dt * (m + diffI - mod2 * m - b3 * mod2 * r)
          }
        }
        // zero outside
        for (let i = 0; i < N; i++) if (!mask[i]) { re2[i] = 0; im2[i] = 0 }
        const tmp2r = re; re = re2; re2 = tmp2r
        const tmp2i = im; im = im2; im2 = tmp2i
      }

      // render: phase → hue (0-360), amplitude → lightness
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          img.data[j] = 10; img.data[j+1] = 11; img.data[j+2] = 20; img.data[j+3] = 255
          continue
        }
        const r = re[i], m = im[i]
        const amp = Math.min(1, Math.sqrt(r * r + m * m))
        const phase = Math.atan2(m, r) // −π..π
        const hue = (phase / (Math.PI * 2) + 0.5) * 360 // 0..360
        // HSL → RGB inline, L = 0.15 + 0.6*amp, S = 0.8
        const l = 0.15 + 0.6 * amp
        const sat = 0.8
        const c = (1 - Math.abs(2 * l - 1)) * sat
        const x2 = c * (1 - Math.abs((hue / 60) % 2 - 1))
        const m2 = l - c / 2
        let rr = 0, gg = 0, bb = 0
        const h6 = (hue / 60) | 0
        if (h6 === 0) { rr=c; gg=x2 }
        else if (h6 === 1) { rr=x2; gg=c }
        else if (h6 === 2) { gg=c; bb=x2 }
        else if (h6 === 3) { gg=x2; bb=c }
        else if (h6 === 4) { rr=x2; bb=c }
        else { rr=c; bb=x2 }
        img.data[j]   = ((rr + m2) * 255) | 0
        img.data[j+1] = ((gg + m2) * 255) | 0
        img.data[j+2] = ((bb + m2) * 255) | 0
        img.data[j+3] = 255
      }

      clear(ctx, W, H)
      tctx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
