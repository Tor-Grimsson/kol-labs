import { TAU, mixHex } from '../lib/util.js'
import { resolveShape, DEFAULT_SHAPE_ID } from './shapes.js'
import { composeCell, compileRules } from './rules.js'
import { glyphShape, ensureGlyphFontUrl } from '../../lib/glyphPath.js'

// Pattern — the ported kol-client rule/tiling system, rendered to Canvas2D so it
// animates + outputs a texture. The cols×rows rule-block TILES infinitely; the
// camera (zoom/angle + flow drift) moves THROUGH it, and `spin` morphs the cells.
//
// On top of the static rules, an ANIMATION sweep brings the tiles to life: a
// time-driven wave (axis diag/col/row/radial, like the rule selectors) phased by
// each cell's world position drives per-cell size (pulse), opacity (fade),
// rotation sway (swing) and colour (mix → color2). Seamless: the only u-terms are
// `u·TAU·animCycles`, `u·TAU·camFlow` and `u·360·spin`, all whole cycles.
//
// Controls are the custom `pattern` panel (PatternControls.jsx).

let cache = null // { key, viewBox, paths:[Path2D] }
const EMPTY = { key: '', viewBox: [0, 0, 1, 1], paths: [] }
function buildPaths(viewBox, paths) {
  const built = []
  for (const d of paths) { try { built.push(new Path2D(d)) } catch { /* skip bad path */ } }
  return { viewBox, paths: built }
}
function shapeFor(id, customSvg, p) {
  // 'glyph' — the tile is a TYPE outline (a letter/word), pulled via opentype.
  // Async: returns an uncached empty until the font streams in, then caches.
  if (id === 'glyph') {
    const url = p?.glyphFontUrl || ''
    const text = p?.glyphChar || 'A'
    const coords = p?.glyphCoords || null
    const slant = p?.glyphSlant || 0
    const track = p?.glyphTrack || 0
    const key = `glyph|${url}|${text}|${JSON.stringify(coords)}|${slant}|${track}`
    if (cache && cache.key === key) return cache
    if (!url) return EMPTY
    const gs = glyphShape(url, text, coords, slant, track)
    if (!gs) { ensureGlyphFontUrl(url); return EMPTY } // retry next frame
    cache = { key, ...buildPaths(gs.viewBox, gs.paths) }
    return cache
  }
  const key = id + '|' + (id === 'custom' ? customSvg : '')
  if (cache && cache.key === key) return cache
  const { viewBox, paths } = resolveShape(id, customSvg)
  cache = { key, ...buildPaths(viewBox, paths) }
  return cache
}

const MAX_CELLS = 6000 // safety cap for extreme zoom-out

