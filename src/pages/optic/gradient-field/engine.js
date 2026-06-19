// Mesh-gradient field — a standalone fullscreen ShaderMaterial: N colour points
// (inverse-distance blended → gooey metaball gradient) through a domain-warped
// fbm, with a glossy sheen, optional grain + duotone, slow time loop. The
// Drekker "Dynamics" / die_doing grainy-mono look. three.js (already a dep).

import * as THREE from 'three'

export const MG_PALETTES = [
  { value: 'dynamics', label: 'Dynamics', cols: ['#2541b2', '#7b2ff7', '#ff3864', '#ffd23f', '#2ec4b6'] },
  { value: 'magma', label: 'Magma', cols: ['#0d0221', '#5f0f40', '#fb8b24', '#e36414', '#ffd23f'] },
  { value: 'aqua', label: 'Aqua', cols: ['#011627', '#0353a4', '#2ec4b6', '#80ffdb', '#e0fbfc'] },
  { value: 'mono', label: 'Mono', cols: ['#000000', '#3a3a3a', '#7a7a7a', '#bcbcbc', '#ffffff'] },
]

const VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uWarp, uGrain, uDuotone, uSheen, uAspect, uContrast;
  uniform vec3 uColors[5];

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
               mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
  vec2 pointPos(int i, float t){
    float fi=float(i);
    return vec2(0.5+0.36*sin(t*0.3+fi*1.7), 0.5+0.32*cos(t*0.26+fi*2.3));
  }

  void main(){
    vec2 uv = vUv;
    uv.x = (uv.x - 0.5) * uAspect + 0.5; // correct for non-square
    vec2 w = vec2(fbm(uv*3.0+uTime*0.05), fbm(uv*3.0+5.2-uTime*0.05));
    uv += (w-0.5)*uWarp;

    vec3 col = vec3(0.0); float wsum = 0.0;
    for(int i=0;i<5;i++){
      vec2 p = pointPos(i, uTime);
      float d = distance(uv, p);
      float wi = 1.0/(d*d+0.02);
      col += uColors[i]*wi; wsum += wi;
    }
    col /= wsum;

    float sh = pow(max(0.0, 0.5+0.5*sin((uv.x+uv.y)*3.1416 - uTime*0.2)), 3.0);
    col += sh*uSheen*0.25;

    if(uDuotone>0.5){ float l=dot(col, vec3(0.299,0.587,0.114)); col=mix(uColors[0], uColors[4], l); }

    // contrast around mid-grey
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);

    float g = (hash(vUv*vec2(1920.0,1080.0)+uTime)-0.5)*uGrain;
    col += g;

    gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
  }
`

const toVec3 = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export class MeshGradientEngine {
  constructor() {
    this.renderer = null
    this.time = 0
    this.playing = true
    this.speed = 1
  }

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.scene = new THREE.Scene()
    this.cam = new THREE.Camera()
    this.uniforms = {
      uTime: { value: 0 },
      uWarp: { value: 0.35 },
      uGrain: { value: 0.04 },
      uDuotone: { value: 0 },
      uSheen: { value: 0.6 },
      uAspect: { value: 1 },
      uContrast: { value: 1 },
      uColors: { value: MG_PALETTES[0].cols.map(toVec3) },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms })
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat))
  }

  resize(w, h) {
    if (!this.renderer) return
    this.renderer.setSize(w, h, false) // exact artboard dims (pixelRatio 1)
    this.uniforms.uAspect.value = w / h
  }

  setParams(p) {
    if (!this.uniforms) return
    if (p.warp != null) this.uniforms.uWarp.value = p.warp
    if (p.grain != null) this.uniforms.uGrain.value = p.grain
    if (p.duotone != null) this.uniforms.uDuotone.value = p.duotone ? 1 : 0
    if (p.sheen != null) this.uniforms.uSheen.value = p.sheen
    if (p.contrast != null) this.uniforms.uContrast.value = p.contrast
    if (p.speed != null) this.speed = p.speed
    if (p.palette != null) {
      const pal = MG_PALETTES.find((x) => x.value === p.palette) || MG_PALETTES[0]
      this.uniforms.uColors.value = pal.cols.map(toVec3)
    }
  }

  setPlaying(v) { this.playing = v }

  frame(dt) {
    if (!this.renderer) return
    if (this.playing) this.time += dt * this.speed
    this.uniforms.uTime.value = this.time
    this.renderer.render(this.scene, this.cam)
  }

  resetTime() { this.time = 0; this.uniforms.uTime.value = 0 }

  exportBlob(w, h) {
    return new Promise((res) => {
      if (!this.renderer) return res(null)
      const prev = { w: this.renderer.domElement.width, h: this.renderer.domElement.height }
      this.resize(w, h)
      this.renderer.render(this.scene, this.cam)
      this.renderer.domElement.toBlob((b) => { this.resize(prev.w, prev.h); res(b) }, 'image/png')
    })
  }

  destroy() {
    if (this.renderer) { this.renderer.dispose(); this.renderer = null }
  }
}
