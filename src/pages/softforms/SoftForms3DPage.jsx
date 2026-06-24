import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { SoftForms3DEngine, GRAD_PALETTES, BACKDROPS } from './engine3d.js'
import { SCENE_3D_BY_ID, CATEGORIES_3D, catRoute, presetsForCat, CTRL_SPEC_3D, BASE_PARAMS_3D, NUMERIC_KEYS_3D } from './registry3d.js'
import { LOOK_PRESETS } from './registry.js'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import { resolveDeep } from '../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'

// Frame = whole composition moves (auto-orbits the camera) · Form = each form
// animates in place (the metaball merge / wobble). Module-level [{id,label,params}].
const FRAME_PRESETS = [
  { id: 'static', label: 'Static', params: { frameMode: 'static' } },
  { id: 'orbit',  label: 'Orbit',  params: { frameMode: 'orbit',  frameSpeed: 0.3 } },
  { id: 'sway',   label: 'Sway',   params: { frameMode: 'sway',   frameSpeed: 0.4 } },
  { id: 'tumble', label: 'Tumble', params: { frameMode: 'tumble', frameSpeed: 0.3 } },
]
const FORM_PRESETS = [
  { id: 'static', label: 'Static', params: { motion: 0 } },
  { id: 'drift',  label: 'Drift',  params: { motion: 0.35 } },
  { id: 'churn',  label: 'Churn',  params: { motion: 0.9 } },
  { id: 'pulse',  label: 'Pulse',  params: { motion: 0.6 } },
]
// Show 'Custom' in the list only while that axis is custom (never a second 'off').
const motionOpts = (presets, val) => {
  const opts = presets.map((p) => ({ value: p.id, label: p.label }))
  return val === 'custom' ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
}