export default {
  id: 'pattern-rules',
  label: 'Pattern',
  group: 'pattern',
  kind: '2d',
  duration: 8,
  controls: 'pattern',
  // Schema for the shared scene-settings (theme recolour + Randomise). The Edit
  // UI is the custom PatternControls panel (reads `values` directly); this array
  // is ONLY metadata: colour ROLES for theming, and noRandom flags on the
  // structural grid params so Randomise rolls colours + continuous params but
  // never thrashes the tiling geometry / array sizes.
  params: [
    { key: 'bg', type: 'color', role: 'bg' },
    { key: 'color', type: 'color', role: 'fg' },
    { key: 'color2', type: 'color', role: 'accent' },
    { key: 'color3', type: 'color', role: 'warm' },
    { key: 'cols', type: 'range', min: 1, max: 32, step: 1, noRandom: true },
    { key: 'rows', type: 'range', min: 1, max: 32, step: 1, noRandom: true },
    { key: 'cell', type: 'range', min: 40, max: 280, step: 1, noRandom: true },
    { key: 'pulse', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'fade', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'swing', type: 'range', min: 0, max: 180, step: 5 },
    { key: 'colorMix', type: 'range', min: 0, max: 1, step: 0.05 },
  ],
  defaults: {
    shape: DEFAULT_SHAPE_ID,
    customSvg: '',
    glyphChar: 'A',       // the type tile (one glyph or a short run)
    glyphFontKey: 'rot',  // UI selection (mapped → url by PatternControls)
    glyphFontUrl: '',     // resolved font url the engine reads
    glyphCoords: null,    // optional VF axis coords for the glyph
    cols: 4,
    rows: 4,
    cell: 120,
    gap: 8,
    stretch: false,
    showGrid: false, // cell-boundary lattice overlay
    bg: '#0e0e11',
    color: '#fcfbf8',
    color2: '#c2502e',
    color3: '#3f6485',
    // Interleave the base fill across colours by cell index — the clean R/Y/B
    // "test grid" substrate. none | checker (2-col) | cols | rows | diag (3-col).
    colorRule: 'none',
    rules: [],
    camZoom: 1,
    camFlow: 1,
    camAngle: 0,
    spin: 0,
    // Animation sweep (per-cell, phased by world position).
    animAxis: 'none', // none | diag | col | row | radial
    animCycles: 1, // whole time cycles over the loop ⇒ seamless
    animWaves: 2, // spatial frequency of the sweep (cosmetic)
    pulse: 0, // 0..1 size breathe
    fade: 0, // 0..1 opacity sweep
    swing: 0, // 0..180 rotation sway (deg)
    colorMix: 0, // 0..1 colour sweep toward color2
  },
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const shp = shapeFor(p.shape, p.customSvg, p)
    if (!shp.paths.length) return

    const [vx, vy, vw, vh] = shp.viewBox
    const cols = Math.max(1, p.cols | 0)
    const rows = Math.max(1, p.rows | 0)
    const cell = Math.max(8, p.cell)
    const period = cell + p.gap
    if (period <= 0) return
    const compiled = compileRules(p.rules)

    const z = p.camZoom || 1
    const ang = (p.camAngle || 0) * Math.PI / 180
    const flow = Math.round(p.camFlow || 0)
    const panX = u * flow * cols * period // whole blocks per loop ⇒ seamless
    const panY = u * flow * rows * period
    const cellSpin = u * 360 * Math.round(p.spin || 0) // whole turns ⇒ seamless

    // Animation sweep params (resolved once per frame).
    const axis = p.animAxis || 'none'
    const animOn = axis !== 'none' && (p.pulse || p.fade || p.swing || p.colorMix)
    const cyc = Math.round(p.animCycles || 0)
    const wav = p.animWaves || 0
    const tphase = u * TAU * cyc

    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(ang)
    ctx.scale(z, z)
    ctx.translate(-panX, -panY)

    // World cells covering the (rotated, zoomed) viewport + margin.
    const reach = (Math.hypot(w, h) / 2) / z + period * 2
    const gx0 = Math.floor((panX - reach) / period)
    const gx1 = Math.ceil((panX + reach) / period)
    const gy0 = Math.floor((panY - reach) / period)
    const gy1 = Math.ceil((panY + reach) / period)

    let count = 0
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (++count > MAX_CELLS) { ctx.restore(); return }
        const col = ((gx % cols) + cols) % cols
        const row = ((gy % rows) + rows) % rows
        const i = row * cols + col
        const c = composeCell(p.rules, compiled, { row, col, cols, rows, i })
        if (c.hidden) continue

        // Per-cell base colour: an optional R/Y/B interleave by cell index (the
        // clean "test grid" substrate), else the single shape colour. Uses the
        // block-wrapped col/row so it stays seamless under camera flow.
        let baseColor = p.color
        const crule = p.colorRule
        if (crule && crule !== 'none') {
          if (crule === 'checker') baseColor = ((col + row) & 1) ? p.color2 : p.color
          else {
            const k3 = crule === 'cols' ? col : crule === 'rows' ? row : col + row
            const idx = ((k3 % 3) + 3) % 3
            baseColor = idx === 0 ? p.color : idx === 1 ? p.color2 : (p.color3 || p.color)
          }
        }

        // Per-cell animation from the sweep (seamless: u only via tphase).
        let aScale = 1
        let aOpacity = c.opacity
        let aRot = 0
        let aColor = baseColor
        if (animOn) {
          const sp = axis === 'col' ? gx
            : axis === 'row' ? gy
              : axis === 'radial' ? Math.hypot(gx, gy)
                : gx + gy
          const sw = Math.sin(tphase - sp * 0.5 * wav) // -1..1
          const k = 0.5 + 0.5 * sw // 0..1
          if (p.pulse) aScale = 1 - p.pulse + p.pulse * k
          if (p.fade) aOpacity = c.opacity * (1 - p.fade + p.fade * k)
          if (p.swing) aRot = p.swing * sw
          if (p.colorMix) aColor = mixHex(baseColor, p.color2, p.colorMix * k)
        }

        ctx.save()
        ctx.translate(gx * period + cell / 2, gy * period + cell / 2)
        ctx.rotate((c.rotate + cellSpin + aRot) * Math.PI / 180)
        ctx.scale(c.scaleX * aScale, c.scaleY * aScale)
        const s = p.stretch ? null : Math.min(cell / vw, cell / vh)
        ctx.scale(p.stretch ? cell / vw : s, p.stretch ? cell / vh : s)
        ctx.translate(-vx - vw / 2, -vy - vh / 2)
        ctx.globalAlpha = aOpacity
        ctx.fillStyle = aColor
        for (const path of shp.paths) ctx.fill(path)
        ctx.restore()
      }
    }

    // Cell-boundary lattice (overlay, follows the camera; pans whole blocks ⇒
    // seamless). Drawn at the gap midpoints between cells.
    if (p.showGrid) {
      ctx.globalAlpha = 0.18
      ctx.strokeStyle = p.color
      ctx.lineWidth = 1
      const x0 = gx0 * period - p.gap / 2
      const x1 = (gx1 + 1) * period - p.gap / 2
      const y0 = gy0 * period - p.gap / 2
      const y1 = (gy1 + 1) * period - p.gap / 2
      ctx.beginPath()
      for (let gx = gx0; gx <= gx1 + 1; gx++) {
        const x = gx * period - p.gap / 2
        ctx.moveTo(x, y0)
        ctx.lineTo(x, y1)
      }
      for (let gy = gy0; gy <= gy1 + 1; gy++) {
        const y = gy * period - p.gap / 2
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.restore()
    ctx.globalAlpha = 1
  },
}
