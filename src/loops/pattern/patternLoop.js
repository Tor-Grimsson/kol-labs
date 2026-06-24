import { TAU, mixHex, hexToRgb } from '../lib/util.js'
import { resolveShape, DEFAULT_SHAPE_ID } from './shapes.js'
import { composeCell, compileRules } from './rules.js'
import { glyphShape, ensureGlyphFontUrl } from '../../lib/glyphPath.js'
import { drawStripes } from './fields/stripeField.js'
import { drawTartan } from './fields/tartanField.js'
import { drawOrganic } from './fields/organicField.js'

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
let rulesCache = null // { key, compiled }
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

// Pan direction → (x, y) block multipliers (×camFlow). Integer only ⇒ seamless.
const PAN_VEC = {
  right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1],
  diag: [1, 1], anti: [1, -1],
}

// Field families (render:'field') — continuous VECTOR renderers that bypass the
// tile loop. All three are cheap geometry (rects / filled paths), NOT per-pixel:
// stripes = bands · tartan = crossed sett bands · organic = bands with a wavy edge.
// Each reads the pattern palette (color/color2/color3 + bg). Seamless on whole-
// cycle phase (u·TAU·round(camFlow)).
const FIELD_DRAW = { stripes: drawStripes, tartan: drawTartan, organic: drawOrganic }
function drawField(ctx, u, w, h, p) {
  (FIELD_DRAW[p.field] || drawStripes)(ctx, u, w, h, p)
}

