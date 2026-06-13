import { Delaunay } from 'd3-delaunay'

import { clear, strokeOutline, wrapLoop } from './common'







// Variable-radius Poisson-disc (multi-pass greedy) + Lloyd relaxation (continuous).
// Repo: kchapelier/fast-2d-poisson-disk-sampling (Bridson) + d3/d3-delaunay (Voronoi).
export const packingLloyd            = {
  id: '01-packing-lloyd',
  name: 'PACKING + LLOYD',
  repo: 'd3-delaunay · Bridson PDS',
  summary:
    'Variable-radius Poisson-disc pack (SDF-scaled radii) settled by Lloyd relaxation. Each frame: Voronoi → move each circle to its cell centroid. Blue-noise → centroidal Voronoi tessellation. Re-usable as the base "packed" layer.',
  helps:
    'The backbone base layer — recreates the Squishy Type reference directly. Matches the ref aesthetic 1:1.',
  init({ ctx, sdf, W, H, rng }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const minR = 6, maxR = 44, radiusScale = 0.85, padding = 2, attempts = 6000

    // Pack via multi-pass greedy dart-throwing into SDF-constrained space
    const cells         = []
    const cell = Math.max(minR, 2)
    const gw = Math.ceil(sdf.w / cell) + 1
    const gh = Math.ceil(sdf.h / cell) + 1
    const grid             = new Array(gw * gh)
    for (let i = 0; i < grid.length; i++) grid[i] = []
    const gi = (x        , y        ) =>
      Math.max(0, Math.min(gh - 1, Math.floor(y / cell))) * gw +
      Math.max(0, Math.min(gw - 1, Math.floor(x / cell)))

    const collides = (x        , y        , r        )          => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell)
      const reach = Math.max(1, Math.ceil((r + maxR) / cell))
      for (let j = -reach; j <= reach; j++) {
        const yy = cy + j
        if (yy < 0 || yy >= gh) continue
        for (let i = -reach; i <= reach; i++) {
          const xx = cx + i
          if (xx < 0 || xx >= gw) continue
          const bucket = grid[yy * gw + xx]
          for (let k = 0; k < bucket.length; k++) {
            const c = cells[bucket[k]]
            const dx = c.x - x, dy = c.y - y
            const s = c.r + r + padding
            if (dx * dx + dy * dy < s * s) return true
          }
        }
      }
      return false
    }

    const bands                     = [
      [maxR * 0.7, maxR],
      [maxR * 0.45, maxR * 0.7],
      [maxR * 0.25, maxR * 0.45],
      [minR, maxR * 0.25],
    ]
    for (const [lo, hi] of bands) {
      for (let i = 0; i < attempts; i++) {
        const x = rng() * sdf.w
        const y = rng() * sdf.h
        const s = sdf.sample(x, y)
        if (s >= 0) continue
        const maxPoss = Math.min(maxR, -s * radiusScale - padding)
        if (maxPoss < lo) continue
        const r = Math.min(maxPoss, hi)
        if (r < minR || collides(x, y, r)) continue
        const idx = cells.length
        cells.push({ x, y, r })
        grid[gi(x, y)].push(idx)
      }
    }

    const relaxStrength = 0.18

    return wrapLoop(() => {
      // Lloyd step: move each circle toward its Voronoi-cell centroid (clamped by SDF).
      const pts = cells.map((c) => [c.x, c.y]                    )
      const delaunay = Delaunay.from(pts)
      const voronoi = delaunay.voronoi([0, 0, sdf.w, sdf.h])
      for (let i = 0; i < cells.length; i++) {
        const poly = voronoi.cellPolygon(i)
        if (!poly) continue
        let cx = 0, cy = 0, area = 0
        for (let k = 0; k < poly.length - 1; k++) {
          const [x0, y0] = poly[k]
          const [x1, y1] = poly[k + 1]
          const cross = x0 * y1 - x1 * y0
          area += cross
          cx += (x0 + x1) * cross
          cy += (y0 + y1) * cross
        }
        area *= 0.5
        if (Math.abs(area) < 1e-6) continue
        cx /= 6 * area
        cy /= 6 * area
        const nx = cells[i].x + (cx - cells[i].x) * relaxStrength
        const ny = cells[i].y + (cy - cells[i].y) * relaxStrength
        if (sdf.sample(nx, ny) < -cells[i].r * 0.2) {
          cells[i].x = nx
          cells[i].y = ny
        }
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.22)', 1)

      // spokes
      ctx.strokeStyle = 'rgba(170, 174, 220, 0.25)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      const spokeCount = 22
      for (const c of cells) {
        for (let i = 0; i < spokeCount; i++) {
          const t = (i / spokeCount) * Math.PI * 2
          ctx.moveTo(c.x * sx, c.y * sy)
          ctx.lineTo((c.x + Math.cos(t) * c.r) * sx, (c.y + Math.sin(t) * c.r) * sy)
        }
      }
      ctx.stroke()

      // edges between touching cells (approx via Voronoi neighbors + dist check)
      ctx.strokeStyle = 'rgba(210, 215, 235, 0.4)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      const visited = new Set        ()
      for (let i = 0; i < cells.length; i++) {
        for (const j of voronoi.neighbors(i)) {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`
          if (visited.has(key)) continue
          visited.add(key)
          const a = cells[i], b = cells[j]
          const dx = a.x - b.x, dy = a.y - b.y
          if (dx * dx + dy * dy < (a.r + b.r + 10) ** 2) {
            ctx.moveTo(a.x * sx, a.y * sy)
            ctx.lineTo(b.x * sx, b.y * sy)
          }
        }
      }
      ctx.stroke()

      // boundary dots (per spoke endpoint)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#8b8fd6'
      ctx.lineWidth = 1
      for (const c of cells) {
        for (let i = 0; i < spokeCount; i++) {
          const t = (i / spokeCount) * Math.PI * 2
          const bx = (c.x + Math.cos(t) * c.r) * sx
          const by = (c.y + Math.sin(t) * c.r) * sy
          ctx.beginPath()
          ctx.arc(bx, by, 1.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }

      // centers
      ctx.fillStyle = '#f3c9c4'
      for (const c of cells) {
        ctx.beginPath()
        ctx.arc(c.x * sx, c.y * sy, 2.4, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
