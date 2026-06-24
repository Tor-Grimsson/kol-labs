import { clamp01 } from './lib/util.js'
import { resolveParams } from '../lib/exprParam.js'
import { applyViewport } from './viewport.js'

// Draw a loop frame with the universal viewport camera wrapped around it (identity
// camera ⇒ no save/restore, renders exactly as the bare loop).
function drawWithViewport(ctx, loop, u, w, h, p) {
  if (!loop) return
  ctx.save()
  applyViewport(ctx, u, w, h, p)
  loop.draw(ctx, u, w, h, p)
  ctx.restore()
}

/* LoopPlayer2D — the Canvas2D runtime for `kind:'2d'` loops.
 *
 * Owns the playhead exactly like PrimitiveEngine (its 3D sibling): an rAF clock
 * accumulates time, wraps when looping, and the frame is derived as u = t/dur and
 * handed to the loop's pure `draw(ctx, u, w, h, params)`. It satisfies the same
 * Player contract (seek / onProgress / setTransport / exportBlobAt / recordLoop /
 * dispose) so the framework Scrubber + TransportBar + ExportPanel drive 2d and 3d
 * loops identically. See contract.js.
 *
 * The loop is responsible for painting the full frame (or intentionally
 * accumulating — the player never auto-clears). Exports render onto an OFFSCREEN
 * canvas at exact pixels, so the visible canvas is never disturbed.
 */
export default class LoopPlayer2D {
  constructor(canvas, loop, params) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.loop = loop
    this.params = params || {}
    this.dur = loop?.duration || 6
    this.accum = 0
    this.last = performance.now()
    this.paused = false
    this.loopFlag = true
    this.speed = 1
    this.w = 0
    this.h = 0
    this.dpr = 1
    this.onProgress = null
    this.raf = requestAnimationFrame(this.tick)
  }

  _t() {
    return this.loopFlag
      ? ((this.accum % this.dur) + this.dur) % this.dur
      : Math.min(this.accum, this.dur)
  }

  _u() {
    return this.dur > 0 ? this._t() / this.dur : 0
  }

  setLoop(loop, params) {
    this.loop = loop
    this.dur = loop?.duration || 6
    if (params) this.params = params
    this.accum = 0
  }

  setParams(params) {
    this.params = params
  }

  setTransport({ paused, speed, loop, duration } = {}) {
    if (paused != null) this.paused = paused
    if (speed != null) this.speed = speed
    if (loop != null) this.loopFlag = loop
    if (duration != null) this.dur = duration
  }

  seek(frac) {
    this.accum = clamp01(frac) * this.dur
  }

  // CSS px in; the backing store is scaled by devicePixelRatio (capped at 2) so
  // the draw fn works in logical px, matching the renderer-side convention.
  resize(wCss, hCss) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.max(1, Math.round(wCss * dpr))
    this.canvas.height = Math.max(1, Math.round(hCss * dpr))
    this.w = wCss
    this.h = hCss
    this.dpr = dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  tick = () => {
    this.raf = requestAnimationFrame(this.tick)
    const now = performance.now()
    const dt = (now - this.last) / 1000
    this.last = now
    if (!this.paused) this.accum += dt * this.speed
    const t = this._t()
    if (this.onProgress) this.onProgress({ t, dur: this.dur })
    if (this.w && this.h && this.loop) {
      // Expression params resolve against loop-local time, so periodic exprs
      // stay seamless across the loop boundary.
      const p = resolveParams(this.params, t)
      drawWithViewport(this.ctx, this.loop, this.dur > 0 ? t / this.dur : 0, this.w, this.h, p)
    }
  }

  // Render the CURRENT frame onto an offscreen canvas at (w, h) px → PNG blob.
  exportBlobAt(w, h) {
    const off = document.createElement('canvas')
    off.width = Math.max(1, Math.round(w))
    off.height = Math.max(1, Math.round(h))
    drawWithViewport(off.getContext('2d'), this.loop, this._u(), off.width, off.height, resolveParams(this.params, this._t()))
    return new Promise((resolve) => off.toBlob(resolve, 'image/png'))
  }

  exportBlob() {
    return this.exportBlobAt(Math.round(this.w), Math.round(this.h))
  }

  // One seamless loop (u:0→1 over dur at realtime) recorded off an offscreen
  // canvas, so the visible stage is untouched. Returns a webm Blob (or null).
  recordLoop(w, h, fps = 30) {
    if (typeof MediaRecorder === 'undefined') return Promise.resolve(null)
    w = Math.max(1, Math.round(w || this.w))
    h = Math.max(1, Math.round(h || this.h))
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    if (!off.captureStream) return Promise.resolve(null)
    const ctx = off.getContext('2d')
    const stream = off.captureStream(fps)
    const ok = (type) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
        : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }

    let raf = 0
    let start = null
    return new Promise((resolve) => {
      rec.onstop = () => { cancelAnimationFrame(raf); resolve(new Blob(chunks, { type: 'video/webm' })) }
      const step = () => {
        const now = performance.now()
        if (start == null) start = now
        const el = (now - start) / 1000
        const u = this.dur > 0 ? Math.min(el / this.dur, 1) : 0
        drawWithViewport(ctx, this.loop, u, w, h, resolveParams(this.params, u * this.dur))
        if (el >= this.dur) { rec.stop(); return }
        raf = requestAnimationFrame(step)
      }
      rec.start()
      raf = requestAnimationFrame(step)
    })
  }

  dispose() {
    cancelAnimationFrame(this.raf)
  }
}
