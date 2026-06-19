// Threads model (after polyhop's "Thread Spinner"), generalized. TWO independent
// layers:
//   1. BALLS — a windmill of BIG white balls (spokes at t=0) that spreads across
//      the surface, each orbiting at its own graduated radius + varied speed.
//   2. FORM  — a set of base curves (loops / rings / grid / stripes / radial /
//      spiral / waves / web). Every point of the form is DRAGGED toward any ball
//      within `infR` (the balls' influence), so the moving balls haul the form
//      around. The drag is form-agnostic — the SAME field warps any base shape.
//
// Pure + DOM-free so node can verify and the renderer can fast-forward for stills.

import { mulberry32 } from '../../../../lib/rng.js'

const TAU = Math.PI * 2

export const FORM_OPTIONS = [
  { value: 'loops', label: 'Loops' },
  { value: 'rings', label: 'Rings' },
  { value: 'grid', label: 'Grid' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'radial', label: 'Radial' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'waves', label: 'Waves' },
  { value: 'web', label: 'Web' },
]

// ── Balls: windmill spokes at t=0, each orbiting at its own radius + varied speed.
function makeBalls(rng, wings, perWing) {
  const balls = []
  for (let wi = 0; wi < wings; wi++) {
    const spoke = (wi / wings) * TAU + (rng() - 0.5) * 0.1
    for (let k = 0; k < perWing; k++) {
      const startR = 0.12 + ((k + 0.5) / perWing) * 0.5
      const dir = rng() < 0.5 ? 1 : -1
      const w = (0.5 + rng() * 1.05) * dir
      const wob = 1.4 + rng() * 2.2
      const wobAmp = 0.12 + rng() * 0.13
      const sizeF = 0.6 + (perWing === 1 ? 0.4 : (k / (perWing - 1)) * 0.7) + (rng() - 0.5) * 0.2
      balls.push({ startR, spoke, w, wob, wobAmp, wph: 0, size: Math.max(0.35, sizeF) })
    }
  }
  return balls
}

// ── Form library: each returns base curves {hue, pts:[[x,y]…]} in normalized
// coords (centre 0, edge ≈ ±0.9). Closed shapes repeat the first point.
export function buildForm(form, count, rng) {
  const N = Math.max(1, Math.round(count))
  const paths = []
  const hue = (i, n) => (i / Math.max(1, n)) * 360
  const closed = (fn, s = 180) => { const p = []; for (let i = 0; i <= s; i++) p.push(fn(i / s)); return p }
  const open = (fn, s = 90) => { const p = []; for (let i = 0; i <= s; i++) p.push(fn(i / s)); return p }
  const axis = (i, n) => (n === 1 ? 0 : i / (n - 1)) * 1.7 - 0.85

  if (form === 'rings') {
    for (let i = 0; i < N; i++) { const r = 0.2 + ((i + 1) / N) * 0.68; paths.push({ hue: hue(i, N), pts: closed((s) => { const a = s * TAU; return [Math.cos(a) * r, Math.sin(a) * r] }) }) }
  } else if (form === 'grid') {
    for (let i = 0; i < N; i++) {
      const v = axis(i, N)
      paths.push({ hue: hue(i, 2 * N), pts: open((s) => [s * 1.7 - 0.85, v]) })
      paths.push({ hue: hue(i + N, 2 * N), pts: open((s) => [v, s * 1.7 - 0.85]) })
    }
  } else if (form === 'stripes') {
    for (let i = 0; i < N; i++) { const v = axis(i, N); paths.push({ hue: hue(i, N), pts: open((s) => [s * 1.7 - 0.85, v]) }) }
  } else if (form === 'radial') {
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; paths.push({ hue: hue(i, N), pts: open((s) => [Math.cos(a) * (0.04 + s * 0.88), Math.sin(a) * (0.04 + s * 0.88)]) }) }
  } else if (form === 'spiral') {
    const arms = Math.max(1, Math.min(N, 5))
    for (let j = 0; j < arms; j++) { const off = (j / arms) * TAU; paths.push({ hue: hue(j, arms), pts: open((s) => { const a = off + s * TAU * 2.6; const r = s * 0.9; return [Math.cos(a) * r, Math.sin(a) * r] }, 220) }) }
  } else if (form === 'waves') {
    for (let i = 0; i < N; i++) { const y0 = axis(i, N); const freq = 2 + (i % 3); const ph = rng() * TAU; paths.push({ hue: hue(i, N), pts: open((s) => { const x = s * 1.8 - 0.9; return [x, y0 + 0.12 * Math.sin(freq * Math.PI * x + ph)] }) }) }
  } else if (form === 'web') {
    const rings = Math.max(2, Math.round(N / 2))
    for (let i = 0; i < rings; i++) { const r = 0.2 + ((i + 1) / rings) * 0.68; paths.push({ hue: hue(i, N + rings), pts: closed((s) => { const a = s * TAU; return [Math.cos(a) * r, Math.sin(a) * r] }) }) }
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; paths.push({ hue: hue(i + rings, N + rings), pts: open((s) => [Math.cos(a) * (0.04 + s * 0.88), Math.sin(a) * (0.04 + s * 0.88)]) }) }
  } else { // loops (default)
    for (let i = 0; i < N; i++) {
      const a = 0.82 + rng() * 0.12
      const b = 0.52 + rng() * 0.26
      const phi = (i / N) * Math.PI + (rng() - 0.5) * 0.4
      const wA = 0.04 + rng() * 0.06
      const wF = 2 + Math.floor(rng() * 2)
      const wP = rng() * TAU
      const cph = Math.cos(phi)
      const sph = Math.sin(phi)
      paths.push({ hue: hue(i, N), pts: closed((s) => { const th = s * TAU; const w = 1 + wA * Math.sin(wF * th + wP); const lx = w * a * Math.cos(th); const ly = w * b * Math.sin(th); return [lx * cph - ly * sph, lx * sph + ly * cph] }) })
    }
  }
  return paths
}

