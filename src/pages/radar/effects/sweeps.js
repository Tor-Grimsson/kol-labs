/**
 * Sweep fields — a time-driven scalar field f(nx, ny, t) → 0..1 that gives a
 * static image "life" by sweeping a moving wavefront across the dither/ascii
 * pattern. Each sweep picks a SHAPE (how the wavefront moves) and a TARGET
 * (what the scalar modulates: brightness fed into the existing modes, cell
 * geometry, or a reveal mask). Sweeps compound — stack several and they
 * combine. Shared by ditherEngine + asciiEngine; same time contract as video.
 */

export const SWEEP_SHAPE_OPTIONS = [
  { value: 'linear', label: 'Linear Bar' },
  { value: 'radial', label: 'Radial Pulse' },
  { value: 'wave', label: 'Traveling Wave' },
  { value: 'angular', label: 'Radar Sweep' },
  { value: 'noise', label: 'Noise Drift' },
]

export const SWEEP_TARGET_OPTIONS = [
  { value: 'brightness', label: 'Brightness' },
  { value: 'geometry', label: 'Geometry' },
  { value: 'reveal', label: 'Reveal' },
]

/* A fresh sweep with sane defaults (brightness band drifting left→right). */
export function makeSweep(shape = 'linear') {
  return {
    shape,
    target: 'brightness',
    enabled: true,
    amount: 0.6, // strength applied to the chosen target (brightness/geometry)
    speed: 0.3, // wavefront cycles per second; negative reverses direction
    width: 0.35, // band thickness (0..1) / wavelength for the wave shape
    angle: 0, // travel direction in degrees (linear/wave/angular)
    centerX: 0.5,
    centerY: 0.5,
  }
}

const TAU = Math.PI * 2
const wrap01 = (x) => x - Math.floor(x)

/* Raised falloff: 1 at the band centre, smoothly → 0 at half-width `w`. */
function band(dist, w) {
  if (w <= 0) return 0
  const t = Math.min(1, dist / w)
  return 1 - t * t * (3 - 2 * t)
}

/* Value noise (hash-lattice, smooth-interpolated) → 0..1. */
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

/* One sweep's wavefront value at a normalized cell (nx,ny in 0..1) at time t. */
export function sampleSweep(sw, nx, ny, t) {
  const a = (sw.angle || 0) * (Math.PI / 180)
  const cos = Math.cos(a), sin = Math.sin(a)
  const cx = sw.centerX ?? 0.5
  const cy = sw.centerY ?? 0.5
  const pos = wrap01(t * (sw.speed || 0))
  const halfW = Math.max(0.01, (sw.width || 0.35) * 0.5)

  switch (sw.shape) {
    case 'radial': {
      const dx = nx - cx, dy = ny - cy
      const u = wrap01(Math.sqrt(dx * dx + dy * dy) / 0.7071)
      const d = Math.abs(u - pos)
      return band(Math.min(d, 1 - d), halfW)
    }
    case 'wave': {
      const u = (nx - 0.5) * cos + (ny - 0.5) * sin
      const freq = 1 + (1 - (sw.width || 0.35)) * 8 // narrower → more stripes
      return 0.5 + 0.5 * Math.sin((u * freq - t * (sw.speed || 0)) * TAU)
    }
    case 'angular': {
      const ang = wrap01(Math.atan2(ny - cy, nx - cx) / TAU)
      const d = Math.abs(ang - pos)
      return band(Math.min(d, 1 - d), halfW)
    }
    case 'noise': {
      const sc = 2 + (1 - (sw.width || 0.35)) * 8
      return vnoise(nx * sc + t * (sw.speed || 0), ny * sc - t * (sw.speed || 0) * 0.5)
    }
    case 'linear':
    default: {
      const u = wrap01(0.5 + (nx - 0.5) * cos + (ny - 0.5) * sin)
      const d = Math.abs(u - pos)
      return band(Math.min(d, 1 - d), halfW)
    }
  }
}

/* True if any enabled sweep targets reveal — drives the raw-image underlay. */
export const hasRevealSweep = (sweeps) =>
  Array.isArray(sweeps) && sweeps.some((s) => s.enabled && s.target === 'reveal')

/* Reused scratch — evaluated per cell, consumed synchronously by the engine. */
const _acc = { bright: 0, scaleMul: 1, offX: 0, offY: 0, rot: 0, hasReveal: false, reveal: 0 }

/**
 * Combine every enabled sweep at one cell into a single modulation packet.
 * brightness → additive luma delta; geometry → scale/displace/rotate the cell;
 * reveal → max-blended mask (engine gates the cell when reveal < 0.5).
 * Returns a shared scratch object — read it before the next call.
 */
export function evalSweeps(sweeps, nx, ny, t) {
  _acc.bright = 0; _acc.scaleMul = 1; _acc.offX = 0; _acc.offY = 0
  _acc.rot = 0; _acc.hasReveal = false; _acc.reveal = 0
  for (let i = 0; i < sweeps.length; i++) {
    const sw = sweeps[i]
    if (!sw.enabled) continue
    const s = sampleSweep(sw, nx, ny, t)
    if (sw.target === 'reveal') {
      _acc.hasReveal = true
      if (s > _acc.reveal) _acc.reveal = s
    } else if (sw.target === 'geometry') {
      const k = s * (sw.amount || 0)
      const a = (sw.angle || 0) * (Math.PI / 180)
      _acc.scaleMul *= 1 + k
      _acc.offX += Math.cos(a) * k
      _acc.offY += Math.sin(a) * k
      _acc.rot += k
    } else {
      _acc.bright += s * (sw.amount || 0)
    }
  }
  return _acc
}
