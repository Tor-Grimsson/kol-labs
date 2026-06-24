import * as THREE from 'three'
import { orbitEye } from '../../lib/orbit.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// OrbitView — the real orbit camera for the Penrose specimen, replacing the old
// CSS fake-3D (camera.js). The prototype's 2D canvas becomes a texture on a flat
// plane viewed by a PerspectiveCamera: drag = orbit, wheel = zoom (OrbitControls),
// Yaw/Pitch/Distance/FOV snap the rig, a motion preset animates on the transport
// clock. Camera rig (orbitEye + OrbitControls + the motion presets) is ported
// verbatim from the radar Scan / optic ReliefOrbit rig — only the mesh differs:
// a SOLID textured plane (Penrose art is line/vector, not a luminance relief).
// Owns no rAF: the host renders the specimen each frame and calls frame(time).

const TAU = Math.PI * 2
const clampPitch = (v) => Math.max(-1.4, Math.min(1.4, v))

// dist 2.35 @ fov 45 makes the 2×2 plane fill the frame front-on (visible
// half-height ≈ plane half-height); pitch 0 so the default reads as a flat,
// filled artboard — orbiting from there reveals the 3D.
export const ORBIT_DEFAULTS = {
  dist: 2.35, fov: 45, yaw: 0, pitch: 0,
  cameraMotion: false, motionPreset: 'orbit', motionSpeed: 0.3,
}

export const MOTION_PRESETS = [
  { value: 'orbit', label: 'Orbit' }, { value: 'spin', label: 'Spin' }, { value: 'rock', label: 'Rock' },
  { value: 'rise', label: 'Rise' }, { value: 'push', label: 'Push' }, { value: 'pull', label: 'Pull' },
]

export default class OrbitView {
  constructor(canvas) {
    this.canvas = canvas
    // alpha so the stage bg-surface-secondary shows through around the plane.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const [ix, iy, iz] = orbitEye(0, ORBIT_DEFAULTS.pitch, ORBIT_DEFAULTS.dist)
    this.camera.position.set(ix, iy, iz)
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 8
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this._camKey = ''
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide })
    this.tex = null
    this.texAspect = 1
    this.params = {}
    this._buildMesh()
  }

  _buildMesh() {
    const a = this.texAspect || 1
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose() }
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * a, 2), this.mat)
    this.scene.add(this.mesh)
  }

  setSource(canvas2d) {
    if (!this.tex || this.tex.image !== canvas2d) {
      if (this.tex) this.tex.dispose()
      this.tex = new THREE.CanvasTexture(canvas2d)
      this.tex.minFilter = THREE.LinearFilter
      this.tex.magFilter = THREE.LinearFilter
      this.mat.map = this.tex
      this.mat.needsUpdate = true
    }
    const ar = (canvas2d.width || 1) / (canvas2d.height || 1)
    if (ar !== this.texAspect) { this.texAspect = ar; this._buildMesh() }
  }

  setParams(p) {
    this.params = p
    const fov = p.fov ?? 45
    if (fov !== this.camera.fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix() }
    // Manual snap, keyed so a live param push doesn't yank a mouse-orbit back.
    if (!p.cameraMotion) {
      const key = `${p.yaw}|${p.pitch}|${p.dist}`
      if (key !== this._camKey) {
        this._camKey = key
        const [ex, ey, ez] = orbitEye(p.yaw ?? 0, p.pitch ?? 0.1, p.dist ?? 3)
        this.camera.position.set(ex, ey, ez)
        this.controls.target.set(0, 0, 0)
        this.controls.update()
      }
    }
  }

  resize(w, h) {
    if (w < 1 || h < 1) return
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  resolveCam(time) {
    const p = this.params
    let yaw = p.yaw ?? 0, pitch = p.pitch ?? 0.1, dist = p.dist ?? 3
    if (p.cameraMotion) {
      const w = time * (p.motionSpeed ?? 0.3)
      const osc = Math.sin(w * TAU)
      switch (p.motionPreset) {
        case 'spin': yaw = w * 2.2; break
        case 'rock': yaw += osc * 0.7; break
        case 'rise': pitch += osc * 0.6; break
        case 'push': dist *= 1 - 0.35 * (0.5 + 0.5 * osc); break
        case 'pull': dist *= 1 + 0.6 * (0.5 + 0.5 * osc); break
        default: yaw = w; break // 'orbit'
      }
    }
    return { yaw, pitch: clampPitch(pitch), dist }
  }

  frame(time) {
    if (this.tex) this.tex.needsUpdate = true
    if (this.params.cameraMotion) {
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

  reset() { this.controls.reset(); this._camKey = '' }
  dispose() {
    this.controls.dispose()
    if (this.mesh) this.mesh.geometry.dispose()
    if (this.tex) this.tex.dispose()
    this.mat.dispose()
    this.renderer.dispose()
  }
}
