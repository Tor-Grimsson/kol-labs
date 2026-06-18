import { buildPath } from './paths.js'
import { glyphAnim } from './animations.js'
import { fontByKey, vfString } from '../lib/vfAxes.js'

/* KineticType — the SVG type-on-path engine for /kinetic.
 *
 * Why SVG: Canvas 2D can't set per-glyph variable-font axes, so each glyph is its
 * own <text>. We measure advances with the browser (getStartPositionOfChar /
 * getComputedTextLength — these reflect real VF widths), map each onto the curve
 * via path.getPointAtLength + a tangent from two ε-samples, and animate as a pure
 * fn of u∈[0,1] (seamless). A straight baseline is just a degenerate path.
 *
 * Satisfies the same Player contract as LoopPlayer2D / PrimitiveEngine
 * (seek/onProgress/setTransport/exportBlobAt/recordLoop/dispose) so the framework
 * Scrubber + TransportBar + ExportPanel drive it identically. Loads paused.
 *
 * Export is vector → crisp at any @Nx: clone the live SVG, embed the current font
 * as a base64 @font-face (CSS fonts don't survive SVG→Image rasterization), set
 * the target width/height (viewBox unchanged → scales), rasterize to a canvas.
 */
const NS = 'http://www.w3.org/2000/svg'
const clamp01 = (x) => Math.max(0, Math.min(1, x))

