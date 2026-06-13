/* Raster-resampling glyph modes: halftone (→ <circle> grid) and ASCII
 * (→ <text> grid). Both rasterize the glyph to an offscreen canvas first,
 * sample at a regular grid, then emit SVG primitives.
 *
 * Per-glyph; intended to render inside the same <g> the glyph would. */

import { voronoiShatter } from './procedural.js'

const ASCII_RAMP = ' .,:;i1tfLCG08@'

function rasterize(d, w, h, padding = 4) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  /* The path is in glyph coords (baseline-up); we flip Y to canvas coords
   * and scale to fit. Callers pass a path already centered in [0..1]² via
   * a viewBox. We rely on a wrapping <svg> for that — here we just sample
   * what we get. */
  ctx.fillStyle = '#000'
  try {
    ctx.translate(padding, h - padding)
    ctx.scale(1, -1)
    const p = new Path2D(d)
    ctx.fill(p)
  } catch { /* malformed path; bail */ }
  return ctx.getImageData(0, 0, w, h)
}

/* Sample average luminance in a cell. */
function cellLuminance(image, cx, cy, cellW, cellH) {
  let sum = 0
  let count = 0
  const x0 = Math.max(0, Math.floor(cx))
  const y0 = Math.max(0, Math.floor(cy))
  const x1 = Math.min(image.width, Math.floor(cx + cellW))
  const y1 = Math.min(image.height, Math.floor(cy + cellH))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4
      const a = image.data[i + 3] / 255
      sum += a
      count++
    }
  }
  return count ? sum / count : 0
}

/* Halftone: returns an array of { cx, cy, r } per cell, weighted by ink. */
export function halftoneDots(d, { gridSize = 8, maxRadius = null, totalW = 200, totalH = 200 } = {}) {
  if (typeof document === 'undefined') return []
  const radius = maxRadius ?? gridSize * 0.5
  const image = rasterize(d, totalW, totalH)
  const cols = Math.floor(totalW / gridSize)
  const rows = Math.floor(totalH / gridSize)
  const dots = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * gridSize
      const cellY = row * gridSize
      const lum = cellLuminance(image, cellX, cellY, gridSize, gridSize)
      if (lum < 0.05) continue
      const r = lum * radius
      const cx = cellX + gridSize / 2
      const cy = cellY + gridSize / 2
      dots.push({ cx, cy, r })
    }
  }
  return dots
}

/* Voronoi shatter: passthrough to the procedural module so consumers can
 * import all "raster-like" modes from one place. */
export function shatterCells(d, { density = 24, inset = 0.1 } = {}) {
  return voronoiShatter(d, { density, inset })
}

/* ASCII: returns array of { cx, cy, char } per cell. */
export function asciiCells(d, { gridSize = 10, totalW = 200, totalH = 200, ramp = ASCII_RAMP } = {}) {
  if (typeof document === 'undefined') return []
  const image = rasterize(d, totalW, totalH)
  const cols = Math.floor(totalW / gridSize)
  const rows = Math.floor(totalH / (gridSize * 1.5))
  const cells = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * gridSize
      const cellY = row * gridSize * 1.5
      const lum = cellLuminance(image, cellX, cellY, gridSize, gridSize * 1.5)
      if (lum < 0.02) continue
      const idx = Math.min(ramp.length - 1, Math.floor(lum * ramp.length))
      cells.push({ cx: cellX + gridSize / 2, cy: cellY + gridSize * 0.75, char: ramp[idx] })
    }
  }
  return cells
}
