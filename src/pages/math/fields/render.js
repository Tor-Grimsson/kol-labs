// Fields category — the two render kinds, lifted verbatim from the old FieldPage /
// ComplexPage so the consolidated shell draws bit-identically. Pure paint helpers;
// the editor owns the canvas/pan-zoom/rAF loop and the particle state.
//
//   kind 'scalar'  — f(x,y) heatmap (+ flow particles, advected in the editor loop)
//   kind 'complex' — domain coloring of f(z) (cached field, re-mapped per frame)

const toRGB = (h) => { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] }

// ── Scalar heatmap (Field) ──────────────────────────────────────────────────
export function paintHeat(ctx, w, h, st) {
  const { f, cx, cy, range, low, high } = st
  const vals = new Float64Array(w * h)
  let mn = Infinity
  let mx = -Infinity
  const aspect = h / w
  for (let py = 0; py < h; py++) {
    const y = cy - (py / h - 0.5) * range * aspect
    for (let px = 0; px < w; px++) {
      const x = cx + (px / w - 0.5) * range
      let v = f(x, y, 0)
      if (!Number.isFinite(v)) v = 0
      vals[py * w + px] = v
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
  }
  const span = (mx - mn) || 1
  const A = toRGB(low)
  const B = toRGB(high)
  const img = ctx.createImageData(w, h)
  const data = img.data
  for (let i = 0; i < w * h; i++) {
    const u = (vals[i] - mn) / span
    const idx = i * 4
    data[idx] = A[0] + (B[0] - A[0]) * u
    data[idx + 1] = A[1] + (B[1] - A[1]) * u
    data[idx + 2] = A[2] + (B[2] - A[2]) * u
    data[idx + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

// ── Complex domain coloring (Complex) ────────────────────────────────────────
function hsv(h, s, v) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: return [v, t, p]
    case 1: return [q, v, p]
    case 2: return [p, v, t]
    case 3: return [p, q, v]
    case 4: return [t, p, v]
    default: return [v, p, q]
  }
}

// Evaluate f(z) ONCE per pixel → cache arg + log2|f|; paintField re-maps cheaply.
export function computeField(w, h, { f, cx, cy, range }) {
  const n = w * h
  const arg = new Float32Array(n)
  const logmod = new Float32Array(n)
  const bad = new Uint8Array(n)
  const aspect = h / w
  for (let py = 0; py < h; py++) {
    const im = cy - (py / h - 0.5) * range * aspect
    const row = py * w
    for (let px = 0; px < w; px++) {
      const re = cx + (px / w - 0.5) * range
      const i = row + px
      let wr = 0
      let wi = 0
      try { const o = f([re, im]); wr = o[0]; wi = o[1] } catch { /* singular */ }
      if (!Number.isFinite(wr) || !Number.isFinite(wi)) { bad[i] = 1; continue }
      arg[i] = Math.atan2(wi, wr)
      logmod[i] = Math.log2(Math.hypot(wr, wi) + 1e-12)
    }
  }
  return { w, h, arg, logmod, bad }
}

export function paintField(ctx, field, { coloring = 'rings', huePhase = 0, ringPhase = 0, shade = 0 }) {
  const { w, h, arg, logmod, bad } = field
  const img = ctx.createImageData(w, h)
  const data = img.data
  const n = w * h
  const vScale = 1 - shade // Form · Shade: brightness breathe (0 = none)
  for (let i = 0; i < n; i++) {
    const idx = i * 4
    if (bad[i]) { data[idx] = data[idx + 1] = data[idx + 2] = 0; data[idx + 3] = 255; continue }
    const H = (((arg[i] / (Math.PI * 2)) + 1 + huePhase) % 1 + 1) % 1
    let V = 1
    if (coloring === 'smooth') {
      const mod = Math.pow(2, logmod[i])
      V = 0.35 + 0.65 * (2 / Math.PI) * Math.atan(mod)
    } else {
      const k = logmod[i] + ringPhase
      V = 0.55 + 0.45 * (k - Math.floor(k))
      if (coloring === 'contour') {
        const a2 = (arg[i] + huePhase * Math.PI * 2) / (Math.PI / 6)
        V *= 0.4 + 0.6 * Math.min(1, Math.abs(a2 - Math.round(a2)) * 6)
      }
    }
    const [r, g, b] = hsv(H, 1, V * vScale)
    data[idx] = r * 255
    data[idx + 1] = g * 255
    data[idx + 2] = b * 255
    data[idx + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

// Minimal complex arithmetic (z = [re, im]) — the curated f(z) maps reference it.
export const C = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1] || 1e-12; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d] },
  exp: (a) => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])] },
  sin: (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])],
  sq: (a) => C.mul(a, a),
  cube: (a) => C.mul(C.mul(a, a), a),
}

export const COMPLEX_FUNCS = [
  { id: 'z2-1', label: 'z² − 1', f: (z) => C.sub(C.sq(z), [1, 0]) },
  { id: 'z3-1', label: 'z³ − 1', f: (z) => C.sub(C.cube(z), [1, 0]) },
  { id: 'inv', label: '1 / z', f: (z) => C.div([1, 0], z) },
  { id: 'rat', label: '(z²−1)/(z²+1)', f: (z) => { const z2 = C.sq(z); return C.div(C.sub(z2, [1, 0]), C.add(z2, [1, 0])) } },
  { id: 'zinv', label: 'z + 1/z', f: (z) => C.add(z, C.div([1, 0], z)) },
  { id: 'sin', label: 'sin z', f: (z) => C.sin(z) },
  { id: 'exp', label: 'eᶻ', f: (z) => C.exp(z) },
  { id: 'poly5', label: 'z⁵ + z − 1', f: (z) => { const z2 = C.sq(z); const z5 = C.mul(C.sq(z2), z); return C.sub(C.add(z5, z), [1, 0]) } },
]
export const complexFn = (id) => (COMPLEX_FUNCS.find((f) => f.id === id) || COMPLEX_FUNCS[0]).f
