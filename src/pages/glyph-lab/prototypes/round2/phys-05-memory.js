// Memory-Augmented Physarum (Temporal Trail Strata).
// Two trail fields: recent (fast decay) and long-term (very slow decay).
// Agents sense a blend of both; heavily-trafficked paths burn permanent
// routes into long-term memory — the glyph gains stratified vascular history.
// Reference: Boussard et al. 2019 Phil Trans Roy Soc B 374:20180368.



import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'agents',    type: 'int',   min: 300,  max: 3000, default: 1200, step: 100,   label: 'agents' },
  { key: 'sensAng',   type: 'range', min: 0.1,  max: 1.5,  default: 0.45, step: 0.02,  label: 'sensor angle' },
  { key: 'sensDist',  type: 'range', min: 3,    max: 30,   default: 9,    step: 0.5,   label: 'sensor dist' },
  { key: 'deposit',   type: 'range', min: 0.01, max: 0.3,  default: 0.08, step: 0.01,  label: 'deposit' },
  { key: 'memWeight', type: 'range', min: 0.0,  max: 1.0,  default: 0.4,  step: 0.05,  label: 'memory weight' },
  { key: 'ltDecay',   type: 'range', min: 0.998, max: 0.9999, default: 0.9993, step: 0.0002, label: 'LT decay' },
]

const GS           = 160
const RECENT_DECAY = 0.91
const LT_DEPOSIT   = 0.1   // fraction of deposit that goes to long-term

export const r2_phys_05_memory            = {
  id: 'r2-phys-05-memory',
  name: 'MEMORY PHYSARUM',
  repo: 'Boussard et al. 2019 Phil Trans Roy Soc B',
  summary: 'Dual trail strata: a fast-decaying recent field and a near-permanent long-term field. Heavily-used routes stabilise into highways; new explorers path-find differently from their predecessors — the glyph accrues stratified vascular memory.',
  helps: 'Long evolution arc — early dynamics look like baseline physarum but memory highways shift agent behaviour over hundreds of ticks.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const N         = num(params, 'agents',    1200)
    const SA        = num(params, 'sensAng',   0.45)
    const SD        = num(params, 'sensDist',  9)
    const DA        = num(params, 'deposit',   0.08)
    const MEM_W     = num(params, 'memWeight', 0.4)
    const LT_DECAY  = num(params, 'ltDecay',   0.9993)

    const TAU = Math.PI * 2
    const RA  = 0.3

    const recent = new Float32Array(GS * GS)
    const ltMem  = new Float32Array(GS * GS)
    const isIn   = new Uint8Array(GS * GS)
    for (let y = 0; y < GS; y++)
      for (let x = 0; x < GS; x++)
        isIn[y * GS + x] = sdf.sample((x / GS) * sdf.w, (y / GS) * sdf.h) < 0 ? 1 : 0

    const sampleB = (buf              , x        , y        )         => {
      const ix = Math.max(0, Math.min(GS - 1, Math.round(x)))
      const iy = Math.max(0, Math.min(GS - 1, Math.round(y)))
      return buf[iy * GS + ix]
    }
    const score = (x        , y        )         =>
      (1 - MEM_W) * sampleB(recent, x, y) + MEM_W * sampleB(ltMem, x, y)

    const ax = new Float32Array(N)
    const ay = new Float32Array(N)
    const aa = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const [sx, sy] = sampleInside(sdf, rng)
      ax[i] = (sx / sdf.w) * GS
      ay[i] = (sy / sdf.h) * GS
      aa[i] = rng() * TAU
    }

    const img = ctx.createImageData(GS, GS)
    const tmp = document.createElement('canvas')
    tmp.width = GS; tmp.height = GS
    const tc = tmp.getContext('2d')

    return wrapLoop(() => {
      for (let i = 0; i < N; i++) {
        const ang = aa[i]
        const sL = score(ax[i] + Math.cos(ang - SA) * SD, ay[i] + Math.sin(ang - SA) * SD)
        const sF = score(ax[i] + Math.cos(ang) * SD,      ay[i] + Math.sin(ang) * SD)
        const sR = score(ax[i] + Math.cos(ang + SA) * SD, ay[i] + Math.sin(ang + SA) * SD)

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

        const ix = Math.max(0, Math.min(GS - 1, Math.round(ax[i])))
        const iy = Math.max(0, Math.min(GS - 1, Math.round(ay[i])))
        recent[iy * GS + ix] = Math.min(1, recent[iy * GS + ix] + DA)
        ltMem[iy * GS + ix]  = Math.min(1, ltMem[iy * GS + ix]  + DA * LT_DEPOSIT)
      }

      // Decay + diffuse recent
      const tmp2 = new Float32Array(recent)
      for (let y = 1; y < GS - 1; y++) {
        for (let x = 1; x < GS - 1; x++) {
          if (!isIn[y * GS + x]) continue
          let s = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              s += tmp2[(y + dy) * GS + (x + dx)]
          recent[y * GS + x] = (s / 9) * RECENT_DECAY
        }
      }

      // Long-term: minimal diffusion, very slow decay
      const tmp3 = new Float32Array(ltMem)
      for (let y = 1; y < GS - 1; y++) {
        for (let x = 1; x < GS - 1; x++) {
          if (!isIn[y * GS + x]) continue
          // 1px kernel with 0.01 weight per neighbor (very slow spread)
          const c = tmp3[y * GS + x]
          const nb = (tmp3[(y-1)*GS+x] + tmp3[(y+1)*GS+x] + tmp3[y*GS+(x-1)] + tmp3[y*GS+(x+1)]) * 0.01
          ltMem[y * GS + x] = (c + nb) * LT_DECAY
        }
      }

      // Render: recent in cool blue, long-term in warm gold
      for (let i = 0; i < GS * GS; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = 10; img.data[j+1] = 11; img.data[j+2] = 20; img.data[j+3] = 255
          continue
        }
        const r = Math.min(1, recent[i] * 2.5)
        const m = Math.min(1, ltMem[i]  * 8.0)   // amplified — accumulates slowly
        img.data[j]   = (40  * r + 230 * m) | 0
        img.data[j+1] = (160 * r + 180 * m) | 0
        img.data[j+2] = (220 * r + 20  * m) | 0
        img.data[j+3] = 255
      }
      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
