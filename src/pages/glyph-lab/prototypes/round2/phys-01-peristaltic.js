// Oscillatory / Peristaltic Physarum.
// Agents carry an internal phase; deposit is modulated by sin(phase),
// producing traveling-wave pulses along formed veins. Optional Kuramoto
// coupling synchronises nearby agents over time.
// Reference: Jones 2010 (sensor geometry); Alim et al. 2013 PNAS (peristalsis).



import { num, bool } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'agents',   type: 'int',   min: 300,  max: 3000, default: 1200, step: 100,   label: 'agents' },
  { key: 'sensAng',  type: 'range', min: 0.1,  max: 1.5,  default: 0.45, step: 0.02,  label: 'sensor angle' },
  { key: 'sensDist', type: 'range', min: 3,    max: 30,   default: 9,    step: 0.5,   label: 'sensor dist' },
  { key: 'deposit',  type: 'range', min: 0.02, max: 0.3,  default: 0.10, step: 0.01,  label: 'deposit' },
  { key: 'decay',    type: 'range', min: 0.80, max: 0.98, default: 0.90, step: 0.005, label: 'decay' },
  { key: 'omega',    type: 'range', min: 0.01, max: 0.15, default: 0.04, step: 0.005, label: 'phase speed' },
  { key: 'coupling', type: 'boolean', default: true, label: 'Kuramoto sync' },
]

const GS = 160

export const r2_phys_01_peristaltic            = {
  id: 'r2-phys-01-peristaltic',
  name: 'OSCILLATORY PHYSARUM',
  repo: 'Jones 2010 + Alim et al. 2013 PNAS',
  summary: 'Agents carry a phase variable; deposit is modulated by sin(phase), creating peristaltic wave pulses that travel along formed veins. Optional Kuramoto coupling produces network-wide synchronization.',
  helps: 'Physarum that never goes static — steady-state is a living circulatory system with visible pulse waves.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const N       = num(params, 'agents',   1200)
    const SA      = num(params, 'sensAng',  0.45)
    const SD      = num(params, 'sensDist', 9)
    const DA      = num(params, 'deposit',  0.10)
    const DECAY   = num(params, 'decay',    0.90)
    const OMEGA   = num(params, 'omega',    0.04)
    const COUPLE  = bool(params, 'coupling', true)

    const TAU = Math.PI * 2
    const RA  = 0.3  // rotation amount per tick

    // Trail grid
    const trail = new Float32Array(GS * GS)
    const isIn  = new Uint8Array(GS * GS)
    for (let y = 0; y < GS; y++)
      for (let x = 0; x < GS; x++)
        isIn[y * GS + x] = sdf.sample((x / GS) * sdf.w, (y / GS) * sdf.h) < 0 ? 1 : 0

    const tSample = (x        , y        )         => {
      const ix = Math.max(0, Math.min(GS - 1, Math.round(x)))
      const iy = Math.max(0, Math.min(GS - 1, Math.round(y)))
      return trail[iy * GS + ix]
    }

    // Agents: x, y in [0,GS), angle, phase
    const ax = new Float32Array(N)
    const ay = new Float32Array(N)
    const aa = new Float32Array(N)
    const ap = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const [sx, sy] = sampleInside(sdf, rng)
      ax[i] = (sx / sdf.w) * GS
      ay[i] = (sy / sdf.h) * GS
      aa[i] = rng() * TAU
      ap[i] = rng() * TAU
    }

    const img = ctx.createImageData(GS, GS)
    const tmp = document.createElement('canvas')
    tmp.width = GS; tmp.height = GS
    const tc = tmp.getContext('2d')

    return wrapLoop(() => {
      // Sense + turn + step
      for (let i = 0; i < N; i++) {
        const ang = aa[i]
        // three sensor positions
        const fl = ax[i] + Math.cos(ang - SA) * SD
        const fb = ay[i] + Math.sin(ang - SA) * SD
        const fc = ax[i] + Math.cos(ang) * SD
        const fd = ay[i] + Math.sin(ang) * SD
        const fr = ax[i] + Math.cos(ang + SA) * SD
        const fs = ay[i] + Math.sin(ang + SA) * SD

        const sL = tSample(fl, fb)
        const sF = tSample(fc, fd)
        const sR = tSample(fr, fs)

        if (sF >= sL && sF >= sR) {
          // keep heading
        } else if (sL > sR) {
          aa[i] -= RA
        } else if (sR > sL) {
          aa[i] += RA
        } else {
          aa[i] += (rng() < 0.5 ? -1 : 1) * RA
        }

        // Step
        const nx = ax[i] + Math.cos(aa[i])
        const ny = ay[i] + Math.sin(aa[i])
        const sx2 = (nx / GS) * sdf.w
        const sy2 = (ny / GS) * sdf.h
        if (nx >= 0 && nx < GS && ny >= 0 && ny < GS && sdf.sample(sx2, sy2) < 0) {
          ax[i] = nx; ay[i] = ny
        } else {
          aa[i] = rng() * TAU
        }

        // Deposit modulated by phase
        const pulse = 0.5 + 0.5 * Math.sin(ap[i])
        const ix = Math.max(0, Math.min(GS - 1, Math.round(ax[i])))
        const iy = Math.max(0, Math.min(GS - 1, Math.round(ay[i])))
        trail[iy * GS + ix] = Math.min(1, trail[iy * GS + ix] + DA * pulse)

        // Advance phase; Kuramoto coupling to local trail density
        let dph = OMEGA
        if (COUPLE) dph += 0.012 * (tSample(ax[i], ay[i]) - 0.5)
        ap[i] = (ap[i] + dph + TAU) % TAU
      }

      // Decay + diffuse (3x3 box)
      const tmp2 = new Float32Array(trail)
      for (let y = 1; y < GS - 1; y++) {
        for (let x = 1; x < GS - 1; x++) {
          if (!isIn[y * GS + x]) continue
          let s = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              s += tmp2[(y + dy) * GS + (x + dx)]
          trail[y * GS + x] = (s / 9) * DECAY
        }
      }

      // Render
      for (let i = 0; i < GS * GS; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = 10; img.data[j+1] = 11; img.data[j+2] = 20; img.data[j+3] = 255
          continue
        }
        const v = Math.min(1, trail[i] * 2.5)
        img.data[j]   = (20  + 200 * v) | 0
        img.data[j+1] = (180 * v)       | 0
        img.data[j+2] = (60  + 160 * v) | 0
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
