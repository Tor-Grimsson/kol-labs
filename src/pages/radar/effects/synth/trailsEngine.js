import * as THREE from 'three'
import SynthEngine, { FULLSCREEN_VERT } from './synthBase.js'

/* Trails — recursive video feedback ("70s video studio" / color-trail). Each
 * frame composites the source over a decayed, transformed copy of the previous
 * frame (ping-pong RTs). Per-channel decay + a chroma uv offset give the colour
 * trail; the feedback transform (zoom/rotate) induces motion on a STILL source
 * (the infinity-mirror tunnel) and trails motion on VIDEO. */

const FB_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform sampler2D uImage;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  uniform float uDecay;
  uniform float uRgb;     // per-channel decay spread (colour trail)
  uniform float uZoom;    // feedback zoom (1 = none)
  uniform float uRot;     // feedback rotation, rad/frame
  uniform float uShift;   // chroma uv offset for the feedback sample
  uniform float uMix;     // source contribution (0 = pure feedback)
  void main() {
    // Feedback uv: zoom + rotate around centre.
    vec2 c = vUv - 0.5;
    float s = sin(uRot), co = cos(uRot);
    c = mat2(co, -s, s, co) * c;
    c *= uZoom;
    vec2 pUv = c + 0.5;
    vec2 sh = vec2(uShift, 0.0);
    vec3 dec = vec3(uDecay, uDecay - uRgb, uDecay - 2.0 * uRgb);
    float fr = texture2D(uPrev, pUv + sh).r * dec.r;
    float fg = texture2D(uPrev, pUv).g * dec.g;
    float fb = texture2D(uPrev, pUv - sh).b * dec.b;
    vec3 fbk = vec3(fr, fg, fb);
    vec3 src = texture2D(uImage, vUv * uScale + uOffset).rgb;
    gl_FragColor = vec4(max(fbk, src * uMix), 1.0);
  }
`

const COPY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  void main() { gl_FragColor = texture2D(uTex, vUv); }
`

const RT_OPTS = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }

export default class TrailsEngine extends SynthEngine {
  _setup() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.rtA = new THREE.WebGLRenderTarget(2, 2, RT_OPTS)
    this.rtB = new THREE.WebGLRenderTarget(2, 2, RT_OPTS)
    this.fbMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FB_FRAG,
      uniforms: {
        uPrev: { value: null }, uImage: { value: null },
        uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) },
        uDecay: { value: 0.9 }, uRgb: { value: 0.03 }, uZoom: { value: 1 }, uRot: { value: 0 }, uShift: { value: 0.003 }, uMix: { value: 1 },
      },
    })
    this.copyMat = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: COPY_FRAG, uniforms: { uTex: { value: null } } })
    this.quad = new THREE.Mesh(this.geo, this.fbMat)
    this.scene.add(this.quad)
  }

  _applyFit() {
    const { sx, sy, ox, oy } = this.coverFit()
    this.fbMat.uniforms.uScale.value.set(sx, sy)
    this.fbMat.uniforms.uOffset.value.set(ox, oy)
  }

  _onImage() { this._applyFit() }

  _onParams() {
    const p = this.params
    const u = this.fbMat.uniforms
    u.uDecay.value = p.decay ?? 0.9
    u.uRgb.value = p.rgb ?? 0.03
    u.uZoom.value = p.zoom ?? 1
    u.uRot.value = p.rotate ?? 0
    u.uShift.value = p.shift ?? 0.003
    u.uMix.value = p.mix ?? 1
  }

  _resize(w, h) {
    this.rtA.setSize(w, h)
    this.rtB.setSize(w, h)
    this.renderer.setRenderTarget(this.rtA); this.renderer.clear()
    this.renderer.setRenderTarget(this.rtB); this.renderer.clear()
    this.renderer.setRenderTarget(null)
    this._applyFit()
  }

  _frame() {
    if (!this.tex) { this.renderer.setRenderTarget(null); this.renderer.clear(); return }
    // Feedback pass: rtA (prev) → rtB, then swap.
    this.quad.material = this.fbMat
    this.fbMat.uniforms.uPrev.value = this.rtA.texture
    this.fbMat.uniforms.uImage.value = this.tex
    this.renderer.setRenderTarget(this.rtB)
    this.renderer.render(this.scene, this.camera)
    const tmp = this.rtA; this.rtA = this.rtB; this.rtB = tmp
    // Display the accumulated buffer.
    this.quad.material = this.copyMat
    this.copyMat.uniforms.uTex.value = this.rtA.texture
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
  }

  _dispose() {
    this.rtA.dispose(); this.rtB.dispose()
    this.fbMat.dispose(); this.copyMat.dispose(); this.geo.dispose()
  }
}
