import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { SoftFormsEngine, GRAD_PALETTES, BACKDROPS } from './engine.js'
import { SCENE_BY_ID, SOFTFORM_CATEGORIES, catRoute, presetsForCat, LOOK_PRESETS, CTRL_SPEC, BASE_PARAMS, NUMERIC_KEYS } from './registry.js'
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
import Icon from '../../components/loaders/Icon.jsx'

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const PAL_VALUES = GRAD_PALETTES.map((p) => p.value)

const FORM_TYPE_OPTS = [
  { value: 'teardrop', label: 'Teardrop' },
  { value: 'pill', label: 'Pill' },
  { value: 'dome', label: 'Dome' },
  { value: 'orb', label: 'Orb' },
  { value: 'super', label: 'Lozenge' },
]
const MAX_FORMS = 5

// JS port of the shader SDF — same maths as engine.js `formDist`, for hit-testing.
function formDist(t, qx, qy) {
  if (t === 'teardrop') {
    const taper = lerp(1, 0.36, clamp(qy * 0.5 + 0.5, 0, 1))
    return Math.hypot(qx / taper, qy) - 1
  }
  if (t === 'pill') {
    const dx = Math.max(Math.abs(qx) - 0.58, 0)
    return Math.hypot(dx, qy) - 0.5
  }
  if (t === 'super') {
    return (Math.abs(qx) ** 3.4 + Math.abs(qy) ** 3.4) ** (1 / 3.4) - 1
  }
  return Math.hypot(qx, qy) - 1 // dome / orb
}

