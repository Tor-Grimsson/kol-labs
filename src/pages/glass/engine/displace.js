// Glass — displacement-map filter. A procedural vector field offsets each output
// pixel's sample point into the source image, fracturing/refracting it like a
// sheet of patterned glass (a cross between kaleidoscope mirroring and a
// refractor). Pure Canvas2D, no deps. The field functions return a displacement
// vector in roughly [-1,1]; the page scales it by X/Y Shift (in pixels).

// ---- deterministic value noise (for the frosted "Glass" + shard patterns) ----
function hash2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}
const fade = (t) => t * t * (3 - 2 * t)
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  const u = fade(xf), v = fade(yf)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}
function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1
  for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5 }
  return s
}
// per-band signed offset, stable per index
const band = (i) => hash2(i, 7) * 2 - 1

// Each pattern: field(nx, ny, scale, t) -> [fx, fy]. nx,ny in [0,1]; scale grows
// frequency / band count; t is the (optional) animation clock — most are static.
export const PATTERNS = [
  // The hero: discrete vertical panes, each shifted independently (hard seams).
  { id: 'panes', label: 'Panes', field(nx, ny, s, t) {
    const n = Math.max(2, Math.round(3 + s * 6))
    const b = Math.floor(nx * n)
    const drift = t ? 0.25 * Math.sin(t + b) : 0
    return [band(b * 2) * 0.35, band(b * 2 + 1) + drift]
  } },
  // Horizontal version — strips shifted sideways.
  { id: 'bands', label: 'Bands', field(nx, ny, s, t) {
    const n = Math.max(2, Math.round(3 + s * 6))
    const b = Math.floor(ny * n)
    const drift = t ? 0.25 * Math.sin(t + b) : 0
    return [band(b * 2) + drift, band(b * 2 + 1) * 0.35]
  } },
  // Frosted glass — fbm gradient → smooth organic wobble.
  { id: 'glass', label: 'Glass', field(nx, ny, s, t) {
    const f = 2 + s * 3, e = 0.012, ph = t * 0.15
    const base = fbm(nx * f + ph, ny * f)
    const gx = fbm((nx + e) * f + ph, ny * f) - base
    const gy = fbm(nx * f + ph, (ny + e) * f) - base
    return [(gx / e) * 0.12, (gy / e) * 0.12]
  } },
  // Concentric refraction ripples from centre.
  { id: 'ripple', label: 'Ripple', field(nx, ny, s, t) {
    const dx = nx - 0.5, dy = ny - 0.5
    const r = Math.hypot(dx, dy) + 1e-4
    const w = Math.sin(r * (8 + s * 22) - t * 2)
    return [(dx / r) * w, (dy / r) * w]
  } },
  // Sinusoidal warp on both axes.
  { id: 'waves', label: 'Waves', field(nx, ny, s, t) {
    const f = 4 + s * 12
    return [Math.sin(ny * f + t), Math.sin(nx * f + t * 0.7)]
  } },
  // Diagonal slats.
  { id: 'diagonal', label: 'Diagonal', field(nx, ny, s) {
    const n = Math.max(2, Math.round(4 + s * 8))
    const o = band(Math.floor((nx + ny) * n))
    return [o * 0.7, o * 0.7]
  } },
  // Shattered cells (kaleidoscope shards) — coarse grid, per-cell offset.
  { id: 'shards', label: 'Shards', field(nx, ny, s) {
    const n = Math.max(2, Math.round(2 + s * 5))
    const cx = Math.floor(nx * n), cy = Math.floor(ny * n)
    return [band(cx * 31 + cy), band(cy * 31 + cx)]
  } },
  // Tile grid — row/column offsets stack into blocks.
  { id: 'grid', label: 'Grid', field(nx, ny, s) {
    const n = Math.max(2, Math.round(3 + s * 6))
    return [band(Math.floor(ny * n)), band(Math.floor(nx * n))]
  } },
  // Bulge lens — radial magnify toward centre.
  { id: 'lens', label: 'Lens', field(nx, ny, s) {
    const dx = nx - 0.5, dy = ny - 0.5
    const k = (0.5 - Math.hypot(dx, dy)) * (1 + s)
    return [dx * k * 2, dy * k * 2]
  } },
  // Swirl — tangential twist around centre.
  { id: 'swirl', label: 'Swirl', field(nx, ny, s, t) {
    const dx = nx - 0.5, dy = ny - 0.5
    const a = (0.5 - Math.hypot(dx, dy)) * (2 + s * 4) + t * 0.5
    return [-dy * a * 2, dx * a * 2]
  } },
]
export const PATTERN_OPTIONS = PATTERNS.map((p) => ({ value: p.id, label: p.label }))