export default class KineticType {
  constructor(host, params) {
    this.host = host
    this.params = params || {}
    this.dur = 6
    this.accum = 0
    this.last = performance.now()
    this.paused = true
    this.loopFlag = true
    this.speed = 1
    this.w = 0
    this.h = 0
    this.onProgress = null
    this._cache = null // { key, centers, total }
    this._closed = false
    this._glyphKey = '' // text|font → when to rebuild the glyph pool
    this._fontCss = {} // url → base64 @font-face css (export)

    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('xmlns', NS)
    svg.style.display = 'block'
    svg.style.maxWidth = '100%'
    svg.style.maxHeight = '100%'
    this.bg = document.createElementNS(NS, 'rect')
    this.pathEl = document.createElementNS(NS, 'path')
    this.pathEl.setAttribute('fill', 'none')
    this.glyphG = document.createElementNS(NS, 'g')
    this.glyphG.setAttribute('data-glyphs', '') // found in the clone for webm export
    this.measEl = document.createElementNS(NS, 'text')
    this.measEl.setAttribute('x', '0')
    this.measEl.setAttribute('y', '0')
    this.measEl.style.visibility = 'hidden'
    svg.append(this.bg, this.pathEl, this.glyphG, this.measEl)
    host.appendChild(svg)
    this.svg = svg
    this.glyphEls = []

    // Re-measure once real fonts finish loading (initial metrics may be fallback).
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => { this._cache = null }).catch(() => {})
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
    this._cache = null
  }

  setParams(params) { this.params = params }
  setTransport({ paused, speed, loop, duration } = {}) {
    if (paused != null) this.paused = paused
    if (speed != null) this.speed = speed
    if (loop != null) this.loopFlag = loop
    if (duration != null) this.dur = duration
  }

  seek(frac) { this.accum = clamp01(frac) * this.dur }
  _t() { return this.loopFlag ? ((this.accum % this.dur) + this.dur) % this.dur : Math.min(this.accum, this.dur) }

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

  // Build/refresh the per-glyph <text> pool when the text or font changes.
  _ensureGlyphs(text, font) {
    const key = `${text}|${font.family}`
    if (key === this._glyphKey) return
    this._glyphKey = key
    this.glyphG.textContent = ''
    this.glyphEls = []
    for (const ch of text) {
      const t = document.createElementNS(NS, 'text')
      t.setAttribute('text-anchor', 'middle')
      t.setAttribute('dominant-baseline', 'central')
      t.textContent = ch
      this.glyphG.appendChild(t)
      this.glyphEls.push(t)
    }
  }

  // Measure glyph centres (arc-length offsets) using the browser. Cached by the
  // metrics-affecting params; reflects real VF widths at the base axis values.
  _measure(p, font) {
    const ls = p.letterSpacing || 0
    const key = `${p.text}|${font.family}|${p.fontSize}|${ls}|${vfString(p.vf)}`
    if (this._cache && this._cache.key === key) return this._cache
    const m = this.measEl
    m.style.fontFamily = `'${font.family}'`
    m.style.fontSize = `${p.fontSize}px`
    m.style.letterSpacing = `${ls}px`
    m.style.fontVariationSettings = vfString(p.vf)
    m.textContent = p.text
    const n = p.text.length
    const centers = new Array(n)
    let total = 0
    try {
      total = m.getComputedTextLength()
      const starts = new Array(n)
      for (let i = 0; i < n; i++) starts[i] = m.getStartPositionOfChar(i).x
      for (let i = 0; i < n; i++) centers[i] = (starts[i] + (i + 1 < n ? starts[i + 1] : total)) / 2
    } catch {
      // Fallback: even spacing.
      total = p.fontSize * 0.6 * n
      for (let i = 0; i < n; i++) centers[i] = (i + 0.5) * (total / Math.max(1, n))
    }
    this._cache = { key, centers, total }
    return this._cache
  }

  _render(u) {
    const p = this.params
    const font = fontByKey(p.font)
    const text = p.text || ''
    this.bg.setAttribute('fill', p.bg || '#0b0b0e')

    const path = buildPath(p.path?.type || 'line', this.w, this.h, p.path || {})
    this._closed = path.closed
    this.pathEl.setAttribute('d', path.d)
    this.pathEl.setAttribute('stroke', p.showPath ? (p.fill || '#888') : 'none')
    this.pathEl.setAttribute('stroke-width', p.showPath ? 1 : 0)
    this.pathEl.style.opacity = p.showPath ? 0.25 : 0

    this._ensureGlyphs(text, font)
    if (!text.length) return
    this._measure(p, font)
    this._placeAll(u, this.glyphEls)
  }

  // Place glyph elements `els` (live or an export clone's) for time u. Reads the
  // current path (this.pathEl, attached → getPointAtLength) + measured centres.
  _placeAll(u, els) {
    const p = this.params
    const font = fontByKey(p.font)
    const cache = this._cache
    if (!cache) return
    const pathLen = this.pathEl.getTotalLength()
    if (!pathLen) return
    const { centers, total } = cache
    const align = p.align || 'center'
    const startLen = align === 'start' ? 0 : align === 'end' ? pathLen - total : (pathLen - total) / 2
    const motion = p.motion || { mode: 'none' }
    const axis = font.axes.find((a) => a.tag === (motion.axis || (font.axes[0] && font.axes[0].tag)))
    const eps = 0.75
    const closed = this._closed
    const wrap = (L) => closed ? ((L % pathLen) + pathLen) % pathLen : Math.max(0, Math.min(pathLen, L))
    const n = Math.min(els.length, centers.length)

    for (let i = 0; i < n; i++) {
      const el = els[i]
      const a = glyphAnim(motion.mode || 'none', {
        i, n: els.length, u, m: motion, sizePx: p.fontSize, pathLen,
        axisTag: axis ? axis.tag : 'wght', axisMin: axis ? axis.min : 100, axisMax: axis ? axis.max : 900,
      })
      const L = wrap(startLen + centers[i] + a.dLen)
      const pt = this.pathEl.getPointAtLength(L)
      const A = this.pathEl.getPointAtLength(wrap(L - eps))
      const B = this.pathEl.getPointAtLength(wrap(L + eps))
      const ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI

      el.setAttribute('transform',
        `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${(ang + a.dRot).toFixed(2)}) translate(0 ${(-a.dNormal).toFixed(2)}) scale(${a.scale.toFixed(3)})`)
      el.style.fontFamily = `'${font.family}'`
      el.style.fontSize = `${p.fontSize}px`
      el.style.fontVariationSettings = vfString(a.vf ? { ...p.vf, ...a.vf } : p.vf)
      el.setAttribute('fill', p.fill || '#e8e4dc')
      el.setAttribute('opacity', a.opacity)
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

  async exportBlobAt(w, h) {
    const font = fontByKey(this.params.font)
    const css = await this._fontFaceCss(font)
    const clone = this.svg.cloneNode(true)
    clone.setAttribute('width', Math.round(w))
    clone.setAttribute('height', Math.round(h))
    const style = document.createElementNS(NS, 'style')
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

  // One seamless loop (u:0→1 over dur) → webm. Each frame is a fresh SVG→canvas
  // raster of a detached clone (font embedded), captured off an offscreen canvas.
  // Capped at 900px so the per-frame raster keeps ~realtime (font re-parse per
  // frame is the cost). Visible stage untouched. Returns a Blob (or null).
  async recordLoop(w, h, fps = 25) {
    if (typeof MediaRecorder === 'undefined' || !this._cache) return null
    let tw = Math.max(1, Math.round(w || this.w))
    let th = Math.max(1, Math.round(h || this.h))
    const sc = Math.min(1, 900 / Math.min(tw, th))
    tw = Math.round(tw * sc)
    th = Math.round(th * sc)

    const font = fontByKey(this.params.font)
    const css = await this._fontFaceCss(font)
    const clone = this.svg.cloneNode(true)
    clone.setAttribute('width', tw)
    clone.setAttribute('height', th)
    const style = document.createElementNS(NS, 'style')
    style.textContent = css
    clone.insertBefore(style, clone.firstChild)
    const grp = clone.querySelector('[data-glyphs]')
    const cloneEls = grp ? Array.from(grp.children) : []

    const off = document.createElement('canvas')
    off.width = tw
    off.height = th
    if (!off.captureStream) return null
    const ctx = off.getContext('2d')
    const ok = (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm'
    const stream = off.captureStream(fps)
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }

    const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src })
    const frame = async (u) => {
      this._placeAll(u, cloneEls)
      const str = new XMLSerializer().serializeToString(clone)
      const im = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(str)}`)
      ctx.clearRect(0, 0, tw, th)
      ctx.drawImage(im, 0, 0, tw, th)
    }

    return new Promise((resolve) => {
      let start = null
      let stopped = false
      rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
      const step = async () => {
        if (stopped) return
        const now = performance.now()
        if (start == null) start = now
        const el = (now - start) / 1000
        try { await frame(Math.min(el / this.dur, 1)) } catch { /* skip frame */ }
        if (el >= this.dur) { stopped = true; if (rec.state !== 'inactive') rec.stop(); return }
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
