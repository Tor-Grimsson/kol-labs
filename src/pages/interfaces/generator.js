/**
 * Seeded generative composer. A composition is fully described by a seed +
 * aspect + theme, so "save what's cool" is just storing those few values and
 * the screen regenerates deterministically (the lab's seeded-art pattern).
 *
 * The grammar mirrors the 50 hand-built screens: statusbar → labelled widget
 * rows / readouts / hex strips → optional transport, in a theme — so a reroll
 * looks intentional, not like noise. Aspect drives the output frame + column
 * count (tall → 1 col, square → 2, wide → 3).
 */
import { WIDGETS, widgetFor } from './widgets/registry.js'
import { statusbar, label, readouts, numericStrip, transport, dualNum, el, widgetHost } from './screens.js'
import { fontStack } from './lib/fonts.js'

const DESIGN = 360 // short-edge design px; ScaleToFit scales to the viewport

export const THEMES = ['default', 'blood', 'ice', 'mono', 'cream', 'kol']
export const ASPECTS = [
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '3:4', label: '3:4', ratio: 3 / 4 },
  { key: '4:5', label: '4:5', ratio: 4 / 5 },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
]
export const aspectFor = (key) => ASPECTS.find((a) => a.key === key) || ASPECTS[0]

const CONTENT = WIDGETS // the animated widgets are the content pool

/* word banks → plausible lofi-UI strings */
const NOUNS = ['OSC-A', 'OSC-B', 'FILTER', 'OUTPUT', 'INPUT', 'SEQUENCE', 'SPECTRUM', 'MATRIX', 'BUFFER', 'CORE', 'PHASE', 'SYNC', 'DRIFT', 'SCAN', 'GAIN', 'BANK', 'CHANNEL', 'MODULE', 'SIGNAL', 'CARRIER', 'FEED', 'MIX', 'BUS', 'VOICE', 'CELL', 'NODE']
const TAGS = ['LIVE', 'STBL', 'LOCK', 'ARMED', 'SYNC', 'RDY', 'HOLD', 'SCAN', 'IDLE', 'PEAK', 'OK']
const UNITS = ['HZ', 'DB', 'MS', 'BPM', '%', 'ST', 'PX', 'RATE']
const KEYS = ['FRQ', 'Q', 'CUT', 'GAIN', 'LFO', 'RATE', 'ENV', 'RES', 'MIX', 'PAN', 'AMP', 'MOD', 'DLY', 'FBK']

/* deterministic PRNG (mulberry32 + fnv1a) */
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (rng, arr) => arr[(rng() * arr.length) | 0]

function randParams(w, rng) {
  const o = { ...w.defaults }
  for (const p of w.params) {
    if (p.type === 'select') o[p.key] = pick(rng, p.options)
    else if (p.type === 'boolean') { /* keep the default — don't randomise toggles */ }
    // only randomise a text param that ships with copy (cipher); leave opt-in
    // fields (sevenSeg value, codeScroll custom) blank so their default behaviour holds
    else if (p.type === 'text') { if (o[p.key]) o[p.key] = `${pick(rng, NOUNS)} ${pick(rng, NOUNS)}` }
    else { const steps = Math.round((p.max - p.min) / p.step); o[p.key] = p.min + Math.round(rng() * steps) * p.step }
  }
  return o
}

/* section generators (one per kind) — shared by generate() + sectionForKey() */
const genStatusbar = (rng) => ({ kind: 'statusbar', right: `${pick(rng, NOUNS)} ${pick(rng, TAGS)}` })
const genLabel = (rng) => ({ kind: 'label', left: `${pick(rng, NOUNS)} · ${pick(rng, NOUNS)}`, right: rng() < 0.5 ? pick(rng, TAGS) : '' })
const genReadouts = (rng) => {
  const items = []; const n = 4 + ((rng() * 4) | 0)
  for (let j = 0; j < n; j++) items.push([pick(rng, KEYS), `${(rng() * 999).toFixed(2)} ${pick(rng, UNITS)}`])
  return { kind: 'readouts', items }
}
const genStrip = (rng) => ({ kind: 'strip', groups: 1 + ((rng() * 2) | 0), per: 8 + ((rng() * 8) | 0) })
const genDual = (rng) => ({ kind: 'dual', rows: 4 + ((rng() * 4) | 0) })
const genTransport = (rng) => ({ kind: 'transport', label: `${pick(rng, NOUNS)} · ${pick(rng, UNITS)}`, active: '▶' })
const genWidgets = (rng) => {
  const widgets = []
  const w1 = pick(rng, CONTENT); widgets.push({ key: w1.key, opts: randParams(w1, rng) })
  if (rng() < 0.26) { const w2 = pick(rng, CONTENT); widgets.push({ key: w2.key, opts: randParams(w2, rng) }) }
  return { kind: 'widgets', widgets }
}

