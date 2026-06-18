import * as THREE from 'three'
import { resolveParams, hasExpr } from '../../../../lib/exprParam.js'

/**
 * Chromatic-aberration distortion engine.
 *
 * Pipeline (per frame):
 *   1. Trail pass — a feedback render target that fades toward black each frame
 *      (uDecay) and stamps a soft blob at the eased cursor position while the
 *      pointer is moving (uActive decays when it stops → the trail fades out).
 *      Ping-ponged between two RTs.
 *   2. Display pass — samples the image, displaced by the *gradient* of the
 *      trail (a lens-like push around the cursor), and reads the R/G/B channels
 *      at separately offset positions along that gradient (the colour bleed).
 *
 * The image is fit "cover" into the canvas via uImageScale/uImageOffset.
 */

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const TRAIL_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uDecay;
  uniform float uAspect;
  uniform float uActive;
  void main() {
    float prev = texture2D(uPrev, vUv).r;
    vec2 d = vUv - uMouse;
    d.x *= uAspect;
    float blob = smoothstep(uRadius, 0.0, length(d)) * uActive;
    float v = max(prev * uDecay, blob);
    gl_FragColor = vec4(vec3(v), 1.0);
  }
`

const DISPLAY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform sampler2D uTrail;
  uniform vec2 uImageScale;
  uniform vec2 uImageOffset;
  uniform float uStrength;
  uniform float uRGBShift;
  uniform vec2 uTexel;
  void main() {
    // Trail intensity at this pixel, plus its gradient (points toward the
    // cursor's bright centre → the refraction direction).
    float t  = texture2D(uTrail, vUv).r;
    float tL = texture2D(uTrail, vUv - vec2(uTexel.x, 0.0)).r;
    float tR = texture2D(uTrail, vUv + vec2(uTexel.x, 0.0)).r;
    float tD = texture2D(uTrail, vUv - vec2(0.0, uTexel.y)).r;
    float tU = texture2D(uTrail, vUv + vec2(0.0, uTexel.y)).r;
    vec2 grad = vec2(tR - tL, tU - tD);
    vec2 dir = length(grad) > 1e-5 ? normalize(grad) : vec2(0.0);

    vec2 disp = grad * uStrength;
    // Chromatic aberration — R/G/B read at positions offset along the trail
    // direction, magnitude = trail intensity x shift. (The old code scaled by
    // gradient *magnitude*, which is tiny → sub-pixel, no visible split.)
    vec2 chroma = dir * t * uRGBShift;

    vec2 base = vUv * uImageScale + uImageOffset;
    float r = texture2D(uImage, base + disp + chroma).r;
    float g = texture2D(uImage, base + disp).g;
    float b = texture2D(uImage, base + disp - chroma).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }
`

const TRAIL_SCALE = 0.5 // trail RT runs at half canvas res — softer + cheaper

