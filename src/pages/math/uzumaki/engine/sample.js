import { compile } from '../lib/funcgen'

const TAU = Math.PI * 2
const DEG = Math.PI / 180

const safe = (fn, p, idx) => {
  if (!fn) return 0
  const v = fn(p, idx, 0)
  return Number.isFinite(v) ? v : 0
}

// Joints of an epicycle (origin → tip of each summed vector) at parameter s.
export function epicycleJoints(terms, s) {
  const joints = [{ x: 0, y: 0, z: 0 }]
  let x = 0
  let y = 0
  for (const tm of terms) {
    const a = tm.freq * s + (tm.phase || 0)
    x += tm.amp * Math.cos(a)
    y += tm.amp * Math.sin(a)
    joints.push({ x, y, z: 0 })
  }
  return joints
}

// Sample a clip's curve into object-space points once. Returns
// { pts, maxExtent, epi } where epi = { terms, range } for epicycles else null.
export function sampleClip(clip) {
  const c = clip.curve
  const pts = []
  let maxExtent = 1e-6
  const spiralG = clip.modifiers?.spiral || 0

  const push = (x, y, z, u) => {
    const sp = spiralG ? 1 + spiralG * u : 1
    const X = x * sp
    const Y = y * sp
    const Z = z * sp
    pts.push({ x: X, y: Y, z: Z })
    const e = Math.max(Math.abs(X), Math.abs(Y), Math.abs(Z))
    if (e > maxExtent) maxExtent = e
  }

  if (c.kind === 'epicycle') {
    const range = (c.turns || 1) * TAU
    const M = 2200
    for (let i = 0; i <= M; i++) {
      const s = (range * i) / M
      let x = 0
      let y = 0
      for (const tm of c.terms) {
        const a = tm.freq * s + (tm.phase || 0)
        x += tm.amp * Math.cos(a)
        y += tm.amp * Math.sin(a)
      }
      push(x, y, 0, i / M)
    }
    return { pts, maxExtent, epi: spiralG ? null : { terms: c.terms, range } }
  }

  if (c.kind === 'polar') {
    const rFn = compile(c.r)
    const [a, b] = c.range
    const M = 2000
    for (let i = 0; i <= M; i++) {
      const th = a + ((b - a) * i) / M
      const r = safe(rFn, th, 0)
      push(r * Math.cos(th), r * Math.sin(th), 0, i / M)
    }
    return { pts, maxExtent, epi: null }
  }

  if (c.kind === 'param2d' || c.kind === 'param3d') {
    const xFn = compile(c.x)
    const yFn = compile(c.y)
    const zFn = c.kind === 'param3d' ? compile(c.z) : null
    const [a, b] = c.range
    const M = 2400
    for (let i = 0; i <= M; i++) {
      const t = a + ((b - a) * i) / M
      push(safe(xFn, t, 0), safe(yFn, t, 0), zFn ? safe(zFn, t, 0) : 0, i / M)
    }
    return { pts, maxExtent, epi: null }
  }

  if (c.kind === 'points') {
    const aFn = compile(c.a)
    const rFn = compile(c.r)
    const N = c.count
    for (let i = 0; i < N; i++) {
      const ang = safe(aFn, 0, i)
      const r = safe(rFn, 0, i)
      push(r * Math.cos(ang), r * Math.sin(ang), 0, i / N)
    }
    return { pts, maxExtent, epi: null }
  }

  if (c.kind === 'maurer') {
    for (let i = 0; i <= 360; i++) {
      const kdeg = i * c.d
      const th = kdeg * DEG
      const r = Math.sin(c.n * th)
      push(r * Math.cos(th), r * Math.sin(th), 0, i / 360)
    }
    return { pts, maxExtent, epi: null }
  }

  return { pts: [{ x: 0, y: 0, z: 0 }], maxExtent: 1, epi: null }
}