// World clip point → form-local q (centred, unrotated, /scale). Mirrors the shader.
function localQ(f, px, py) {
  const dx = px - f.x, dy = py - f.y
  const a = -((f.rot || 0) * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return [(c * dx - s * dy) / f.sx, (s * dx + c * dy) / (f.sy ?? f.sx)]
}

// Topmost form (last painted) under a clip point, or -1.
function hitForm(forms, px, py) {
  for (let i = forms.length - 1; i >= 0; i--) {
    const [qx, qy] = localQ(forms[i], px, py)
    if (formDist(forms[i].t, qx, qy) < 0.06) return i
  }
  return -1
}

// Selection-frame geometry for a form, in screen pixels.
function handlesOf(f, dw, dh, ar) {
  const clipToPx = (fx, fy) => ({ x: (fx / ar * 0.5 + 0.5) * dw, y: (0.5 - fy * 0.5) * dh })
  const a = ((f.rot || 0) * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  const sy = f.sy ?? f.sx
  const world = (lx, ly) => clipToPx(f.x + c * lx - s * ly, f.y + s * lx + c * ly)
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([ux, uy]) => world(ux * f.sx, uy * sy))
  return { corners, center: clipToPx(f.x, f.y), rotate: world(0, sy + 0.22) }
}

// ── Randomisers — one per facet, so the Random tab can roll them independently ──
const rollColorP = (s) => ({ ...s, palette: pick(PAL_VALUES), spectral: Math.random() < 0.5, hue: Math.random(), irid: rand(0.6, 1.8), rimShift: rand(0, 0.3) })
const rollColorForms = (fs) => fs.map((f) => ({ ...f, hue: Math.random() }))
const rollTransformForms = (fs) => fs.map((f) => ({ ...f, x: rand(-0.55, 0.55), y: rand(-0.75, 0.75), rot: rand(0, 360) }))
const rollScaleForms = (fs) => fs.map((f) => ({ ...f, sx: rand(0.35, 0.95), sy: rand(0.35, 0.95) }))
const rollAnimP = (s) => ({ ...s, motion: rand(0, 1.1), sweep: rand(0, 360) })

function SoftFormsEditor({ category }) {
  const navigate = useNavigate()
  const presets = presetsForCat(category)
  const [presetId, setPresetId] = useState(presets[0].id)
  const scene = SCENE_BY_ID[presetId] || presets[0]
  const [genTab, setGenTab] = useState('style')
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const dragRef = useRef(null)

  const [P, setP] = useState(() => ({ ...BASE_PARAMS, ...scene.defaults }))
  const up = (k) => (v) => setP((s) => ({ ...s, [k]: v }))
  const [look, setLook] = useState('')
  const [forms, setForms] = useState(() => scene.forms.map((f) => ({ ...f })))
  const [sel, setSel] = useState(-1)
  const [view, setView] = useState({ dw: 1, dh: 1 })

  const [res, setRes] = useState(1600)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const ar = ratioFor(aspect) || 1
  const timeRef = useRef(0)
  const cfg = useRef({})
  cfg.current = { ...P, speed: tempo / 120, playing }

  // One engine + render loop for the page's life (remounts per sub-page via key).
  useEffect(() => {
    const engine = new SoftFormsEngine()
    engineRef.current = engine
    engine.init(canvasRef.current)
    engine.setParams({ ...BASE_PARAMS, ...scene.defaults, forms: scene.forms })
    let alive = true
    let raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      const c = cfg.current
      if (c.playing) timeRef.current += dt * c.speed
      const num = { speed: c.speed }
      for (const k of NUMERIC_KEYS) num[k] = c[k]
      num.grain = 0 // grain is a post-FX, not part of the form shading
      engine.setParams(resolveDeep(num, timeRef.current))
      engine.frame(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engine.destroy(); engineRef.current = null }
  }, [])

  // Size the artboard to the chosen aspect × resolution.
  useEffect(() => {
    const w = ar >= 1 ? res : Math.round(res * ar)
    const h = ar >= 1 ? Math.round(res / ar) : res
    engineRef.current?.resize(w, h)
  }, [ar, res])

  // Track the displayed canvas rect so the SVG overlay maps clip↔pixels.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const measure = () => { const r = el.getBoundingClientRect(); setView({ dw: r.width, dh: r.height }) }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // Non-numeric params → set on change (the loop handles the animated ones).
  useEffect(() => { engineRef.current?.setParams({ palette: P.palette, spectral: P.spectral, backdrop: P.backdrop, rimShift: P.rimShift }) }, [P.palette, P.spectral, P.backdrop, P.rimShift])
  useEffect(() => { engineRef.current?.setParams({ forms }) }, [forms])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  const applyLook = (id) => {
    const f = LOOK_PRESETS.find((x) => x.id === id)
    if (!f) return
    setLook(id)
    setP((s) => ({ ...s, ...f.p }))
  }

  // ── Preset / category ────────────────────────────────────────────────────
  const loadPreset = (id) => {
    const s = SCENE_BY_ID[id]
    if (!s) return
    setPresetId(id)
    setP({ ...BASE_PARAMS, ...s.defaults })
    setForms(s.forms.map((f) => ({ ...f })))
    setSel(-1); setLook('')
  }
  const pickCat = (id) => navigate(catRoute(id))

  // ── Layer ops ──────────────────────────────────────────────────────────
  const updForm = (key, val) => setForms((fs) => fs.map((f, i) => (i === sel ? { ...f, [key]: val } : f)))
  const addForm = () => setForms((fs) => (fs.length >= MAX_FORMS ? fs : [...fs, { t: 'dome', x: 0, y: 0, sx: 0.6, sy: 0.6, rot: 0, hue: Math.random() }]))
  const dupForm = (i) => setForms((fs) => {
    if (fs.length >= MAX_FORMS) return fs
    const c = { ...fs[i], x: clamp(fs[i].x + 0.12, -1, 1), y: clamp(fs[i].y - 0.1, -1, 1) }
    return [...fs.slice(0, i + 1), c, ...fs.slice(i + 1)]
  })
  const delForm = (i) => { setForms((fs) => fs.filter((_, k) => k !== i)); setSel(-1) }
  const swapForm = (i, j) => setForms((fs) => { if (j < 0 || j >= fs.length) return fs; const n = [...fs]; [n[i], n[j]] = [n[j], n[i]]; return n })

  // ── On-canvas grab / scale / rotate ──────────────────────────────────────
  const mouseClip = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    return { x: ((mx / r.width) - 0.5) * 2 * ar, y: (0.5 - (my / r.height)) * 2, mx, my, dw: r.width, dh: r.height }
  }
  const onPointerDown = (e) => {
    const m = mouseClip(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    // Handle hit on the selected form first (scale corners / rotate knob).
    if (sel >= 0 && forms[sel]) {
      const h = handlesOf(forms[sel], m.dw, m.dh, ar)
      const near = (p) => Math.hypot(p.x - m.mx, p.y - m.my) < 12
      if (near(h.rotate)) { dragRef.current = { mode: 'rotate', i: sel }; return }
      if (h.corners.some(near)) { dragRef.current = { mode: 'scale', i: sel, start: { ...forms[sel] } }; return }
    }
    const hit = hitForm(forms, m.x, m.y)
    setSel(hit)
    if (hit >= 0) dragRef.current = { mode: 'move', i: hit, grab: { x: m.x, y: m.y }, start: { ...forms[hit] } }
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const m = mouseClip(e)
    if (d.mode === 'move') {
      setForms((fs) => fs.map((f, i) => (i === d.i ? { ...f, x: clamp(d.start.x + (m.x - d.grab.x), -1.2, 1.2), y: clamp(d.start.y + (m.y - d.grab.y), -1.2, 1.2) } : f)))
    } else if (d.mode === 'scale') {
      const a = -((d.start.rot || 0) * Math.PI) / 180
      const c = Math.cos(a), s = Math.sin(a)
      const dx = m.x - d.start.x, dy = m.y - d.start.y
      const lx = c * dx - s * dy, ly = s * dx + c * dy // mouse in the form's local frame
      setForms((fs) => fs.map((f, i) => (i === d.i ? { ...f, sx: clamp(Math.abs(lx), 0.12, 1.6), sy: clamp(Math.abs(ly), 0.12, 1.6) } : f)))
    } else if (d.mode === 'rotate') {
      setForms((fs) => fs.map((f, i) => (i === d.i ? { ...f, rot: ((Math.atan2(m.x - f.x, m.y - f.y) * 180) / Math.PI + 360) % 360 } : f)))
    }
  }
  const onPointerUp = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId) }

  // ── Random tab ────────────────────────────────────────────────────────
  const rollColor = () => { setP(rollColorP); setForms(rollColorForms) }
  const rollTransform = () => setForms(rollTransformForms)
  const rollScale = () => setForms(rollScaleForms)
  const rollAnim = () => setP(rollAnimP)
  const rollAll = () => { rollColor(); rollTransform(); rollScale(); rollAnim() }

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: res, h: res }
    const blob = await engineRef.current?.exportBlob(dd.w, dd.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-softforms-${scene.id}-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSettings = () => ({ presetId, ...P, look, forms, res, aspect, scale })
  const applySettings = (s) => {
    if (s.presetId && SCENE_BY_ID[s.presetId]) setPresetId(s.presetId)
    setP((cur) => { const next = { ...cur }; for (const k of Object.keys(BASE_PARAMS)) if (s[k] != null) next[k] = s[k]; return next })
    if (s.look != null) setLook(s.look)
    if (s.forms != null) setForms(s.forms)
    if (s.res != null) setRes(s.res)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  const slider = (k) => (
    <Slider key={k} labeled label={CTRL_SPEC[k].label} min={CTRL_SPEC[k].min} max={CTRL_SPEC[k].max} step={CTRL_SPEC[k].step} value={P[k]} onChange={up(k)} variant="default" />
  )

  const selForm = sel >= 0 ? forms[sel] : null
  const handles = selForm ? handlesOf(selForm, view.dw, view.dh, ar) : null

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="relative inline-block leading-none">
          <canvas data-vcap="stage" ref={canvasRef} className="block max-h-[88vh] w-auto rounded" />
          {handles && (
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'grab' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {handles && (
                <g>
                  <polygon
                    points={handles.corners.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.5"
                  />
                  <line x1={(handles.corners[0].x + handles.corners[1].x) / 2} y1={(handles.corners[0].y + handles.corners[1].y) / 2} x2={handles.rotate.x} y2={handles.rotate.y} stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" />
                  <circle cx={handles.rotate.x} cy={handles.rotate.y} r="6" fill="#fff" />
                  {handles.corners.map((p, i) => (
                    <rect key={i} x={p.x - 5} y={p.y - 5} width="10" height="10" fill="#fff" stroke="#000" strokeOpacity="0.3" />
                  ))}
                </g>
              )}
            </svg>
          )}
        </div>
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Soft Forms</RailHeader>
            <SegmentedToggle value={genTab} onChange={setGenTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'layers', label: 'Layers' }]} />
          </>
        }
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
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={`softforms-${category}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={SOFTFORM_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={category} onChange={pickCat} />
          <Dropdown size="sm" variant="subtle" className="w-full" options={presets.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={loadPreset} />
        </Section>

        {genTab === 'style' && (<>
        <Section label="Look">
          <Dropdown size="sm" options={LOOK_PRESETS.map((x) => ({ value: x.id, label: x.label }))} value={look} onChange={applyLook} variant="subtle" className="w-full" />
        </Section>
        <Section label="Form">
          {slider('sweep')}{slider('bulge')}{slider('relief')}{slider('motion')}
        </Section>
        <Section label="Iridescence">
          <Dropdown size="sm" options={GRAD_PALETTES.map((x) => ({ value: x.value, label: x.label }))} value={P.palette} onChange={up('palette')} variant="subtle" className="w-full" />
          <ToggleSwitch variant="plain" label="Spectral" checked={P.spectral} onChange={up('spectral')} />
          {slider('irid')}{slider('hue')}
        </Section>
        <Section label="Lighting">
          {slider('sheen')}{slider('gloss')}{slider('rim')}{slider('rimPow')}{slider('rimShift')}{slider('sss')}
        </Section>
        <Section label="Surface">
          <Dropdown size="sm" options={BACKDROPS.map((x) => ({ value: x.value, label: x.label }))} value={P.backdrop} onChange={up('backdrop')} variant="subtle" className="w-full" />
        </Section>
        </>)}

        {genTab === 'layers' && (<>
        <Section label="Layers">
          <div className="flex flex-col gap-1">
            {[...forms].reverse().map((f, di) => {
              const i = forms.length - 1 - di
              return (
              <div key={i} className={`flex items-center gap-1 rounded px-2 py-1 ${i === sel ? 'bg-fg-08' : 'bg-fg-02 hover:bg-fg-04'}`}>
                <button type="button" className="flex-1 text-left kol-mono-12 text-emphasis" onClick={() => setSel(i)}>
                  {`${i + 1} · ${FORM_TYPE_OPTS.find((o) => o.value === f.t)?.label ?? f.t}`}
                </button>
                <button type="button" className="text-meta hover:text-emphasis" title="Up" onClick={() => swapForm(i, i + 1)}><Icon name="chevron-up" className="w-3.5 h-3.5" /></button>
                <button type="button" className="text-meta hover:text-emphasis" title="Down" onClick={() => swapForm(i, i - 1)}><Icon name="chevron-down" className="w-3.5 h-3.5" /></button>
                <button type="button" className="text-meta hover:text-emphasis" title="Duplicate" onClick={() => dupForm(i)}><Icon name="copy" className="w-3.5 h-3.5" /></button>
                <button type="button" className="text-meta hover:text-emphasis" title="Delete" onClick={() => delForm(i)}><Icon name="trash" className="w-3.5 h-3.5" /></button>
              </div>
              )
            })}
          </div>
          <Button variant="primary" size="sm" className="w-full" iconLeft="plus" disabled={forms.length >= MAX_FORMS} onClick={addForm}>Add form</Button>
        </Section>

        {selForm && (
          <Section label="Selected">
            <Dropdown size="sm" options={FORM_TYPE_OPTS} value={selForm.t} onChange={(v) => updForm('t', v)} variant="subtle" className="w-full" />
            <Slider labeled label="Position X" min={-1} max={1} step={0.01} value={selForm.x} onChange={(v) => updForm('x', v)} variant="default" />
            <Slider labeled label="Position Y" min={-1} max={1} step={0.01} value={selForm.y} onChange={(v) => updForm('y', v)} variant="default" />
            <Slider labeled label="Scale X" min={0.12} max={1.6} step={0.01} value={selForm.sx} onChange={(v) => updForm('sx', v)} variant="default" />
            <Slider labeled label="Scale Y" min={0.12} max={1.6} step={0.01} value={selForm.sy ?? selForm.sx} onChange={(v) => updForm('sy', v)} variant="default" />
            <Slider labeled label="Rotation" min={0} max={360} step={1} value={selForm.rot || 0} onChange={(v) => updForm('rot', v)} variant="default" />
            <Slider labeled label="Hue" min={0} max={1} step={0.01} value={selForm.hue || 0} onChange={(v) => updForm('hue', v)} variant="default" />
          </Section>
        )}
        </>)}

        {genTab === 'generate' && (
        <Section label="Generate">
          <Button variant="primary" size="sm" className="w-full" onClick={rollAll}>Randomize all</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="sm" onClick={rollColor}>Color</Button>
            <Button variant="primary" size="sm" onClick={rollTransform}>Transform</Button>
            <Button variant="primary" size="sm" onClick={rollScale}>Scale</Button>
            <Button variant="primary" size="sm" onClick={rollAnim}>Animation</Button>
          </div>
        </Section>
        )}
      </EditorRail>
    </div>
  )
}

// Soft Forms — Page › Category › Preset (Stack · Solo · Cluster); first category
// owns /softforms, the rest are /softforms/<cat>; scenes switch in the rail.
export default function SoftFormsPage() {
  return (
    <Routes>
      {SOFTFORM_CATEGORIES.map((c) => (
        <Route key={c.id} path={c.id === SOFTFORM_CATEGORIES[0].id ? '/' : c.id} element={<SoftFormsEditor key={c.id} category={c.id} />} />
      ))}
    </Routes>
  )
}
