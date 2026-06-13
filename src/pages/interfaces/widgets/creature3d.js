import p5 from 'p5'
import { pixelate } from '../pixel'























const SHAPES                                 = {
  manta: (u, v, t, amp, freq) => {
    const U = u * 2 - 1
    const V = v * 2 - 1
    const x = U * 1.35
    const z = V * 0.65
    const body = Math.pow(Math.max(0, 1 - U * U * 0.55 - V * V * 0.9), 0.5) * 0.18
    const flap = Math.sin(t * freq * Math.PI * 2 + U * Math.PI * 0.2) * Math.pow(Math.abs(U), 1.3) * amp
    const y = flap + body
    return [x, y, z]
  },
  whale: (u, v, t, amp, freq) => {
    const U = u * 2 - 1
    const V = v * 2 - 1
    const bodyTaper = Math.pow(Math.max(0, 1 - U * U), 0.55)
    const x = U * 2.1
    const thickness = bodyTaper * 0.42
    const y = V * thickness
    const z = Math.cos(v * Math.PI) * thickness
    const tailFactor = Math.max(0, (U - 0.55) / 0.45)
    const tail = Math.sin(t * freq * Math.PI * 2) * amp * tailFactor * tailFactor * 1.2
    return [x, y + tail, z]
  },
  wing: (u, v, t, amp, freq) => {
    const U = u * 2 - 1
    const V = v * 2 - 1
    const x = U * 1.4
    const z = V * 0.95 - 0.1
    const thin = Math.pow(Math.max(0, 1 - V * V * 0.7), 0.6) * 0.08
    const flap = Math.sin(t * freq * Math.PI * 2 + U * Math.PI * 0.35) * Math.abs(U) * amp
    const y = flap + thin
    return [x, y, z]
  },
  blob: (u, v, t, amp, freq) => {
    const phi = u * Math.PI * 2
    const theta = v * Math.PI
    const r = 1 + Math.sin(u * 4 * Math.PI + t * freq * 2) * 0.12
      + Math.sin(v * 3 * Math.PI + t * freq * 1.4) * 0.1
      + Math.sin((u + v) * 5 + t * freq) * 0.06 * amp
    const x = r * Math.sin(theta) * Math.cos(phi)
    const y = r * Math.cos(theta)
    const z = r * Math.sin(theta) * Math.sin(phi)
    return [x, y, z]
  },
  torus: (u, v, _t, _a, _f) => {
    const phi = u * Math.PI * 2
    const theta = v * Math.PI * 2
    const R = 1.15, r = 0.42
    return [
      (R + r * Math.cos(theta)) * Math.cos(phi),
      r * Math.sin(theta),
      (R + r * Math.cos(theta)) * Math.sin(phi),
    ]
  },
  core: (u, v, t, amp, freq) => {
    const U = u * 2 - 1
    const V = v * 2 - 1
    // superellipse cushion shell
    const ex = Math.pow(Math.abs(U), 4) + Math.pow(Math.abs(V), 4)
    const shellR = ex > 0 ? Math.pow(ex, 0.25) : 0.01
    const norm = shellR > 0 ? 1 / shellR : 0
    const xN = U * norm
    const zN = V * norm
    // radial spike at 4 cardinals
    const angle = Math.atan2(zN, xN)
    const spike = Math.max(0, Math.cos(angle * 4)) * 0.35
    const breath = Math.sin(t * freq * 2) * 0.04 * amp
    const rOuter = 1 + spike + breath
    const x = xN * rOuter
    const z = zN * rOuter
    const yPuff = Math.max(0, 1 - xN * xN - zN * zN) * 0.35
    const y = yPuff * (v < 0.5 ? 1 : -1)
    return [x, y, z]
  },
  squid: (u, v, t, amp, freq) => {
    // 8 tentacles indexed by u, length by v
    const idx = Math.floor(u * 8)
    const ang = (idx / 8) * Math.PI * 2
    const tLen = v * 2.0
    const curl = Math.sin(v * Math.PI * 2.5 + t * freq + idx * 0.8) * amp * v * 0.9
    const headBulb = v < 0.15 ? (0.15 - v) * 2 : 0
    const x = Math.cos(ang) * (0.25 + tLen * 0.35 + headBulb * 0.6)
      + curl * Math.cos(ang + Math.PI / 2)
    const y = -tLen + 0.5
    const z = Math.sin(ang) * (0.25 + tLen * 0.35 + headBulb * 0.6)
      + curl * Math.sin(ang + Math.PI / 2)
    return [x, y, z]
  },
}

export function creature3d(opts                )     {
  const W = opts.w ?? 160
  const H = opts.h ?? 160
  const shape = opts.shape ?? 'manta'
  const samples = opts.samples ?? 30
  const flapFreq = opts.flapFreq ?? 0.7
  const flapAmp = opts.flapAmp ?? 0.35
  const spinSpeed = opts.spinSpeed ?? 0.18
  const tumble = opts.tumble ?? false
  const scale = opts.scale ?? 34
  const withCore = opts.withCore ?? false
  const seed = opts.seed ?? 0
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'

  const shapeFn = SHAPES[shape]

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(24)
    }

    p.draw = () => {
      p.background(bg)
      p.noStroke()

      const t = p.millis() / 1000 + seed
      const phase = t * spinSpeed * Math.PI * 2
      const tiltX = tumble ? Math.sin(t * 0.23) * 0.55 : -0.18

      const cY = Math.cos(phase), sY = Math.sin(phase)
      const cX = Math.cos(tiltX), sX = Math.sin(tiltX)
      const CAM = 4.2


      const pts       = []
      const total = samples * samples

      const project = (x        , y        , z        )            => {
        const xr = x * cY - z * sY
        const zr = x * sY + z * cY
        const yr = y * cX - zr * sX
        const zr2 = y * sX + zr * cX
        const persp = CAM / (CAM + zr2)
        if (persp < 0.1) return null
        const px = W / 2 + xr * persp * scale
        const py = H / 2 + yr * persp * scale
        return { px, py, depth: zr2 }
      }

      for (let i = 0; i < total; i++) {
        const u = (i % samples) / (samples - 1)
        const v = Math.floor(i / samples) / (samples - 1)
        const [x, y, z] = shapeFn(u, v, t, flapAmp, flapFreq)
        const pt = project(x, y, z)
        if (pt) pts.push(pt)
      }

      // optional core sphere
      if (withCore) {
        const coreSamples = 14
        const coreR = 0.35
        for (let i = 0; i < coreSamples; i++) {
          for (let j = 0; j < coreSamples; j++) {
            const phi = (i / coreSamples) * Math.PI * 2
            const theta = (j / (coreSamples - 1)) * Math.PI
            const cx = coreR * Math.sin(theta) * Math.cos(phi)
            const cy = coreR * Math.cos(theta)
            const cz = coreR * Math.sin(theta) * Math.sin(phi)
            const pt = project(cx, cy, cz)
            if (pt) pts.push(pt)
          }
        }
      }

      if (pts.length === 0) return
      pts.sort((a, b) => a.depth - b.depth)
      const minD = pts[0].depth
      const maxD = pts[pts.length - 1].depth
      const range = maxD - minD + 0.001

      for (const pt of pts) {
        const x = Math.round(pt.px)
        const y = Math.round(pt.py)
        if (x < 0 || x >= W || y < 0 || y >= H) continue
        const d01 = (pt.depth - minD) / range
        p.fill(d01 > 0.55 ? fg : dim)
        p.rect(x, y, 1, 1)
      }
    }
  }, opts.host)
}
