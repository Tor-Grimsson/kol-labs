import { buildPath, isArray } from './paths.js'
import { glyphAnim } from './animations.js'
import { featureString } from './opentype.js'
import { fontByKey, vfString } from '../lib/vfAxes.js'
import { resolveParams } from '../../../lib/exprParam.js'

/* KineticType — the SVG type composition engine for /kinetic.
 *
 * A composition is a FRAME ({ bg }) holding N INSTANCES, each an independent type
 * element with its own text · font · colour · arrangement (path or grid) · variable
 * axes · OpenType features · internal animation. The three Generate tabs map onto
 * this: Design = the frame (content/colour/theme), Layout = the instance list +
 * each one's arrangement type, Edit = the selected instance's typography/motion.
 *
 * Why SVG: Canvas 2D can't set per-glyph variable-font axes, so each glyph is its
 * own <text>. We measure advances with the browser (getStartPositionOfChar /
 * getComputedTextLength — these reflect real VF/feature widths), place each onto a
 * curve via getPointAtLength + a tangent (or a grid cell for 'array'), and animate
 * as a pure fn of u∈[0,1] (seamless).
 *
 * Satisfies the Player contract (seek/onProgress/setTransport/exportBlobAt/
 * recordLoop/dispose) so the framework Scrubber + TransportBar + ExportPanel drive
 * it identically. Loads paused.
 */
const NS = 'http://www.w3.org/2000/svg'
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const el = (name) => document.createElementNS(NS, name)

// Accept the new composition shape, or wrap a legacy single-instance params blob.
function asComposition(params) {
  if (!params) return { bg: '#16202E', instances: [] }
  if (Array.isArray(params.instances)) return params
  const { bg, ...rest } = params
  return { bg: bg || '#16202E', instances: [{ id: 'main', ...rest }] }
}

export default class KineticType {
  constructor(host, params) {
    this.host = host
    this.params = asComposition(params)
    this.dur = 6
    this.accum = 0
    this.last = performance.now()
    this.paused = true
    this.loopFlag = true
    this.speed = 1
    this.w = 0
    this.h = 0
    this.onProgress = null
    this._rt = new Map() // id → { group, pathEl, glyphG, glyphEls, cache, glyphKey, closed }
    this._instSig = '' // instance-id signature; reconcile the DOM only when it changes
    this._needsRemeasure = false // set when fonts finish loading → drop caches once
    this._fontCss = {} // url → base64 @font-face css (export)

    const svg = el('svg')
    svg.setAttribute('xmlns', NS)
    svg.style.display = 'block'
    svg.style.maxWidth = '100%'
    svg.style.maxHeight = '100%'
    // Clip to the frame (the SVG box = the aspect ratio) by default, so type that
    // flows past the edges crops at the frame like a poster bleed instead of
    // spilling across the whole stage. params.clip === false → 'visible' (no clip).
    svg.style.overflow = 'hidden'
    this._clipApplied = true
    this.bg = el('rect')
    this.layer = el('g')          // holds every instance group (export reads this)
    this.layer.setAttribute('data-layer', '')
    this.measEl = el('text')      // shared hidden measure node
    this.measEl.setAttribute('x', '0')
    this.measEl.setAttribute('y', '0')
    this.measEl.style.visibility = 'hidden'
    svg.append(this.bg, this.layer, this.measEl)
    host.appendChild(svg)
    this.svg = svg

    // Re-measure once real fonts finish loading (initial metrics may be fallback).
    // Flag it — the instance runtimes don't exist yet here, so clearing their
    // caches now would be a no-op; _render drops them on the next frame instead.
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => { this._needsRemeasure = true }).catch(() => {})
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  resize(wCss, hCss) {
    this.w = wCss
    this.h = hCss
    this.svg.setAttribute('width', wCss)
    this.svg.setAttribute('height', hCss)
    this.svg.setAttribute('viewBox', `0 0 ${wCss} ${hCss}`)
    this.bg.setAttribute('width', wCss)
    this.bg.setAttribute('height', hCss)
    for (const rt of this._rt.values()) rt.cache = null
  }

  setParams(params) { this.params = asComposition(params) }
  setTransport({ paused, speed, loop, duration } = {}) {
    if (paused != null) this.paused = paused
    if (speed != null) this.speed = speed
    if (loop != null) this.loopFlag = loop
    if (duration != null) this.dur = duration
  }

