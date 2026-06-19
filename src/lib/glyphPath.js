// Glyph → SVG-path outline, for using TYPE as a pattern tile (and anywhere a
// letterform is needed as vector geometry). opentype.js extracts the outline; we
// hand back a `{ viewBox, paths }` shape in the same shape `resolveShape` returns,
// so the pattern engine treats a glyph exactly like any other tile.
//
// Async by nature (fonts stream in). `glyphShape` returns null until the font has
// parsed; callers in a render loop just retry next frame after `ensureGlyphFontUrl`.

import opentype from 'opentype.js'

const EM = 1000 // nominal units; the pattern rescales the tile to the cell anyway

const fontPromises = new Map() // url → Promise<Font>
const resolved = new Map()     // url → Font
const shapeCache = new Map()   // key → { viewBox, paths }

export function ensureGlyphFontUrl(url) {
  if (!url || resolved.has(url)) return Promise.resolve(resolved.get(url) || null)
  if (fontPromises.has(url)) return fontPromises.get(url)
  const p = fetch(url)
    .then((r) => { if (!r.ok) throw new Error(`font fetch failed: ${url}`); return r.arrayBuffer() })
    .then((buf) => { const f = opentype.parse(buf); resolved.set(url, f); return f })
    .catch(() => { fontPromises.delete(url); return null })
  fontPromises.set(url, p)
  return p
}

function variationFor(font, coords) {
  if (!coords || !font.tables || !font.tables.fvar) return undefined
  const out = {}
  for (const a of font.tables.fvar.axes) if (coords[a.tag] != null) out[a.tag] = coords[a.tag]
  return Object.keys(out).length ? out : undefined
}

// → { viewBox:[x,y,w,h], paths:[dString] } | null. Lays the run out glyph-by-glyph
// so it's a TRUE instance of the styled word: `coords` = variable-axis values,
// `slant` (deg) = faux-italic shear, `trackRatio` = letter-spacing as a fraction of
// the em (so the type's Tracking reflects in the tile).
export function glyphShape(url, text, coords, slant = 0, trackRatio = 0) {
  if (!url || !text) return null
  const key = `${url}|${text}|${JSON.stringify(coords || null)}|${slant}|${trackRatio}`
  if (shapeCache.has(key)) return shapeCache.get(key)
  const font = resolved.get(url)
  if (!font) { ensureGlyphFontUrl(url); return null }
  const opts = {}
  const v = variationFor(font, coords)
  if (v) opts.variation = v

  // manual run layout: place each glyph at the pen, advance by its width + tracking
  const trackEm = trackRatio * EM
  const scale = EM / font.unitsPerEm
  const path = new opentype.Path()
  let x = 0
  for (const ch of Array.from(text)) {
    const g = font.charToGlyph(ch)
    const gp = font.getPath(ch, x, 0, EM, opts)
    for (const c of gp.commands) path.commands.push(c)
    x += (g.advanceWidth || font.unitsPerEm * 0.5) * scale + trackEm
  }

  if (slant) {
    // shear toward +x as y rises (opentype y is negative above the baseline).
    const k = Math.tan((slant * Math.PI) / 180)
    for (const c of path.commands) {
      if ('x' in c && 'y' in c) c.x += -c.y * k
      if ('x1' in c && 'y1' in c) c.x1 += -c.y1 * k
      if ('x2' in c && 'y2' in c) c.x2 += -c.y2 * k
    }
  }

  const d = path.toPathData(2)
  const bb = path.getBoundingBox()
  const w = Math.max(1, bb.x2 - bb.x1)
  const h = Math.max(1, bb.y2 - bb.y1)
  const shape = { viewBox: [bb.x1, bb.y1, w, h], paths: d ? [d] : [] }
  shapeCache.set(key, shape)
  return shape
}
