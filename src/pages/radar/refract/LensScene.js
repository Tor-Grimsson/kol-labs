// Lens — a real 3D scene (supersedes the 2D refraction shader). TWO objects in
// space: a PHOTO PLANE at the back (your uploaded image/video, unlit) and a
// GLASS MESH in front (MeshPhysicalMaterial transmission + IOR + dispersion =
// true chromatic aberration). The z-GAP between them is the Distance control —
// orbit the camera and you see the depth. Environment = procedural RoomEnvironment
// IBL (no asset), so the glass reflects + refracts realistically.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { SpotLightLayer } from '../../../lib/spotLight.js'
import { FilterShader } from './filterPass.js'

export class LensScene {
  constructor() {
    this.disposed = false
    this.playing = true
    this.flow = 1
    this.autoRotate = false
    this.orbitSpeed = 1
    // camera motion + viewport mode
    this.motionOn = false
    this.motionType = 'orbit'
    this.motionSpeed = 1
    this.camPhase = 0
    this.viewMode = 'viewer' // viewer = free orbit · camera = locked shot
    this.shape = 'slab'
    this.size = 1
    this.distance = 1
    this.imgAspect = 1
    // image layer transform (photo plane)
    this.imgZoom = 1
    this.imgOffsetX = 0
    this.imgOffsetY = 0
    this.imgScale = 1
  }

  init(container) {
    this.container = container
    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.bgColor = new THREE.Color('#0b0d12')
    this._bgType = 'solid'      // solid | gradient | metallic
    this._bgAmount = 1          // how much colour (dims toward black)
    this._bgTransparent = false
    this.scene.background = this.bgColor

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    this.camera.position.set(1.1, 0.5, 4) // slightly off-axis so the gap reads immediately
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 12
    this.controls.target.set(0, 0, 0)

    // Lights + procedural environment IBL (drives glass reflections/refraction).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(3, 4, 3)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xaabbff, 0.6)
    fill.position.set(-3, -1, 2)
    this.scene.add(fill)
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = this.envTex

    // LAYER 1 — the photo plane. A LIT material (MeshStandard) so the scene's
    // lights — incl. an added spotlight — actually illuminate it. `emissive` is
    // wired to the same map so the photo stays readable at full colour even with
    // no light layer (emissiveIntensity = the "unlit base"; lights add on top).
    this.photoMat = new THREE.MeshStandardMaterial({
      color: 0x222428, roughness: 0.95, metalness: 0,
      emissive: 0xffffff, emissiveIntensity: 0.85,
    })
    this.photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.photoMat)
    this.photo.position.z = 0
    this.scene.add(this.photo)
    this._resizePlane()

