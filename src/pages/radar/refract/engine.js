// Refraction v2 engine — a true glass shader (supersedes the v1 pixi combo).
// A fullscreen three.js ShaderMaterial samples the photo through a procedural,
// animated surface: the surface height → gradient → refraction OFFSET, sampled
// per-channel with DISPERSION (more rainbow where the glass bends harder), plus
// a fresnel sheen on the steep edges and an optional frost (multi-tap softening).
// In-shader fluid animation — no per-frame JS map repaint. Keeps the v1 page API
// (init/setSource/setParams/setPlaying/resetTime/exportBlob/destroy).

import * as THREE from 'three'

const TYPE_INDEX = { glass: 0, ripple: 1, ice: 2, mirror: 3 }

const VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPhoto;
  uniform float uHasPhoto, uTime, uScale, uDepth, uChromatic, uFrost, uSheen, uViewAspect, uImgAspect;
  uniform int uType;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
               mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }

  // surface height field per distorter type
  float H(vec2 uv){
    float t = uTime;
    float f = 1.0 + uScale*6.0;
    if(uType==1){ // ripple
      float r = length(uv-0.5);
      return sin(r*f*16.0 - t*2.0)*0.5+0.5;
    } else if(uType==2){ // ice — faceted (quantized fbm)
      float n = fbm(uv*f*3.0 + t*0.15);
      return floor(n*7.0)/7.0;
    } else if(uType==3){ // mirror/liquid — low freq
      return fbm(uv*f*0.7 + t*0.1);
    }
    return fbm(uv*f + t*0.12); // glass
  }

  // screen uv → cover-fit image uv
  vec2 coverUV(vec2 uv){
    vec2 s = uViewAspect > uImgAspect ? vec2(1.0, uImgAspect/uViewAspect) : vec2(uViewAspect/uImgAspect, 1.0);
    return (uv-0.5)*s + 0.5;
  }
  vec3 sampleClamped(vec2 uv){ return texture2D(uPhoto, clamp(coverUV(uv), 0.001, 0.999)).rgb; }

  void main(){
    vec2 uv = vUv;
    if(uHasPhoto < 0.5){ gl_FragColor = vec4(0.02,0.025,0.04,1.0); return; }

    float e = 0.004;
    vec2 grad = vec2(H(uv+vec2(e,0.0))-H(uv-vec2(e,0.0)), H(uv+vec2(0.0,e))-H(uv-vec2(0.0,e)));
    vec2 off = grad * (uDepth*0.5);

    float disp = uChromatic*0.0025;
    vec3 c;
    c.r = sampleClamped(uv - off*(1.0+disp)).r;
    c.g = sampleClamped(uv - off).g;
    c.b = sampleClamped(uv - off*(1.0-disp)).b;

    // frost — average a few taps with the refracted sample
    if(uFrost > 0.001){
      vec3 acc = c;
      float r = uFrost*0.01;
      acc += sampleClamped(uv - off + vec2(r,0.0));
      acc += sampleClamped(uv - off + vec2(-r,0.0));
      acc += sampleClamped(uv - off + vec2(0.0,r));
      acc += sampleClamped(uv - off + vec2(0.0,-r));
      c = mix(c, acc/5.0, clamp(uFrost*0.12, 0.0, 1.0));
    }

    // fresnel sheen — bright rim where the surface is steep
    float steep = clamp(length(grad) * uDepth * 6.0, 0.0, 1.0);
    c += pow(steep, 2.0) * uSheen;

    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`

export class RefractEngine {
  constructor() {
    this.renderer = null
    this.disposed = false
    this.playing = true
    this.time = 0
    this.flow = 1
    this.container = null
  }

  init(container) {
    this.container = container
    const canvas = document.createElement('canvas')
    container.appendChild(canvas)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.scene = new THREE.Scene()
    this.cam = new THREE.Camera()
    this.uniforms = {
      uPhoto: { value: null },
      uHasPhoto: { value: 0 },
      uTime: { value: 0 },
      uType: { value: 0 },
      uScale: { value: 0.4 },
      uDepth: { value: 0.06 },
      uChromatic: { value: 6 },
      uFrost: { value: 0 },
      uSheen: { value: 0.5 },
      uViewAspect: { value: 1 },
      uImgAspect: { value: 1 },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms })
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat))

    this._resize()
    this.ro = new ResizeObserver(() => this._resize())
    this.ro.observe(container)

    let last = performance.now()
    const loop = (now) => {
      if (this.disposed) return
      const dt = (now - last) / 1000
      last = now
      if (this.playing) this.time += dt * this.flow
      this.uniforms.uTime.value = this.time
      this.renderer.render(this.scene, this.cam)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  _resize() {
    if (!this.renderer || !this.container) return
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setSize(w, h, false)
    this.uniforms.uViewAspect.value = w / h
  }

  setSource(img) {
    if (!this.uniforms) return
    if (!img) { this.uniforms.uHasPhoto.value = 0; return }
    const tex = new THREE.Texture(img)
    tex.needsUpdate = true
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    if (this.tex) this.tex.dispose()
    this.tex = tex
    this.uniforms.uPhoto.value = tex
    this.uniforms.uHasPhoto.value = 1
    this.uniforms.uImgAspect.value = (img.width || img.videoWidth || 1) / (img.height || img.videoHeight || 1)
  }

  setParams(p) {
    if (!this.uniforms) return
    if (p.type != null) this.uniforms.uType.value = TYPE_INDEX[p.type] ?? 0
    if (p.scale != null) this.uniforms.uScale.value = p.scale
    if (p.depth != null) this.uniforms.uDepth.value = p.depth / 500 // px-ish UI → uv space
    if (p.chromatic != null) this.uniforms.uChromatic.value = p.chromatic
    if (p.frost != null) this.uniforms.uFrost.value = p.frost
    if (p.sheen != null) this.uniforms.uSheen.value = p.sheen
    if (p.flow != null) this.flow = p.flow
  }

  setPlaying(v) { this.playing = v }
  resetTime() { this.time = 0; if (this.uniforms) this.uniforms.uTime.value = 0 }

  async exportBlob() {
    if (!this.renderer) return null
    this.renderer.render(this.scene, this.cam)
    return new Promise((res) => this.renderer.domElement.toBlob(res, 'image/png'))
  }

  destroy() {
    this.disposed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.ro) this.ro.disconnect()
    if (this.tex) this.tex.dispose()
    if (this.renderer) { this.renderer.dispose(); this.renderer = null }
  }
}
