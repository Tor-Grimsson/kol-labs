

// 8x8 Bayer threshold matrix (values 0-63, scaled to 0-1)
export const BAYER8             = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

export function bayer(x        , y        )         {
  return BAYER8[y & 7][x & 7] / 64
}

export function dither(gray        , x        , y        )        {
  return gray > bayer(x, y) ? 1 : 0
}

// configure a p5 instance for crisp pixel art: no smoothing on canvas or context
export function pixelate(p    )       {
  p.noSmooth()
  const c = (p                                            ).canvas
  if (c && c.style) {
    c.style.imageRendering = 'pixelated'
    c.style.width = '100%'
    c.style.height = '100%'
  }
  const ctx = c?.getContext('2d')
  if (ctx) ctx.imageSmoothingEnabled = false
}

// Linear map with clamp
export function lmap(v        , a        , b        , c        , d        )         {
  const t = (v - a) / (b - a)
  const k = Math.max(0, Math.min(1, t))
  return c + (d - c) * k
}

// Hash-based pseudo-noise driven by integer coords + time
export function nz(x        , y        )         {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
