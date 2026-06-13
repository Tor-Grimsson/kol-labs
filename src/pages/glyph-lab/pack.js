













export function packCircles(
  sdf              ,
  w        ,
  h        ,
  opts          ,
)           {
  const { minR, maxR, radiusScale, padding, attempts, rng } = opts

  const sampleSDF = (x        , y        )         => {
    const ix = Math.max(0, Math.min(w - 1, Math.round(x)))
    const iy = Math.max(0, Math.min(h - 1, Math.round(y)))
    return sdf[iy * w + ix]
  }

  const cell = Math.max(minR, 2)
  const gw = Math.ceil(w / cell) + 1
  const gh = Math.ceil(h / cell) + 1
  const grid             = new Array(gw * gh)
  for (let i = 0; i < grid.length; i++) grid[i] = []

  const gi = (x        , y        )         => {
    const cx = Math.max(0, Math.min(gw - 1, Math.floor(x / cell)))
    const cy = Math.max(0, Math.min(gh - 1, Math.floor(y / cell)))
    return cy * gw + cx
  }

  const circles           = []

  const collides = (x        , y        , r        )          => {
    const cx = Math.floor(x / cell)
    const cy = Math.floor(y / cell)
    const reach = Math.max(1, Math.ceil((r + maxR) / cell))
    for (let j = -reach; j <= reach; j++) {
      const yy = cy + j
      if (yy < 0 || yy >= gh) continue
      for (let i = -reach; i <= reach; i++) {
        const xx = cx + i
        if (xx < 0 || xx >= gw) continue
        const bucket = grid[yy * gw + xx]
        for (let k = 0; k < bucket.length; k++) {
          const c = circles[bucket[k]]
          const dx = c.x - x
          const dy = c.y - y
          const sum = c.r + r + padding
          if (dx * dx + dy * dy < sum * sum) return true
        }
      }
    }
    return false
  }

  // Multi-pass greedy: large radii first, then medium, then small.
  // Each pass does dart-throwing but only accepts circles whose
  // natural SDF-derived radius falls within the pass band. This yields
  // the "big circles pack first, smaller fill gaps" look of the reference.
  const passes                     = [
    [maxR * 0.7, maxR],
    [maxR * 0.45, maxR * 0.7],
    [maxR * 0.25, maxR * 0.45],
    [minR, maxR * 0.25],
  ]

  for (const [lo, hi] of passes) {
    for (let i = 0; i < attempts; i++) {
      const x = rng() * w
      const y = rng() * h
      const sdfVal = sampleSDF(x, y)
      if (sdfVal >= 0) continue
      const maxPossible = Math.min(maxR, -sdfVal * radiusScale - padding)
      if (maxPossible < lo) continue
      const r = Math.min(maxPossible, hi)
      if (r < minR) continue
      if (collides(x, y, r)) continue
      const idx = circles.length
      circles.push({ x, y, r })
      grid[gi(x, y)].push(idx)
    }
  }

  return circles
}

export function computeEdges(circles          , tolerance = 4)         {
  const edges         = []
  const n = circles.length
  for (let i = 0; i < n; i++) {
    const a = circles[i]
    for (let j = i + 1; j < n; j++) {
      const b = circles[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d2 = dx * dx + dy * dy
      const sum = a.r + b.r + tolerance
      if (d2 < sum * sum) edges.push({ a: i, b: j })
    }
  }
  return edges
}
