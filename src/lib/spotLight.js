// LightLayer — a reusable light any three.js scene can drop in. One of three
// types: a Spotlight, a Sun (directional), or a Studio 3-point rig (key/fill/
// back). All lights parent to a `pivot` Group — attach a TransformControls to
// `light.pivot` to drag the whole light, and aim at the shared `target`.
//
//   import { LightLayer } from '../../../lib/spotLight.js'
//   this.light = new LightLayer(this.scene)
//   this.light.setParams({ enabled:true, type:'spot', intensity:80, x:2,y:3,z:3 })
//   // render loop (if the helper is on): this.light.update()
//   // teardown: this.light.dispose()
//
// `SpotLightLayer` is kept as an alias for callers that only want a spotlight.

import * as THREE from 'three'

export const LIGHT_TYPES = [
  { value: 'spot', label: 'Spot' },
  { value: 'sun', label: 'Sun' },
  { value: 'three', label: 'Studio' },
]

export const LIGHT_DEFAULTS = {
  enabled: false,
  type: 'spot',
  color: '#ffffff',
  intensity: 80,
  angle: 32, // degrees (spot / studio)
  penumbra: 0.45,
  x: 2, y: 3, z: 3, // pivot position
  helper: false,
}

// per-type intensity ratios for the studio rig
const RIG = [
  { pos: [3, 4, 3], k: 1.0 }, // key
  { pos: [-4, 1, 2], k: 0.4 }, // fill
  { pos: [0, 3, -4], k: 0.6 }, // back
]

export class LightLayer {
  constructor(scene, params = {}) {
    this.scene = scene
    this.pivot = new THREE.Group() // the gizmo target — lights hang off this
    scene.add(this.pivot)
    this.target = new THREE.Object3D() // everything aims here (subject @ origin)
    scene.add(this.target)
    this.helper = null
    this.lights = []
    this.type = null
    this.params = { ...LIGHT_DEFAULTS, ...params }
    this._build(this.params.type)
    this.setParams(this.params)
  }

  _clearLights() {
    for (const l of this.lights) this.pivot.remove(l)
    this.lights = []
  }

  _build(type) {
    this._clearLights()
    if (type === 'sun') {
      const d = new THREE.DirectionalLight(0xffffff, 1)
      d.target = this.target
      this.pivot.add(d)
      this.lights = [d]
    } else if (type === 'three') {
      this.lights = RIG.map((r) => {
        const s = new THREE.SpotLight(0xffffff, r.k)
        s.position.set(...r.pos)
        s.target = this.target
        this.pivot.add(s)
        return s
      })
    } else {
      const s = new THREE.SpotLight(0xffffff, 1)
      s.target = this.target
      this.pivot.add(s)
      this.lights = [s]
    }
    this.type = type
    this.main = this.lights[0]
    if (this.helper) { this.setHelper(false); this.setHelper(true) } // rebind helper
  }

  setParams(p) {
    if (!p) return
    this.params = { ...this.params, ...p }
    if (p.type != null && p.type !== this.type) this._build(p.type)
    if (p.enabled != null) this.pivot.visible = !!p.enabled
    if (p.color != null) for (const l of this.lights) l.color.set(p.color)
    if (p.intensity != null) {
      if (this.type === 'three') this.lights.forEach((l, i) => { l.intensity = p.intensity * RIG[i].k })
      else this.main.intensity = p.intensity
    }
    if (p.angle != null) for (const l of this.lights) { if (l.isSpotLight) l.angle = (p.angle * Math.PI) / 180 }
    if (p.penumbra != null) for (const l of this.lights) { if (l.isSpotLight) l.penumbra = p.penumbra }
    if (p.x != null) this.pivot.position.x = p.x
    if (p.y != null) this.pivot.position.y = p.y
    if (p.z != null) this.pivot.position.z = p.z
    if (p.helper != null) this.setHelper(p.helper)
    this.target.updateMatrixWorld()
    this.pivot.updateMatrixWorld()
    this.helper?.update?.()
  }

  setHelper(on) {
    if (on && !this.helper) {
      this.helper = this.type === 'sun'
        ? new THREE.DirectionalLightHelper(this.main, 0.6)
        : new THREE.SpotLightHelper(this.main)
      this.scene.add(this.helper)
    } else if (!on && this.helper) {
      this.scene.remove(this.helper)
      this.helper.dispose?.()
      this.helper = null
    }
  }

  // Call from the render loop so the helper tracks pivot/target changes.
  update() { this.helper?.update?.() }

  dispose() {
    this.setHelper(false)
    this._clearLights()
    this.scene.remove(this.pivot)
    this.scene.remove(this.target)
  }
}

// Back-compat alias — a plain spotlight.
export const SpotLightLayer = LightLayer
export const SPOTLIGHT_DEFAULTS = LIGHT_DEFAULTS