export default class DistortionEngine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
    this.renderer.setClearColor(0x000000, 0) // transparent → the stage's bg-surface-secondary shows through

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)

    this.target = new THREE.Vector2(0.5, 0.5)
    this.eased = new THREE.Vector2(0.5, 0.5)
    this.active = 0
    this.params = { strength: 0.25, radius: 0.18, decay: 0.94, rgbShift: 0.03 }
    this._raw = { ...this.params }   // as authored (may hold expression strings)
    this._exprActive = false
    this.size = new THREE.Vector2(1, 1)
    this.imageAspect = 1
    this.texture = null
    this._raf = null
    this.paused = false
    this.timeScale = 1
    // No motion of its own (cursor-driven) — but an expression param needs a
    // clock to animate against, so the engine keeps a playhead.
    this.time = 0
    this.last = performance.now()

    const rtOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.rtA = new THREE.WebGLRenderTarget(2, 2, rtOpts)
    this.rtB = new THREE.WebGLRenderTarget(2, 2, rtOpts)

    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: {
        uPrev: { value: null },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uRadius: { value: this.params.radius },
        uDecay: { value: this.params.decay },
        uAspect: { value: 1 },
        uActive: { value: 0 },
      },
    })

    this.displayMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        uImage: { value: null },
        uTrail: { value: null },
        uImageScale: { value: new THREE.Vector2(1, 1) },
        uImageOffset: { value: new THREE.Vector2(0, 0) },
        uStrength: { value: this.params.strength },
        uRGBShift: { value: this.params.rgbShift },
        uTexel: { value: new THREE.Vector2(0.5, 0.5) },
      },
    })

    this.quad = new THREE.Mesh(this.geo, this.trailMat)
    this.scene.add(this.quad)
    this._clearTargets()
  }

  _clearTargets() {
    this.renderer.setRenderTarget(this.rtA)
    this.renderer.clear()
    this.renderer.setRenderTarget(this.rtB)
    this.renderer.clear()
    this.renderer.setRenderTarget(null)
  }

  setImage(image) {
    if (this.texture) this.texture.dispose()
    // VideoTexture self-updates every frame; static images upload once.
    const isVideo = typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement
    const tex = isVideo ? new THREE.VideoTexture(image) : new THREE.Texture(image)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    if (!isVideo) tex.needsUpdate = true
    this.texture = tex
    this.imageAspect = image.width / image.height
    this.displayMat.uniforms.uImage.value = tex
    this._updateFit()
  }

  setParams(p) {
    Object.assign(this._raw, p)
    this._exprActive = hasExpr(this._raw)
    this._apply()
  }

  // Resolve expression params at the current playhead and push to uniforms.
  _apply() {
    this.params = resolveParams(this._raw, this.time)
    this.trailMat.uniforms.uRadius.value = this.params.radius
    this.trailMat.uniforms.uDecay.value = this.params.decay
    this.displayMat.uniforms.uStrength.value = this.params.strength
    this.displayMat.uniforms.uRGBShift.value = this.params.rgbShift
  }

  /** Pointer position in uv space (0..1, origin bottom-left). */
  setPointer(u, v) {
    this.target.set(u, v)
    this.active = 1
  }

  // Transport hooks: freeze the animation, scale its rate, clear the trail.
  setPaused(p) { this.paused = !!p }
  setTimeScale(s) { this.timeScale = Math.max(0.05, s) }
  clearTrail() { this._clearTargets() }

  resize(w, h) {
    if (w < 1 || h < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    const rw = Math.max(2, Math.round(w * TRAIL_SCALE))
    const rh = Math.max(2, Math.round(h * TRAIL_SCALE))
    this.rtA.setSize(rw, rh)
    this.rtB.setSize(rw, rh)
    this.size.set(w, h)
    this.trailMat.uniforms.uAspect.value = w / h
    this.displayMat.uniforms.uTexel.value.set(1 / rw, 1 / rh)
    this._updateFit()
    this._clearTargets()
  }

  _updateFit() {
    const canvasAspect = this.size.x / this.size.y
    let sx
    let sy
    if (this.imageAspect > canvasAspect) {
      sx = canvasAspect / this.imageAspect
      sy = 1
    } else {
      sx = 1
      sy = this.imageAspect / canvasAspect
    }
    this.displayMat.uniforms.uImageScale.value.set(sx, sy)
    this.displayMat.uniforms.uImageOffset.value.set((1 - sx) / 2, (1 - sy) / 2)
  }

  start() {
    if (this._raf) return
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      this._frame()
    }
    this._raf = requestAnimationFrame(loop)
  }

  _frame() {
    if (this.paused) return
    // Advance the playhead and re-resolve expression params (if any).
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.time += dt * this.timeScale
    if (this._exprActive) this._apply()

    this.eased.lerp(this.target, 0.12 * this.timeScale) // cursor lag

    // Trail feedback pass (rtA = previous, render into rtB, then swap).
    this.quad.material = this.trailMat
    this.trailMat.uniforms.uPrev.value = this.rtA.texture
    this.trailMat.uniforms.uMouse.value.copy(this.eased)
    this.trailMat.uniforms.uActive.value = this.active
    this.renderer.setRenderTarget(this.rtB)
    this.renderer.render(this.scene, this.camera)
    const tmp = this.rtA
    this.rtA = this.rtB
    this.rtB = tmp
    this.active *= 0.9 // stamping fades once the pointer stops feeding setPointer

    // Display pass to screen.
    this.renderer.setRenderTarget(null)
    if (this.texture) {
      this.quad.material = this.displayMat
      this.displayMat.uniforms.uTrail.value = this.rtA.texture
      this.renderer.render(this.scene, this.camera)
    } else {
      this.renderer.clear()
    }
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    this.rtA.dispose()
    this.rtB.dispose()
    this.trailMat.dispose()
    this.displayMat.dispose()
    this.geo.dispose()
    if (this.texture) this.texture.dispose()
    this.renderer.dispose()
  }
}