  seek(frac) { this.accum = clamp01(frac) * this.dur }
  _t() { return this.loopFlag ? ((this.accum % this.dur) + this.dur) % this.dur : Math.min(this.accum, this.dur) }

  // Resolve time-expression params for ONE instance — top-level + nested vf/path/
  // motion (resolveParams only walks one level). Identity when nothing's an expr.
  _resolve(raw, t) {
    if (!raw) return raw
    const top = resolveParams(raw, t)
    const vf = resolveParams(raw.vf, t)
    const path = resolveParams(raw.path, t)
    const motion = resolveParams(raw.motion, t)
    if (top === raw && vf === raw.vf && path === raw.path && motion === raw.motion) return raw
    return { ...top, vf, path, motion }
  }

  tick = () => {
    this.raf = requestAnimationFrame(this.tick)
    const now = performance.now()
    const dt = (now - this.last) / 1000
    this.last = now
    if (!this.paused) this.accum += dt * this.speed
    const t = this._t()
    if (this.onProgress) this.onProgress({ t, dur: this.dur })
    if (this.w && this.h) this._render(this.dur > 0 ? t / this.dur : 0)
  }

  // ── runtime DOM reconciliation: one <g> per instance, keyed by id, kept in
  // params order so z-stacking follows the Layout list. ──
  _syncInstances() {
    const insts = this.params.instances || []
    // Reconcile the DOM only when the instance set/order actually changes — not
    // every frame (param edits keep the same ids → nothing to move).
    const sig = insts.map((i) => i.id).join('|')
    if (sig === this._instSig) return
    this._instSig = sig
    const ids = new Set(insts.map((i) => i.id))
    for (const [id, rt] of this._rt) {
      if (!ids.has(id)) { rt.group.remove(); this._rt.delete(id) }
    }
    for (const inst of insts) {
      let rt = this._rt.get(inst.id)
      if (!rt) {
        const group = el('g')
        const pathEl = el('path')
        pathEl.setAttribute('fill', 'none')
        const glyphG = el('g')
        glyphG.setAttribute('data-glyphs', inst.id) // located in the export clone
        group.append(pathEl, glyphG)
        rt = { group, pathEl, glyphG, glyphEls: [], cache: null, glyphKey: '', closed: false }
        this._rt.set(inst.id, rt)
      }
      this.layer.appendChild(rt.group) // re-append → enforce DOM/z order
    }
  }

  _render(u) {
    this.params = asComposition(this.params)
    // clip-to-frame toggle (default on) → SVG overflow
    const clip = this.params.clip !== false
    if (clip !== this._clipApplied) { this._clipApplied = clip; this.svg.style.overflow = clip ? 'hidden' : 'visible' }
    // fonts just finished loading → drop every measure cache so glyph metrics
    // re-measure against the real font (not the fallback used on first paint).
    if (this._needsRemeasure) {
      this._needsRemeasure = false
      for (const rt of this._rt.values()) rt.cache = null
    }
    this.bg.setAttribute('fill', this.params.bg || '#16202E')
    this._syncInstances()
    for (const inst of this.params.instances) {
      const rt = this._rt.get(inst.id)
      if (rt) this._renderInstance(inst, rt, u)
    }
  }

  // Build/refresh an instance's per-glyph <text> pool (text × copies). Keyed by
  // text|font|copies so a content change rebuilds, a param tweak doesn't.
  _ensureGlyphs(rt, text, font, copies) {
    const key = `${text}|${font.family}|${copies}`
    if (key === rt.glyphKey) return
    rt.glyphKey = key
    rt.glyphG.textContent = ''
    rt.glyphEls = []
    for (let c = 0; c < copies; c++) {
      for (const ch of text) {
        const t = el('text')
        t.setAttribute('text-anchor', 'middle')
        t.setAttribute('dominant-baseline', 'central')
        t.textContent = ch
        rt.glyphG.appendChild(t)
        rt.glyphEls.push(t)
      }
    }
  }