    // LAYER 2 — the glass mesh (refracts the plane behind it). z = distance.
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.05,
      transmission: 1, thickness: 1.2, ior: 1.5, dispersion: 3,
      attenuationColor: new THREE.Color(0xffffff), attenuationDistance: 4,
      clearcoat: 0.3, clearcoatRoughness: 0.1, envMapIntensity: 1.3,
      transparent: true,
    })
    this.glassGeom = this._buildGeom('slab', 1)
    this.glass = new THREE.Mesh(this.glassGeom, this.glassMat)
    this.glass.position.z = 1
    this.scene.add(this.glass)

    // LIGHT layer — an optional spotlight (reusable across 3D scenes). Off until
    // added via the Layers "+". position default puts it up-front-right.
    this.spot = new SpotLightLayer(this.scene, { x: 2, y: 3, z: 3, intensity: 80 })

    // MOVE GIZMO — Blender-style XYZ arrows + planar handles on the selected
    // object. Dragging disables the orbit; position changes report back to React.
    this.tcontrols = new TransformControls(this.camera, canvas)
    this.tcontrols.setSpace('world')
    this.tcontrols.addEventListener('dragging-changed', (e) => { this.controls.enabled = !e.value })
    this.tcontrols.addEventListener('objectChange', () => {
      const o = this.tcontrols.object
      if (!o || !this.onTransform) return
      const id = o === this.glass ? 'glass' : o === this.spot?.pivot ? 'light' : 'image'
      this.onTransform(id, { x: o.position.x, y: o.position.y, z: o.position.z })
    })
    this.gizmo = this.tcontrols.getHelper()
    this.scene.add(this.gizmo)

    // VIEW GIZMO — corner axis widget; click an axis to snap the view to it.
    // Toggled by the Master layer's "Show gizmo" (off by default).
    this.viewHelperOn = false
    this.viewHelper = new ViewHelper(this.camera, canvas)
    this.viewHelper.center = this.controls.target
    canvas.addEventListener('pointerdown', (e) => { if (this.viewHelperOn) this.viewHelper?.handleClick(e) })

    // POST-PROCESS — chromatic aberration + grain + vignette (the Filter tab).
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0.6, 0.8) // strength 0 = off
    this.composer.addPass(this.bloomPass)
    this.filterPass = new ShaderPass(FilterShader)
    this.composer.addPass(this.filterPass)

    this._resize()
    this.ro = new ResizeObserver(() => this._resize())
    this.ro.observe(container)

    let last = performance.now()
    const loop = (now) => {
      if (this.disposed) return
      const dt = (now - last) / 1000
      last = now
      if (this.playing && this.autoRotate) {
        this.glass.rotation.y += dt * this.orbitSpeed * 0.5 * this.flow
      }
      // CAMERA MOTION — drives the locked shot, only in 'camera' view mode.
      // In 'viewer' mode OrbitControls owns the camera (free inspect).
      if (this.motionOn && this.playing && this.viewMode === 'camera') {
        this.camPhase += dt * (this.motionSpeed ?? 1)
        const t = this.controls.target
        let yaw = this.camYaw, pitch = this.camPitch, dist = this.camDist
        const p = this.camPhase
        switch (this.motionType) {
          case 'spin': yaw += p * 2; break
          case 'rock': yaw += Math.sin(p) * 0.6; break
          case 'rise': pitch = THREE.MathUtils.clamp(pitch + Math.sin(p) * 0.4, -1.4, 1.4); break
          case 'push': dist = Math.max(this.controls.minDistance, dist + Math.sin(p) * 1.0); break
          case 'orbit': default: yaw += p; break
        }
        this.camera.position.set(
          t.x + dist * Math.cos(pitch) * Math.sin(yaw),
          t.y + dist * Math.sin(pitch),
          t.z + dist * Math.cos(pitch) * Math.cos(yaw),
        )
        this.camera.lookAt(t)
      } else {
        this.controls.update()
      }
      this.spot.update() // keep the spotlight helper cone synced to position
      this.filterPass.uniforms.uTime.value += dt
      this.composer.render()
      if (this.viewHelper && this.viewHelperOn) {
        if (this.viewHelper.animating) this.viewHelper.update(dt)
        this.renderer.autoClear = false
        this.viewHelper.render(this.renderer)
        this.renderer.autoClear = true
      }
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
    return Promise.resolve()
  }

  // Attach the move gizmo to a layer's object ('glass' | 'image'), or hide it ('master').
  // The movable Object3D for a layer id (glass/image/light), or null.
  _objFor(id) {
    if (id === 'glass') return this.glass
    if (id === 'image') return this.photo
    if (id === 'light') return this.spot?.pivot
    return null
  }

  setGizmoTarget(id) {
    if (!this.tcontrols) return
    const o = this._objFor(id)
    if (o) this.tcontrols.attach(o)
    else this.tcontrols.detach()
  }

  // Corner scene gizmo (ViewHelper) visibility — driven by the Master layer toggle.
  setViewHelperVisible(v) { this.viewHelperOn = v }

  // Viewport mode: 'viewer' = free orbit (inspect); 'camera' = the locked shot
  // (manual orbit off, camera motion plays). Switching to viewer keeps the shot's
  // pose so you start from where the camera is.
  setViewMode(mode) {
    this.viewMode = mode
    if (mode === 'camera') this.controls.enabled = false
    else this.controls.enabled = !this.motionOn // viewer: orbit unless motion owns it
  }

  // Camera motion (Camera layer's Motion tab). Capture the current orbit as the
  // base when turning on, and disable manual orbit while animating.
  setCameraMotion({ on, type, speed } = {}) {
    if (type != null) this.motionType = type
    if (speed != null) this.motionSpeed = speed
    if (on != null && on !== this.motionOn) {
      this.motionOn = on
      if (on) {
        const off = this.camera.position.clone().sub(this.controls.target)
        this.camDist = off.length() || 4
        this.camYaw = Math.atan2(off.x, off.z)
        this.camPitch = Math.asin(THREE.MathUtils.clamp(off.y / this.camDist, -1, 1))
        this.camPhase = 0
        this.controls.enabled = false
      } else {
        this.controls.enabled = true
      }
    }
  }

  // Draw one background "material" full-canvas. Each type exposes its OWN params:
  //   solid    color, brightness
  //   linear   color → color2, angle, brightness
  //   radial   color (center) → color2 (edge), center x/y, radius, brightness
  //   multi    color, hue spread, heads, angle (multi-head conic)
  //   metallic color, sweep position, sharpness, angle
  // Caller sets globalAlpha for the per-layer opacity blend.
  _drawBg(ctx, bg, w, h) {
    const type = bg.type === 'gradient' ? 'linear' : bg.type
    const br = bg.brightness ?? 1
    const col = (hex, k = 1) => { const c = new THREE.Color(hex || '#000000'); return `rgb(${(c.r * 255 * k) | 0},${(c.g * 255 * k) | 0},${(c.b * 255 * k) | 0})` }
    const c1 = bg.color || '#000000'
    const c2 = bg.color2 || '#000000'

    if (type === 'solid') { ctx.fillStyle = col(c1, br); ctx.fillRect(0, 0, w, h); return }

    if (type === 'radial') {
      const cx = (bg.cx ?? 0.5) * w, cy = (bg.cy ?? 0.5) * h
      const rad = (bg.radius ?? 0.62) * Math.max(w, h)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, rad))
      g.addColorStop(0, col(c1, br))
      g.addColorStop(1, col(c2, br))
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return
    }

    if (type === 'multi') {
      // multi-head conic — N hue-shifted heads spread from the base colour.
      const base = new THREE.Color(c1); const hsl = {}; base.getHSL(hsl)
      const spread = bg.spread ?? 0.3
      const heads = Math.max(2, Math.round(bg.heads ?? 4))
      const ang = ((bg.angle ?? 0) * Math.PI) / 180
      const g = ctx.createConicGradient(ang, w / 2, h / 2)
      for (let i = 0; i <= heads; i++) {
        const t = i / heads
        const hue = (hsl.h + Math.sin(t * Math.PI * 2) * spread + 1) % 1
        const c = new THREE.Color().setHSL(hue, hsl.s, hsl.l * br)
        g.addColorStop(t, `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`)
      }
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return
    }

    // linear + metallic + glass — directional gradient at `angle`
    const ang = ((bg.angle ?? 90) * Math.PI) / 180
    const dx = Math.cos(ang), dy = Math.sin(ang)
    const cx = w / 2, cy = h / 2, half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2
    const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half)
    if (type === 'glass') {
      // frosted glass — soft milky gradient (base ↔ tint) with a broad sheen band.
      const base = new THREE.Color(c1)
      const tint = new THREE.Color(bg.color2 || '#ffffff')
      const frost = bg.frost ?? 0.5 // how much the tint milks the base
      const sheen = bg.sheen ?? 0.5
      const mix = (k) => { const m = base.clone().lerp(tint, frost * k); return `rgb(${(m.r * 255 * br) | 0},${(m.g * 255 * br) | 0},${(m.b * 255 * br) | 0})` }
      const sh = (k) => { const m = base.clone().lerp(new THREE.Color('#ffffff'), Math.min(1, frost * 0.4 + sheen * k)); return `rgb(${(m.r * 255 * br) | 0},${(m.g * 255 * br) | 0},${(m.b * 255 * br) | 0})` }
      g.addColorStop(0.0, mix(0.3))
      g.addColorStop(0.4, mix(0.7))
      g.addColorStop(0.5, sh(1)) // soft broad highlight
      g.addColorStop(0.6, mix(0.8))
      g.addColorStop(1.0, mix(0.45))
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return
    }
    if (type === 'metallic') {
      const base = new THREE.Color(c1)
      const toWhite = (t) => `rgb(${((base.r + (1 - base.r) * t) * 255) | 0},${((base.g + (1 - base.g) * t) * 255) | 0},${((base.b + (1 - base.b) * t) * 255) | 0})`
      const refl = bg.reflectivity ?? 0.65 // highlight contrast (chrome ↔ matte)
      const bands = Math.max(1, Math.round(bg.bands ?? 1)) // reflection streaks (brushed metal)
      const sweep = Math.min(1, Math.max(0, bg.sweep ?? 0.5)) // shifts the band set
      const sharp = bg.sharpness ?? 0.5
      const wdt = 0.01 + (1 - sharp) * 0.18 / bands // tighter as bands ↑
      const lo = (0.3 - refl * 0.22) * br // valley darkness ↓ with reflectivity
      const hi = (0.55 + refl * 0.4) // peak whiteness ↑ with reflectivity
      const stops = []
      stops.push([0, col(c1, lo)])
      for (let i = 0; i < bands; i++) {
        const pos = ((i + 0.5) / bands + sweep) % 1
        stops.push([Math.max(0, pos - wdt), col(c1, (0.5 + refl * 0.4) * br)])
        stops.push([pos, toWhite(hi * br)])
        stops.push([Math.min(1, pos + wdt), col(c1, (0.45 + refl * 0.3) * br)])
      }
      stops.push([1, col(c1, lo)])
      stops.sort((a, x) => a[0] - x[0])
      for (const [p, c] of stops) g.addColorStop(Math.min(1, Math.max(0, p)), c)
    } else { // linear — color → color2
      g.addColorStop(0, col(c1, br))
      g.addColorStop(1, col(c2, br))
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  }

  // Composite the background STACK (bottom→top, each with its own opacity) onto
  // one CanvasTexture → scene.background. Supports multiple backgrounds.
  _applyBackground() {
    if (this._bgTransparent) { this.scene.background = null; return }
    const list = this._backgrounds
    if (!list || list.length === 0) { this.scene.background = this.bgColor; return }
    if (!this._bgCanvas) { this._bgCanvas = document.createElement('canvas'); this._bgCanvas.width = 512; this._bgCanvas.height = 512 }
    const cv = this._bgCanvas
    const w = cv.width, h = cv.height
    const ctx = cv.getContext('2d')
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h) // opaque base so the stack never shows through
    for (const bg of list) {
      ctx.globalAlpha = bg.opacity ?? 1
      this._drawBg(ctx, bg, w, h)
    }
    ctx.globalAlpha = 1
    if (this._bgTex) this._bgTex.dispose()
    this._bgTex = new THREE.CanvasTexture(cv)
    this._bgTex.colorSpace = THREE.SRGBColorSpace
    this.scene.background = this._bgTex
  }

  _buildGeom(shape, size) {
    const s = size
    switch (shape) {
      case 'sphere': return new THREE.SphereGeometry(0.62 * s, 64, 64)
      case 'torus': return new THREE.TorusGeometry(0.5 * s, 0.2 * s, 48, 120)
      case 'crystal': return new THREE.IcosahedronGeometry(0.72 * s, 0) // faceted gem/ice
      case 'slab':
      default: return new RoundedBoxGeometry(1.5 * s, 1.5 * s, 0.42 * s, 6, 0.18 * s)
    }
  }

  // Plane scaled to the image aspect (× the image-layer scale), filling the view.
  _resizePlane() {
    const h = 2.4 * this.imgScale
    const w = h * this.imgAspect
    this.photo.scale.set(w, h, 1)
  }

  // Image-layer texture transform: zoom (repeat) + pan (offset) on the photo plane.
  _applyTex() {
    if (!this.photoTex) return
    const z = Math.max(this.imgZoom, 0.01)
    this.photoTex.repeat.set(1 / z, 1 / z)
    this.photoTex.offset.set((1 - 1 / z) / 2 - this.imgOffsetX, (1 - 1 / z) / 2 - this.imgOffsetY)
    this.photoTex.needsUpdate = true
  }

  setSource(img) {
    if (!this.photoMat) return
    if (!img) { this.photoMat.map = null; this.photoMat.emissiveMap = null; this.photoMat.color.set(0x222428); this.photoMat.needsUpdate = true; return }
    const isVideo = img.tagName === 'VIDEO'
    const tex = isVideo ? new THREE.VideoTexture(img) : new THREE.Texture(img)
    if (!isVideo) tex.needsUpdate = true
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    if (this.photoTex) this.photoTex.dispose()
    this.photoTex = tex
    this.photoMat.map = tex
    this.photoMat.emissiveMap = tex // base visibility carries the photo; lights add on top
    this.photoMat.color.set(0xffffff)
    this.photoMat.needsUpdate = true
    this.imgAspect = (img.width || img.videoWidth || 1) / (img.height || img.videoHeight || 1)
    this._resizePlane()
    this._applyTex()
  }

  setParams(p) {
    if (!this.glassMat) return
    const m = this.glassMat
    // glass object
    if ((p.shape != null && p.shape !== this.shape) || (p.size != null && p.size !== this.size)) {
      this.shape = p.shape ?? this.shape
      this.size = p.size ?? this.size
      const old = this.glassGeom
      this.glassGeom = this._buildGeom(this.shape, this.size)
      this.glass.geometry = this.glassGeom
      old?.dispose()
    }
    // DISTANCE — the z-gap between the glass and the photo plane
    if (p.distance != null) { this.distance = p.distance; this.glass.position.z = p.distance }
    // XYZ position — glass mesh (z = distance, set above) + photo plane
    if (p.glassX != null) this.glass.position.x = p.glassX
    if (p.glassY != null) this.glass.position.y = p.glassY
    if (p.imageX != null) this.photo.position.x = p.imageX
    if (p.imageY != null) this.photo.position.y = p.imageY
    if (p.imageZ != null) this.photo.position.z = p.imageZ
    // physical glass material (real refraction + chromatic dispersion)
    if (p.ior != null) m.ior = p.ior
    if (p.thickness != null) m.thickness = p.thickness
    if (p.roughness != null) m.roughness = p.roughness
    if (p.dispersion != null) m.dispersion = p.dispersion
    if (p.metalness != null) m.metalness = p.metalness
    if (p.transmission != null) m.transmission = p.transmission
    if (p.tint != null) m.attenuationColor.set(p.tint)
    if (p.tintDistance != null) m.attenuationDistance = p.tintDistance <= 0 ? 1e9 : p.tintDistance
    if (p.envIntensity != null) m.envMapIntensity = p.envIntensity
    // IMAGE layer — photo plane transform
    let tex = false, plane = false
    if (p.imgZoom != null) { this.imgZoom = p.imgZoom; tex = true }
    if (p.imgOffsetX != null) { this.imgOffsetX = p.imgOffsetX; tex = true }
    if (p.imgOffsetY != null) { this.imgOffsetY = p.imgOffsetY; tex = true }
    if (p.imgScale != null) { this.imgScale = p.imgScale; plane = true }
    if (tex) this._applyTex()
    if (plane) this._resizePlane()
    // layer visibility (the LayersPanel eye toggles)
    if (p.glassVisible != null) this.glass.visible = p.glassVisible
    if (p.imageVisible != null) this.photo.visible = p.imageVisible
    if (p.spotlight != null) this.spot.setParams(p.spotlight)
    // MASTER layer — camera / scene
    if (p.fov != null) { this.camera.fov = p.fov; this.camera.updateProjectionMatrix() }
    if (p.autoRotate != null) this.autoRotate = p.autoRotate
    if (p.orbitSpeed != null) this.orbitSpeed = p.orbitSpeed
    {
      let bgDirty = false
      if (p.backgrounds != null) { this._backgrounds = p.backgrounds; bgDirty = true }
      if (p.bgTransparent != null) { this._bgTransparent = p.bgTransparent; bgDirty = true }
      if (bgDirty) this._applyBackground()
    }
    if (p.flow != null) this.flow = p.flow
    // FILTER post-process uniforms
    if (p.filter && this.filterPass) {
      const u = this.filterPass.uniforms
      if (p.filter.aberration != null) u.uAberration.value = p.filter.aberration
      if (p.filter.grain != null) u.uGrain.value = p.filter.grain
      if (p.filter.vignette != null) u.uVignette.value = p.filter.vignette
      if (p.filter.bloom != null && this.bloomPass) this.bloomPass.strength = p.filter.bloom
    }
  }

  // Seed the whole material from a surface preset (the sub-page identity).
  applySurface(mat) {
    if (!this.glassMat || !mat) return
    const m = this.glassMat
    for (const k of ['transmission', 'ior', 'roughness', 'dispersion', 'metalness']) {
      if (mat[k] != null) m[k] = mat[k]
    }
  }

  setPlaying(v) { this.playing = v }
  resetTime() { if (this.glass) this.glass.rotation.set(0, 0, 0) }
  resetCamera() {
    this.camera.position.set(1.1, 0.5, 4)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  // Orbit camera as yaw/pitch/distance (so the shared draw-3d CameraPanel can drive it).
  getCamera() {
    const t = this.controls.target
    const dx = this.camera.position.x - t.x
    const dy = this.camera.position.y - t.y
    const dz = this.camera.position.z - t.z
    const dist = Math.hypot(dx, dy, dz) || 1
    return {
      yaw: (Math.atan2(dx, dz) * 180) / Math.PI,
      pitch: (Math.asin(Math.max(-1, Math.min(1, dy / dist))) * 180) / Math.PI,
      dist,
    }
  }
  setCamera(v) {
    const cur = this.getCamera()
    const y = ((v.yaw ?? cur.yaw) * Math.PI) / 180
    const p = ((v.pitch ?? cur.pitch) * Math.PI) / 180
    const d = v.dist ?? cur.dist
    const t = this.controls.target
    this.camera.position.set(
      t.x + d * Math.cos(p) * Math.sin(y),
      t.y + d * Math.sin(p),
      t.z + d * Math.cos(p) * Math.cos(y),
    )
    this.camera.lookAt(t)
    this.controls.update()
  }

  async exportBlob(w, h) {
    if (!this.renderer) return null
    const restore = { w: this.renderer.domElement.clientWidth, h: this.renderer.domElement.clientHeight }
    if (w && h) {
      this.renderer.setSize(w, h, false)
      this.composer?.setSize(w, h)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    const gizmoOn = this.gizmo?.visible
    if (this.gizmo) this.gizmo.visible = false // keep the move gizmo out of exports
    this.composer ? this.composer.render() : this.renderer.render(this.scene, this.camera)
    const blob = await new Promise((res) => this.renderer.domElement.toBlob(res, 'image/png'))
    if (this.gizmo) this.gizmo.visible = gizmoOn
    if (w && h) this._resize(restore.w, restore.h)
    return blob
  }

  _resize() {
    if (!this.renderer || !this.container) return
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(w, h, false)
    this.composer?.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  destroy() {
    this.disposed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.ro) this.ro.disconnect()
    this.spot?.dispose()
    this.controls?.dispose()
    // r169 TransformControls extends Controls (no `traverse`), so its own
    // dispose() throws — detach + disconnect, then dispose the helper root.
    this.tcontrols?.detach()
    this.tcontrols?.disconnect()
    if (this.gizmo) {
      this.scene.remove(this.gizmo)
      this.gizmo.traverse((c) => { c.geometry?.dispose?.(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose?.()) })
    }
    this.viewHelper?.dispose()
    this.composer?.dispose()
    this.photoTex?.dispose()
    this._bgTex?.dispose()
    this.glassGeom?.dispose()
    this.glassMat?.dispose()
    this.photoMat?.dispose()
    this.envTex?.dispose()
    this.pmrem?.dispose()
    this.renderer?.dispose()
    this.renderer = null
  }
}