// Cover-fit a source (w/h or video w/h) into a w×h frame.
function coverFit(sw, sh, w, h) {
  const k = Math.max(w / sw, h / sh)
  const dw = sw * k, dh = sh * k
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh }
}
// Edge handling for an out-of-bounds sample coordinate.
function edgeAt(v, n, mode) {
  if (v >= 0 && v < n) return v | 0
  if (mode === 'wrap') { let m = v % n; return (m < 0 ? m + n : m) | 0 }
  if (mode === 'mirror') {
    const p = n - 1, m = Math.abs(v) % (2 * p)
    return (m <= p ? m : 2 * p - m) | 0
  }
  return v < 0 ? 0 : n - 1 // clamp
}

// Render the displaced image into `canvas` (sized by the caller). `source` is any
// CanvasImageSource with width/height (img, video, or canvas).
// Core displacement pass: cover-fit `source` into a w×h ctx, then sample-displace.
// With chroma > 0 the R/G/B channels are sampled with slightly different offsets
// (glass dispersion along the displacement + a radial lens fringe) → chromatic
// aberration.
function displaceInto(ctx, w, h, source, params) {
  const { pattern = 'panes', xShift = 50, yShift = 0, scale = 1, mix = 100,
    edge = 'clamp', mirror = false, angle = 0, chroma = 0, panX = 0, panY = 0, time = 0 } = params
  const sw = source.width || source.videoWidth, sh = source.height || source.videoHeight
  const fit = coverFit(sw, sh, w, h)
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(source, fit.x, fit.y, fit.w, fit.h)
  const base = ctx.getImageData(0, 0, w, h)
  const sd = base.data
  const out = ctx.createImageData(w, h)
  const od = out.data

  const pat = PATTERNS.find((p) => p.id === pattern) || PATTERNS[0]
  const ax = (xShift / 100) * w * 0.25 // full shift ≈ quarter-frame
  const ay = (yShift / 100) * h * 0.25
  const m = mix / 100
  const rad = (angle * Math.PI) / 180
  const ca = Math.cos(rad), sa = Math.sin(rad)
  const cAmt = chroma / 100              // dispersion: per-channel displacement gain
  const cRad = (chroma / 100) * w * 0.02 // radial lens fringe (px)
  const hw = w / 2, hh = h / 2

  for (let y = 0; y < h; y++) {
    const ny = y / h
    for (let x = 0; x < w; x++) {
      // kaleidoscope fold: mirror the right half onto the left before sampling
      const fxBase = mirror && x >= w / 2 ? (w - 1 - x) : x
      // rotate sample-space into the field, then rotate the result back, so the
      // whole pattern (panes/bands/waves) turns with Angle. panX/panY scroll the
      // field (Frame motion) — the whole glass sheet slides.
      const cx = fxBase / w - 0.5 - panX, cy = ny - 0.5 - panY
      const v = pat.field(ca * cx + sa * cy + 0.5, -sa * cx + ca * cy + 0.5, scale, time)
      const dx = (ca * v[0] - sa * v[1]) * ax
      const dy = (sa * v[0] + ca * v[1]) * ay
      const di = (y * w + x) << 2

      if (chroma > 0) {
        const rx = (x - hw) / hw, ry = (y - hh) / hh // radial unit
        const rX = edgeAt(fxBase + dx * (1 + cAmt) + rx * cRad, w, edge)
        const rY = edgeAt(y + dy * (1 + cAmt) + ry * cRad, h, edge)
        const gX = edgeAt(fxBase + dx, w, edge), gY = edgeAt(y + dy, h, edge)
        const bX = edgeAt(fxBase + dx * (1 - cAmt) - rx * cRad, w, edge)
        const bY = edgeAt(y + dy * (1 - cAmt) - ry * cRad, h, edge)
        const r = sd[(rY * w + rX) << 2]
        const g = sd[((gY * w + gX) << 2) + 1]
        const b = sd[((bY * w + bX) << 2) + 2]
        if (m >= 1) { od[di] = r; od[di + 1] = g; od[di + 2] = b; od[di + 3] = 255 }
        else {
          od[di] = sd[di] * (1 - m) + r * m
          od[di + 1] = sd[di + 1] * (1 - m) + g * m
          od[di + 2] = sd[di + 2] * (1 - m) + b * m
          od[di + 3] = 255
        }
        continue
      }

      const si = (edgeAt(y + dy, h, edge) * w + edgeAt(fxBase + dx, w, edge)) << 2
      if (m >= 1) {
        od[di] = sd[si]; od[di + 1] = sd[si + 1]; od[di + 2] = sd[si + 2]; od[di + 3] = 255
      } else {
        od[di] = sd[di] * (1 - m) + sd[si] * m
        od[di + 1] = sd[di + 1] * (1 - m) + sd[si + 1] * m
        od[di + 2] = sd[di + 2] * (1 - m) + sd[si + 2] * m
        od[di + 3] = 255
      }
    }
  }
  ctx.putImageData(out, 0, 0)
}

