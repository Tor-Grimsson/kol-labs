import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { useImage } from '../state/ImageContext'
import SourcePlaceholder from '../components/SourcePlaceholder.jsx'
import LibrarySourceButton from '../components/LibrarySourceButton.jsx'
import { LensScene } from './LensScene.js'
import { SURFACE_BY_ID, GLASS_SHAPES } from './distorters.js'
import { resolveDeep } from '../../../lib/exprParam.js'
import LayersPanel from './LayersPanel.jsx'
import Icon from '../../../components/loaders/Icon.jsx'
import { ASPECT_SPECS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { downloadSettings, readSettingsFile } from '../../../lib/settingsIO.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Button from '../../../components/atoms/Button.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

// Optic · Lens — a real 3D scene: a PHOTO PLANE behind a GLASS MESH, with the
// z-GAP between them as the headline Distance control. Orbit the camera to see
// the depth; the glass refracts + chromatically disperses the photo behind it.
// One shell, one surface per page (`surface` prop = the sub-page identity).
export default function LensShell({ surface = 'glass', title = 'Glass', preset = {} }) {
  const surf = SURFACE_BY_ID[surface] || SURFACE_BY_ID.glass
  const { sourceImage, loadImageFromFile, clearImage } = useImage()
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const fileInputRef = useRef(null)
  const settingsInputRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [footTab, setFootTab] = useState('transport')
  const [playing, setPlaying] = useState(() => defaultAutoplay())

  // image layer — photo plane transform
  const [imgZoom, setImgZoom] = useState(1)
  const [imgOffsetX, setImgOffsetX] = useState(0)
  const [imgOffsetY, setImgOffsetY] = useState(0)
  const [imgScale, setImgScale] = useState(1)
  // XYZ position — image plane (z) + glass mesh (x/y; z = distance)
  const [imageX, setImageX] = useState(0)
  const [imageY, setImageY] = useState(0)
  const [imageZ, setImageZ] = useState(0)
  const [glassX, setGlassX] = useState(0)
  const [glassY, setGlassY] = useState(0)
  // glass object
  const [selLayer, setSelLayer] = useState('glass') // active layer (glass | image | light | camera | scene)
  const [removedLayers, setRemovedLayers] = useState(() => new Set()) // deleted layers (X)
  const [glassVisible, setGlassVisible] = useState(true)
  const [imageVisible, setImageVisible] = useState(true)
  const [gizmoOn, setGizmoOn] = useState(false) // show/hide the XYZ move gizmo (off by default)
  const [viewMode, setViewMode] = useState('viewer') // viewer = free orbit · camera = locked shot
  const [mode, setMode] = useState('transform') // transform | texture | filter
  // filter post-process (global)
  const [aberration, setAberration] = useState(0)
  const [grain, setGrain] = useState(0)
  const [vignette, setVignette] = useState(0)
  const [bloom, setBloom] = useState(0)
  const [activeFilters, setActiveFilters] = useState([]) // post-fx added via the Filter dropdown
  const [shape, setShape] = useState(surf.geom)
  const [size, setSize] = useState(preset.size ?? 1)
  const [distance, setDistance] = useState(preset.distance ?? 1)
  // physical glass material
  const [ior, setIor] = useState(surf.mat.ior)
  const [thickness, setThickness] = useState(1.2)
  const [roughness, setRoughness] = useState(surf.mat.roughness)
  const [dispersion, setDispersion] = useState(surf.mat.dispersion)
  const [metalness, setMetalness] = useState(surf.mat.metalness)
  const [transmission, setTransmission] = useState(surf.mat.transmission)
  const [tint, setTint] = useState(preset.tint ?? '#ffffff')
  const [tintDistance, setTintDistance] = useState(preset.tintDistance ?? 4)
  // camera / scene
  const [fov, setFov] = useState(preset.fov ?? 40)
  const [autoRotate, setAutoRotate] = useState(false)
  const [orbitSpeed, setOrbitSpeed] = useState(1)
  // camera motion (Camera layer's Motion tab)
  const [camMotionOn, setCamMotionOn] = useState(false)
  const [camMotionType, setCamMotionType] = useState('orbit')
  const [camMotionSpeed, setCamMotionSpeed] = useState(0.5)
  const [bgTransparent, setBgTransparent] = useState(false)
  // Background STACK — one or more backgrounds composited bottom→top by opacity.
  // Each is a self-contained card (toggle + type + sliders), like radar's sweeps.
  const [backgrounds, setBackgrounds] = useState([{ id: 1, type: 'solid', color: preset.bg ?? '#0b0d12', brightness: 1, opacity: 1, visible: true }])
  const bgIdRef = useRef(2)
  const addBackground = () => setBackgrounds((prev) => [...prev, { id: bgIdRef.current++, type: 'linear', color: '#2a3a55', color2: '#000000', brightness: 1, angle: 90, opacity: 0.6, visible: true }])
  const updateBackground = (i, key, val) => setBackgrounds((prev) => prev.map((b, idx) => (idx === i ? { ...b, [key]: val } : b)))
  const removeBackground = (i) => setBackgrounds((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  // Drag-reorder, expressed in DISPLAY order (top row = front-most). The stored
  // array is back→front, so we reverse, splice, and reverse back.
  const [collapsedBg, setCollapsedBg] = useState(() => new Set()) // UI fold per card (≠ hide)
  const toggleCollapseBg = (id) => setCollapsedBg((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const dragBgRef = useRef(null)
  const reorderBg = (fromDisp, toDisp) => setBackgrounds((prev) => {
    if (fromDisp === toDisp) return prev
    const disp = [...prev].reverse()
    const [m] = disp.splice(fromDisp, 1)
    disp.splice(toDisp, 0, m)
    return disp.reverse()
  })
  const [envIntensity, setEnvIntensity] = useState(preset.envIntensity ?? 1.3)
  // light layer (added via the Layers "+") — a spotlight on the scene
  const [lightAdded, setLightAdded] = useState(false)
  const [lightType, setLightType] = useState('spot') // spot | sun | three
  const [lightOn, setLightOn] = useState(true)
  const [lightColor, setLightColor] = useState('#ffffff')
  const [lightIntensity, setLightIntensity] = useState(80)
  const [lightAngle, setLightAngle] = useState(32)
  const [lightPenumbra, setLightPenumbra] = useState(0.45)
  const [lightX, setLightX] = useState(2)
  const [lightY, setLightY] = useState(3)
  const [lightZ, setLightZ] = useState(3)
  // transport / export
  const [flow, setFlow] = useState(1)
  const [aspect, setAspect] = useState(() => defaultAspectFor('source'))
  const [expScale, setExpScale] = useState(DEFAULT_SCALE)
  const [imgAspect, setImgAspect] = useState(null)

  const picked = ratioFor(aspect)
  const r = picked ?? imgAspect ?? 4 / 5

  // One scene for the page's life.
  useEffect(() => {
    const engine = new LensScene()
    engineRef.current = engine
    let disposed = false
    engine.init(containerRef.current).then(() => { if (!disposed) { engine.applySurface(surf.mat); setReady(true) } })
    return () => { disposed = true; engine.destroy(); engineRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (ready) engineRef.current?.setSource(sourceImage) }, [ready, sourceImage])
  useEffect(() => {
    if (!sourceImage) { setImgAspect(null); return }
    const w = sourceImage.naturalWidth || sourceImage.videoWidth || sourceImage.width || 1
    const h = sourceImage.naturalHeight || sourceImage.videoHeight || sourceImage.height || 1
    setImgAspect(w / h)
  }, [sourceImage])

  // Structural params (geometry rebuild on shape/size, texture/plane rebuild on
  // img*, visibility, colour) → push on change. The cheap material/transform/post
  // uniforms are resolved per frame below so they can be expression / audio bound.
  useEffect(() => {
    engineRef.current?.setParams({
      shape, size, tint, tintDistance,
      imgZoom, imgOffsetX, imgOffsetY, imgScale,
      glassVisible: glassVisible && !removedLayers.has('glass'),
      imageVisible: imageVisible && !removedLayers.has('image'),
      fov, autoRotate, orbitSpeed, bgTransparent,
    })
  }, [shape, size, tint, tintDistance, imgZoom, imgOffsetX, imgOffsetY, imgScale, glassVisible, imageVisible, removedLayers, fov, autoRotate, orbitSpeed, bgTransparent])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])
  useEffect(() => { engineRef.current?.setCameraMotion({ on: camMotionOn, type: camMotionType, speed: camMotionSpeed }) }, [camMotionOn, camMotionType, camMotionSpeed])
  useEffect(() => { if (ready) engineRef.current?.setViewMode(viewMode) }, [ready, viewMode])
  // Snap `mode` to a tab the active layer actually renders, so switching layers
  // never lands on an unsupported tab (which would show a blank panel).
  useEffect(() => {
    if (selLayer === 'scene' && mode === 'transform') setMode('texture')
    else if (selLayer !== 'scene' && mode === 'filter') setMode('transform')
  }, [selLayer, mode])

  // Per-frame resolve of the cheap material / transform / post-fx params (all
  // plain uniform/position sets in LensScene.setParams — no geometry rebuild) so
  // dispersion, ior, distance, bloom, … can be expression / audio bound.
  const cfg = useRef({})
  cfg.current = { distance, glassX, glassY, imageX, imageY, imageZ, ior, thickness, roughness, dispersion, metalness, transmission, envIntensity, flow, aberration, grain, vignette, bloom }
  useEffect(() => {
    if (!ready) return
    let alive = true
    let raf
    const loop = () => {
      if (!alive) return
      const engine = engineRef.current
      if (engine) {
        const c = cfg.current
        const t = engine.getTime?.() ?? 0
        engine.setParams(resolveDeep({
          distance: c.distance, glassX: c.glassX, glassY: c.glassY, imageX: c.imageX, imageY: c.imageY, imageZ: c.imageZ,
          ior: c.ior, thickness: c.thickness, roughness: c.roughness, dispersion: c.dispersion, metalness: c.metalness,
          transmission: c.transmission, envIntensity: c.envIntensity, flow: c.flow,
          filter: { aberration: c.aberration, grain: c.grain, vignette: c.vignette, bloom: c.bloom },
        }, t))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [ready])
  // Background stack → composited backdrop (hidden layers dropped).
  useEffect(() => {
    engineRef.current?.setParams({ backgrounds: backgrounds.filter((b) => b.visible !== false) })
  }, [backgrounds])

  // Light layer → the scene spotlight (enabled only once added + toggled on).
  // The helper cone shows while the Light layer is selected so you can see where
  // it is + which way it points.
  useEffect(() => {
    engineRef.current?.setParams({
      spotlight: {
        enabled: lightAdded && lightOn,
        type: lightType,
        color: lightColor, intensity: lightIntensity, angle: lightAngle, penumbra: lightPenumbra,
        x: lightX, y: lightY, z: lightZ,
        helper: lightAdded && selLayer === 'light',
      },
    })
  }, [lightAdded, lightOn, lightType, lightColor, lightIntensity, lightAngle, lightPenumbra, lightX, lightY, lightZ, selLayer])

  // The "Show gizmo" toggle drives the MOVE gizmo on Glass/Image, and the corner
  // SCENE gizmo (ViewHelper) on the Master layer.
  useEffect(() => {
    if (!ready) return
    const eng = engineRef.current
    // Camera mode = clean shot: no gizmos at all. Otherwise: move gizmo on movable
    // objects, corner gizmo on the Camera layer.
    const show = gizmoOn && viewMode !== 'camera'
    const movable = selLayer === 'glass' || selLayer === 'image' || selLayer === 'light'
    eng.setGizmoTarget(show && movable ? selLayer : 'none')
    eng.setViewHelperVisible(show && selLayer === 'camera')
  }, [ready, selLayer, gizmoOn, viewMode])
  // Dragging the gizmo writes the object's position back to the sliders.
  useEffect(() => {
    if (!ready) return
    const eng = engineRef.current
    eng.onTransform = (id, p) => {
      if (id === 'glass') { setGlassX(p.x); setGlassY(p.y); setDistance(p.z) }
      else if (id === 'light') { setLightX(p.x); setLightY(p.y); setLightZ(p.z) }
      else { setImageX(p.x); setImageY(p.y); setImageZ(p.z) }
    }
    return () => { if (eng) eng.onTransform = null }
  }, [ready])

  // Layer stack for the floating LayersPanel. Scene = the whole scene (camera /
  // background / environment / post — no visibility toggle); Glass + Image have
  // eye toggles wired to glassVisible / imageVisible (pushed via setParams).
  const allRows = [
    { id: 'glass', label: surf.label, icon: 'ball', visible: glassVisible },
    { id: 'image', label: 'Image', icon: 'image', visible: imageVisible },
    ...(lightAdded ? [{ id: 'light', label: 'Light', icon: 'sun', visible: lightOn }] : []),
    // Camera + Scene are singletons (always present) → no delete.
    { id: 'camera', label: 'Camera', icon: 'video', visible: true, noToggle: true, fixed: true },
    { id: 'scene', label: 'Scene', icon: 'layout-01', visible: true, noToggle: true, fixed: true }, // backdrop + post
  ]
  const layerRows = allRows.filter((l) => !removedLayers.has(l.id))
  const toggleLayer = (id) => {
    if (id === 'glass') setGlassVisible((v) => !v)
    else if (id === 'image') setImageVisible((v) => !v)
    else if (id === 'light') setLightOn((v) => !v)
  }
  // Delete a layer — drop it from the stack (light fully removes its rig). If the
  // deleted layer was selected, fall back to the first remaining row.
  const removeLayer = (id) => {
    if (id === 'light') { setLightAdded(false); if (selLayer === 'light') setSelLayer('scene'); return }
    setRemovedLayers((prev) => { const n = new Set(prev); n.add(id); return n })
    if (selLayer === id) { const next = layerRows.find((l) => l.id !== id); setSelLayer(next ? next.id : 'scene') }
  }
  // The Layers "+" — re-adds (un-deletes) a layer and selects it.
  const addLayer = (type) => {
    const id = type === 'object' ? 'glass' : type
    if (id === 'light') { setLightAdded(true); setLightOn(true) }
    else setRemovedLayers((prev) => { const n = new Set(prev); n.delete(id); return n })
    setSelLayer(id)
  }

  const handleFileUpload = (e) => loadImageFromFile(e.target.files[0])
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); loadImageFromFile(e.dataTransfer.files[0]) }

  // Whole-scene settings (the authored state; source image is NOT included — it's
  // re-uploaded separately). Save/Load via the File tab.
  const getSettings = () => ({
    shape, size, distance, glassX, glassY,
    ior, thickness, roughness, dispersion, metalness, transmission, tint, tintDistance,
    imgZoom, imgOffsetX, imgOffsetY, imgScale, imageX, imageY, imageZ,
    glassVisible, imageVisible,
    fov, autoRotate, orbitSpeed, camMotionOn, camMotionType, camMotionSpeed,
    bgTransparent, backgrounds, envIntensity,
    lightAdded, lightType, lightOn, lightColor, lightIntensity, lightAngle, lightPenumbra, lightX, lightY, lightZ,
    aberration, grain, vignette, bloom, activeFilters,
    aspect, expScale,
  })
  const SETTERS = {
    shape: setShape, size: setSize, distance: setDistance, glassX: setGlassX, glassY: setGlassY,
    ior: setIor, thickness: setThickness, roughness: setRoughness, dispersion: setDispersion, metalness: setMetalness, transmission: setTransmission, tint: setTint, tintDistance: setTintDistance,
    imgZoom: setImgZoom, imgOffsetX: setImgOffsetX, imgOffsetY: setImgOffsetY, imgScale: setImgScale, imageX: setImageX, imageY: setImageY, imageZ: setImageZ,
    glassVisible: setGlassVisible, imageVisible: setImageVisible,
    fov: setFov, autoRotate: setAutoRotate, orbitSpeed: setOrbitSpeed, camMotionOn: setCamMotionOn, camMotionType: setCamMotionType, camMotionSpeed: setCamMotionSpeed,
    bgTransparent: setBgTransparent, backgrounds: setBackgrounds, envIntensity: setEnvIntensity,
    lightAdded: setLightAdded, lightType: setLightType, lightOn: setLightOn, lightColor: setLightColor, lightIntensity: setLightIntensity, lightAngle: setLightAngle, lightPenumbra: setLightPenumbra, lightX: setLightX, lightY: setLightY, lightZ: setLightZ,
    aberration: setAberration, grain: setGrain, vignette: setVignette, bloom: setBloom, activeFilters: setActiveFilters,
    aspect: setAspect, expScale: setExpScale,
  }
  const applySettings = (s) => { for (const [k, v] of Object.entries(s)) SETTERS[k]?.(v) }
  const saveSettings = () => downloadSettings(`optic-${surface}`, getSettings(), `optic-${surface}.json`)
  const loadSettings = (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (file) readSettingsFile(file, `optic-${surface}`).then(applySettings).catch(() => {})
  }

  const handleDownload = async () => {
    const dd = picked ? dimsFor(aspect, Number(expScale)) : null
    const blob = await engineRef.current?.exportBlob(dd?.w, dd?.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-${surface}-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Post-process filters — added/removed via a dropdown (radar FX-chain pattern).
  const FILTER_DEFS = [
    { id: 'aberration', label: 'Aberration', min: 0, max: 3, step: 0.01, def: 0.6, value: aberration, set: setAberration },
    { id: 'grain', label: 'Grain', min: 0, max: 0.5, step: 0.005, def: 0.15, value: grain, set: setGrain },
    { id: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01, def: 0.4, value: vignette, set: setVignette },
    { id: 'bloom', label: 'Bloom', min: 0, max: 3, step: 0.01, def: 0.8, value: bloom, set: setBloom },
  ]
  const addFilter = (id) => { const d = FILTER_DEFS.find((f) => f.id === id); if (!d || activeFilters.includes(id)) return; d.set(d.def); setActiveFilters((p) => [...p, id]) }
  const removeFilter = (id) => { FILTER_DEFS.find((f) => f.id === id)?.set(0); setActiveFilters((p) => p.filter((x) => x !== id)) }
  const filterPanel = (
    <Section label="Filters">
      {activeFilters.map((id) => {
        const d = FILTER_DEFS.find((f) => f.id === id)
        if (!d) return null
        return (
          <div key={id} className="flex flex-col gap-2 p-2 rounded bg-fg-04">
            <div className="flex items-center">
              <span className="kol-helper-10 uppercase tracking-widest text-meta flex-1">{d.label}</span>
              <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label={`Remove ${d.label}`} onClick={() => removeFilter(id)} />
            </div>
            <Slider raised labeled label={d.label} min={d.min} max={d.max} step={d.step} value={d.value} onChange={d.set} variant="default" />
          </div>
        )
      })}
      <Dropdown
        size="sm" variant="subtle" className="w-full"
        options={[{ value: '', label: 'Add filter…' }, ...FILTER_DEFS.filter((f) => !activeFilters.includes(f.id)).map((f) => ({ value: f.id, label: f.label }))]}
        value=""
        onChange={(v) => v && addFilter(v)}
      />
    </Section>
  )

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div
        className="relative flex-1 flex items-center justify-center p-4"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="relative overflow-hidden rounded"
          style={{ aspectRatio: r, width: `min(100%, calc(90vh * ${r}))`, maxHeight: '90vh' }}
        >
          <div ref={containerRef} data-vcap="stage" className="absolute inset-0" />

          {!sourceImage && (
            <div
              className="absolute inset-0 flex items-center justify-center border border-dashed rounded pointer-events-none"
              style={{ borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)' }}
            >
              <div className="pointer-events-auto"><SourcePlaceholder onUpload={() => fileInputRef.current?.click()} /></div>
            </div>
          )}
        </div>

        {/* Floating Layers panel — sibling of the artboard (NOT inside it), so it
            floats over the stage and drags off-canvas without clipping. Hidden in
            Camera mode for a clean shot. Camera controls live in the Camera layer. */}
        {viewMode !== 'camera' && (
          <LayersPanel layers={layerRows} selected={selLayer} onSelect={setSelLayer} onToggle={toggleLayer} onAdd={addLayer} onRemove={removeLayer} />
        )}
      </div>

      <EditorRail
        footerBare
        header={(
          <>
            <RailHeader>Layers</RailHeader>
            {/* Persistent viewport switch — free-orbit Viewer vs the locked Camera shot. */}
            <SegmentedToggle
              className="w-full"
              value={viewMode}
              onChange={setViewMode}
              options={[{ value: 'viewer', label: 'Viewer' }, { value: 'camera', label: 'Camera' }]}
            />
            <div className="flex items-center gap-2">
              <Dropdown
                variant="subtle"
                size="sm"
                className="flex-1"
                options={layerRows.map((l) => ({ value: l.id, label: l.label }))}
                value={selLayer}
                onChange={setSelLayer}
              />
              {!allRows.find((l) => l.id === selLayer)?.fixed && (
                <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Delete layer" onClick={() => removeLayer(selLayer)} />
              )}
            </div>
            <ToggleSwitch variant="plain" label="Show gizmo" checked={gizmoOn} onChange={setGizmoOn} />
            {/* Scene = Texture + Filter. Camera = Transform + Motion + Filter. Others = all three. */}
            {selLayer === 'scene' ? (
              <SegmentedToggle
                value={mode === 'transform' ? 'texture' : mode}
                onChange={setMode}
                options={[{ value: 'texture', label: 'Texture' }, { value: 'filter', label: 'Filter' }]}
              />
            ) : (
              /* Filter is a SCENE-WIDE post pass → only on Scene, not per-object. */
              <SegmentedToggle
                value={mode === 'filter' ? 'transform' : mode}
                onChange={setMode}
                options={[{ value: 'transform', label: 'Transform' }, { value: 'texture', label: selLayer === 'camera' ? 'Motion' : 'Texture' }]}
              />
            )}
          </>
        )}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); engineRef.current?.resetTime() },
              onRewind: () => engineRef.current?.resetTime(),
              tempo: Math.round(flow * 120),
              onTempo: (v) => setFlow(v / 120),
              tempoMax: 400,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: ASPECT_SPECS, scale: expScale, onScale: setExpScale }}
            exportActions={sourceImage
              ? <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={handleDownload}>Download</Button>
              : <div className="kol-mono-10 text-fg-32">Load a source to export.</div>}
            file={
              <div className="flex flex-col gap-2">
                <ButtonGroup orientation="vertical" className="w-full">
                  <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">Upload image / video</Button>
                  <LibrarySourceButton />
                </ButtonGroup>
                {sourceImage && (
                  <Button variant="secondary" size="sm" onClick={clearImage} iconLeft="cross" className="w-full">Clear source</Button>
                )}
                <div className="border-t border-fg-08 pt-2 mt-1">
                  <ButtonGroup orientation="vertical" className="w-full">
                    <Button variant="primary" size="sm" onClick={saveSettings} iconLeft="download" className="w-full">Save settings</Button>
                    <Button variant="primary" size="sm" onClick={() => settingsInputRef.current?.click()} iconLeft="upload" className="w-full">Load settings</Button>
                  </ButtonGroup>
                </div>
              </div>
            }
          />
        }
      >
        {/* ── GLASS layer ── the object in front of the photo */}
        {selLayer === 'glass' && <>
          {mode === 'transform' && <>
            <Section label="Object">
              <Dropdown variant="subtle" size="sm" className="w-full" options={GLASS_SHAPES} value={shape} onChange={setShape} />
              <Slider labeled label="Size" min={0.3} max={2} step={0.01} value={size} onChange={setSize} variant="default" />
            </Section>
            <Section label="Position">
              <Slider labeled label="X" min={-2} max={2} step={0.01} value={glassX} onChange={setGlassX} variant="default" />
              <Slider labeled label="Y" min={-2} max={2} step={0.01} value={glassY} onChange={setGlassY} variant="default" />
              <Slider labeled label="Z · gap" min={0} max={2.5} step={0.01} value={distance} onChange={setDistance} variant="default" />
              <Slider labeled label="Thickness" min={0} max={3} step={0.05} value={thickness} onChange={setThickness} variant="default" />
            </Section>
          </>}
          {mode === 'texture' && (
            <Section label="Material">
              <Slider labeled label="IOR" min={1} max={2.4} step={0.01} value={ior} onChange={setIor} variant="default" />
              <Slider labeled label="Dispersion" min={0} max={20} step={0.1} value={dispersion} onChange={setDispersion} variant="default" />
              <Slider labeled label="Roughness" min={0} max={1} step={0.01} value={roughness} onChange={setRoughness} variant="default" />
              <Slider labeled label="Transmission" min={0} max={1} step={0.01} value={transmission} onChange={setTransmission} variant="default" />
              <Slider labeled label="Metalness" min={0} max={1} step={0.01} value={metalness} onChange={setMetalness} variant="default" />
              <ColorField label="Tint" value={tint} onChange={setTint} />
              <Slider labeled label="Tint depth" min={0} max={8} step={0.1} value={tintDistance} onChange={setTintDistance} variant="default" />
            </Section>
          )}
        </>}

        {/* ── IMAGE layer ── the photo plane behind the glass */}
        {selLayer === 'image' && <>
          {mode === 'transform' && (
            <Section label="Position">
              <Slider labeled label="X" min={-2} max={2} step={0.01} value={imageX} onChange={setImageX} variant="default" />
              <Slider labeled label="Y" min={-2} max={2} step={0.01} value={imageY} onChange={setImageY} variant="default" />
              <Slider labeled label="Z" min={-2} max={2} step={0.01} value={imageZ} onChange={setImageZ} variant="default" />
            </Section>
          )}
          {mode === 'texture' && (
            <Section label="Placement">
              <Slider labeled label="Scale" min={0.3} max={3} step={0.01} value={imgScale} onChange={setImgScale} variant="default" />
              <Slider labeled label="Zoom" min={0.2} max={3} step={0.01} value={imgZoom} onChange={setImgZoom} variant="default" />
              <Slider labeled label="Offset X" min={-0.5} max={0.5} step={0.005} value={imgOffsetX} onChange={setImgOffsetX} variant="default" />
              <Slider labeled label="Offset Y" min={-0.5} max={0.5} step={0.005} value={imgOffsetY} onChange={setImgOffsetY} variant="default" />
              {!sourceImage && <div className="kol-mono-10 text-fg-32">Load a source in the File tab.</div>}
            </Section>
          )}
        </>}

        {/* ── SCENE layer ── background · environment · post ── */}
        {selLayer === 'scene' && <>
          {mode === 'filter' && filterPanel}
          {mode === 'texture' && (<>
          <Section label="Backgrounds">
            <ToggleSwitch variant="plain" label="Transparent" checked={bgTransparent} onChange={setBgTransparent} />
            {!bgTransparent && <>
              {/* one card per background (top = front-most) */}
              {backgrounds.map((_, i) => {
                const bi = backgrounds.length - 1 - i
                const b = backgrounds[bi]
                const on = b.visible !== false
                const collapsed = collapsedBg.has(b.id)
                return (
                  <div
                    key={b.id}
                    className="flex flex-col gap-2 p-2 rounded bg-fg-04"
                    onDragOver={(e) => { e.preventDefault() }}
                    onDrop={(e) => { e.preventDefault(); if (dragBgRef.current != null) reorderBg(dragBgRef.current, i); dragBgRef.current = null }}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="p-0 m-0 border-0 bg-transparent text-fg-48 hover:text-fg-default cursor-pointer inline-flex shrink-0"
                        title={collapsed ? 'Expand' : 'Collapse'}
                        onClick={() => toggleCollapseBg(b.id)}
                      >
                        <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={12} />
                      </button>
                      {backgrounds.length > 1 && (
                        <span
                          draggable
                          onDragStart={() => { dragBgRef.current = i }}
                          onDragEnd={() => { dragBgRef.current = null }}
                          className="kol-mono-12 text-fg-32 hover:text-fg-default cursor-grab active:cursor-grabbing select-none shrink-0"
                          title="Drag to reorder"
                        >⠿</span>
                      )}
                      <ToggleSwitch variant="plain" label={`Background ${bi + 1}`} checked={on} onChange={(v) => updateBackground(bi, 'visible', v)} />
                      {backgrounds.length > 1 && (
                        <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} className="ml-auto" aria-label="Remove background" onClick={() => removeBackground(bi)} />
                      )}
                    </div>
                    {on && !collapsed && (() => {
                      const t = b.type === 'gradient' ? 'linear' : b.type
                      const isGrad = t === 'linear' || t === 'radial' || t === 'multi'
                      const category = isGrad ? 'gradient' : t
                      const set = (k) => (v) => updateBackground(bi, k, v)
                      const setCategory = (v) => updateBackground(bi, 'type', v === 'gradient' ? (isGrad ? t : 'linear') : v)
                      return <>
                        <Dropdown
                          size="sm" variant="subtle" raised className="w-full"
                          options={[{ value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }, { value: 'glass', label: 'Glass' }, { value: 'metallic', label: 'Metallic' }]}
                          value={category}
                          onChange={setCategory}
                        />
                        {isGrad && (
                          <SegmentedToggle
                            className="w-full"
                            options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }, { value: 'multi', label: 'Multi' }]}
                            value={t}
                            onChange={set('type')}
                          />
                        )}
                        <ColorField raised label={t === 'radial' ? 'Center' : 'Color'} value={b.color} onChange={set('color')} />
                        {(t === 'linear' || t === 'radial') && (
                          <ColorField raised label={t === 'radial' ? 'Edge' : 'Color B'} value={b.color2 ?? '#000000'} onChange={set('color2')} />
                        )}
                        <Slider raised labeled label="Brightness" min={0} max={1.5} step={0.01} value={b.brightness ?? 1} onChange={set('brightness')} variant="default" />

                        {(t === 'linear' || t === 'multi' || t === 'metallic' || t === 'glass') && (
                          <Slider raised labeled label="Angle" min={0} max={360} step={1} value={b.angle ?? (t === 'multi' ? 0 : 90)} onChange={set('angle')} variant="default" />
                        )}
                        {t === 'radial' && <>
                          <Slider raised labeled label="Center X" min={0} max={1} step={0.01} value={b.cx ?? 0.5} onChange={set('cx')} variant="default" />
                          <Slider raised labeled label="Center Y" min={0} max={1} step={0.01} value={b.cy ?? 0.5} onChange={set('cy')} variant="default" />
                          <Slider raised labeled label="Radius" min={0.1} max={1.5} step={0.01} value={b.radius ?? 0.62} onChange={set('radius')} variant="default" />
                        </>}
                        {t === 'multi' && <>
                          <Slider raised labeled label="Heads" min={2} max={8} step={1} value={b.heads ?? 4} onChange={set('heads')} variant="default" noExpr />
                          <Slider raised labeled label="Spread" min={0} max={0.5} step={0.01} value={b.spread ?? 0.3} onChange={set('spread')} variant="default" />
                        </>}
                        {t === 'metallic' && <>
                          <Slider raised labeled label="Reflectivity" min={0} max={1} step={0.01} value={b.reflectivity ?? 0.65} onChange={set('reflectivity')} variant="default" />
                          <Slider raised labeled label="Bands" min={1} max={6} step={1} value={b.bands ?? 1} onChange={set('bands')} variant="default" noExpr />
                          <Slider raised labeled label="Sweep" min={0} max={1} step={0.01} value={b.sweep ?? 0.5} onChange={set('sweep')} variant="default" />
                          <Slider raised labeled label="Sharpness" min={0} max={1} step={0.01} value={b.sharpness ?? 0.5} onChange={set('sharpness')} variant="default" />
                        </>}
                        {t === 'glass' && <>
                          <ColorField raised label="Tint" value={b.color2 ?? '#ffffff'} onChange={set('color2')} />
                          <Slider raised labeled label="Frost" min={0} max={1} step={0.01} value={b.frost ?? 0.5} onChange={set('frost')} variant="default" />
                          <Slider raised labeled label="Sheen" min={0} max={1} step={0.01} value={b.sheen ?? 0.5} onChange={set('sheen')} variant="default" />
                        </>}

                        <Slider raised labeled label="Opacity" min={0} max={1} step={0.01} value={b.opacity} onChange={set('opacity')} variant="default" />
                      </>
                    })()}
                  </div>
                )
              })}
              <Button variant="secondary" size="sm" iconLeft="plus" onClick={addBackground} className="w-full">Add background</Button>
            </>}
          </Section>
          <Section label="Environment">
            <Slider labeled label="Reflections" min={0} max={3} step={0.05} value={envIntensity} onChange={setEnvIntensity} variant="default" />
          </Section>
          </>)}
        </>}

        {/* ── CAMERA layer ── */}
        {selLayer === 'camera' && <>
          {mode === 'transform' && (
            <Section label="Camera">
              <Slider labeled label="FOV" min={20} max={80} step={1} value={fov} onChange={setFov} variant="default" noExpr />
              <ToggleSwitch variant="plain" label="Auto-rotate" checked={autoRotate} onChange={setAutoRotate} />
              {autoRotate && <Slider labeled label="Spin" min={0} max={3} step={0.05} value={orbitSpeed} onChange={setOrbitSpeed} variant="default" />}
              <Button variant="primary" size="sm" iconLeft="cycle" onClick={() => engineRef.current?.resetCamera()} className="w-full">Reset camera</Button>
            </Section>
          )}
          {mode === 'texture' && (
            <Section label="Motion">
              <ToggleSwitch variant="plain" label="Animate" checked={camMotionOn} onChange={setCamMotionOn} />
              <Dropdown
                variant="subtle" size="sm" className="w-full"
                options={[{ value: 'orbit', label: 'Orbit' }, { value: 'spin', label: 'Spin' }, { value: 'rock', label: 'Rock' }, { value: 'rise', label: 'Rise' }, { value: 'push', label: 'Push / pull' }]}
                value={camMotionType}
                onChange={setCamMotionType}
              />
              <Slider labeled label="Speed" min={0} max={3} step={0.05} value={camMotionSpeed} onChange={setCamMotionSpeed} variant="default" />
            </Section>
          )}
        </>}

        {selLayer === 'light' && <>
          <Section label="Light">
            <SegmentedToggle
              options={[{ value: 'spot', label: 'Spot' }, { value: 'sun', label: 'Sun' }, { value: 'three', label: 'Studio' }]}
              value={lightType}
              onChange={setLightType}
              className="w-full"
            />
            <ToggleSwitch variant="plain" label="On" checked={lightOn} onChange={setLightOn} />
            <ColorField label="Color" value={lightColor} onChange={setLightColor} />
            <Slider labeled label="Intensity" min={0} max={300} step={1} value={lightIntensity} onChange={setLightIntensity} variant="default" />
            {lightType !== 'sun' && <Slider labeled label="Angle" min={5} max={80} step={1} value={lightAngle} onChange={setLightAngle} variant="default" />}
            {lightType !== 'sun' && <Slider labeled label="Softness" min={0} max={1} step={0.01} value={lightPenumbra} onChange={setLightPenumbra} variant="default" />}
          </Section>
          <Section label="Position">
            <Slider labeled label="X" min={-8} max={8} step={0.05} value={lightX} onChange={setLightX} variant="default" />
            <Slider labeled label="Y" min={-8} max={8} step={0.05} value={lightY} onChange={setLightY} variant="default" />
            <Slider labeled label="Z" min={-8} max={8} step={0.05} value={lightZ} onChange={setLightZ} variant="default" />
            <Button variant="primary" size="sm" iconLeft="cross" onClick={() => { setLightAdded(false); setSelLayer('scene') }} className="w-full">Remove light</Button>
          </Section>
        </>}
      </EditorRail>

      <input ref={fileInputRef} type="file" accept="image/*,video/*,.svg" onChange={handleFileUpload} className="hidden" />
      <input ref={settingsInputRef} type="file" accept="application/json,.json" onChange={loadSettings} className="hidden" />
    </div>
  )
}

