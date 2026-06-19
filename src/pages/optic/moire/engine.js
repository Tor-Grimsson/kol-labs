// Moiré / interference engine — two (optionally three) overlapping grids
// (lines / concentric / radial), each with its own frequency, rotation and
// animated phase, combined by a superposition mode → interference fringes. The
// ml_phæno / bustave B&W op-art look, plus duotone. Canvas2D per-pixel.

const TAU = Math.PI * 2
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

export const GRID_OPTIONS = [
  { value: 'lines', label: 'Lines' },
  { value: 'concentric', label: 'Concentric' },
  { value: 'radial', label: 'Radial' },
]
export const COMBINE_OPTIONS = [
  { value: 'xor', label: 'Interfere (XOR)' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'add', label: 'Add' },
  { value: 'screen', label: 'Screen' },
]
export const MOIRE_PALETTES = [
  { value: 'bw', label: 'Black / White', cols: ['#000000', '#ffffff'] },
  { value: 'blood', label: 'Blood', cols: ['#0a0000', '#ff2d2d'] },
  { value: 'cyan', label: 'Cyan', cols: ['#001014', '#2ec4b6'] },
  { value: 'gold', label: 'Gold', cols: ['#0a0a00', '#ffd23f'] },
]

function gridVal(g, nx, ny, t) {
  const cx = nx - 0.5
  const cy = ny - 0.5
  const a = (g.angle * Math.PI) / 180
  const ph = t * g.speed
  if (g.type === 'concentric') {
    const r = Math.sqrt(cx * cx + cy * cy)
    return 0.5 + 0.5 * Math.sin(r * g.freq * 28 + ph * TAU)
  }
  if (g.type === 'radial') {
    const ang = Math.atan2(cy, cx)
    return 0.5 + 0.5 * Math.sin(ang * Math.round(g.freq) * 2 + ph * TAU)
  }
  // lines (rotated)
  const u = nx * Math.cos(a) + ny * Math.sin(a)
  return 0.5 + 0.5 * Math.sin(u * g.freq * 40 + ph * TAU)
}

function combine(mode, a, b) {
  switch (mode) {
    case 'multiply': return a * b
    case 'add': return (a + b) * 0.5
    case 'screen': return 1 - (1 - a) * (1 - b)
    case 'xor':
    default: return Math.abs(a - b)
  }
}

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function renderMoire(canvas, params, t) {
  const { grids, combine: mode, palette, invert, hardness } = params
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const img = ctx.createImageData(w, h)
  const d = img.data

  const pal = (MOIRE_PALETTES.find((p) => p.value === palette) || MOIRE_PALETTES[0]).cols.map(rgb)
  const c0 = pal[0]
  const c1 = pal[1]
  const active = grids.filter((g) => g.enabled)
  const edge = 0.5 - hardness * 0.49 // hardness → crisp threshold via smoothstep band

  for (let y = 0; y < h; y++) {
    const ny = y / h
    for (let x = 0; x < w; x++) {
      const nx = x / w
      let v = active.length ? gridVal(active[0], nx, ny, t) : 0.5
      for (let k = 1; k < active.length; k++) v = combine(mode, v, gridVal(active[k], nx, ny, t))
      // hardness: push toward 0/1 around the midpoint
      const lo = edge, hi = 1 - edge
      v = lo === hi ? (v < 0.5 ? 0 : 1) : clamp01((v - lo) / (hi - lo))
      if (invert) v = 1 - v
      const i = (y * w + x) << 2
      d[i] = c0[0] + (c1[0] - c0[0]) * v
      d[i + 1] = c0[1] + (c1[1] - c0[1]) * v
      d[i + 2] = c0[2] + (c1[2] - c0[2]) * v
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}
