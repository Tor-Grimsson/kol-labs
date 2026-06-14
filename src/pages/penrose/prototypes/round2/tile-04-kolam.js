

import { num } from '../../knobs'
import { clear, strokeOutline, wrapLoop } from '../common'

// Kolam / Sona mirror-curve path tracing.
// Grid of dots; mirror at each cell (/ or \); trace Eulerian closed loop.
// Animate: path draw-on (progressive trace at constant speed), slow grid warp.

const PARAMS          = [
  { key: 'gridN', type: 'int', min: 4, max: 20, default: 11, label: 'grid N (odd for 1 loop)' },
  { key: 'drawSpeed', type: 'range', min: 0.05, max: 2, default: 0.4, step: 0.05, label: 'draw speed' },
  { key: 'warp', type: 'range', min: 0, max: 1, default: 0.2, step: 0.05, label: 'grid warp' },
  { key: 'strokeW', type: 'range', min: 0.5, max: 5, default: 2, step: 0.5, label: 'stroke width' },
]

// Trace the kolam path on an m×n mirror grid.
// Mirror at cell (i,j): 0 = '\', 1 = '/'
// Path enters a cell from one of 4 edge midpoints, reflects, exits.
// Returns array of [x,y] waypoints in fractional grid coords.
function traceKolam(mirrors            , m        , n        )                     {
  // Edge encoding: 0=top,1=right,2=bottom,3=left of cell (i,j)
  // visited[i][j][e] = true if edge e of cell (i,j) was used
  const visited = new Uint8Array(m * n * 4)
  const path                     = []

  // Find first unvisited entry edge
  function firstFree()                                  {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < m; i++) {
        for (let e = 0; e < 4; e++) {
          if (!visited[(j * m + i) * 4 + e]) return [i, j, e]
        }
      }
    }
    return null
  }

  // Edge midpoint in grid coords (0..m, 0..n)
  function edgeMid(i        , j        , e        )                   {
    if (e === 0) return [i + 0.5, j]
    if (e === 1) return [i + 1, j + 0.5]
    if (e === 2) return [i + 0.5, j + 1]
    return [i, j + 0.5]
  }

  // Given entry edge, compute exit edge based on mirror type
  function exitEdge(i        , j        , entry        , mirrorType        )         {
    // mirrorType 0 = '\': top<->left, right<->bottom
    // mirrorType 1 = '/': top<->right, left<->bottom
    const pairs0                     = [[0, 3], [1, 2]]
    const pairs1                     = [[0, 1], [2, 3]]
    const pairs = mirrorType === 0 ? pairs0 : pairs1
    for (const [a, b] of pairs) {
      if (entry === a) return b
      if (entry === b) return a
    }
    return (entry + 2) % 4
  }

  // Neighbor cell across edge e from (i,j)
  function neighbor(i        , j        , e        )                           {
    // Returns neighbor cell and which edge of it we enter from
    if (e === 0) return [i, j - 1, 2]
    if (e === 1) return [i + 1, j, 3]
    if (e === 2) return [i, j + 1, 0]
    return [i - 1, j, 1]
  }

  let start = firstFree()
  while (start) {
    let [i, j, e] = start
    const loopStart = edgeMid(i, j, e)
    path.push(loopStart)
    let steps = 0
    do {
      visited[(j * m + i) * 4 + e] = 1
      path.push(edgeMid(i, j, e))
      const mType = mirrors[j * m + i]
      const exitE = exitEdge(i, j, e, mType)
      visited[(j * m + i) * 4 + exitE] = 1
      path.push(edgeMid(i, j, exitE))
      // Move to neighbor
      const [ni, nj, ne] = neighbor(i, j, exitE)
      if (ni < 0 || ni >= m || nj < 0 || nj >= n) break
      i = ni; j = nj; e = ne
      steps++
      if (steps > m * n * 8) break
    } while (!(i === start[0] && j === start[1] && e === start[2]))
    path.push(loopStart)
    path.push([NaN, NaN]) // separator
    start = firstFree()
  }
  return path
}

export const r2_tile_04_kolam            = {
  id: 'r2-tile-04-kolam',
  name: 'KOLAM MIRROR CURVE',
  repo: 'South Indian kolam tradition; Bridges 2009 Chavey',
  summary: 'Eulerian mirror-curve path on a dot lattice traced progressively inside the glyph; single closed loop for odd-dimension grids, with slow grid warp from noise.',
  helps: 'Continuous-curve fill maximally different from polygon tilings — biomorphic, almost calligraphic; the draw-on animation is hypnotic inside an SDF-masked letterform.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    let cachedPath                     = []
    let cachedN = 0
    let cachedSeed = 0
    let pathLength = 0

    function rebuildPath(gridN        ) {
      const mirrors = new Uint8Array(gridN * gridN)
      for (let i = 0; i < gridN * gridN; i++) mirrors[i] = rng() < 0.5 ? 0 : 1
      cachedPath = traceKolam(mirrors, gridN, gridN)
      cachedN = gridN
      pathLength = cachedPath.filter(p => !isNaN(p[0])).length
    }

    rebuildPath(num(params, 'gridN', 11))

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const gridN = Math.max(2, Math.round(num(params, 'gridN', 11)))
      const speed = num(params, 'drawSpeed', 0.4)
      const warpAmt = num(params, 'warp', 0.2)
      const sw = num(params, 'strokeW', 2)

      if (gridN !== cachedN) {
        cachedSeed++
        rebuildPath(gridN)
      }

      clear(ctx, W, H)

      // Grid bounds inside glyph — fit to central 80% of canvas
      const margin = W * 0.12
      const gx0 = margin, gy0 = margin
      const gw = W - margin * 2, gh = H - margin * 2
      const cellW = gw / gridN, cellH = gh / gridN

      // How far along the path to draw
      const totalPts = cachedPath.length
      const drawFrac = ((t * speed) % 1.3) / 1.3 // 0..1 with slight pause at end
      const drawUpto = Math.floor(Math.min(drawFrac * 1.05, 1) * totalPts)

      ctx.strokeStyle = 'rgba(220,200,140,0.85)'
      ctx.lineWidth = sw
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      ctx.beginPath()
      let penDown = false
      for (let pi = 0; pi < drawUpto && pi < totalPts; pi++) {
        const [gfx, gfy] = cachedPath[pi]
        if (isNaN(gfx)) { penDown = false; continue }

        // Map grid coords → canvas
        const bx = gx0 + gfx * cellW
        const by = gy0 + gfy * cellH

        // Warp with slow noise
        const wx = bx + warpAmt * 18 * Math.sin(bx * 0.03 + t * 0.25)
        const wy = by + warpAmt * 18 * Math.cos(by * 0.03 + t * 0.19)

        // SDF gate
        const sx = (wx / W) * sdf.w
        const sy = (wy / H) * sdf.h
        if (sdf.sample(sx, sy) > 4) { penDown = false; continue }

        if (!penDown) { ctx.moveTo(wx, wy); penDown = true }
        else ctx.lineTo(wx, wy)
      }
      ctx.stroke()

      strokeOutline(ctx, sdf, W, H)
    })
  },
}