// Reusable supersample buffer (single-threaded → safe to share across calls).
let _ssBuf = null
function ssBuffer(W, H) {
  if (!_ssBuf) _ssBuf = document.createElement('canvas')
  if (_ssBuf.width !== W) _ssBuf.width = W
  if (_ssBuf.height !== H) _ssBuf.height = H
  return _ssBuf
}

// Render the displaced image into `canvas`. `ss` supersamples (render ss× then
// box-downscale) to kill the stair-step aliasing on angled pane seams. ss=1 draws
// straight into the target (fast path for the live animation loop).
export function renderGlass(canvas, source, params) {
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!source) { ctx.clearRect(0, 0, w, h); return }
  const ss = Math.max(1, params.ss || 1)
  if (ss === 1) { displaceInto(ctx, w, h, source, params); return }
  const W = Math.round(w * ss), H = Math.round(h * ss)
  const buf = ssBuffer(W, H)
  displaceInto(buf.getContext('2d', { willReadFrequently: true }), W, H, source, params)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(buf, 0, 0, w, h)
}

// A synthetic source (gradient + ticks) so the pattern thumbnails read even
// before the user loads a photo. Returns a reusable offscreen canvas.
export function makePlaceholder(size = 120) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#f4f4f5'); grad.addColorStop(1, '#27272a')
  g.fillStyle = grad; g.fillRect(0, 0, size, size)
  g.strokeStyle = 'rgba(120,120,130,0.5)'
  g.lineWidth = 1
  for (let i = 0; i < size; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke() }
  g.fillStyle = 'rgba(0,0,0,0.35)'
  g.beginPath(); g.arc(size / 2, size / 2, size * 0.22, 0, Math.PI * 2); g.fill()
  return c
}

// ponytail: per-sample is nearest-neighbour; the seam aliasing is handled by
// supersampling (ss) + box-downscale, not bilinear. Add bilinear only if heavy
// lens/ripple magnification still looks soft at ss=1 during animation.