/* rough rendered height (px) of a section — fill the frame by height budget
 * instead of by section count (a creature is 180px, a label is 16px), and
 * balance multi-column layouts. */
function widgetH(key, opts) {
  const w = widgetFor(key)
  if (w?.square) return 56
  if (opts.h) return opts.h
  if (opts.size) return opts.size
  switch (key) {
    case 'matrix': return (opts.rows || 6) * (opts.cell || 4) + 4
    case 'sequencer': return (opts.rows || 4) * 7 + 4
    case 'sevenSeg': return (opts.scale || 3) * 9 + 4
    case 'codeScroll': return (opts.rows || 4) * ((opts.fontSize || 11) + 4)
    case 'cipher': return ((opts.fontSize || 11) + 4) * 3
    case 'hBars': return (opts.rows || 5) * 8 + 4
    case 'vu': return 12
    default: return 40
  }
}
function heightOf(sec) {
  switch (sec.kind) {
    case 'statusbar': return 18
    case 'label': return 18
    case 'readouts': return Math.ceil(sec.items.length / 2) * 16 + 8
    case 'strip': return 18
    case 'dual': return sec.rows * 15 + 8
    case 'transport': return 26
    case 'widgets': return Math.max(...sec.widgets.map((w) => widgetH(w.key, w.opts))) + 8
    default: return 20
  }
}

/* one section for a registry key, for the UI's "add block" (random content). */
export function sectionForKey(key, seed) {
  const rng = mulberry32(hashStr(String(seed ?? key)))
  switch (key) {
    case 'statusbar': return genStatusbar(rng)
    case 'sectionLabel': return genLabel(rng)
    case 'readouts': return genReadouts(rng)
    case 'hexStrip': return genStrip(rng)
    case 'transport': return genTransport(rng)
    case 'dualNum': return genDual(rng)
    default: { const w = widgetFor(key); return w ? { kind: 'widgets', widgets: [{ key, opts: randParams(w, rng) }] } : null }
  }
}

export function generate(seed, { aspect = 9 / 16, theme = null, lockTheme = false } = {}) {
  const rng = mulberry32(hashStr(String(seed)))
  const th = lockTheme && theme ? theme : pick(rng, THEMES)
  const columns = aspect >= 1.5 ? 3 : aspect >= 0.95 ? 2 : 1
  const dims = aspect >= 1 ? { w: Math.round(DESIGN * aspect), h: DESIGN } : { w: DESIGN, h: Math.round(DESIGN / aspect) }
  const sections = [genStatusbar(rng)]

  // fill by height budget per column (≈92% to leave a little breathing room)
  const perColBudget = Math.max(140, dims.h - 44)
  const target = columns * perColBudget * 1.15 // over-generate; render trims to fit
  let sumH = 0
  let guard = 0
  while (sumH < target && guard++ < 60) {
    if (rng() < 0.55) { const l = genLabel(rng); sections.push(l); sumH += heightOf(l) }
    const roll = rng()
    const sec = roll < 0.72 ? genWidgets(rng) : roll < 0.88 ? genReadouts(rng) : (rng() < 0.5 ? genStrip(rng) : genDual(rng))
    sections.push(sec); sumH += heightOf(sec)
  }
  if (rng() < 0.6) sections.push(genTransport(rng))
  sections.forEach((s, i) => { s.id = i }) // stable ids for remove / filter
  return { seed, theme: th, columns, dims, aspect, sections }
}

/* spec → live DOM. Returns p5 instances; DOM widgets hang _cleanup themselves.
 * editable: wrap each section so the UI can hover-remove it (× carries sec.id). */
