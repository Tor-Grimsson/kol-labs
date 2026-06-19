// Procedural distorter maps for the Refraction page. Each paints an RG
// DISPLACEMENT MAP onto a small canvas: the R/G channels encode the signed x/y
// offset the refraction samples the photo at (128 = no offset). Pixi's
// DisplacementFilter reads exactly this; `depth` (the filter scale) sets the
// magnitude, these set the DIRECTION field + its surface character. Animated by
// `t` for the fluid look. Kept low-res — the field is smooth, pixi scales it up.

export const DISTORTERS = [
  { id: 'glass', label: 'Glass' },
  { id: 'ripple', label: 'Ripple' },
  { id: 'ice', label: 'Ice' },
  { id: 'mirror', label: 'Liquid' },
]

const AMP = 110 // how far R/G swing off the neutral 128

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x, y) {
  let v = 0, amp = 0.5, f = 1
  for (let o = 0; o < 4; o++) { v += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5 }
  return v
}

// Nearest-feature-point distance + cell id, for the ice facets.
function voronoi(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  let best = 9, cx = 0, cy = 0
  for (let gy = -1; gy <= 1; gy++) {
    for (let gx = -1; gx <= 1; gx++) {
      const px = xi + gx + hash2(xi + gx, yi + gy)
      const py = yi + gy + hash2(xi + gx + 41, yi + gy + 17)
      const dx = px - x, dy = py - y
      const dd = dx * dx + dy * dy
      if (dd < best) { best = dd; cx = px; cy = py }
    }
  }
  return { cx, cy }
}

export function paintDistorter(ctx, w, h, type, t, scale) {
  const img = ctx.createImageData(w, h)
  const d = img.data
  const f = 1 + scale * 6 // frequency from the Scale control
  for (let y = 0; y < h; y++) {
    const ny = y / h
    for (let x = 0; x < w; x++) {
      const nx = x / w
      let dx = 0, dy = 0
      if (type === 'ripple') {
        const ax = nx - 0.5, ay = ny - 0.5
        const r = Math.sqrt(ax * ax + ay * ay)
        const ang = Math.atan2(ay, ax)
        const wave = Math.sin(r * f * 8 - t * 2)
        dx = Math.cos(ang) * wave
        dy = Math.sin(ang) * wave
      } else if (type === 'ice') {
        // faceted: offset is constant per voronoi cell → sharp refraction edges
        const { cx, cy } = voronoi(nx * f * 3 + t * 0.15, ny * f * 3)
        dx = (hash2(Math.floor(cx), Math.floor(cy)) - 0.5) * 2
        dy = (hash2(Math.floor(cy), Math.floor(cx) + 7) - 0.5) * 2
      } else if (type === 'mirror') {
        // smooth flowing liquid metal — low-freq domain-warped fbm
        const wx = fbm(nx * f * 0.6 + t * 0.12, ny * f * 0.6)
        dx = Math.sin((wx + t * 0.1) * 6.283)
        dy = Math.cos((fbm(nx * f * 0.6, ny * f * 0.6 - t * 0.12) + t * 0.1) * 6.283)
      } else {
        // glass — two independent animated fbm fields (organic bumps)
        dx = fbm(nx * f + t * 0.12, ny * f) - 0.5
        dy = fbm(nx * f + 31.7, ny * f + t * 0.12) - 0.5
        dx *= 2; dy *= 2
      }
      const i = (y * w + x) << 2
      d[i] = 128 + dx * AMP
      d[i + 1] = 128 + dy * AMP
      d[i + 2] = 128
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}