  // Measure ONE run of `text` (already multiplied) → glyph centres (arc-length
  // offsets) + total advance, at the base axis/feature values. Cached per instance.
  _measure(rt, p, font, text) {
    const ls = p.letterSpacing || 0
    const feat = featureString(p.opentype)
    const key = `${text}|${font.family}|${p.fontSize}|${ls}|${vfString(p.vf)}|${feat}`
    if (rt.cache && rt.cache.key === key) return rt.cache
    const m = this.measEl
    m.style.fontFamily = `'${font.family}'`
    m.style.fontSize = `${p.fontSize}px`
    m.style.letterSpacing = `${ls}px`
    m.style.fontVariationSettings = vfString(p.vf)
    m.style.fontFeatureSettings = feat
    m.textContent = text
    const n = text.length
    const centers = new Array(n)
    let total = 0
    try {
      total = m.getComputedTextLength()
      const starts = new Array(n)
      for (let i = 0; i < n; i++) starts[i] = m.getStartPositionOfChar(i).x
      for (let i = 0; i < n; i++) centers[i] = (starts[i] + (i + 1 < n ? starts[i + 1] : total)) / 2
    } catch {
      total = p.fontSize * 0.6 * n
      for (let i = 0; i < n; i++) centers[i] = (i + 0.5) * (total / Math.max(1, n))
    }
    rt.cache = { key, centers, total }
    return rt.cache
  }

