import * as THREE from 'three'
import SynthEngine, { FULLSCREEN_VERT } from './synthBase.js'

/* Disco — a club-visual fragment post over the source: kaleidoscope mirror,
 * hue-cycling, spin, posterize, strobe. Time-driven, no feedback buffer. The
 * outlier of the family (not Vasulka) but the requested "disco fx". */

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  uniform float uTime;
  uniform float uSeg;     // kaleidoscope segments (0 = off)
  uniform float uHue;     // hue cycle speed
  uniform float uSpin;    // uv rotation speed
  uniform float uPost;    // posterize levels (<2 = off)
  uniform float uStrobe;  // strobe rate (0 = off)

  mat3 hueRot(float a) {
    float c = cos(a), s = sin(a);
    mat3 w = mat3(0.299, 0.299, 0.299, 0.587, 0.587, 0.587, 0.114, 0.114, 0.114);
    mat3 u = mat3(0.701, -0.299, -0.300, -0.587, 0.413, -0.588, -0.114, -0.114, 0.886);
    mat3 v = mat3(0.168, -0.328, 1.250, 0.330, 0.035, -1.050, -0.497, 0.292, -0.203);
    return w + u * c + v * s;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float sp = uTime * uSpin;
    float cs = cos(sp), sn = sin(sp);
    uv = mat2(cs, -sn, sn, cs) * uv;
    if (uSeg > 0.5) {
      float ang = atan(uv.y, uv.x);
      float rad = length(uv);
      float seg = 6.2831853 / uSeg;
      ang = abs(mod(ang, seg) - seg * 0.5);
      uv = vec2(cos(ang), sin(ang)) * rad;
    }
    uv += 0.5;
    vec3 col = texture2D(uImage, fract(uv) * uScale + uOffset).rgb;
    col = clamp(hueRot(uTime * uHue) * col, 0.0, 1.0);
    if (uPost > 1.5) col = floor(col * uPost) / uPost;
    if (uStrobe > 0.01) { float f = step(0.5, fract(uTime * uStrobe)); col *= mix(1.0, f, 0.7); }
    gl_FragColor = vec4(col, 1.0);
  }
`

export default class DiscoEngine extends SynthEngine {
  _setup() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.mat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FRAG,
      uniforms: {
        uImage: { value: null },
        uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 }, uSeg: { value: 6 }, uHue: { value: 0.3 }, uSpin: { value: 0.1 }, uPost: { value: 0 }, uStrobe: { value: 0 },
      },
    })
    this.quad = new THREE.Mesh(this.geo, this.mat)
    this.scene.add(this.quad)
  }

  _applyFit() {
    const { sx, sy, ox, oy } = this.coverFit()
    this.mat.uniforms.uScale.value.set(sx, sy)
    this.mat.uniforms.uOffset.value.set(ox, oy)
  }

  _onImage() { this.mat.uniforms.uImage.value = this.tex; this._applyFit() }

  _onParams() {
    const p = this.params
    const u = this.mat.uniforms
    u.uSeg.value = p.segments ?? 6
    u.uHue.value = p.hue ?? 0.3
    u.uSpin.value = p.spin ?? 0.1
    u.uPost.value = p.posterize ?? 0
    u.uStrobe.value = p.strobe ?? 0
  }

  _resize() { this._applyFit() }

  _frame() {
    this.renderer.setRenderTarget(null)
    if (!this.tex) { this.renderer.clear(); return }
    this.mat.uniforms.uImage.value = this.tex
    this.mat.uniforms.uTime.value = this.time
    this.renderer.render(this.scene, this.camera)
  }

  _dispose() { this.mat.dispose(); this.geo.dispose() }
}
