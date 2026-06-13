// DLA + Physarum Hybrid.
// Phase 1: grow a DLA aggregate inside the SDF mask (~3000 particles).
// Phase 2: pre-deposit trail at DLA cluster sites, spawn physarum agents
//   on the DLA boundary — agents bridge DLA branch tips with organic veins.
// DLA layer slowly fades while physarum network takes over.
// Reference: eCAADe 2018 "Biological Computation of Physarum From DLA to spatial adaptive Voronoi".



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'dlaMax',   type: 'int',   min: 500,  max: 5000, default: 2500, step: 250,  label: 'DLA particles' },
  { key: 'agents',   type: 'int',   min: 200,  max: 2500, default: 900,  step: 100,  label: 'phys agents' },
  { key: 'sensAng',  type: 'range', min: 0.1,  max: 1.5,  default: 0.45, step: 0.02, label: 'sensor angle' },
  { key: 'sensDist', type: 'range', min: 3,    max: 30,   default: 9,    step: 0.5,  label: 'sensor dist' },
  { key: 'deposit',  type: 'range', min: 0.01, max: 0.3,  default: 0.08, step: 0.01, label: 'deposit' },
  { key: 'decay',    type: 'range', min: 0.85, max: 0.99, default: 0.95, step: 0.005, label: 'decay' },
]

const GS         = 160
const DLA_STEP   = 1.5
const STICK_DIST = 2.5
const N_WALKERS  = 120
const DLA_FADE   = 0.9985  // DLA scaffold fades very slowly

