// Trace SDF=0 iso-contour by sub-pixel sign crossings, then decimate to roughly uniform spacing.
// Simpler than full marching squares; good enough for the dotted-outline look.



export function traceOutline(
  sdf              ,
  w        ,
  h        ,
  spacing        ,
)          {
  const raw          = []

  // horizontal sign crossings
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = sdf[y * w + x]
      const b = sdf[y * w + (x + 1)]
      if ((a < 0) !== (b < 0)) {
        const t = a / (a - b)
        raw.push([x + t, y])
      }
    }
  }
  // vertical sign crossings
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      const a = sdf[y * w + x]
      const b = sdf[(y + 1) * w + x]
      if ((a < 0) !== (b < 0)) {
        const t = a / (a - b)
        raw.push([x, y + t])
      }
    }
  }

  // Spatial grid for O(1) decimation check
  const cell = spacing
  const gw = Math.ceil(w / cell) + 1
  const gh = Math.ceil(h / cell) + 1
  const grid            = new Array(gw * gh)
  for (let i = 0; i < grid.length; i++) grid[i] = []

  const sp2 = spacing * spacing
  const kept          = []
  for (const p of raw) {
    const cx = Math.floor(p[0] / cell)
    const cy = Math.floor(p[1] / cell)
    let ok = true
    for (let j = -1; j <= 1 && ok; j++) {
      for (let i = -1; i <= 1 && ok; i++) {
        const xx = cx + i, yy = cy + j
        if (xx < 0 || xx >= gw || yy < 0 || yy >= gh) continue
        const bucket = grid[yy * gw + xx]
        for (let k = 0; k < bucket.length; k++) {
          const q = bucket[k]
          const dx = p[0] - q[0], dy = p[1] - q[1]
          if (dx * dx + dy * dy < sp2) { ok = false; break }
        }
      }
    }
    if (ok) {
      kept.push(p)
      grid[cy * gw + cx].push(p)
    }
  }
  return kept
}
