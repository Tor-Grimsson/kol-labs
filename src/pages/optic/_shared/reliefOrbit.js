import * as THREE from 'three'
import { orbitEye } from '../../../lib/orbit.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ReliefOrbit — a three.js orbit-camera display layer for a 2D Canvas effect.
 * Ports the radar Scan rig (scanEngine.js): the source 2D canvas becomes a
 * texture on a grid of horizontal scanlines (LineSegments); each vertex is pushed
 * along z by the pixel's luminance, so the flat pattern reads as a 3D relief you
 * orbit. Drag = orbit, wheel = zoom (OrbitControls); the Yaw/Pitch/Distance
 * sliders snap the rig; a motion preset (orbit/spin/rock/rise/push/pull) animates
 * on a time value the host supplies (the page's transport clock pauses/resets it).
 *
 * Unlike Scan this owns no rAF loop and no source upload — the host page already
 * renders the 2D pattern every frame and calls setSource()/frame(time). */

const VERT = `
  uniform sampler2D uImage;
  uniform float uDisplace;
  varying vec3 vColor;
  void main() {
    vec3 c = texture2D(uImage, uv).rgb;
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    vColor = c;
    vec3 p = position;
    p.z += (luma - 0.5) * uDisplace;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FRAG = `
  precision highp float;
  varying vec3 vColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(vColor, uOpacity);
  }
`

const TAU = Math.PI * 2
const clampPitch = (v) => Math.max(-1.4, Math.min(1.4, v))

export default class ReliefOrbit {
  constructor(canvas) {
    this.canvas = canvas
    // Transparent so the stage's bg-surface-secondary shows through, like Scan.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const [ix, iy, iz] = orbitEye(0, 0.4, 3)
    this.camera.position.set(ix, iy, iz)
    // Standard three.js scene controls — drag to orbit, wheel to zoom.
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 8
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this._camKey = ''

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      uniforms: {
        uImage: { value: null },
        uDisplace: { value: 1.2 },
        uOpacity: { value: 1 },
      },
    })
    this.tex = null
    this.mesh = null
    this.res = 200
    this.texAspect = 1
    this.params = {}
    this._buildMesh()
  }

  _buildMesh() {
    const n = Math.max(8, Math.round(this.res))
    const rows = n
    const cols = n
    const a = this.texAspect || 1
    const pos = new Float32Array(cols * rows * 3)
    const uvs = new Float32Array(cols * rows * 2)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const u = c / (cols - 1)
        const v = r / (rows - 1)
        pos[i * 3] = (u - 0.5) * 2 * a
        pos[i * 3 + 1] = (0.5 - v) * 2
        pos[i * 3 + 2] = 0
        uvs[i * 2] = u
        uvs[i * 2 + 1] = 1 - v
      }
    }
    const idx = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) idx.push(r * cols + c, r * cols + c + 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    g.setIndex(idx)
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose() }
    this.mesh = new THREE.LineSegments(g, this.mat)
    this.scene.add(this.mesh)
  }

  // Point the relief at a 2D <canvas>; rebuild the mesh if its aspect changed.
  setSource(canvas2d) {
    if (!this.tex || this.tex.image !== canvas2d) {
      if (this.tex) this.tex.dispose()
      this.tex = new THREE.CanvasTexture(canvas2d)
      this.tex.minFilter = THREE.LinearFilter
      this.tex.magFilter = THREE.LinearFilter
      this.mat.uniforms.uImage.value = this.tex
    }
    const ar = (canvas2d.width || 1) / (canvas2d.height || 1)
    if (ar !== this.texAspect) { this.texAspect = ar; this._buildMesh() }
  }

  setParams(p) {
    this.params = p
    this.mat.uniforms.uDisplace.value = p.displace ?? 1.2
    this.mat.uniforms.uOpacity.value = p.opacity ?? 1
    const res = Math.round(p.res ?? 200)
    if (res !== this.res) { this.res = res; this._buildMesh() }
    const fov = p.fov ?? 45
    if (fov !== this.camera.fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix() }
    // Manual yaw/pitch/distance snap the orbit rig; the mouse drags on from there.
    // Keyed on the slider values so a param push won't reset a mouse-orbit.
    if (!p.cameraMotion) {
      const key = `${p.yaw}|${p.pitch}|${p.dist}`
      if (key !== this._camKey) {
        this._camKey = key
        const [ex, ey, ez] = orbitEye(p.yaw ?? 0, p.pitch ?? 0.4, p.dist ?? 3)
        this.camera.position.set(ex, ey, ez)
        this.controls.target.set(0, 0, 0)
        this.controls.update()
      }
    }
  }

  resize(w, h) {
    if (w < 1 || h < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // Orbit pose — manual (yaw/pitch/dist) or a time-driven preset.
  resolveCam(time) {
    const p = this.params
    let yaw = p.yaw ?? 0
    let pitch = p.pitch ?? 0.4
    let dist = p.dist ?? 3
    if (p.cameraMotion) {
      const w = time * (p.motionSpeed ?? 0.3)
      const osc = Math.sin(w * TAU)
      switch (p.motionPreset) {
        case 'spin': yaw = w * 2.2; break
        case 'rock': yaw += osc * 0.7; break
        case 'rise': pitch += osc * 0.6; break
        case 'push': dist *= 1 - 0.35 * (0.5 + 0.5 * osc); break
        case 'pull': dist *= 1 + 0.6 * (0.5 + 0.5 * osc); break
        case 'orbit':
        default: yaw = w; break
      }
    }
    return { yaw, pitch: clampPitch(pitch), dist }
  }

  frame(time) {
    if (this.tex) this.tex.needsUpdate = true
    if (this.params.cameraMotion) {
      // A motion preset drives the camera; mouse control yields to it.
      this.controls.enabled = false
      const { yaw, pitch, dist } = this.resolveCam(time)
      const [ex, ey, ez] = orbitEye(yaw, pitch, dist)
      this.camera.position.set(ex, ey, ez)
      this.camera.lookAt(0, 0, 0)
    } else {
      this.controls.enabled = true
      this.controls.update() // required for enableDamping
    }
    this.renderer.render(this.scene, this.camera)
  }

  exportBlob() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'))
  }

  dispose() {
    this.controls.dispose()
    if (this.mesh) this.mesh.geometry.dispose()
    if (this.tex) this.tex.dispose()
    this.mat.dispose()
    this.renderer.dispose()
  }
}