// Weave (render:'weave') — true over/under interlacing. Per crossing the warp
// (vertical) and weft (horizontal) ribbons overlap; a parity fn decides which is
// drawn SECOND (on top), so strands genuinely pass over and under across the field.
const parityWeave = (type, col, row) => {
  switch (type) {
    case 'twill':  return ((((col - row) % 4) + 4) % 4) < 2     // diagonal wales
    case 'satin':  return (((col * 2 + row * 3) % 5) + 5) % 5 === 0 // sparse floats
    case 'basket': return ((Math.floor(col / 2) + Math.floor(row / 2)) & 1) === 0
    default:       return ((col + row) & 1) === 0                // plain
  }
}
function drawWeave(ctx, u, w, h, p) {
  const cols = Math.max(1, p.cols | 0)
  const rows = Math.max(1, p.rows | 0)
  const cell = Math.max(8, p.cell)
  const period = cell + (p.gap || 0)
  if (period <= 0) return
  const z = p.camZoom || 1
  const ang = (p.camAngle || 0) * Math.PI / 180
  const flow = Math.round(p.camFlow || 0)
  const baseHalf = Math.max(1, (p.strandWidth ?? 0.7) * cell) / 2
  const weave = p.weaveType || 'plain'
  const warpCol = p.color, weftCol = p.color2 || p.color
  const warpLit = mixHex(warpCol, '#ffffff', 0.2), weftLit = mixHex(weftCol, '#ffffff', 0.2)
  // Collinear ribbon segments from adjacent cells must OVERLAP, not abut — exact
  // abutment leaves a sub-pixel AA seam (the faint grid the strands read through).
  // Extend each segment ~1 device px past the cell midpoint so neighbours overlap.
  const len = period + 2 / z

  // FORM — per-crossing pulse/fade swept diagonally (the same sweep the tile engine
  // uses), so the weave gets a Motion Form too. Seamless: u only via tphase.
  const axis = p.animAxis || 'none'
  const formOn = axis !== 'none' && (p.pulse || p.fade)
  const cyc = Math.round(p.animCycles || 0)
  const wav = p.animWaves || 0
  const tphase = u * TAU * cyc

  // Frame — the whole woven sheet PANS (translates) in the picked direction. Seamless:
  // the parity wraps on cols/rows, so panning whole cols/rows repeats per loop lands
  // identically. (flow=0 ⇒ static.)
  const [fx, fy] = PAN_VEC[p.panDir] || PAN_VEC.right
  const panX = u * flow * fx * cols * period
  const panY = u * flow * fy * rows * period

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(ang)
  ctx.scale(z, z)
  ctx.translate(-panX, -panY)

  const reach = (Math.hypot(w, h) / 2) / z + period * 2
  const gx0 = Math.floor((panX - reach) / period), gx1 = Math.ceil((panX + reach) / period)
  const gy0 = Math.floor((panY - reach) / period), gy1 = Math.ceil((panY + reach) / period)

  // ribbon = base fill + a centre sheen (tube/cord read).
  const ribbon = (cx, cy, vert, base, lit, half) => {
    ctx.fillStyle = base
    if (vert) ctx.fillRect(cx - half, cy - len / 2, half * 2, len)
    else ctx.fillRect(cx - len / 2, cy - half, len, half * 2)
    ctx.fillStyle = lit
    const sh = half * 0.6
    if (vert) ctx.fillRect(cx - sh, cy - len / 2, sh * 2, len)
    else ctx.fillRect(cx - len / 2, cy - sh, len, sh * 2)
  }

  let count = 0
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      if (++count > MAX_CELLS) { ctx.restore(); return }
      const col = ((gx % cols) + cols) % cols
      const row = ((gy % rows) + rows) % rows
      const cx = gx * period, cy = gy * period

      // Per-crossing Form sweep (k 0..1, plain sine ⇒ seamless): Pulse breathes the
      // strand width, Fade its opacity, phased by axis across the field.
      let half = baseHalf
      if (formOn) {
        const sp = axis === 'col' ? gx : axis === 'row' ? gy : axis === 'radial' ? Math.hypot(gx, gy) : gx + gy
        const k = 0.5 + 0.5 * Math.sin(tphase - sp * 0.5 * wav)
        if (p.pulse) half = baseHalf * (1 - p.pulse + p.pulse * k)
        ctx.globalAlpha = p.fade ? (1 - p.fade + p.fade * k) : 1
      }

      const warpOver = parityWeave(weave, col, row)
      if (warpOver) { ribbon(cx, cy, false, weftCol, weftLit, half); ribbon(cx, cy, true, warpCol, warpLit, half) }
      else { ribbon(cx, cy, true, warpCol, warpLit, half); ribbon(cx, cy, false, weftCol, weftLit, half) }
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

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
    // ── Field render (render:'field') — continuous per-pixel pattern families
    // that bypass the tile loop (Stripes now; Tartan/Organic later). `field`
    // picks the family; each reads the palette (color/color2/color3 + bg).
    render: 'tiles',     // 'tiles' (tile loop) | 'field' (continuous field)
    field: 'stripes',    // active field family when render==='field'
    stripeAngle: 0,      // band direction (deg): 0 vertical · 90 horizontal · 45 diagonal
    stripePitch: 60,     // field units per band (band width / spacing)
    offsetX: 0,          // static position: shift across the bands (0..1 of a period)
    offsetY: 0,          // static position: shift along the bands (0..1 of a period)
    bandCount: 2,        // palette colours walked (1 single · 2 A/B · 3 A/B/C)
    duty: 1,             // 1 = solid bands; <1 = ink band width on the bg ground (pinstripe)
    edgeSoftness: 0,     // 0 = hard edge; >0 = soft / ombré blend
    // Tartan field (field:'tartan')
    sett: 'black-watch', // threadcount table (src/loops/pattern/fields/setts.js)
    settScale: 5,        // px per thread unit
    twill: 0.18,         // 2/2-twill diagonal bias (0 = flat average)
    // Organic field (field:'organic') — bands with a wavy edge profile
    waveAmp: 0.4,        // undulation depth (× pitch)
    waveFreq: 1.5,       // waves across the field
    waveProfile: 'sine', // edge profile — see fields/organicField.js PROFILES ('custom' ⇒ waveCurve)
    waveCurve: null,     // editable bezier profile (ProfileEditor) when waveProfile==='custom'
    waveFlow: 0,         // organic: along-axis travel — the wave runs along the bands (whole cycles)
    fillMode: 'off',     // Split gaps: 'off' (ground shows) | 'extend' (bands meet) | 'solid' (fillColor)
    fillColor: '#101014',// ground colour when fillMode==='solid'
    // Form animation — PER-BAND (stripes/organic): each band moves individually.
    // Seamless on whole `fieldCycles`. 0 = off. (Field-wide scroll is the Frame axis.)
    fieldSway: 0,        // per-band position shift amount
    fieldStagger: 0,     // phase the sway across band index (×π ⇒ odd/even opposite at 1)
    fieldShimmer: 0,     // per-band colour shimmer toward the next band
    fieldPulse: 0,       // tartan sett-scale breathe (field-wide)
    fieldCycles: 1,      // whole cycles per loop for the above
    // Weave render (render:'weave') — interlaced over/under strands
    weaveType: 'plain',  // plain | twill | satin | basket (which strand goes over)
    strandWidth: 0.7,    // ribbon width (× cell)
    camZoom: 1,
    camFlow: 1,
    camAngle: 0,
    panDir: 'diag', // pan direction: right|left|up|down|diag|anti (see PAN_VEC)
    spin: 0,
    // Curated-motion selectors (PatternControls Animation tab) — two orthogonal
    // axes: Frame (camera pan) + Form (per-cell sweep). 'custom' = hand-tuned;
    // both UI-only, the engine ignores them.
    framePreset: 'custom',
    formPreset: 'custom',
    // Animation sweep (per-cell, phased by world position).
    animAxis: 'none', // none | diag | col | row | radial
    animCycles: 1, // Speed: whole time cycles over the loop ⇒ seamless
    animWaves: 2, // Stagger: spatial phase offset of the sweep tile-to-tile
    pulse: 0, // 0..1 size breathe
    fade: 0, // 0..1 opacity sweep
    swing: 0, // 0..180 rotation sway (deg)
    colorMix: 0, // 0..1 colour sweep toward color2
  },
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    // Render dispatch: field families bypass the tile loop entirely. 'tiles'
    // (default) falls through to the original engine below — Blocks' native case.
    if ((p.render || 'tiles') === 'field') return drawField(ctx, u, w, h, p)
    if (p.render === 'weave') return drawWeave(ctx, u, w, h, p)

    const shp = shapeFor(p.shape, p.customSvg, p)
    if (!shp.paths.length) return

    const [vx, vy, vw, vh] = shp.viewBox
    const cols = Math.max(1, p.cols | 0)
    const rows = Math.max(1, p.rows | 0)
    const cell = Math.max(8, p.cell)
    const period = cell + p.gap
    if (period <= 0) return
    const rulesKey = (p.rules || []).map(r => r.selectKind === 'expression' ? r.expression || '' : '_').join('|')
    if (!rulesCache || rulesCache.key !== rulesKey) rulesCache = { key: rulesKey, compiled: compileRules(p.rules) }
    const compiled = rulesCache.compiled

    const z = p.camZoom || 1
    const ang = (p.camAngle || 0) * Math.PI / 180
    const flow = Math.round(p.camFlow || 0)
    // Pan direction → per-axis block multipliers. All integer ⇒ whole blocks per
    // loop ⇒ seamless. 'diag' (1,1) reproduces the original down-right drift.
    const [fx, fy] = PAN_VEC[p.panDir] || PAN_VEC.diag
    const panX = u * flow * fx * cols * period
    const panY = u * flow * fy * rows * period
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
    const baseMatrix = ctx.getTransform()

    // Pre-parse hex colors once so per-cell colorMix can inline-lerp without string parsing.
    const _c1 = hexToRgb(p.color)
    const _c2 = hexToRgb(p.color2 || p.color)
    const _c3 = hexToRgb(p.color3 || p.color2 || p.color)

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
          const k = 0.5 + 0.5 * sw // 0..1 — plain sine ⇒ symmetric, always seamless
          if (p.pulse) aScale = 1 - p.pulse + p.pulse * k
          if (p.fade) aOpacity = c.opacity * (1 - p.fade + p.fade * k)
          if (p.swing) aRot = p.swing * (2 * k - 1)
          if (p.colorMix) {
            const base = baseColor === p.color2 ? _c2 : baseColor === p.color3 ? _c3 : _c1
            const t = p.colorMix * k
            aColor = `rgb(${base[0]+t*(_c2[0]-base[0])|0},${base[1]+t*(_c2[1]-base[1])|0},${base[2]+t*(_c2[2]-base[2])|0})`
          }
        }

        ctx.translate(gx * period + cell / 2, gy * period + cell / 2)
        ctx.rotate((c.rotate + cellSpin + aRot) * Math.PI / 180)
        ctx.scale(c.scaleX * aScale, c.scaleY * aScale)
        const s = p.stretch ? null : Math.min(cell / vw, cell / vh)
        ctx.scale(p.stretch ? cell / vw : s, p.stretch ? cell / vh : s)
        ctx.translate(-vx - vw / 2, -vy - vh / 2)
        ctx.globalAlpha = aOpacity
        ctx.fillStyle = aColor
        for (const path of shp.paths) ctx.fill(path)
        ctx.setTransform(baseMatrix)
        ctx.globalAlpha = 1
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
