

import { Delaunay } from 'd3-delaunay'
import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common'

const PARAMS          = [
  { key: 'N',        type: 'int',   min: 30,  max: 250, default: 90,  step: 10,   label: 'sites' },
  { key: 'waveFreq', type: 'range', min: 0.1, max: 2,   default: 0.5, step: 0.05, label: 'wave freq' },
  { key: 'waveAmp',  type: 'range', min: 0,   max: 1,   default: 0.7, step: 0.05, label: 'wave amp' },
  { key: 'relax',    type: 'range', min: 0,   max: 1,   default: 0.2, step: 0.02, label: 'Lloyd strength' },
  { key: 'drawCells', type: 'boolean', default: true, label: 'show cells' },
]

// Smooth value-noise hash for density field (no external deps)
function hash21(x        , y        )         {
  // simple deterministic hash to [0,1]
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  n -= Math.floor(n)
  return n
}

function smoothNoise(x        , y        )         {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  return (
    hash21(ix,   iy)   * (1-ux) * (1-uy) +
    hash21(ix+1, iy)   * ux     * (1-uy) +
    hash21(ix,   iy+1) * (1-ux) * uy     +
    hash21(ix+1, iy+1) * ux     * uy
  )
}

function fbm(x        , y        , octaves = 3)         {
  let v = 0, amp = 0.5, freq = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    v    += smoothNoise(x * freq, y * freq) * amp
    norm += amp
    amp  *= 0.5
    freq *= 2.1
  }
  return v / norm
}

// CVT with time-varying Perlin-style density field. Lloyd iteration moves each
// site toward the density-weighted centroid of its Voronoi cell. With a
// static SDF density the system would converge; the animated noise field
// prevents convergence — sites perpetually reorganise, chasing a moving target.
export const r2_geom_05_cvt_density            = {
  id: 'r2-geom-05-cvt-density',
  name: 'CVT ANIMATED DENSITY',
  repo: 'd3-delaunay · Lloyd + noise density',
  summary: 'Centroidal Voronoi Tessellation where the density field ρ(x,y,t) sweeps with animated Perlin-style noise. Sites chase density peaks — never converging, producing fluid collective drift inside the glyph.',
  helps: 'Distinct from vanilla Lloyd: the density field drives continuous site reorganisation. Cells cluster in density waves, then scatter.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    let N = num(params, 'N', 90)
    let sites                     = []

    const reseed = () => {
      N = num(params, 'N', 90)
      sites = []
      for (let i = 0; i < N; i++) sites.push(sampleInside(sdf, rng))
    }
    reseed()

    // Monte-Carlo centroid samples per cell
    const MC = 12
    const scl = 1 / sdf.w  // normalise coords for noise

    const density = (x        , y        , t        , amp        , freq        )         => {
      if (sdf.sample(x, y) >= 0) return 0
      const base  = Math.max(0, -sdf.sample(x, y)) / 40  // SDF-based base density
      const noise = fbm(x * scl * freq * 4 + t * 0.3, y * scl * freq * 4 + t * 0.2)
      return base + amp * noise
    }

    return wrapLoop(() => {
      const t       = clock.nowSeconds()
      const freq    = num(params, 'waveFreq', 0.5)
      const amp     = num(params, 'waveAmp', 0.7)
      const relax   = num(params, 'relax', 0.2)
      const drawC   = params['drawCells']

      // Lloyd step with density-weighted centroid via Monte Carlo
      const pts = Float64Array.from(sites.flat())
      const del = new Delaunay(pts)
      const vor = del.voronoi([0, 0, sdf.w, sdf.h])

      for (let i = 0; i < N; i++) {
        const poly = vor.cellPolygon(i)
        if (!poly || poly.length < 3) continue

        // Bounding box of cell
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const [px, py] of poly) {
          if (px < minX) minX = px; if (px > maxX) maxX = px
          if (py < minY) minY = py; if (py > maxY) maxY = py
        }

        let wx = 0, wy = 0, wSum = 0
        for (let m = 0; m < MC; m++) {
          const sx2 = minX + rng() * (maxX - minX)
          const sy2 = minY + rng() * (maxY - minY)
          // Point-in-polygon (ray-casting)
          let inside = false
          for (let k = 0, j = poly.length - 1; k < poly.length; j = k++) {
            const [xi, yi] = poly[k], [xj, yj] = poly[j]
            if ((yi > sy2) !== (yj > sy2) && sx2 < ((xj - xi) * (sy2 - yi)) / (yj - yi) + xi) inside = !inside
          }
          if (!inside) continue
          const w = density(sx2, sy2, t, amp, freq)
          wx += sx2 * w; wy += sy2 * w; wSum += w
        }
        if (wSum < 1e-9) continue
        const tx = wx / wSum, ty = wy / wSum
        const nx = sites[i][0] + (tx - sites[i][0]) * relax
        const ny = sites[i][1] + (ty - sites[i][1]) * relax
        if (sdf.sample(nx, ny) < 0) { sites[i][0] = nx; sites[i][1] = ny }
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      if (drawC) {
        for (let i = 0; i < N; i++) {
          const poly = vor.cellPolygon(i)
          if (!poly || poly.length < 3) continue
          const [cx, cy] = sites[i]
          const d = density(cx, cy, t, amp, freq)
          const a = 0.08 + Math.min(0.5, d * 0.4)
          ctx.beginPath()
          ctx.moveTo(poly[0][0] * sx, poly[0][1] * sy)
          for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k][0] * sx, poly[k][1] * sy)
          ctx.closePath()
          ctx.strokeStyle = `rgba(150,185,255,${(a * 1.4).toFixed(2)})`
          ctx.lineWidth = 0.7
          ctx.stroke()
          ctx.fillStyle = `rgba(100,130,210,${a.toFixed(2)})`
          ctx.fill()
        }
      }

      // Sites coloured by local density
      for (let i = 0; i < N; i++) {
        const [x, y] = sites[i]
        if (sdf.sample(x, y) >= 0) continue
        const d = density(x, y, t, amp, freq)
        const brightness = Math.round(160 + d * 80)
        ctx.beginPath()
        ctx.arc(x * sx, y * sy, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${brightness},${brightness - 20},180)`
        ctx.fill()
      }
    })
  },
}
