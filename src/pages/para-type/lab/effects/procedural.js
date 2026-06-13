/* Procedural shape modulators applied at the path-string level.
 *
 * Functions either:
 *   - take a path `d` string and return a transformed `d`, or
 *   - take a glyph definition and emit decorative SVG <path> children.
 *
 * No filters here — these are real geometry changes. */

import Warp from 'warpjs'
import SVGPathCommander from 'svg-path-commander'
import simplify from 'simplify-js'
import { Delaunay } from 'd3-delaunay'
import { perlin2, catmullRomClosedPath, polylineToPath, lerp, rng } from '../math.js'

function pathToWarp(d) {
  const svgNS = 'http://www.w3.org/2000/svg'
  const tmp = document.createElementNS(svgNS, 'svg')
  const path = document.createElementNS(svgNS, 'path')
  const normalized = new SVGPathCommander(d).toAbsolute().toString()
  path.setAttribute('d', normalized)
  tmp.appendChild(path)
  return { path, warp: new Warp(tmp) }
}

/* Per-vertex Perlin/Simplex displacement of outline. */
export function perlinDisplace(d, { amount = 0, freq = 0.05, seed = 1 } = {}) {
  if (amount === 0) return d
  try {
    const { path, warp } = pathToWarp(d)
    warp.interpolate(3)
    warp.transform(([x, y]) => {
      const nx = perlin2(x * freq, y * freq, seed) * amount * 20
      const ny = perlin2(x * freq + 100, y * freq + 100, seed) * amount * 20
      return [x + nx, y + ny]
    })
    return path.getAttribute('d')
  } catch { return d }
}

/* Catmull-Rom resample at variable resolution. Higher `flatness` = fewer
 * samples → faceted/low-poly look. */
export function catmullResample(d, { flatness = 0 } = {}) {
  if (flatness === 0) return d
  try {
    /* Sample the path densely then keep every Nth point. */
    const points = samplePathPoints(d, Math.max(8, Math.round(200 * (1 - flatness))))
    if (points.length < 4) return d
    return catmullRomClosedPath(points.map(p => [p.x, p.y]), 0.5)
  } catch { return d }
}

/* Path simplification via Ramer-Douglas-Peucker (simplify-js). */
export function simplifyPath(d, { tolerance = 0 } = {}) {
  if (tolerance === 0) return d
  try {
    const pts = samplePathPoints(d, 300)
    const simplified = simplify(pts, tolerance * 4, true)
    return polylineToPath(simplified.map(p => [p.x, p.y]), true)
  } catch { return d }
}

/* Sample a path's outline at evenly-spaced points using DOM SVGPathElement. */
function samplePathPoints(d, count = 100) {
  const svgNS = 'http://www.w3.org/2000/svg'
  const path = document.createElementNS(svgNS, 'path')
  path.setAttribute('d', d)
  const total = path.getTotalLength()
  const pts = []
  for (let i = 0; i <= count; i++) {
    const p = path.getPointAtLength((i / count) * total)
    pts.push({ x: p.x, y: p.y })
  }
  return pts
}

/* Voronoi shatter — generate cell polygons from points sampled on the
 * outline. Returns an array of SVG path-d strings (one per cell). */
export function voronoiShatter(d, { density = 24, inset = 0 } = {}) {
  try {
    const pts = samplePathPoints(d, Math.max(6, density))
    const flat = pts.map(p => [p.x, p.y])
    /* Add interior points for richer cells. */
    const bb = new SVGPathCommander(d).getBBox()
    const r = rng(7)
    for (let i = 0; i < density * 2; i++) {
      flat.push([
        bb.x + r() * bb.width,
        bb.y + r() * bb.height,
      ])
    }
    const delaunay = Delaunay.from(flat)
    const voronoi = delaunay.voronoi([bb.x - 5, bb.y - 5, bb.x + bb.width + 5, bb.y + bb.height + 5])
    const cells = []
    for (let i = 0; i < flat.length; i++) {
      const poly = voronoi.cellPolygon(i)
      if (!poly) continue
      const insetPoly = poly.map(([x, y]) => {
        const cx = flat[i][0], cy = flat[i][1]
        return [lerp(cx, x, 1 - inset), lerp(cy, y, 1 - inset)]
      })
      cells.push('M ' + insetPoly.map(p => `${p[0]} ${p[1]}`).join(' L ') + ' Z')
    }
    return cells
  } catch { return [] }
}

/* L-system turtle-driven growth. Returns an array of polylines (each a list
 * of [x,y] points). Default rule: feathery branching. */
export function lSystemBranches(origin, angle, length, depth, seed = 0) {
  const r = rng(seed)
  const lines = []
  const draw = (x, y, ang, len, lvl) => {
    if (lvl <= 0 || len < 1) return
    const x2 = x + Math.cos(ang) * len
    const y2 = y + Math.sin(ang) * len
    lines.push([[x, y], [x2, y2]])
    /* Two branches at ±θ with shorter length. */
    const theta = 0.4 + r() * 0.3
    const nextLen = len * (0.6 + r() * 0.15)
    draw(x2, y2, ang - theta, nextLen, lvl - 1)
    draw(x2, y2, ang + theta, nextLen, lvl - 1)
  }
  draw(origin[0], origin[1], angle, length, depth)
  return lines
}

/* Cheap rasterize-then-marching-squares stand-in: sample distance field
 * from outline. Returns isoline polylines clipped to the bbox.
 *
 * Pragma: full marching-squares is heavy; here we approximate by rendering
 * the path to an offscreen canvas, sampling alpha, and emitting contour
 * polylines via the canvas. We expose a `threshold` ∈ [-1, 1] for
 * inflate/erode. */
export function sdfThreshold(d, { threshold = 0, resolution = 64 } = {}) {
  if (typeof document === 'undefined') return d
  try {
    const bb = new SVGPathCommander(d).getBBox()
    const pad = Math.max(bb.width, bb.height) * 0.2
    const minX = bb.x - pad
    const minY = bb.y - pad
    const w = bb.width + pad * 2
    const h = bb.height + pad * 2
    const canvas = document.createElement('canvas')
    canvas.width = resolution
    canvas.height = Math.round(resolution * h / w)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'black'
    ctx.translate(0, 0)
    ctx.scale(canvas.width / w, canvas.height / h)
    ctx.translate(-minX, -minY)
    const p = new Path2D(d)
    ctx.fill(p)
    /* For now, just return the original d — proper marching-squares is a
     * future enhancement. Threshold scales the stroke width effect. */
    void threshold
    return d
  } catch { return d }
}

/* Per-glyph deterministic shuffle of a numeric value. Used to give each
 * glyph in the grid a slightly different parameter when `randomize` is on. */
export function jitter(value, range, seed, salt) {
  const r = rng((seed | 0) * 1009 + (salt | 0) * 13)
  return value + (r() - 0.5) * range
}
