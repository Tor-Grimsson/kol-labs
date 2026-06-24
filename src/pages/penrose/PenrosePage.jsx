import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/atoms/Button.jsx'
import Input from '../../components/atoms/Input.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import { roundIfNum, isExpr, evalExpr } from '../../lib/exprParam.js'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import './main.css'
import { mulberry32 } from './prng'
import { rasterizeGlyph, computeSDF } from './sdf'
import { PROTOTYPES } from './prototypes'
import { makeSDF, setLoopClock } from './prototypes/common'
import OrbitView, { ORBIT_DEFAULTS, MOTION_PRESETS } from './orbitView'
import { CLOCK } from './clock'
import { defaultValues, fmt } from './knobs'
import { FONTS, FRAMES, frameFor, setPalette, setOpacity, PALETTE } from './settings'
import { SHAPE_SOURCES, rasterizeShape } from './shapes'
import { makeMapper, tintedContext } from './tint'
import { resolveTheme, THEME_OPTIONS } from '../../lib/themes.js'
import { randomSeed } from '../../lib/rng.js'
import { defaultAspectFor, defaultTheme, defaultAutoplay } from '../../lib/appSettings.js'
import { usePublishShortcuts, usePublishInfo, usePublishReset, usePublishRetrigger } from '../../components/framework/pageShortcuts.jsx'
import { CATEGORIES, catRoute, presetsForCat } from './registry'
import { CATEGORY_ORDER } from './prototypes/categories.js'

const LOGICAL = 960 // logical artboard resolution (higher = crisper + finer detail)
const MASK_RES = LOGICAL
const dpr = Math.min(window.devicePixelRatio || 1, 3)
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const DEFAULT_SEED = 42

// Distribute different substrates across presets so they don't all bake the glyph
// 'A'. Indexed by the prototype's position → each preset gets a distinct shape
// (mostly vector outlines, a few glyph letters). Switching preset re-assigns from
// this pool; the user can still override via the Shape control.
const SUBSTRATE_POOL = [
  { shape: 'circle' }, { shape: 'triangle' }, { shape: 'square' }, { shape: 'hexagon' },
  { shape: 'star' }, { shape: 'blob' }, { shape: 'ring' },
  { shape: 'glyph', letter: 'A' }, { shape: 'glyph', letter: 'O' },
  { shape: 'glyph', letter: 'S' }, { shape: 'glyph', letter: 'G' },
]

const PENROSE_SHORTCUTS = [
  ['drag', 'orbit'],
  ['wheel', 'zoom'],
  ['← / →', 'step preset'],
  ['R', 'retrigger (fresh run)'],
  ['C', 'reset camera'],
  ['space', 'play / pause'],
]

// Shared themes give grid as a solid hex; penrose draws the grid overlay as a
// translucent fill, so convert #rrggbb → rgba(r,g,b,a). Passes non-hex through.
const hexToRGBA = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Baked once before first render. Rebakes mutate sdfData in place so the shared
// `sdf` closure sees fresh values; bumping sdfVersion remounts the prototype.
let sdfData = null
let sdf = null

// Per-prototype param values, keyed by proto.id. Persists across remounts.
const paramStore = {}
const getParams = (protoId, declared) => {
  if (!paramStore[protoId]) paramStore[protoId] = declared
  else for (const k in declared) if (!(k in paramStore[protoId])) paramStore[protoId][k] = declared[k]
  return paramStore[protoId]
}

const initProto = (i, canvas, ctx, W, H, label, seedBase, clock) => {
  const proto = PROTOTYPES[i]
  const values = getParams(proto.id, defaultValues(proto.params))
  const seed = seedBase + i
  const rng = mulberry32(seed)
  const useClock = clock || CLOCK
  setLoopClock(useClock)
  const wctx = tintedContext(ctx, makeMapper(PALETTE))
  const liveParams = new Proxy(values, {
    get(t, k) { const v = t[k]; return isExpr(v) ? evalExpr(v, useClock.nowSeconds()) : v },
  })
  try {
    return proto.init({ canvas, ctx: wctx, sdf, W, H, rng, seed, params: liveParams, clock: useClock }) ?? null
  } catch (err) {
    console.error(`[${proto.id}] ${label} threw:`, err)
    return null
  } finally {
    setLoopClock(CLOCK)
  }
}

