
import { clear, wrapLoop } from './common'

// Gray-Scott reaction-diffusion on a 220×220 grid (one-dim per channel).
// Mask limits the reactive region to SDF<0. Rendered via an ImageData put
// scaled into the canvas.
//
// Reference: jasonwebb/reaction-diffusion-playground ·
// https://karlsims.com/rd.html (Karl Sims) · mrob.com/pub/comp/xmorphia (Mrob)
export const reactionDiff            = {
  id: '10-reaction-diffusion',
  name: 'REACTION-DIFFUSION (GRAY-SCOTT)',
  repo: 'jasonwebb/reaction-diffusion-playground',
  summary:
    'Gray-Scott partial-differential equations solved on a coarse grid, masked by the SDF. Produces coral / zebra / spots / leopard depending on feed/kill rates. Slower iteration than vector algos; here CPU-bound at ~30fps, fine for demo. A pixel pattern layer instead of vector.',
  helps:
    'The odd one out — raster, not vector. Shows what off-brief looks like. Probably not the fit for this project, but worth seeing the comparison.',
  init({ ctx, sdf, W, H }) {
    const GRID = 220
    const A = new Float32Array(GRID * GRID)
    const B = new Float32Array(GRID * GRID)
    const A2 = new Float32Array(GRID * GRID)
    const B2 = new Float32Array(GRID * GRID)
    const isIn = new Uint8Array(GRID * GRID)
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const sx = (x / GRID) * sdf.w
        const sy = (y / GRID) * sdf.h
        isIn[y * GRID + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
        A[y * GRID + x] = 1
      }
    }
    // seed with a few random spots inside
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() * GRID) | 0
      const y = (Math.random() * GRID) | 0
      if (!isIn[y * GRID + x]) continue
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx < 0 || xx >= GRID || yy < 0 || yy >= GRID) continue
          if (!isIn[yy * GRID + xx]) continue
          B[yy * GRID + xx] = 1
        }
      }
    }

    const dA = 1.0, dB = 0.5
    const feed = 0.055, kill = 0.062
    const dt = 1

    const img = ctx.createImageData(GRID, GRID)

    const laplace = (buf              , x        , y        , i        )         => {
      const l = x > 0 ? buf[i - 1] : buf[i]
      const r = x < GRID - 1 ? buf[i + 1] : buf[i]
      const u = y > 0 ? buf[i - GRID] : buf[i]
      const d = y < GRID - 1 ? buf[i + GRID] : buf[i]
      return l + r + u + d - 4 * buf[i]
    }

    return wrapLoop(() => {
      // 2 iterations per frame
      for (let it = 0; it < 2; it++) {
        for (let y = 1; y < GRID - 1; y++) {
          for (let x = 1; x < GRID - 1; x++) {
            const i = y * GRID + x
            if (!isIn[i]) { A2[i] = A[i]; B2[i] = B[i]; continue }
            const a = A[i], b = B[i]
            const ab2 = a * b * b
            A2[i] = a + (dA * laplace(A, x, y, i) - ab2 + feed * (1 - a)) * dt
            B2[i] = b + (dB * laplace(B, x, y, i) + ab2 - (kill + feed) * b) * dt
          }
        }
        A.set(A2)
        B.set(B2)
      }

      // render via ImageData scaled
      for (let i = 0; i < GRID * GRID; i++) {
        const j = i * 4
        if (!isIn[i]) { img.data[j] = 10; img.data[j + 1] = 11; img.data[j + 2] = 20; img.data[j + 3] = 255; continue }
        const v = Math.max(0, Math.min(1, A[i] - B[i]))
        img.data[j] = 243 * v + 10 * (1 - v)
        img.data[j + 1] = 201 * v + 11 * (1 - v)
        img.data[j + 2] = 196 * v + 20 * (1 - v)
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = GRID; tmp.height = GRID
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tmp, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
    })
  },
}