export function makeThreads(opts = {}, seed = 1) {
  const rng = mulberry32((seed ?? 1) >>> 0)
  const wings = Math.max(2, Math.round(opts.wings ?? 3))
  const perWing = Math.max(1, Math.round(opts.perWing ?? 4))
  const balls = makeBalls(rng, wings, perWing)
  const paths = buildForm(opts.form || 'loops', opts.lines ?? 6, rng)
  return { balls, paths }
}

// Ball position at time t, NORMALIZED. On its spoke at radius startR when t=0.
export function ballPosN(b, t, speed = 1) {
  const tt = t * speed
  const R = b.startR * (1 + b.wobAmp * Math.sin(b.wob * tt + b.wph))
  const ang = b.spoke + b.w * tt
  return [R * Math.cos(ang), R * Math.sin(ang)]
}

// Rotate a base curve by rotSpeed·t and DRAG every point toward nearby balls.
// Kernel 4·u·(1−u) is a smooth bump (0 at the ball centre AND edge, peak mid) ⇒
// the form wraps the balls without collapsing onto them or spiking.
export function applyDrag(basePts, t, ballsN, r = {}, rotSpeed = 0) {
  const infR = r.infR ?? 0.28
  const pull = r.pull ?? 0.18
  const maxPull = r.maxPull ?? 0.4
  const rot = rotSpeed * t
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const out = []
  for (let i = 0; i < basePts.length; i++) {
    let x = basePts[i][0] * c - basePts[i][1] * s
    let y = basePts[i][0] * s + basePts[i][1] * c
    if (pull > 0) {
      let ox = 0
      let oy = 0
      for (let k = 0; k < ballsN.length; k++) {
        const vx = ballsN[k][0] - x
        const vy = ballsN[k][1] - y
        const d = Math.hypot(vx, vy)
        if (d < infR && d > 1e-4) {
          const u = d / infR
          const f = pull * 4 * u * (1 - u)
          ox += (vx / d) * f
          oy += (vy / d) * f
        }
      }
      const om = Math.hypot(ox, oy)
      if (om > maxPull) { ox = (ox / om) * maxPull; oy = (oy / om) * maxPull }
      x += ox
      y += oy
    }
    out.push([x, y])
  }
  return out
}

export { TAU }
