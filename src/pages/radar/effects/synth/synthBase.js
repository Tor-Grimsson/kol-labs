import * as THREE from 'three'
import { resolveParams, resolveRate, hasExpr } from '../../../../lib/exprParam.js'

/* SynthEngine — shared base for the radar "Synth" effect family (analog
 * video-synthesis lineage: trails, slitscan, Rutt-Etra scan, disco). It owns the
 * renderer, the source texture (image OR video), the rAF loop + time clock, and
 * export (PNG + webm). Subclasses implement the render pipeline:
 *
 *   _setup()        build scene/camera/material(s)/render-targets
 *   _onImage()      source texture (re)assigned       (optional)
 *   _onParams()     params changed → push to uniforms  (optional)
 *   _resize(w,h)    canvas resized → size RTs/camera    (optional)
 *   _frame(dt)      render one frame to the screen      (REQUIRED)
 *   _dispose()      free subclass GPU resources         (optional)
 *
 * preserveDrawingBuffer is on so exportPNG()'s toBlob can read the canvas back.
 * The base is render-target-agnostic — quad effects use an ortho quad, the scan
 * effect uses a perspective line mesh; each builds its own scene in _setup(). */

export const FULLSCREEN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export default class SynthEngine {
  constructor(canvas) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0) // transparent → the stage's bg-surface-secondary shows through
    this._raw = {}          // params as authored (may hold expression strings)
    this.params = {}        // _raw resolved at the current playhead (what subclasses read)
    this._exprActive = false
    this.time = 0
    this.last = performance.now()
    this.tex = null
    this.isVideo = false
    this.imageAspect = 1
    this.w = 1
    this.h = 1
    this._raf = null
    this.paused = false
    this._setup()
  }

  setImage(image) {
    if (this.tex) this.tex.dispose()
    this.isVideo = typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement
    const tex = this.isVideo ? new THREE.VideoTexture(image) : new THREE.Texture(image)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    if (!this.isVideo) tex.needsUpdate = true
    this.tex = tex
    this.imageAspect = (image.width || 1) / (image.height || 1)
    this._onImage?.()
  }

  setParams(p) {
    Object.assign(this._raw, p)
    this._exprActive = hasExpr(this._raw)
    this._apply()
    // Tempo drives video playback rate too (1 = realtime).
    if (this.isVideo && this.tex?.image && this.params.speed) {
      try { this.tex.image.playbackRate = Math.max(0.0625, Math.min(16, this.params.speed)) } catch { /* ignore */ }
    }
  }

  // Resolve expression params at the current playhead and push to the subclass.
  _apply() {
    this.params = resolveParams(this._raw, this.time)
    this._onParams?.()
  }

  // Transport: pause freezes the time clock AND the source video; reset returns
  // the clock + video to 0 and clears any subclass buffers (_reset).
  setPaused(p) {
    this.paused = !!p
    if (this.isVideo && this.tex?.image) {
      const v = this.tex.image
      if (p) v.pause()
      else { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}) }
    }
  }

  reset() {
    this.time = 0
    if (this.isVideo && this.tex?.image) { try { this.tex.image.currentTime = 0 } catch { /* ignore */ } }
    this._reset?.()
  }

  resize(w, h) {
    if (w < 1 || h < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.w = w
    this.h = h
    this._resize?.(w, h)
  }

  // Cover-fit scale/offset for a fullscreen quad sampling the source (maps output
  // uv → source uv, centre-cropping the longer axis).
  coverFit() {
    const ca = this.w / this.h
    let sx
    let sy
    if (this.imageAspect > ca) { sx = ca / this.imageAspect; sy = 1 } else { sx = 1; sy = this.imageAspect / ca }
    return { sx, sy, ox: (1 - sx) / 2, oy: (1 - sy) / 2 }
  }

  start() {
    if (this._raf) return
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      const now = performance.now()
      const dt = Math.min(0.05, (now - this.last) / 1000) // clamp huge gaps (tab switch)
      this.last = now
      if (!this.paused) this.time += dt * resolveRate(this._raw.speed, this.time)
      if (this._exprActive) this._apply() // re-resolve at the new playhead → live uniforms
      this._frame(dt)
    }
    this._raf = requestAnimationFrame(loop)
  }

  // PNG = the current on-screen canvas as-is (preserves the accumulated state of
  // feedback effects; @Nx retarget would reset their buffers — deferred).
  exportPNG() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'))
  }

  // webm = capture the live canvas for `seconds`. (Aspect/scale retarget while
  // capturing is the shared roadmap-#4 gap — deferred; this records what's shown.)
  recordWebm(seconds = 6, fps = 30) {
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) return Promise.resolve(null)
    const stream = this.canvas.captureStream(fps)
    const ok = (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
        : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    return new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
      rec.start()
      setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, seconds * 1000)
    })
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    this._dispose?.()
    if (this.tex) this.tex.dispose()
    this.renderer.dispose()
  }
}