export const r2_phys_04_dlahybrid            = {
  id: 'r2-phys-04-dlahybrid',
  name: 'DLA + PHYSARUM HYBRID',
  repo: 'eCAADe 2018 + Jones 2010',
  summary: 'DLA grows a fractal scaffold inside the glyph; physarum agents seed on the DLA boundary and bridge branch tips with organic veins. The crisp fractal backbone dissolves as the soft network takes over.',
  helps: 'Two-phase visual transition — the most dramatic prototype in the gallery. Fractal structure hands off to living vein dynamics.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const DLA_MAX = num(params, 'dlaMax',   2500)
    const N       = num(params, 'agents',   900)
    const SA      = num(params, 'sensAng',  0.45)
    const SD      = num(params, 'sensDist', 9)
    const DA      = num(params, 'deposit',  0.08)
    const DECAY   = num(params, 'decay',    0.95)

    const TAU = Math.PI * 2
    const RA  = 0.3

    const trail  = new Float32Array(GS * GS)
    const dlaMap = new Float32Array(GS * GS)  // fading DLA scaffold brightness
    const isIn   = new Uint8Array(GS * GS)
    for (let y = 0; y < GS; y++)
      for (let x = 0; x < GS; x++)
        isIn[y * GS + x] = sdf.sample((x / GS) * sdf.w, (y / GS) * sdf.h) < 0 ? 1 : 0

    // ---- Phase 1: grow DLA synchronously before first frame ----

    const stuck           = []
    const walkers                             = []

    const [s0x, s0y] = sampleInside(sdf, rng)
    stuck.push({ x: (s0x / sdf.w) * GS, y: (s0y / sdf.h) * GS })

    const cs = 10
    const gw = Math.ceil(GS / cs) + 1
    const gh = Math.ceil(GS / cs) + 1
    const grid             = new Array(gw * gh).fill(null).map(() => [])
    const gi = (x        , y        ) =>
      Math.max(0, Math.min(gh - 1, Math.floor(y / cs))) * gw +
      Math.max(0, Math.min(gw - 1, Math.floor(x / cs)))
    grid[gi(stuck[0].x, stuck[0].y)].push(0)

    for (let i = 0; i < N_WALKERS; i++) {
      const [wx, wy] = sampleInside(sdf, rng)
      walkers.push({ x: (wx / sdf.w) * GS, y: (wy / sdf.h) * GS })
    }

    const MAX_DLA_TICKS = 8000
    for (let tick = 0; tick < MAX_DLA_TICKS && stuck.length < DLA_MAX; tick++) {
      for (const w of walkers) {
        const ang = rng() * TAU
        const nx = w.x + Math.cos(ang) * DLA_STEP
        const ny = w.y + Math.sin(ang) * DLA_STEP
        if (nx < 0 || nx >= GS || ny < 0 || ny >= GS) continue
        if (sdf.sample((nx / GS) * sdf.w, (ny / GS) * sdf.h) >= 0) continue
        w.x = nx; w.y = ny

        const gx = Math.floor(w.x / cs)
        const gy = Math.floor(w.y / cs)
        let hit = false
        outer: for (let j = -1; j <= 1; j++) {
          const yy = gy + j; if (yy < 0 || yy >= gh) continue
          for (let i2 = -1; i2 <= 1; i2++) {
            const xx = gx + i2; if (xx < 0 || xx >= gw) continue
            for (const idx of grid[yy * gw + xx]) {
              const s = stuck[idx]
              if ((s.x - w.x) ** 2 + (s.y - w.y) ** 2 < STICK_DIST * STICK_DIST) {
                hit = true; break outer
              }
            }
          }
        }
        if (hit) {
          const idx = stuck.length
          stuck.push({ x: w.x, y: w.y })
          grid[gi(w.x, w.y)].push(idx)
          const [nwx, nwy] = sampleInside(sdf, rng)
          w.x = (nwx / sdf.w) * GS; w.y = (nwy / sdf.h) * GS
          if (stuck.length >= DLA_MAX) break
        }
      }
    }

    // Stamp DLA into trail and dlaMap
    for (const s of stuck) {
      const ix = Math.max(0, Math.min(GS - 1, Math.round(s.x)))
      const iy = Math.max(0, Math.min(GS - 1, Math.round(s.y)))
      trail[iy * GS + ix]  = 0.9
      dlaMap[iy * GS + ix] = 1.0
    }

    // ---- Phase 2: physarum agents seeded on DLA boundary ----
    // Boundary = DLA pixel with at least one non-DLA neighbor
    const boundary                     = []
    for (const s of stuck) {
      const ix = Math.round(s.x), iy = Math.round(s.y)
      let onBoundary = false
      for (let dy = -1; dy <= 1 && !onBoundary; dy++)
        for (let dx = -1; dx <= 1 && !onBoundary; dx++) {
          const nx2 = ix + dx, ny2 = iy + dy
          if (nx2 < 0 || nx2 >= GS || ny2 < 0 || ny2 >= GS) continue
          if (trail[ny2 * GS + nx2] < 0.5) onBoundary = true
        }
      if (onBoundary) boundary.push([ix, iy])
    }

    const ax = new Float32Array(N)
    const ay = new Float32Array(N)
    const aa = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      if (boundary.length > 0) {
        const [bx, by] = boundary[Math.floor(rng() * boundary.length)]
        ax[i] = bx; ay[i] = by
      } else {
        const [sx2, sy2] = sampleInside(sdf, rng)
        ax[i] = (sx2 / sdf.w) * GS; ay[i] = (sy2 / sdf.h) * GS
      }
      aa[i] = rng() * TAU
    }

    const tSample = (x        , y        )         => {
      const ix = Math.max(0, Math.min(GS - 1, Math.round(x)))
      const iy = Math.max(0, Math.min(GS - 1, Math.round(y)))
      return trail[iy * GS + ix]
    }

    const img = ctx.createImageData(GS, GS)
    const tmp2 = document.createElement('canvas')
    tmp2.width = GS; tmp2.height = GS
    const tc = tmp2.getContext('2d')

    return wrapLoop(() => {
      for (let i = 0; i < N; i++) {
        const ang = aa[i]
        const sL = tSample(ax[i] + Math.cos(ang - SA) * SD, ay[i] + Math.sin(ang - SA) * SD)
        const sF = tSample(ax[i] + Math.cos(ang) * SD,      ay[i] + Math.sin(ang) * SD)
        const sR = tSample(ax[i] + Math.cos(ang + SA) * SD, ay[i] + Math.sin(ang + SA) * SD)

        if (sF >= sL && sF >= sR) {
          // straight
        } else if (sL > sR) {
          aa[i] -= RA
        } else if (sR > sL) {
          aa[i] += RA
        } else {
          aa[i] += (rng() < 0.5 ? -1 : 1) * RA
        }

        const nx = ax[i] + Math.cos(aa[i])
        const ny = ay[i] + Math.sin(aa[i])
        if (nx >= 0 && nx < GS && ny >= 0 && ny < GS &&
            sdf.sample((nx / GS) * sdf.w, (ny / GS) * sdf.h) < 0) {
          ax[i] = nx; ay[i] = ny
        } else {
          aa[i] = rng() * TAU
        }

        const ixi = Math.max(0, Math.min(GS - 1, Math.round(ax[i])))
        const iyi = Math.max(0, Math.min(GS - 1, Math.round(ay[i])))
        trail[iyi * GS + ixi] = Math.min(1, trail[iyi * GS + ixi] + DA)
      }

      // Trail decay + diffuse
      const tmp3 = new Float32Array(trail)
      for (let y = 1; y < GS - 1; y++) {
        for (let x = 1; x < GS - 1; x++) {
          if (!isIn[y * GS + x]) continue
          let s = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              s += tmp3[(y + dy) * GS + (x + dx)]
          trail[y * GS + x] = (s / 9) * DECAY
        }
      }

      // Fade DLA scaffold
      for (let i = 0; i < GS * GS; i++) dlaMap[i] *= DLA_FADE

      // Render: DLA in blue-white, physarum trail in warm amber
      for (let i = 0; i < GS * GS; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = 10; img.data[j+1] = 11; img.data[j+2] = 20; img.data[j+3] = 255
          continue
        }
        const t = Math.min(1, trail[i] * 2.5)
        const d = dlaMap[i]
        img.data[j]   = (220 * t + 160 * d) | 0
        img.data[j+1] = (150 * t + 200 * d) | 0
        img.data[j+2] = (20  * t + 240 * d) | 0
        img.data[j+3] = 255
      }
      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp2, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