export function renderComposition(spec, node, { editable = false } = {}) {
  const instances = []
  const screen = el('div', `screen theme-${spec.theme}`)
  screen.style.width = `${spec.dims.w}px`
  screen.style.height = `${spec.dims.h}px`
  screen.style.overflow = 'hidden'
  screen.style.position = 'relative'

  // global layout / typography controls (spec-level)
  const lay = spec.layout || {}
  if (spec.uiFont) screen.style.fontFamily = fontStack(spec.uiFont)
  if (lay.padT != null) screen.style.padding = `${lay.padT}px ${lay.padR}px ${lay.padB}px ${lay.padL}px`
  node.appendChild(screen)

  // content fills the frame width; render trims it to fit the height
  const content = el('div')
  const gap = lay.gap != null ? lay.gap : 8
  content.style.cssText = `display:flex;flex-direction:column;gap:${gap}px;width:100%`
  if (lay.scale && lay.scale !== 1) { content.style.transform = `scale(${lay.scale})`; content.style.transformOrigin = 'top center' }
  screen.appendChild(content)

  const addWidget = (host, key, opts) => {
    const w = widgetFor(key)
    if (!w) return
    if (w.square) host.classList.add('sq') // circular controls stay 1:1, fixed size
    const inst = w.factory({ host, ...opts })
    if (inst) instances.push(inst)
  }
  const fill = (host, sec) => {
    if (sec.kind === 'statusbar') statusbar(host, sec.right)
    else if (sec.kind === 'label') label(host, sec.left, sec.right)
    else if (sec.kind === 'readouts') readouts(host, sec.items)
    else if (sec.kind === 'strip') numericStrip(host, sec.groups, sec.per)
    else if (sec.kind === 'dual') dualNum(host, sec.rows)
    else if (sec.kind === 'transport') transport(host, sec.label, sec.active)
    else if (sec.kind === 'widgets') {
      if (sec.widgets.length > 1) {
        const row = el('div', 'row'); host.appendChild(row)
        for (const wd of sec.widgets) { const wh = widgetHost(); row.appendChild(wh); addWidget(wh, wd.key, wd.opts) }
      } else {
        const wh = widgetHost('naked'); host.appendChild(wh); addWidget(wh, sec.widgets[0].key, sec.widgets[0].opts)
      }
    }
  }
  const place = (parent, sec) => {
    const start = instances.length
    const wrap = el('div', 'gen-section')
    if (sec.font) wrap.style.fontFamily = fontStack(sec.font) // per-element face override
    parent.appendChild(wrap)
    fill(wrap, sec)
    wrap._instances = instances.slice(start)
    wrap._h = heightOf(sec)
    wrap._id = sec.id ?? 0
    if (editable) {
      wrap.dataset.sec = String(sec.id) // click-to-select reads this id
      const btn = el('button', 'gen-remove'); btn.textContent = '×'; btn.dataset.sec = String(sec.id); btn.type = 'button'
      wrap.appendChild(btn)
    }
    return wrap
  }

  const header = spec.sections.find((s) => s.kind === 'statusbar')
  const footers = spec.sections.filter((s) => s.kind === 'transport')
  const body = spec.sections.filter((s) => s !== header && !footers.includes(s))

  if (header) place(content, header)
  const row = el('div', 'row'); row.style.alignItems = 'flex-start'; content.appendChild(row)
  const cols = []
  for (let c = 0; c < spec.columns; c++) {
    const cd = el('div'); cd.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;min-width:0'
    row.appendChild(cd); cols.push({ el: cd, wraps: [], h: 0 })
  }
  // greedy: each section to the currently-shortest column
  for (const sec of body) {
    let mi = 0
    for (let c = 1; c < cols.length; c++) if (cols[c].h < cols[mi].h) mi = c
    const w = place(cols[mi].el, sec); cols[mi].wraps.push(w); cols[mi].h += w._h
  }
  for (const f of footers) place(content, f)

  // trim trailing body sections (from the tallest column) until it fits the
  // frame at full width — fills width, never clips, no distortion. Re-runs as
  // p5 canvases mount (their heights aren't known synchronously).
  const trim = () => {
    let guard = 0
    while (content.offsetHeight > screen.clientHeight - 34 && guard++ < 60) {
      // tallest column whose tail is a generated section (added blocks ids ≥ 1000
      // are user-placed — don't auto-trim them)
      let t = -1
      for (let c = 0; c < cols.length; c++) {
        const w = cols[c].wraps
        if (!w.length || w[w.length - 1]._id >= 1000) continue
        if (t < 0 || cols[c].h > cols[t].h) t = c
      }
      if (t < 0) break
      const w = cols[t].wraps.pop(); cols[t].h -= w._h
      w.querySelectorAll('*').forEach((n) => n._cleanup?.())
      if (w._instances) for (const p of w._instances) { p.remove?.(); const i = instances.indexOf(p); if (i >= 0) instances.splice(i, 1) }
      w.remove()
    }
  }
  const ro = new ResizeObserver(trim)
  ro.observe(content); ro.observe(screen)
  content._cleanup = () => ro.disconnect()
  trim()

  return { instances }
}