  _renderInstance(raw, rt, u) {
    const p = this._resolve(raw, this._t())
    rt.live = p
    const font = fontByKey(p.font)
    // type multiplier — repeat the word N times into one run so a single instance
    // makes N copies without retyping (joined by two spaces for a clean gap).
    const base = p.text || ''
    const mult = Math.max(1, Math.round(p.multiply || 1))
    const text = mult > 1 && base ? Array(mult).fill(base).join('  ') : base
    const type = p.path?.type || 'line'

    // position offset (normalized) → translate the whole instance group. Lets the
    // user drag the text anywhere, including off the frame edges (flow).
    const ox = (p.offset?.x || 0) * this.w
    const oy = (p.offset?.y || 0) * this.h
    rt.group.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`)

    if (isArray(type)) {
      rt.pathEl.setAttribute('d', '')
      rt.pathEl.style.opacity = 0
      const rows = Math.max(1, Math.round(p.path?.rows ?? 2))
      const cols = Math.max(1, Math.round(p.path?.cols ?? 3))
      this._ensureGlyphs(rt, text, font, rows * cols)
      if (!text.length) return
      this._measure(rt, p, font, text)
      this._placeArray(p, rt, font, u, rt.glyphEls, rows, cols)
      return
    }

    const path = buildPath(type, this.w, this.h, p.path || {})
    rt.closed = path.closed
    rt.pathEl.setAttribute('d', path.d)
    rt.pathEl.setAttribute('stroke', p.showPath ? (p.fill || '#888') : 'none')
    rt.pathEl.setAttribute('stroke-width', p.showPath ? 1 : 0)
    rt.pathEl.style.opacity = p.showPath ? 0.25 : 0
    this._ensureGlyphs(rt, text, font, 1)
    if (!text.length) return
    this._measure(rt, p, font, text)
    this._placeOnPath(p, rt, font, u, rt.glyphEls)
  }

  // common per-glyph styling (live + export share this)
  _styleGlyph(el2, p, font, a) {
    el2.style.fontFamily = `'${font.family}'`
    el2.style.fontSize = `${p.fontSize}px`
    el2.style.fontVariationSettings = vfString(a.vf ? { ...p.vf, ...a.vf } : p.vf)
    el2.style.fontFeatureSettings = featureString(p.opentype)
    el2.setAttribute('fill', p.fill || '#e8e4dc')
    el2.setAttribute('opacity', a.opacity)
  }

  _motionAxis(p, font) {
    const motion = p.motion || { mode: 'none' }
    return font.axes.find((a) => a.tag === (motion.axis || (font.axes[0] && font.axes[0].tag)))
  }

  // Place glyphs `els` along this instance's path (geometry from rt.pathEl, which
  // is attached for getPointAtLength). Used live AND for export clones (els = clone).
  _placeOnPath(p, rt, font, u, els) {
    const cache = rt.cache
    if (!cache) return
    const pathLen = rt.pathEl.getTotalLength()
    if (!pathLen) return
    const { centers, total } = cache
    const align = p.align || 'center'
    const startLen = align === 'start' ? 0 : align === 'end' ? pathLen - total : (pathLen - total) / 2
    const motion = p.motion || { mode: 'none' }
    const axis = this._motionAxis(p, font)
    const eps = 0.75
    const closed = rt.closed
    // 'flow' = let glyphs run past an open path's ends (overflow the frame) by
    // extrapolating along the end tangent; 'contain' clamps them inside.
    const flow = p.flow === 'flow' && !closed
    const wrap = (L) => closed ? ((L % pathLen) + pathLen) % pathLen : Math.max(0, Math.min(pathLen, L))
    const ptAt = (L) => {
      if (flow && (L < 0 || L > pathLen)) {
        const edge = L < 0 ? 0 : pathLen
        const base = rt.pathEl.getPointAtLength(edge)
        const a2 = rt.pathEl.getPointAtLength(Math.max(0, edge - eps))
        const b2 = rt.pathEl.getPointAtLength(Math.min(pathLen, edge + eps))
        let dx = b2.x - a2.x, dy = b2.y - a2.y
        const len = Math.hypot(dx, dy) || 1
        dx /= len; dy /= len
        const over = L - edge
        return { x: base.x + dx * over, y: base.y + dy * over }
      }
      return rt.pathEl.getPointAtLength(wrap(L))
    }
    const n = Math.min(els.length, centers.length)

    for (let i = 0; i < n; i++) {
      // base point (pre-motion) → the glyph's normalized position for field sweeps
      const L0 = startLen + centers[i]
      const pBase = ptAt(L0)
      const a = glyphAnim(motion.mode || 'none', {
        i, n: centers.length, u, m: motion, sizePx: p.fontSize, pathLen,
        axisTag: axis ? axis.tag : 'wght', axisMin: axis ? axis.min : 100, axisMax: axis ? axis.max : 900,
        nx: this.w ? pBase.x / this.w : 0.5, ny: this.h ? pBase.y / this.h : 0.5,
      })
      const L = L0 + a.dLen
      const pt = ptAt(L)
      const A = ptAt(L - eps)
      const B = ptAt(L + eps)
      const ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI
      els[i].setAttribute('transform',
        `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${(ang + a.dRot).toFixed(2)}) translate(0 ${(-a.dNormal).toFixed(2)}) scale(${a.scale.toFixed(3)})`)
      this._styleGlyph(els[i], p, font, a)
    }
  }

  // Place glyphs `els` as a rows×cols grid of the text (the 'array' arrangement).
  // Motion still applies per glyph (dNormal → vertical, scale/opacity/vf as-is;
  // dLen has no path so it's ignored). Seamless: u only enters via the motion.
  _placeArray(p, rt, font, u, els, rows, cols) {
    const cache = rt.cache
    if (!cache) return
    const { centers, total } = cache
    const len = centers.length // measured run length (already multiplied)
    if (!len) return
    const m = Math.min(this.w, this.h) * 0.08
    const cellW = (this.w - 2 * m) / cols
    const cellH = (this.h - 2 * m) / rows
    const motion = p.motion || { mode: 'none' }
    const axis = this._motionAxis(p, font)

    for (let cell = 0; cell < rows * cols; cell++) {
      const r = Math.floor(cell / cols)
      const c = cell % cols
      const cx = m + c * cellW + cellW / 2
      const cy = m + r * cellH + cellH / 2
      const originX = cx - total / 2
      for (let j = 0; j < len; j++) {
        const idx = cell * len + j
        const el2 = els[idx]
        if (!el2) continue
        const x = originX + centers[j]
        const a = glyphAnim(motion.mode || 'none', {
          i: cell * len + j, n: rows * cols * len, u, m: motion, sizePx: p.fontSize, pathLen: 0,
          axisTag: axis ? axis.tag : 'wght', axisMin: axis ? axis.min : 100, axisMax: axis ? axis.max : 900,
          nx: this.w ? x / this.w : 0.5, ny: this.h ? cy / this.h : 0.5,
        })
        const y = cy - a.dNormal
        el2.setAttribute('transform',
          `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.dRot.toFixed(2)}) scale(${a.scale.toFixed(3)})`)
        this._styleGlyph(el2, p, font, a)
      }
    }
  }

  // ── export ── (vector → crisp at any @Nx)
  async _fontFaceCss(font) {
    if (this._fontCss[font.url]) return this._fontCss[font.url]
    const buf = await fetch(font.url).then((r) => r.arrayBuffer())
    const bytes = new Uint8Array(buf)
    let bin = ''
    const CH = 0x8000
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
    const b64 = btoa(bin)
    const fmt = font.url.endsWith('.woff2') ? 'woff2' : font.url.endsWith('.woff') ? 'woff' : 'truetype'
    const css = `@font-face{font-family:'${font.family}';src:url(data:font/${fmt};base64,${b64}) format('${fmt}');font-weight:1 1000;font-stretch:1% 1000%;}`
    this._fontCss[font.url] = css
    return css
  }

  // Embed every unique font used across the instances (multi-font compositions).
  async _allFontCss() {
    const fonts = new Map()
    for (const inst of (this.params.instances || [])) {
      const f = fontByKey(inst.font)
      fonts.set(f.url, f)
    }
    const css = []
    for (const f of fonts.values()) css.push(await this._fontFaceCss(f))
    return css.join('\n')
  }

  async exportBlobAt(w, h) {
    const css = await this._allFontCss()
    const clone = this.svg.cloneNode(true)
    clone.setAttribute('width', Math.round(w))
    clone.setAttribute('height', Math.round(h))
    const style = el('style')
    style.textContent = css
    clone.insertBefore(style, clone.firstChild)
    const str = new XMLSerializer().serializeToString(clone)
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(str)}`
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w))
    c.height = Math.max(1, Math.round(h))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return new Promise((res) => c.toBlob(res, 'image/png'))
  }

  exportBlob() { return this.exportBlobAt(Math.round(this.w), Math.round(this.h)) }

  // One seamless loop (u:0→1 over dur) → webm. Each frame re-places every
  // instance's clone glyphs (geometry read from the live, stable paths) and
  // rasterizes the detached clone. Capped at 900px. Visible stage untouched.
  async recordLoop(w, h, fps = 25) {
    if (typeof MediaRecorder === 'undefined') return null
    const insts = this.params.instances || []
    if (!insts.length) return null
    let tw = Math.max(1, Math.round(w || this.w))
    let th = Math.max(1, Math.round(h || this.h))
    const sc = Math.min(1, 900 / Math.min(tw, th))
    tw = Math.round(tw * sc)
    th = Math.round(th * sc)

    const css = await this._allFontCss()
    const clone = this.svg.cloneNode(true)
    clone.setAttribute('width', tw)
    clone.setAttribute('height', th)
    const style = el('style')
    style.textContent = css
    clone.insertBefore(style, clone.firstChild)

    // map each instance id → its clone glyph element list
    const cloneEls = new Map()
    clone.querySelectorAll('[data-glyphs]').forEach((g) => cloneEls.set(g.getAttribute('data-glyphs'), Array.from(g.children)))

    const off = document.createElement('canvas')
    off.width = tw
    off.height = th
    if (!off.captureStream) return null
    // Freeze the live rAF for the duration — the recorder samples the live path
    // geometry + caches per frame; letting the live loop mutate them mid-record
    // tears the output. Restarted in rec.onstop.
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null }
    const ctx = off.getContext('2d')
    const ok = (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm'
    const stream = off.captureStream(fps)
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }

    const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src })
    const frame = async (u) => {
      for (const inst of insts) {
        const rt = this._rt.get(inst.id)
        const els = cloneEls.get(inst.id)
        if (!rt || !els || !rt.live) continue
        const font = fontByKey(rt.live.font)
        const type = rt.live.path?.type || 'line'
        if (isArray(type)) {
          const rows = Math.max(1, Math.round(rt.live.path?.rows ?? 2))
          const cols = Math.max(1, Math.round(rt.live.path?.cols ?? 3))
          this._placeArray(rt.live, rt, font, u, els, rows, cols)
        } else {
          this._placeOnPath(rt.live, rt, font, u, els)
        }
      }
      const str = new XMLSerializer().serializeToString(clone)
      const im = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(str)}`)
      ctx.clearRect(0, 0, tw, th)
      ctx.drawImage(im, 0, 0, tw, th)
    }

    return new Promise((resolve) => {
      let start = null
      let stopped = false
      rec.onstop = () => {
        if (!this.raf) this.raf = requestAnimationFrame(this.tick) // resume the live loop
        resolve(new Blob(chunks, { type: 'video/webm' }))
      }
      const step = async () => {
        if (stopped) return
        const now = performance.now()
        if (start == null) start = now
        const elp = (now - start) / 1000
        try { await frame(Math.min(elp / this.dur, 1)) } catch { /* skip frame */ }
        if (elp >= this.dur) { stopped = true; if (rec.state !== 'inactive') rec.stop(); return }
        requestAnimationFrame(step)
      }
      rec.start()
      requestAnimationFrame(step)
    })
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    if (this.svg && this.svg.parentNode === this.host) this.host.removeChild(this.svg)
  }
}