function SoftForms3DEditor({ category }) {
  const navigate = useNavigate()
  const presets = presetsForCat(category)
  const [presetId, setPresetId] = useState(presets[0].id)
  const scene = SCENE_3D_BY_ID[presetId] || presets[0]
  const [genTab, setGenTab] = useState('style')
  const [animTab, setAnimTab] = useState('frame')
  const [framePreset, setFramePreset] = useState('static')
  const [formPreset, setFormPreset] = useState('custom')
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const dragRef   = useRef(null)
  const camRef    = useRef({ theta: 0.3, phi: 0.15, dist: 3.0 })

  const [P, setP]       = useState(() => ({ ...BASE_PARAMS_3D, ...scene.defaults }))
  const up = (k) => (v) => setP((s) => ({ ...s, [k]: v }))
  const [look, setLook] = useState('')
  const [forms, setForms] = useState(() => scene.forms.map((f) => ({ ...f })))

  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo]     = useState(120)
  const [aspect, setAspect]   = useState(() => defaultAspectFor('view'))
  const [scale, setScale]     = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const ar      = ratioFor(aspect) || 1
  const timeRef = useRef(0)
  const cfg     = useRef({})
  cfg.current   = { ...P, speed: tempo / 120, playing }

  useEffect(() => {
    const engine = new SoftForms3DEngine()
    engineRef.current = engine
    engine.init(canvasRef.current)
    engine.setParams({ ...BASE_PARAMS_3D, ...scene.defaults, forms: scene.forms })
    engine.setCamera(camRef.current)
    let alive = true, raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      const c = cfg.current
      if (c.playing) timeRef.current += dt * c.speed
      const num = { speed: c.speed }
      for (const k of NUMERIC_KEYS_3D) num[k] = c[k]
      num.grain = 0 // grain is a post-FX, not part of the form shading
      engine.setParams(resolveDeep(num, timeRef.current))
      // Frame motion = the whole composition orbits/sways/tumbles over time (drives
      // the camera; manual drag resumes when Frame is Static).
      if (c.playing && c.frameMode && c.frameMode !== 'static') {
        const sp = c.frameSpeed ?? 0.3
        const w = timeRef.current * sp
        const cam = camRef.current
        if (c.frameMode === 'orbit') { cam.theta = 0.4 + timeRef.current * sp; cam.phi = 0.15 }
        else if (c.frameMode === 'sway') { cam.theta = 0.4 + Math.sin(w * Math.PI * 2) * 0.7; cam.phi = 0.15 }
        else if (c.frameMode === 'tumble') { cam.theta = 0.4 + timeRef.current * sp; cam.phi = Math.max(-1.2, Math.min(1.2, 0.15 + Math.sin(w * 0.6 * Math.PI * 2) * 0.6)) }
      }
      engine.setCamera(camRef.current)
      engine.frame(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engine.destroy(); engineRef.current = null }
  }, [])

  useEffect(() => {
    const res = 1600
    const w = ar >= 1 ? res : Math.round(res * ar)
    const h = ar >= 1 ? Math.round(res / ar) : res
    engineRef.current?.resize(w, h)
  }, [ar])

  useEffect(() => {
    engineRef.current?.setParams({
      palette: P.palette, spectral: P.spectral, backdrop: P.backdrop,
      rimShift: P.rimShift, metaball: scene.defaults.metaball,
    })
  }, [P.palette, P.spectral, P.backdrop, P.rimShift])

  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])
  useEffect(() => { engineRef.current?.setParams({ forms }) }, [forms])

  const applyLook = (id) => {
    const f = LOOK_PRESETS.find((x) => x.id === id)
    if (!f) return
    setLook(id)
    setP((s) => ({ ...s, ...f.p }))
  }

  // ── Preset / category ────────────────────────────────────────────────────
  const loadPreset = (id) => {
    const s = SCENE_3D_BY_ID[id]
    if (!s) return
    setPresetId(id)
    setP({ ...BASE_PARAMS_3D, ...s.defaults })
    setForms(s.forms.map((f) => ({ ...f })))
    setLook('')
    engineRef.current?.setParams({ ...BASE_PARAMS_3D, ...s.defaults, metaball: s.defaults.metaball })
  }
  const pickCat = (id) => navigate(catRoute(id))

  // ── Generate — randomize ──────────────────────────────────────────────────
  const TAU = Math.PI * 2
  const rand = (a, b) => a + Math.random() * (b - a)
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const rndIn = (sp) => { const v = sp.min + Math.random() * (sp.max - sp.min); return sp.step >= 1 ? Math.round(v) : Math.round(v / sp.step) * sp.step }
  // Random point in a ball of radius R (uniform).
  const inBall = (R) => { const r = R * Math.cbrt(Math.random()); const th = Math.random() * TAU; const ph = Math.acos(2 * Math.random() - 1); return [r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph) * 0.8] }
  const recenter = (arr) => { const n = arr.length || 1; const c = arr.reduce((a, f) => ({ x: a.x + f.x / n, y: a.y + f.y / n, z: a.z + f.z / n }), { x: 0, y: 0, z: 0 }); return arr.map((f) => ({ ...f, x: f.x - c.x, y: f.y - c.y, z: f.z - c.z })) }

  const rollColor = () => setP((s) => ({ ...s, palette: pick(GRAD_PALETTES).value, spectral: Math.random() < 0.5, hue: Math.random(), irid: rndIn(CTRL_SPEC_3D.irid) }))
  const rollLight = () => setP((s) => ({ ...s, sheen: rndIn(CTRL_SPEC_3D.sheen), gloss: rndIn(CTRL_SPEC_3D.gloss), rim: rndIn(CTRL_SPEC_3D.rim), sss: rndIn(CTRL_SPEC_3D.sss) }))
  const rollMotionP = () => setP((s) => ({ ...s, motion: rndIn(CTRL_SPEC_3D.motion), sweep: rndIn(CTRL_SPEC_3D.sweep) }))
  // Transform = a fresh arrangement. Tight cluster for metaballs (so they sit at
  // necking distance and merge), looser for discrete forms. Metaballs vary BALL
  // COUNT 2–5 (uCount is dynamic, MAX_FORMS=5); discrete forms keep their shapes.
  const rollTransform = () => setForms((fs) => {
    if (scene.defaults.metaball) {
      const N = 2 + Math.floor(Math.random() * 4) // 2..5 balls
      const R = rand(0.45, 0.9)
      return recenter(Array.from({ length: N }, (_, i) => {
        const [x, y, z] = inBall(R); const s = rand(0.5, 0.92)
        return { t: 'sphere', x, y, z, sx: s, sy: s, sz: s, rot: 0, hue: i / N }
      }))
    }
    const R = rand(0.6, 1.15)
    return recenter(fs.map((f) => { const [x, y, z] = inBall(R); return { ...f, x, y, z, rot: rand(0, 360) } }))
  })
  // Scale = vary each form's size, preserving its shape aspect.
  const rollScale = () => setForms((fs) => fs.map((f) => { const k = rand(0.6, 1.4); return { ...f, sx: clamp(f.sx * k, 0.3, 1.2), sy: clamp(f.sy * k, 0.3, 1.2), sz: clamp((f.sz ?? f.sx) * k, 0.3, 1.2) } }))
  const rollAll = () => { rollColor(); rollLight(); rollMotionP(); rollTransform(); rollScale() }

  // ── Animation — Frame / Form presets ──────────────────────────────────────
  const applyFramePreset = (id) => { setFramePreset(id); const p = FRAME_PRESETS.find((x) => x.id === id); if (p) setP((s) => ({ ...s, ...p.params })) }
  const applyFormPreset = (id) => { setFormPreset(id); const p = FORM_PRESETS.find((x) => x.id === id); if (p) setP((s) => ({ ...s, ...p.params })) }
  const onFrameEdit = (k, v) => { setP((s) => ({ ...s, [k]: v })); setFramePreset('custom') }
  const onFormEdit = (k, v) => { setP((s) => ({ ...s, [k]: v })); setFormPreset('custom') }

  // Orbit camera — drag rotates, wheel zooms
  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, theta: camRef.current.theta, phi: camRef.current.phi }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.x) / 280 * Math.PI
    const dy = (e.clientY - d.y) / 280 * Math.PI
    camRef.current = {
      ...camRef.current,
      theta: d.theta - dx,
      phi: Math.max(-1.2, Math.min(1.2, d.phi - dy)),
    }
  }
  const onPointerUp = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId) }
  const onWheel = (e) => {
    e.preventDefault()
    camRef.current = { ...camRef.current, dist: Math.max(1.0, Math.min(8.0, camRef.current.dist + e.deltaY * 0.005)) }
  }

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: 1600, h: 1600 }
    const blob = await engineRef.current?.exportBlob(dd.w, dd.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kol-softforms-3d-${scene.id}-${Date.now()}.png`; a.click()
    URL.revokeObjectURL(url)
  }

  const getSettings  = () => ({ presetId, ...P, look, aspect, scale })
  const applySettings = (s) => {
    if (s.presetId && SCENE_3D_BY_ID[s.presetId]) setPresetId(s.presetId)
    setP((cur) => { const n = { ...cur }; for (const k of Object.keys(BASE_PARAMS_3D)) if (s[k] != null) n[k] = s[k]; return n })
    if (s.look   != null) setLook(s.look)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale  != null) setScale(s.scale)
  }

  const slider = (k) => (
    <Slider key={k} labeled label={CTRL_SPEC_3D[k].label} min={CTRL_SPEC_3D[k].min} max={CTRL_SPEC_3D[k].max} step={CTRL_SPEC_3D[k].step} value={P[k]} onChange={up(k)} variant="default" />
  )

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas
          data-vcap="stage"
          ref={canvasRef}
          className="block max-h-[88vh] w-auto rounded cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        />
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Soft Forms 3D</RailHeader>
            <SegmentedToggle value={genTab} onChange={setGenTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'animation', label: 'Animation' }]} />
          </>
        }
        footer={
          <EditorFooter
            tab={footTab} onTab={setFootTab}
            transport={{
              playing, onPlay: () => setPlaying(true), onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); engineRef.current?.resetTime() },
              onRewind: () => engineRef.current?.resetTime(),
              tempo, onTempo: setTempo, tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={`softforms3d-${category}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={CATEGORIES_3D.map((c) => ({ value: c.id, label: c.label }))} value={category} onChange={pickCat} />
          <Dropdown size="sm" variant="subtle" className="w-full" options={presets.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={loadPreset} />
        </Section>

        {genTab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={rollAll}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={rollColor}>Color</Button>
              <Button variant="primary" size="sm" onClick={rollLight}>Lighting</Button>
              <Button variant="primary" size="sm" onClick={rollTransform}>Transform</Button>
              <Button variant="primary" size="sm" onClick={rollScale}>Scale</Button>
              <Button variant="primary" size="sm" onClick={rollMotionP}>Motion</Button>
              <Button variant="primary" size="sm" onClick={() => loadPreset(pick(presets).id)}>Preset</Button>
            </div>
          </Section>
        )}

        {genTab === 'style' && (<>
        <Section label="Look">
          <Dropdown size="sm" options={LOOK_PRESETS.map((x) => ({ value: x.id, label: x.label }))} value={look} onChange={applyLook} variant="subtle" className="w-full" />
        </Section>
        <Section label="Iridescence">
          <Dropdown size="sm" options={GRAD_PALETTES.map((x) => ({ value: x.value, label: x.label }))} value={P.palette} onChange={up('palette')} variant="subtle" className="w-full" />
          <ToggleSwitch variant="plain" label="Spectral" checked={P.spectral} onChange={up('spectral')} />
          {slider('irid')}{slider('sweep')}{slider('hue')}
        </Section>
        <Section label="Lighting">
          {slider('sheen')}{slider('gloss')}{slider('rim')}{slider('rimPow')}{slider('sss')}
        </Section>
        <Section label="Surface">
          <Dropdown size="sm" options={BACKDROPS.map((x) => ({ value: x.value, label: x.label }))} value={P.backdrop} onChange={up('backdrop')} variant="subtle" className="w-full" />
        </Section>
        </>)}

        {genTab === 'animation' && (<>
        <Section label="Motion">
          <LabeledControl inline label="Frame">
            <Dropdown size="sm" variant="subtle" className="w-full" options={motionOpts(FRAME_PRESETS, framePreset)} value={framePreset} onChange={applyFramePreset} />
          </LabeledControl>
          <LabeledControl inline label="Form">
            <Dropdown size="sm" variant="subtle" className="w-full" options={motionOpts(FORM_PRESETS, formPreset)} value={formPreset} onChange={applyFormPreset} />
          </LabeledControl>
        </Section>
        {/* Frame = the whole composition orbits the camera · Form = each form animates in place. */}
        <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
        {animTab === 'frame' && (
          <Section label="Frame">
            <Slider labeled label="Speed" min={0.05} max={1.5} step={0.05} value={P.frameSpeed ?? 0.3} onChange={(v) => onFrameEdit('frameSpeed', v)} variant="default" noExpr />
          </Section>
        )}
        {animTab === 'form' && (
          <Section label="Form">
            <Slider labeled label="Motion" min={CTRL_SPEC_3D.motion.min} max={CTRL_SPEC_3D.motion.max} step={CTRL_SPEC_3D.motion.step} value={P.motion} onChange={(v) => onFormEdit('motion', v)} variant="default" />
          </Section>
        )}
        </>)}
      </EditorRail>
    </div>
  )
}

// Soft Forms 3D — Page › Category › Preset (Forms · Metaballs); first category owns
// /softforms-3d, the rest are /softforms-3d/<cat>; scenes switch in the rail.
export default function SoftForms3DPage() {
  return (
    <Routes>
      {CATEGORIES_3D.map((c) => (
        <Route key={c.id} path={c.id === CATEGORIES_3D[0].id ? '/' : c.id} element={<SoftForms3DEditor key={c.id} category={c.id} />} />
      ))}
    </Routes>
  )
}
