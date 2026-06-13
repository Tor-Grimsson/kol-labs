/* Lab math utilities — pure, framework-free. */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp  = (a, b, t) => a + (b - a) * t
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
export const TAU = Math.PI * 2

/* Seeded 32-bit hash → uniform [0,1). Mulberry32-ish. Deterministic for
 * a given (seed, salt) pair. */
export function seededRandom(seed, salt = 0) {
  let s = (seed * 2654435761) ^ (salt * 1597334677)
  s = (s + 0x6D2B79F5) | 0
  let r = Math.imul(s ^ (s >>> 15), 1 | s)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296
}

/* Returns a closure that produces deterministic random numbers from a seed. */
export function rng(seed = 0) {
  let state = seed | 0
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let r = Math.imul(state ^ (state >>> 15), 1 | state)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/* Improved Perlin noise (Ken Perlin's reference impl), seedable via permutation
 * shuffle. Returns ~[-1, 1]. 2D variant. */
function buildPermutation(seed) {
  const p = new Uint8Array(512)
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i++) base[i] = i
  const r = rng(seed || 1)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]]
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255]
  return p
}

let _perlinCache = { seed: null, p: null }
function getPerm(seed) {
  if (_perlinCache.seed !== seed) {
    _perlinCache = { seed, p: buildPermutation(seed) }
  }
  return _perlinCache.p
}
const _fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
const _grad2 = (hash, x, y) => {
  const h = hash & 7
  const u = h < 4 ? x : y
  const v = h < 4 ? y : x
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v)
}

export function perlin2(x, y, seed = 1) {
  const p = getPerm(seed)
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = _fade(xf)
  const v = _fade(yf)
  const aa = p[p[xi] + yi]
  const ab = p[p[xi] + yi + 1]
  const ba = p[p[xi + 1] + yi]
  const bb = p[p[xi + 1] + yi + 1]
  return lerp(
    lerp(_grad2(aa, xf, yf),       _grad2(ba, xf - 1, yf),     u),
    lerp(_grad2(ab, xf, yf - 1),   _grad2(bb, xf - 1, yf - 1), u),
    v,
  ) * 0.5
}

/* Cardinal / Catmull-Rom spline through a list of 2D points. Returns an SVG
 * path string. `tension` in [0,1]; 0 = uniform Catmull-Rom. Open polyline. */
export function catmullRomPath(points, tension = 0.5) {
  if (points.length < 2) return ''
  const k = (1 - tension) / 6
  const cmd = [`M ${points[0][0]} ${points[0][1]}`]
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) * k
    const c1y = p1[1] + (p2[1] - p0[1]) * k
    const c2x = p2[0] - (p3[0] - p1[0]) * k
    const c2y = p2[1] - (p3[1] - p1[1]) * k
    cmd.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`)
  }
  return cmd.join(' ')
}

/* Same but closed (last point connects back to first). */
export function catmullRomClosedPath(points, tension = 0.5) {
  if (points.length < 3) return catmullRomPath(points, tension)
  const k = (1 - tension) / 6
  const n = points.length
  const cmd = [`M ${points[0][0]} ${points[0][1]}`]
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) * k
    const c1y = p1[1] + (p2[1] - p0[1]) * k
    const c2x = p2[0] - (p3[0] - p1[0]) * k
    const c2y = p2[1] - (p3[1] - p1[1]) * k
    cmd.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`)
  }
  cmd.push('Z')
  return cmd.join(' ')
}

/* Superellipse boundary points: |x/a|^n + |y/b|^n = 1.
 * n=2 → ellipse; n→∞ → rectangle; n<1 → astroid-like (pinched).
 * Returns count points evenly around the boundary. */
export function superellipse(cx, cy, a, b, n = 2, count = 64) {
  const pts = []
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * TAU
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    const x = cx + Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * a
    const y = cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * b
    pts.push([x, y])
  }
  return pts
}

/* Sample a polyline at evenly-spaced arc lengths. */
export function resampleEven(points, count) {
  if (points.length < 2 || count < 2) return points.slice()
  const lens = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    lens.push(lens[i - 1] + Math.hypot(dx, dy))
  }
  const total = lens[lens.length - 1]
  if (total === 0) return points.slice()
  const out = []
  let j = 1
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total
    while (j < lens.length - 1 && lens[j] < target) j++
    const t = (target - lens[j - 1]) / (lens[j] - lens[j - 1] || 1)
    out.push([
      lerp(points[j - 1][0], points[j][0], t),
      lerp(points[j - 1][1], points[j][1], t),
    ])
  }
  return out
}

/* Normal at index i of a polyline (perpendicular unit vector). */
export function normalAt(points, i) {
  const n = points.length
  const a = points[(i - 1 + n) % n]
  const b = points[(i + 1) % n]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [-dy / len, dx / len]
}

export function polylineToPath(points, closed = false) {
  if (!points.length) return ''
  const cmd = [`M ${points[0][0]} ${points[0][1]}`]
  for (let i = 1; i < points.length; i++) {
    cmd.push(`L ${points[i][0]} ${points[i][1]}`)
  }
  if (closed) cmd.push('Z')
  return cmd.join(' ')
}
