// Anisotropic RD — Schnakenberg kinetics with tensor diffusion driven by SDF gradient.
// Diffusion flows preferentially along the letterform contours, producing oriented
// stripes/dashes that follow the glyph's own geometry (wood grain / fingerprint effect).
// Reference: Sanderson et al. 2006 J. Graphics Tools 11(3); Witkin & Kass SIGGRAPH 1991.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

const PARAMS          = [
  { key: 'res',    type: 'int',   min: 80,  max: 180, default: 140,  step: 20,  label: 'grid' },
  { key: 'dU',     type: 'range', min: 0.01, max: 0.5, default: 0.1, step: 0.01, label: 'diffU base' },
  { key: 'aniso',  type: 'range', min: 1.0, max: 20.0, default: 8.0, step: 0.5, label: 'anisotropy' },
  { key: 'a',      type: 'range', min: 0.01, max: 0.3, default: 0.1, step: 0.01, label: 'feed a' },
  { key: 'b',      type: 'range', min: 0.4,  max: 1.4, default: 0.9, step: 0.05, label: 'source b' },
  { key: 'dRatio', type: 'range', min: 10,   max: 100, default: 50,  step: 5,   label: 'D ratio U/V' },
]

export const r2_rd_05_aniso            = {
  id: 'r2-rd-05-aniso',
  name: 'ANISOTROPIC RD (SCHNAKENBERG)',
  repo: 'Sanderson et al. 2006 + Witkin-Kass 1991',
  summary: 'Schnakenberg Turing patterns with SDF-gradient tensor diffusion: stripes align with the glyph contours like wood grain.',
  helps: 'The letter shape sculpts its own internal texture — architecturally unique, nothing else in the gallery does this.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const res    = num(params, 'res',    140)
    const dU     = num(params, 'dU',     0.1)
    const aniso  = num(params, 'aniso',  8.0)
    const a      = num(params, 'a',      0.1)
    const b      = num(params, 'b',      0.9)
    const dRatio = num(params, 'dRatio', 50)

    const dV = dU * dRatio

    const N = res * res
    const U  = new Float32Array(N)
    const V  = new Float32Array(N)
    const U2 = new Float32Array(N)
    const V2 = new Float32Array(N)
    const isIn = new Uint8Array(N)

    // Precompute anisotropic tensor field from SDF gradient.
    // At each cell: principal axis aligned with SDF gradient (along boundary);
    // transverse axis is normal. λ1 (along) = dU; λ2 (normal) = dU/aniso.
    // Tensor components Dxx, Dyy, Dxy stored per cell.
    const Dxx = new Float32Array(N)
    const Dyy = new Float32Array(N)
    const Dxy = new Float32Array(N)
    const VDxx = new Float32Array(N)
    const VDyy = new Float32Array(N)
    const VDxy = new Float32Array(N)

    const h = 1.5
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const sx = (x / res) * sdf.w
        const sy = (y / res) * sdf.h
        const inside = sdf.sample(sx, sy) < 0
        const i = y * res + x
        isIn[i] = inside ? 1 : 0

        // SDF gradient gives the normal direction; tangent is perpendicular
        const gx = sdf.sample(sx + h, sy) - sdf.sample(sx - h, sy)
        const gy = sdf.sample(sx, sy + h) - sdf.sample(sx, sy - h)
        const glen = Math.hypot(gx, gy) || 1
        const nx = gx / glen, ny = gy / glen   // normal (outward)
        const tx = -ny, ty = nx                // tangent (along contour)

        // λ1 along tangent (fast), λ2 along normal (slow = λ1/aniso)
        const la = dU
        const lb = dU / aniso
        Dxx[i] = la * tx * tx + lb * nx * nx
        Dyy[i] = la * ty * ty + lb * ny * ny
        Dxy[i] = la * tx * ty + lb * nx * ny

        // V uses same orientation but scaled by dRatio
        VDxx[i] = Dxx[i] * dRatio
        VDyy[i] = Dyy[i] * dRatio
        VDxy[i] = Dxy[i] * dRatio

        if (inside) {
          U[i] = rng() * 0.2 + 0.1
          V[i] = rng() * 0.2 + 0.4
        }
      }
    }

    // Schnakenberg steady state: u_ss = a+b, v_ss = b/(a+b)²
    const uss = a + b

    const img = ctx.createImageData(res, res)
    const tmp = document.createElement('canvas')
    tmp.width = res; tmp.height = res
    const tc = tmp.getContext('2d')

    // Anisotropic Laplacian: ∇·(D∇u) using 9-point stencil
    // ≈ Dxx*(u_{i+1,j}+u_{i-1,j}−2u) + Dyy*(u_{i,j+1}+u_{i,j-1}−2u)
    //   + Dxy*(u_{i+1,j+1}+u_{i-1,j-1}−u_{i+1,j-1}−u_{i-1,j+1}) / 2
    const aLap = (buf              , ddxx              , ddyy              , ddxy              ,
                  x        , y        )         => {
      const i   = y * res + x
      const im1 = x > 0       ? i - 1   : i
      const ip1 = x < res - 1 ? i + 1   : i
      const jm1 = y > 0       ? i - res  : i
      const jp1 = y < res - 1 ? i + res  : i
      const c = buf[i]
      const lapX = buf[ip1] + buf[im1] - 2 * c
      const lapY = buf[jp1] + buf[jm1] - 2 * c
      const xp1yp1 = (x < res - 1 && y < res - 1) ? buf[i + res + 1] : c
      const xm1ym1 = (x > 0       && y > 0)        ? buf[i - res - 1] : c
      const xp1ym1 = (x < res - 1 && y > 0)        ? buf[i - res + 1] : c
      const xm1yp1 = (x > 0       && y < res - 1)  ? buf[i + res - 1] : c
      const cross = xp1yp1 + xm1ym1 - xp1ym1 - xm1yp1
      return ddxx[i] * lapX + ddyy[i] * lapY + ddxy[i] * cross * 0.5
    }

    const dt = 0.5

    return wrapLoop(() => {
      for (let it = 0; it < 2; it++) {
        for (let y = 0; y < res; y++) {
          for (let x = 0; x < res; x++) {
            const i = y * res + x
            if (!isIn[i]) { U2[i] = U[i]; V2[i] = V[i]; continue }
            const u = U[i], v = V[i]
            const u2v = u * u * v
            // Schnakenberg: du/dt = ∇·(DU∇u) + a − u + u²v
            //               dv/dt = ∇·(DV∇v) + b − u²v
            U2[i] = u + dt * (aLap(U, Dxx, Dyy, Dxy, x, y)   + a - u + u2v)
            V2[i] = v + dt * (aLap(V, VDxx, VDyy, VDxy, x, y) + b - u2v)
          }
        }
        U.set(U2)
        V.set(V2)
      }

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = 10; img.data[j + 1] = 11; img.data[j + 2] = 20; img.data[j + 3] = 255
          continue
        }
        const t = Math.max(0, Math.min(1, (U[i] - (uss - 1)) / 2))
        img.data[j]     = (230 * t + 15 * (1 - t)) | 0
        img.data[j + 1] = (180 * t + 20 * (1 - t)) | 0
        img.data[j + 2] = (60  * t + 55 * (1 - t)) | 0
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
