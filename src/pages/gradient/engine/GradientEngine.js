import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { gradientVertex, gradientFragment } from './shaders.js'

/* GradientEngine — one renderer, one WebGL context. Grid mode renders every
 * variation into its own scissored viewport (the three.js multi-scene
 * technique — N separate contexts would hit browser limits); single mode
 * renders one variation full-canvas. The React shell resolves variation specs
 * (shape/colors/driver/distort per seed) and pushes them via update().
 * preserveDrawingBuffer is on so exportBlob() can read the canvas back. */

const BG = '#0b0b0e'
const GAP = 14
const MAX_COLORS = 5

const makeGlowTexture = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.25)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export default class GradientEngine {
  constructor(canvas) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(new THREE.Color(BG), 1)
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    this.camera.position.set(0, 0.15, 4.2)
    this.camera.lookAt(0, 0, 0)
    // One camera, one orbit — in grid mode all tiles share the view, so a drag
    // orbits the whole set; clicks (no drag) still select tiles.
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 1.6
    this.controls.maxDistance = 12
    this.glowTex = makeGlowTexture()
    this.geoms = {
      sphere: new THREE.SphereGeometry(1.02, 96, 96),
      cube: new RoundedBoxGeometry(1.55, 1.55, 1.55, 6, 0.26),
      torus: new THREE.TorusGeometry(0.82, 0.3, 64, 128),
      blob: new THREE.SphereGeometry(0.95, 128, 128),
      wave: new THREE.PlaneGeometry(2.1, 1.5, 128, 96),
    }
    this.tiles = []
    this.rects = []
    this.mode = 'grid'
    this.idx = 0
    this.globals = { glow: 0.6, grain: 0.06, speed: 1, paused: false }
    this.time = 0
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  buildTile(spec) {
    const scene = new THREE.Scene()
    const material = new THREE.ShaderMaterial({
      vertexShader: gradientVertex,
      fragmentShader: gradientFragment,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uDistort: { value: 0 },
        uSeedOffset: { value: 0 },
        uColors: { value: Array.from({ length: MAX_COLORS }, () => new THREE.Color()) },
        uCount: { value: 2 },
        uDriver: { value: 0 },
        uGlow: { value: 0.6 },
        uGrain: { value: 0.06 },
      },
    })
    const mesh = new THREE.Mesh(this.geoms[spec.shape], material)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.3,
    }))
    glow.position.set(0, -0.5, -1.2)
    glow.scale.set(3.6, 3.6, 1)
    scene.add(glow)
    scene.add(mesh)
    return { scene, mesh, material, glow, spec }
  }

  applySpec(tile, spec) {
    const u = tile.material.uniforms
    tile.mesh.geometry = this.geoms[spec.shape]
    tile.mesh.rotation.set(spec.shape === 'wave' ? -0.35 : 0.12, 0, 0)
    u.uDistort.value = spec.distort
    u.uSeedOffset.value = spec.seed % 977
    u.uDriver.value = spec.driver
    u.uCount.value = Math.min(spec.colors.length, MAX_COLORS)
    spec.colors.slice(0, MAX_COLORS).forEach((hex, i) => u.uColors.value[i].set(hex))
    tile.glow.material.color.set(spec.colors[Math.floor(spec.colors.length / 2)])
    tile.spec = spec
  }

  update({ specs, mode, idx, globals }) {
    if (specs) {
      while (this.tiles.length < specs.length) this.tiles.push(this.buildTile(specs[this.tiles.length]))
      specs.forEach((spec, i) => this.applySpec(this.tiles[i], spec))
    }
    if (mode) this.mode = mode
    if (idx != null) this.idx = idx
    if (globals) this.globals = globals
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false)
    this.w = w
    this.h = h
  }

  tileAt(x, y) {
    return this.rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
  }

  renderTile(tile, rect) {
    // setViewport/setScissor take logical units; three applies the pixel ratio.
    this.renderer.setViewport(rect.x, this.h - rect.y - rect.h, rect.w, rect.h)
    this.renderer.setScissor(rect.x, this.h - rect.y - rect.h, rect.w, rect.h)
    this.camera.aspect = rect.w / rect.h
    this.camera.updateProjectionMatrix()
    this.renderer.render(tile.scene, this.camera)
  }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = (now - this.last) / 1000
    this.last = now
    if (!this.globals.paused) this.time += dt * this.globals.speed
    this.controls.update()
    if (!this.w || !this.h || this.tiles.length === 0) return

    for (const tile of this.tiles) {
      const u = tile.material.uniforms
      u.uTime.value = this.time
      u.uGlow.value = this.globals.glow
      u.uGrain.value = this.globals.grain
      tile.glow.material.opacity = 0.18 + this.globals.glow * 0.3
      const wave = tile.spec.shape === 'wave'
      tile.mesh.rotation.y = tile.spec.phase + this.time * tile.spec.rotSpeed * (wave ? 0.3 : 1)
    }

    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, this.w, this.h)
    this.renderer.clear()
    this.renderer.setScissorTest(true)

    if (this.mode === 'single') {
      const rect = { x: 0, y: 0, w: this.w, h: this.h }
      this.rects = [rect]
      this.renderTile(this.tiles[this.idx], rect)
    } else {
      const n = this.tiles.length
      const cols = 3
      const rows = Math.ceil(n / cols)
      const tw = (this.w - GAP * (cols + 1)) / cols
      const th = (this.h - GAP * (rows + 1)) / rows
      this.rects = this.tiles.map((_, i) => ({
        x: GAP + (i % cols) * (tw + GAP),
        y: GAP + Math.floor(i / cols) * (th + GAP),
        w: tw,
        h: th,
      }))
      this.tiles.forEach((tile, i) => this.renderTile(tile, this.rects[i]))
    }
    this.renderer.setScissorTest(false)
  }

  resetCamera() {
    this.camera.position.set(0, 0.15, 4.2)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  exportBlob() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'))
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    for (const tile of this.tiles) {
      tile.material.dispose()
      tile.glow.material.dispose()
    }
    for (const g of Object.values(this.geoms)) g.dispose()
    this.glowTex.dispose()
    this.renderer.dispose()
  }
}
