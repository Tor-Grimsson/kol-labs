// Generate-tab randomizers for the Scanline generator. Each section returns a
// param patch applied over the current state (the editor maps keys → setters), so
// randomizing one section leaves the others intact. The category (geometry + mark)
// is PRESERVED — you stay in the same category, just like Pattern's render kind.

const rnd = (a, b) => a + Math.random() * (b - a)
const rint = (a, b) => Math.round(rnd(a, b))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const chance = (p) => Math.random() < p

// GEOMETRY — the scan-path layout + spacing. KEEPS the current geometry (the
// category); only its counts/spacing vary.
function randGeometry(v) {
  const geometry = v.geometry || 'rows'
  const p = {
    minGap: +rnd(2, 8).toFixed(1), maxGap: +rnd(14, 40).toFixed(1),
    contrast: +rnd(0.7, 2).toFixed(2), displace: chance(0.5) ? 0 : +rnd(0.2, 0.9).toFixed(2),
  }
  if (geometry === 'rows' || geometry === 'columns') { p.rows = rint(40, 160); p.weave = chance(0.3) }
  if (geometry === 'radial') p.rayCount = rint(120, 360)
  if (geometry === 'rings') p.ringCount = rint(30, 100)
  if (geometry === 'spiral') { p.turns = rint(3, 14); p.arms = rint(1, 4) }
  if (geometry === 'radial' || geometry === 'rings' || geometry === 'spiral') p.swirl = chance(0.5) ? 0 : +rnd(-1, 1).toFixed(2)
  return p
}

// FIELD — the scalar field that drives the density (category-independent).
function randField() {
  return { field: pick(['noise', 'waves', 'radial']), freq: +rnd(0.4, 3).toFixed(2), lens: +rnd(0.6, 2.5).toFixed(2) }
}

// MARK — KEEPS the current mark (part of the category); only its size/detail vary.
function randMark(v) {
  const mark = v.mark || 'dots'
  const p = { markSize: +rnd(0.5, 2).toFixed(2) }
  if (mark === 'dash') p.dashLen = +rnd(0.5, 2.5).toFixed(2)
  if (mark === 'glyph') { p.charset = pick(['ascii', 'blocks', 'binary', 'dots']); p.fontScale = +rnd(0.6, 1.6).toFixed(2) }
  return p
}

// COLOR — palette + invert.
function randColor() {
  return { palette: pick(['mono', 'cream', 'blueprint', 'ember', 'acid']), invert: chance(0.3) }
}

// MOTION FRAME — the whole-pattern motion (flow/drift/spin). 'custom' clears the
// Frame preset selector since a random combo isn't a named preset.
function randFrame() {
  return { framePreset: 'custom', flow: +rnd(0.4, 2.4).toFixed(2), drift: rint(0, 360), spin: chance(0.5) ? 0 : +rnd(-1.5, 1.5).toFixed(2) }
}

// MOTION FORM — the per-mark animation (sweep/pulse).
function randForm() {
  return { formPreset: 'custom', sweep: chance(0.5) ? 0 : +rnd(0.2, 1).toFixed(2), pulse: chance(0.5) ? 0 : +rnd(0.2, 1).toFixed(2) }
}

export function randomizeScanline(v, section) {
  if (section === 'geometry') return randGeometry(v)
  if (section === 'field') return randField()
  if (section === 'mark') return randMark(v)
  if (section === 'color') return randColor()
  if (section === 'frame') return randFrame()
  if (section === 'form') return randForm()
  return { ...randGeometry(v), ...randField(), ...randMark(v), ...randColor() } // 'all' (look, in-category)
}