function KnobsPanel({ proto, onTweak }) {
  const [, force] = useReducer((x) => x + 1, 0)
  const params = proto.params
  const values = getParams(proto.id, defaultValues(params))
  if (!params || params.length === 0) return <div className="kol-helper-10 text-meta">No parameters.</div>
  const set = (key, v) => { values[key] = v; force(); onTweak() }
  return (
    <div className="flex flex-col gap-3">
      {params.map((p) => {
        const label = p.label ?? p.key
        if (p.type === 'range' || p.type === 'int') {
          return (
            <Slider labeled key={p.key} label={label} min={p.min} max={p.max}
              step={p.step ?? (p.type === 'int' ? 1 : 0.01)} value={values[p.key]}
              onChange={(v) => set(p.key, p.type === 'int' ? roundIfNum(v) : v)}
              formatValue={(v) => fmt(v, p.type === 'int')} className="w-full" noExpr />
          )
        }
        if (p.type === 'boolean') return <ToggleSwitch key={p.key} variant="plain" label={label} checked={!!values[p.key]} onChange={(v) => set(p.key, v)} />
        if (p.type === 'select') {
          return (
            <LabeledControl key={p.key} inline label={label}>
              <Dropdown size="sm" variant="subtle" className="w-full" options={p.options.map((o) => ({ value: o, label: String(o) }))} value={values[p.key]} onChange={(v) => set(p.key, v)} />
            </LabeledControl>
          )
        }
        if (p.type === 'color') return <ColorField key={p.key} label={label} value={values[p.key]} onChange={(v) => set(p.key, v)} />
        return null
      })}
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  // Category is route-derived (sidebar hops to /penrose/<cat>); the Preset dropdown
  // picks the prototype in-rail. Bare /penrose → the first category.
  const rawCat = (useParams()['*'] || '').split('/').filter(Boolean)[0]
  const cat = CATEGORY_ORDER.includes(rawCat) ? rawCat : CATEGORY_ORDER[0]
  const presets = presetsForCat(cat)

  usePublishShortcuts('Penrose', PENROSE_SHORTCUTS)

  const [presetId, setPresetId] = useState(() => presetsForCat(cat)[0]?.id)
  const [shape, setShape] = useState('glyph')
  const [letter, setLetter] = useState('A')
  const [weight, setWeight] = useState('700')
  const [font, setFont] = useState(FONTS[0].id)
  const [paused, setPaused] = useState(CLOCK.isPaused())
  const [speed, setSpeed] = useState(CLOCK.speed)
  const [bottomTab, setBottomTab] = useState('transport')
  const [cam, setCam] = useState(ORBIT_DEFAULTS)
  const updateCam = (k, v) => setCam((c) => ({ ...c, [k]: v }))
  const [sdfVersion, setSdfVersion] = useState(0)
  const [resetNonce, setResetNonce] = useState(0)
  const [frameRatio, setFrameRatio] = useState(() => { const a = defaultAspectFor('view'); return FRAMES.some((f) => f.id === a) ? a : '1:1' })
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [ov, setOv] = useState({})
  const setOvKey = (k, v) => setOv((o) => ({ ...o, [k]: v }))
  const [opacity, setOpacityState] = useState({ fg: 1, accent: 1, dim: 5, warm: 1 })
  const setOpacityKey = (k, v) => setOpacityState((o) => ({ ...o, [k]: v }))
  const [showGrid, setShowGrid] = useState(false)
  const [showCross, setShowCross] = useState(false)
  const [seedBase, setSeedBase] = useState(DEFAULT_SEED)
  const [res, setRes] = useState(LOGICAL)
  const [genTab, setGenTab] = useState('style')

  const proto = PROTOTYPES.find((p) => p.id === presetId) || PROTOTYPES[0]
  const idx = PROTOTYPES.indexOf(proto)

  // Honor the global autoplay setting at mount.
  useEffect(() => { if (defaultAutoplay()) CLOCK.resume(); else CLOCK.pause(); setPaused(CLOCK.isPaused()) }, [])

  // Category change → load that category's first preset (didMount-guarded so the
  // initial mount keeps the route's preset, not a reset).
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    setPresetId(presetsForCat(cat)[0]?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat])

  // Each preset gets a distributed substrate (SUBSTRATE_POOL) instead of all 'A'.
  // skipped once after a settings-load so a saved shape is honored.
  const skipDistribute = useRef(false)
  useEffect(() => {
    if (skipDistribute.current) { skipDistribute.current = false; return }
    const sub = SUBSTRATE_POOL[Math.max(0, idx) % SUBSTRATE_POOL.length]
    setShape(sub.shape)
    if (sub.shape === 'glyph') setLetter(sub.letter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId])

  const canvasRef = useRef(null) // offscreen 2D — the specimen render target (texture source)
  const glRef = useRef(null)     // visible WebGL canvas — the orbit view
  const orbitRef = useRef(null)
  const camRef = useRef(cam)
  camRef.current = cam

  // Orbit view: textures the offscreen specimen canvas onto a plane and renders it
  // every frame from the orbit camera (drag = orbit, wheel = zoom). Owns the rAF
  // that drives the camera; the prototype's own loop keeps drawing into canvasRef.
  useEffect(() => {
    const ov = new OrbitView(glRef.current)
    orbitRef.current = ov
    const fit = () => ov.resize(glRef.current.clientWidth, glRef.current.clientHeight)
    const ro = new ResizeObserver(fit)
    ro.observe(glRef.current)
    fit()
    let raf = 0
    const loop = () => {
      ov.setSource(canvasRef.current)
      ov.setParams(camRef.current)
      ov.frame(CLOCK.nowSeconds())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); ov.dispose() }
  }, [])

  // Debounced glyph/shape/weight/font/resolution rebake (220ms), skipped on first render.
  const booted = useRef(false)
  useEffect(() => {
    if (!booted.current) { booted.current = true; return }
    const id = setTimeout(() => {
      const maskP = shape === 'glyph'
        ? rasterizeGlyph(letter || 'A', font, weight, res * 0.9, res, res)
        : Promise.resolve(rasterizeShape(shape, res, res))
      void maskP.then((m) => {
        const next = computeSDF(m, res, res)
        if (sdfData.length === next.length) { sdfData.set(next) }
        else { sdfData = next; sdf = makeSDF(sdfData, res, res) }
        setSdfVersion((v) => v + 1)
      })
    }, 220)
    return () => clearTimeout(id)
  }, [shape, letter, weight, font, res])

  // Prototype lifecycle: init on preset/rebake/reset/re-seed/colour change.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cleanup = initProto(idx, canvas, ctx, res, res, 'init', seedBase)
    return () => { if (cleanup) cleanup() }
  }, [idx, sdfVersion, resetNonce, seedBase, themeId, invert, ov, opacity, res])

  const reset = () => { CLOCK.reset(); CLOCK.resume(); setPaused(false); setResetNonce((n) => n + 1) }
  const retrigger = () => { CLOCK.reset(); CLOCK.resume(); setPaused(false); setSeedBase(randomSeed()) }
  usePublishReset(reset)
  usePublishRetrigger(retrigger)
  const setClockSpeed = (v) => { CLOCK.setSpeed(v); setSpeed(v) }
  const camReset = () => { orbitRef.current?.reset(); setCam(ORBIT_DEFAULTS) }

  const stepPreset = (d) => {
    const cur = Math.max(0, presets.findIndex((p) => p.id === presetId))
    setPresetId(presets[(cur + d + presets.length) % presets.length].id)
  }
  const pickCat = (id) => navigate(catRoute(id))

  // ── Generate — randomize buttons (mirrors the generator pages) ────────────────
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const rndSeed = () => setSeedBase(randomSeed())
  const rndSpecimen = () => { if (presets.length) setPresetId(pick(presets).id) }
  const rndShape = () => setShape(pick(SHAPE_SOURCES).id)
  const rndColor = () => { setThemeId(pick(THEME_OPTIONS).value); setInvert(Math.random() < 0.3); setOv({}) }
  const rndGlyph = () => {
    setLetter(String.fromCharCode(65 + Math.floor(Math.random() * 26)))
    setWeight(String(pick(WEIGHTS)))
    setFont(pick(FONTS).id)
  }
  const rndParams = () => {
    const ps = proto.params
    if (ps?.length) {
      const vals = getParams(proto.id, defaultValues(ps))
      for (const p of ps) {
        if (p.type === 'range') vals[p.key] = p.min + Math.random() * (p.max - p.min)
        else if (p.type === 'int') vals[p.key] = Math.round(p.min + Math.random() * (p.max - p.min))
        else if (p.type === 'boolean') vals[p.key] = Math.random() < 0.5
        else if (p.type === 'select') vals[p.key] = pick(p.options)
      }
    }
    setResetNonce((n) => n + 1)
  }
  const randomizeAll = () => {
    setClockSpeed(1)
    rndShape(); rndColor(); if (shape === 'glyph') rndGlyph(); rndParams(); rndSeed()
  }

  // Settings IO.
  const getSettings = () => ({
    presetId, themeId, invert, ov, opacity, shape, letter, weight, font,
    frameRatio, showGrid, showCross, cam, seedBase, speed, res, paramStore,
  })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.presetId != null && s.presetId !== presetId) skipDistribute.current = true
    if (s.presetId) setPresetId(s.presetId)
    if (s.themeId != null) setThemeId(s.themeId)
    if (typeof s.invert === 'boolean') setInvert(s.invert)
    if (s.ov && typeof s.ov === 'object') setOv(s.ov)
    if (s.opacity && typeof s.opacity === 'object') setOpacityState({ fg: 1, accent: 1, dim: 1, warm: 1, ...s.opacity })
    if (s.shape != null) setShape(s.shape)
    if (s.letter != null) setLetter(s.letter)
    if (s.weight != null) setWeight(String(s.weight))
    if (s.font != null) setFont(s.font)
    if (s.frameRatio != null) setFrameRatio(s.frameRatio)
    if (typeof s.showGrid === 'boolean') setShowGrid(s.showGrid)
    if (typeof s.showCross === 'boolean') setShowCross(s.showCross)
    if (s.cam && typeof s.cam === 'object') setCam({ ...ORBIT_DEFAULTS, ...s.cam })
    if (Number.isFinite(s.res)) setRes(s.res)
    if (s.speed != null) setClockSpeed(s.speed)
    if (s.paramStore && typeof s.paramStore === 'object') {
      for (const id in s.paramStore) paramStore[id] = { ...paramStore[id], ...s.paramStore[id] }
    }
    if (s.seedBase != null) setSeedBase(s.seedBase)
    else setResetNonce((n) => n + 1)
  }
  const downloadPng = () => {
    const gl = glRef.current
    // Composite the orbit view onto the theme bg (its surround is transparent).
    const out = document.createElement('canvas')
    out.width = gl.width; out.height = gl.height
    const octx = out.getContext('2d')
    octx.fillStyle = ov.bg ?? resolveTheme(themeId, invert).bg
    octx.fillRect(0, 0, out.width, out.height)
    octx.drawImage(gl, 0, 0)
    const link = document.createElement('a')
    link.href = out.toDataURL('image/png')
    link.download = `penrose-${proto.id}.png`
    link.click()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft') stepPreset(-1)
      else if (e.key === 'ArrowRight') stepPreset(1)
      else if (e.key === 'c' || e.key === 'C') camReset()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, presets])

  usePublishInfo('Penrose', [
    ['Specimen', proto.name],
    ['Ref', proto.repo],
    ['About', proto.summary],
    ['Use', proto.helps],
    ['Seed', String(seedBase)],
  ])

  const fr = frameFor(frameRatio)
  const aspect = fr.w / fr.h
  const wrapStyle = aspect >= 1
    ? { aspectRatio: `${fr.w} / ${fr.h}`, width: `min(86vw, ${Math.round(res * aspect)}px)` }
    : { aspectRatio: `${fr.w} / ${fr.h}`, height: `min(86vh, ${Math.round(res / aspect)}px)` }
  const t = resolveTheme(themeId, invert)
  const eff = {
    bg: ov.bg ?? t.bg, fg: ov.fg ?? t.fg, accent: ov.accent ?? t.accent,
    grid: ov.grid ?? t.grid, dim: ov.dim ?? t.dim ?? t.accent, warm: ov.warm ?? t.warm ?? t.accent,
  }
  const gridRGBA = hexToRGBA(eff.grid, 0.07)
  const vars = { bg: eff.bg, fg: eff.fg, accent: eff.accent, grid: gridRGBA, dim: eff.dim, warm: eff.warm }
  setPalette(vars)
  setOpacity(opacity)
  const themeVars = { '--bg': vars.bg, '--fg': vars.fg, '--dim': vars.dim, '--accent': vars.accent, '--warm': vars.warm, '--grid': vars.grid }

  return (
    <div className="flex min-h-dvh">
      <div className="penrose-page flex-1 min-w-0 bg-surface-secondary" style={themeVars}>
        <div id="app">
          <div className="single-row my-auto">
            <div className="canvas-wrap" data-vcap="stage" style={wrapStyle}>
              {/* Offscreen 2D specimen render target → textured onto the orbit plane. */}
              <canvas ref={canvasRef} width={res * dpr} height={res * dpr} style={{ display: 'none' }} />
              <canvas ref={glRef} className="block w-full h-full cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} />
              {showGrid && <div className="frame-grid" aria-hidden="true" />}
              {showCross && <div className="frame-cross" aria-hidden="true" />}
            </div>
          </div>
        </div>
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Penrose</RailHeader>
            <SegmentedToggle value={genTab} onChange={setGenTab}
              options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'parameters', label: 'Parameters' }]} />
          </>
        }
        footer={
          <EditorFooter
            tab={bottomTab}
            onTab={setBottomTab}
            transport={{
              playing: !paused,
              onPlay: () => { CLOCK.resume(); setPaused(false) },
              onPause: () => { CLOCK.pause(); setPaused(true) },
              onStop: () => { CLOCK.reset(); CLOCK.pause(); setPaused(true); reset() },
              onRewind: () => { CLOCK.reset(); reset() },
              tempo: Math.round(speed * 120),
              onTempo: (v) => setClockSpeed(v / 120),
              tempoMax: 300,
            }}
            exportProps={{ aspect: frameRatio, onAspect: setFrameRatio, aspects: FRAMES.map((f) => ({ value: f.id, label: f.label })), hideScale: true }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={downloadPng}>Export PNG</Button>}
            settingsPage="penrose"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={cat} onChange={pickCat} />
          <Dropdown size="sm" variant="subtle" className="w-full" options={presets.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={setPresetId} />
        </Section>

        {genTab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={randomizeAll}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={rndSeed}>Generation</Button>
              <Button variant="primary" size="sm" onClick={rndSpecimen}>Specimen</Button>
              <Button variant="primary" size="sm" onClick={rndShape}>Shape</Button>
              <Button variant="primary" size="sm" onClick={rndColor}>Colour</Button>
              <Button variant="primary" size="sm" onClick={rndGlyph} disabled={shape !== 'glyph'}>Glyph</Button>
              <Button variant="primary" size="sm" onClick={rndParams}>Parameters</Button>
            </div>
            <Button variant="primary" size="sm" className="w-full" onClick={reset}>Generation reset</Button>
          </Section>
        )}

        {genTab === 'style' && (
          <>
            <Section label="Shape">
              <LabeledControl inline label="Source">
                <Dropdown size="sm" variant="subtle" className="w-full" options={SHAPE_SOURCES.map((s) => ({ value: s.id, label: s.label }))} value={shape} onChange={setShape} />
              </LabeledControl>
              {shape === 'glyph' && (
                <>
                  <LabeledControl inline label="Letter">
                    <Input size="sm" width="100%" maxLength={8} value={letter} placeholder="A" onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setLetter(e.target.value.slice(0, 8))} />
                  </LabeledControl>
                  <LabeledControl inline label="Weight">
                    <Dropdown size="sm" variant="subtle" className="w-full" options={WEIGHTS.map((w) => ({ value: String(w), label: String(w) }))} value={weight} onChange={setWeight} />
                  </LabeledControl>
                  <LabeledControl inline label="Font">
                    <Dropdown size="sm" variant="subtle" className="w-full" options={FONTS.map((f) => ({ value: f.id, label: f.label }))} value={font} onChange={setFont} />
                  </LabeledControl>
                </>
              )}
              <Slider labeled label="Resolution" min={480} max={1920} step={80} value={res} onChange={(v) => setRes(roundIfNum(v))} className="w-full" noExpr />
            </Section>

            <Section label="Display">
              <ToggleSwitch labeled variant="plain" label="Grid overlay" checked={showGrid} onChange={setShowGrid} />
              <ToggleSwitch labeled variant="plain" label="Crosshair" checked={showCross} onChange={setShowCross} />
            </Section>

            <Section label="Camera">
              <Slider labeled label="Distance" min={1.5} max={8} step={0.1} value={cam.dist} onChange={(v) => updateCam('dist', v)} variant="default" noExpr />
              <Slider labeled label="Field of view" min={20} max={90} step={1} value={cam.fov} onChange={(v) => updateCam('fov', roundIfNum(v))} variant="default" noExpr />
              <Slider labeled label="Yaw" min={-3.14} max={3.14} step={0.02} value={cam.yaw} onChange={(v) => updateCam('yaw', v)} variant="default" noExpr />
              <Slider labeled label="Pitch" min={-1.4} max={1.4} step={0.02} value={cam.pitch} onChange={(v) => updateCam('pitch', v)} variant="default" noExpr />
              <ToggleSwitch labeled variant="plain" label="Camera motion" checked={cam.cameraMotion} onChange={(v) => updateCam('cameraMotion', v)} />
              {cam.cameraMotion && (
                <>
                  <LabeledControl inline label="Preset">
                    <Dropdown size="sm" variant="subtle" className="w-full" options={MOTION_PRESETS} value={cam.motionPreset} onChange={(v) => updateCam('motionPreset', v)} />
                  </LabeledControl>
                  <Slider labeled label="Motion speed" min={0.02} max={1.5} step={0.02} value={cam.motionSpeed} onChange={(v) => updateCam('motionSpeed', v)} variant="default" noExpr />
                </>
              )}
            </Section>

            <Section label="Opacity">
              <Slider labeled label="Foreground" min={0} max={5} step={0.1} value={opacity.fg} onChange={(v) => setOpacityKey('fg', v)} className="w-full" noExpr />
              <Slider labeled label="Accent" min={0} max={5} step={0.1} value={opacity.accent} onChange={(v) => setOpacityKey('accent', v)} className="w-full" noExpr />
              <Slider labeled label="Dim" min={0} max={5} step={0.1} value={opacity.dim} onChange={(v) => setOpacityKey('dim', v)} className="w-full" noExpr />
              <Slider labeled label="Warm" min={0} max={5} step={0.1} value={opacity.warm} onChange={(v) => setOpacityKey('warm', v)} className="w-full" noExpr />
            </Section>

            <Section label="Color">
              <LabeledControl inline label="Theme">
                <Dropdown size="sm" variant="subtle" className="w-full" options={THEME_OPTIONS} value={themeId} onChange={setThemeId} />
              </LabeledControl>
              <ToggleSwitch labeled variant="plain" label="Invert" checked={invert} onChange={setInvert} />
              <ColorField label="Background" value={eff.bg} onChange={(v) => setOvKey('bg', v)} />
              <ColorField label="Foreground" value={eff.fg} onChange={(v) => setOvKey('fg', v)} />
              <ColorField label="Accent" value={eff.accent} onChange={(v) => setOvKey('accent', v)} />
              <ColorField label="Dim" value={eff.dim} onChange={(v) => setOvKey('dim', v)} />
              <ColorField label="Warm" value={eff.warm} onChange={(v) => setOvKey('warm', v)} />
              {(showGrid || showCross) && <ColorField label="Grid" value={eff.grid} onChange={(v) => setOvKey('grid', v)} />}
              {Object.keys(ov).length > 0 && <Button variant="primary" size="sm" className="w-full" onClick={() => setOv({})}>Reset colors</Button>}
            </Section>
          </>
        )}

        {genTab === 'parameters' && (
          <Section label="Parameters">
            <KnobsPanel key={proto.id} proto={proto} onTweak={() => setResetNonce((n) => n + 1)} />
          </Section>
        )}
      </EditorRail>
    </div>
  )
}

// Route-mount wrapper: the SDF must be baked before App renders.
export default function PenrosePage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void rasterizeGlyph('A', FONTS[0].id, '700', LOGICAL * 0.9, MASK_RES, MASK_RES).then((mask0) => {
      if (!alive) return
      sdfData = computeSDF(mask0, MASK_RES, MASK_RES)
      sdf = makeSDF(sdfData, MASK_RES, MASK_RES)
      setReady(true)
    })
    return () => { alive = false }
  }, [])
  if (!ready) return null
  return <App />
}
