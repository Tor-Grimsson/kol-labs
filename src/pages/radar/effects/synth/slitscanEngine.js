import * as THREE from 'three'
import SynthEngine, { FULLSCREEN_VERT } from './synthBase.js'

/* Slitscan — true time-displacement. A rolling N-frame history is stored in a
 * grid atlas (one cell per frame); the display samples, per pixel, a DIFFERENT
 * past frame chosen by a displacement ramp along an axis — so each column / row
 * shows the whole frame from a different moment (the time-smear, not a 1px slit).
 * Controls: axis (H/V/radial) · span (how deep into the history the ramp reaches)
 * · curve (bend the time ramp) · invert. Shines on video; a still has no temporal
 * change so it reads static. Transport pause freezes the capture. */

const COLS = 6
const ROWS = 6
const N = COLS * ROWS // history depth (frames)
const MAX_ATLAS = 4096

const STORE_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  void main() { gl_FragColor = texture2D(uImage, vUv * uScale + uOffset); }
`

const DISPLAY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uAtlas;
  uniform float uN, uCols, uRows, uHead;
  uniform int uAxis;     // 0 horizontal, 1 vertical, 2 radial
  uniform float uSpan;   // 0..1 fraction of the history the ramp spans
  uniform float uCurve;  // pow exponent — bends the time ramp
  uniform float uInvert; // flip the time direction
  void main() {
    float age;
    if (uAxis == 0) age = vUv.x;
    else if (uAxis == 1) age = vUv.y;
    else age = clamp(length(vUv - 0.5) / 0.70710678, 0.0, 1.0);
    if (uInvert > 0.5) age = 1.0 - age;
    age = pow(clamp(age, 0.0, 1.0), uCurve);
    float back = age * (uN - 1.0) * uSpan;          // frames into the past
    float fidx = mod(uHead - 1.0 - back + uN * 64.0, uN); // newest = head-1
    float cell = floor(fidx + 0.5);
    float cx = mod(cell, uCols);
    float cy = floor(cell / uCols);
    vec2 uvIn = mix(vec2(0.0015), vec2(0.9985), vUv); // inset hides cell-edge bleed
    vec2 a = (vec2(cx, cy) + uvIn) / vec2(uCols, uRows);
    gl_FragColor = texture2D(uAtlas, a);
  }
`

const RT_OPTS = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }

export default class SlitscanEngine extends SynthEngine {
  _setup() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.atlas = new THREE.WebGLRenderTarget(2, 2, RT_OPTS)
    this.head = 0
    this.cellW = 1
    this.cellH = 1
    this.storeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: STORE_FRAG,
      uniforms: { uImage: { value: null }, uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) } },
    })
    this.displayMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        uAtlas: { value: null }, uN: { value: N }, uCols: { value: COLS }, uRows: { value: ROWS }, uHead: { value: 0 },
        uAxis: { value: 0 }, uSpan: { value: 1 }, uCurve: { value: 1 }, uInvert: { value: 0 },
      },
    })
    this.quad = new THREE.Mesh(this.geo, this.storeMat)
    this.scene.add(this.quad)
  }

  _applyFit() {
    const { sx, sy, ox, oy } = this.coverFit()
    this.storeMat.uniforms.uScale.value.set(sx, sy)
    this.storeMat.uniforms.uOffset.value.set(ox, oy)
  }

  _onImage() { this._applyFit() }

  _onParams() {
    const p = this.params
    const u = this.displayMat.uniforms
    u.uAxis.value = p.axis === 'vertical' ? 1 : p.axis === 'radial' ? 2 : 0
    u.uSpan.value = Math.max(0.05, Math.min(1, p.span ?? 1))
    u.uCurve.value = Math.max(0.2, Math.min(4, p.curve ?? 1))
    u.uInvert.value = p.invert ? 1 : 0
  }

  _sizeAtlas(w, h) {
    const s = Math.min(1, MAX_ATLAS / (COLS * w), MAX_ATLAS / (ROWS * h))
    this.cellW = Math.max(2, Math.floor(w * s))
    this.cellH = Math.max(2, Math.floor(h * s))
    this.atlas.setSize(COLS * this.cellW, ROWS * this.cellH)
    this._clearAtlas()
  }

  _clearAtlas() {
    this.renderer.setRenderTarget(this.atlas)
    this.renderer.clear()
    this.renderer.setRenderTarget(null)
    this.head = 0
  }

  _reset() { this._clearAtlas() }

  _resize(w, h) {
    this._sizeAtlas(w, h)
    this._applyFit()
  }

  _frame() {
    if (!this.tex) { this.renderer.setRenderTarget(null); this.renderer.clear(); return }
    // Capture the live frame into the next history cell (frozen while paused).
    // Set the RT's OWN viewport (atlas pixels — not renderer.setViewport, which
    // scales by devicePixelRatio) so the cell lands exactly; the quad fills it.
    if (!this.paused) {
      const cx = this.head % COLS
      const cy = Math.floor(this.head / COLS)
      this.atlas.viewport.set(cx * this.cellW, cy * this.cellH, this.cellW, this.cellH)
      this.quad.material = this.storeMat
      this.storeMat.uniforms.uImage.value = this.tex
      this.renderer.setRenderTarget(this.atlas)
      this.renderer.render(this.scene, this.camera)
      this.head = (this.head + 1) % N
    }
    // Display: time-displaced sample of the history. setRenderTarget(null)
    // restores the full-canvas viewport (the RT viewport above was on the RT).
    this.quad.material = this.displayMat
    this.displayMat.uniforms.uAtlas.value = this.atlas.texture
    this.displayMat.uniforms.uHead.value = this.head
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
  }

  _dispose() {
    this.atlas.dispose()
    this.storeMat.dispose()
    this.displayMat.dispose()
    this.geo.dispose()
  }
}
