import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { IridescentEngine, GRAD_PALETTES, BACKDROPS } from './engine.js'
import {
  GRADIENT_CATEGORIES, TYPE_BY_ID, LOOK_PRESETS, CTRL_SPEC, BASE_PARAMS, NUMERIC_KEYS,
  catIndex, catRoute, presetsForCat,
} from './registry.js'
import { resolveDeep } from '../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rndIn = (sp) => { const v = sp.min + Math.random() * (sp.max - sp.min); return sp.step >= 1 ? Math.round(v) : Math.round(v / sp.step) * sp.step }

// Gradients — iridescent shader on the generator archetype. CATEGORY (Field/Pole/
// Volume) selects the shader branch + control set; the rail's Preset dropdown picks
// one of the category's TYPES. Sliders resolve per-frame (expression/audio capable);
// the transport drives the baked uTime motion.
function GradientsEditor({ category }) {
  const navigate = useNavigate()
  const presets = presetsForCat(category)

  const [presetId, setPresetId] = useState(presets[0].id)
  const type = TYPE_BY_ID[presetId] || presets[0]

  const [P, setP] = useState(() => ({ ...BASE_PARAMS, ...presets[0].defaults }))
  const up = (k) => (v) => setP((s) => ({ ...s, [k]: v }))
  const [look, setLook] = useState('')

  const [tab, setTab] = useState('style')
  const [res, setRes] = useState(1600)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const timeRef = useRef(0)
  const cfg = useRef({})
  cfg.current = { ...P, speed: tempo / 120, playing }

  const canvasRef = useRef(null)
  const engineRef = useRef(null)

  // One engine + render loop for the editor's life (remounts per category via key).
  useEffect(() => {
    const engine = new IridescentEngine()
    engineRef.current = engine
    engine.init(canvasRef.current)
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
      num.grain = 0 // grain is a post-FX, not part of the gradient field
      engine.setParams(resolveDeep(num, timeRef.current))
      engine.frame(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engine.destroy(); engineRef.current = null }
  }, [])

  // Preset (type) → set the shader branch; category is fixed within this mount.
  useEffect(() => { engineRef.current?.setParams({ cat: catIndex(category), type: type.type }) }, [category, type.type])

  useEffect(() => {
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? res : Math.round(res * r)
    const h = r >= 1 ? Math.round(res / r) : res
    engineRef.current?.resize(w, h)
  }, [aspect, res])

  useEffect(() => { engineRef.current?.setParams({ palette: P.palette, spectral: P.spectral, backdrop: P.backdrop }) }, [P.palette, P.spectral, P.backdrop])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  // ── Preset / category ────────────────────────────────────────────────────────
  const loadPreset = (id) => {
    const t = TYPE_BY_ID[id]
    if (!t) return
    setPresetId(id)
    setP({ ...BASE_PARAMS, ...t.defaults })
    setLook('')
  }
  const pickCat = (id) => navigate(catRoute(id))
  const applyLook = (id) => {
    const f = LOOK_PRESETS.find((x) => x.id === id)
    if (!f) return
    setLook(id)
    setP((s) => ({ ...s, ...f.p }))
  }

  // ── Generate — randomize within the type ──────────────────────────────────────
  const rollLook = () => applyLook(pick(LOOK_PRESETS).id)
  const rollForm = () => setP((s) => {
    const n = { ...s, warp: rndIn({ min: 0, max: 0.5, step: 0.01 }) }
    for (const k of type.controls) n[k] = rndIn(CTRL_SPEC[k])
    return n
  })
  const rollSurface = () => setP((s) => ({ ...s, sheen: rndIn({ min: 0, max: 1.2, step: 0.02 }), gloss: rndIn({ min: 6, max: 60, step: 1 }), backdrop: pick(BACKDROPS).value }))
  const randomize = (which) => {
    if (which === 'preset') return loadPreset(pick(presets).id)
    if (which === 'all') { setTempo(120); rollLook(); rollForm(); rollSurface(); return }
    if (which === 'look') return rollLook()
    if (which === 'form') return rollForm()
    if (which === 'surface') return rollSurface()
  }

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: res, h: res }
    const blob = await engineRef.current?.exportBlob(dd.w, dd.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-gradient-${type.id}-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSettings = () => ({ presetId, ...P, look, res, aspect, scale })
  const applySettings = (s) => {
    if (s.presetId && TYPE_BY_ID[s.presetId]) setPresetId(s.presetId)
    setP((cur) => {
      const next = { ...cur }
      for (const k of Object.keys(BASE_PARAMS)) if (s[k] != null) next[k] = s[k]
      return next
    })
    if (s.look != null) setLook(s.look)
    if (s.res != null) setRes(s.res)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas data-vcap="stage" ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" />
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Gradients</RailHeader>
            <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }]} />
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
            settingsPage={`gradients-${category}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={GRADIENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={category} onChange={pickCat} />
          <Dropdown size="sm" variant="subtle" className="w-full" options={presets.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={loadPreset} />
        </Section>

        {tab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('look')}>Look</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('form')}>Form</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('surface')}>Surface</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('preset')}>Preset</Button>
            </div>
          </Section>
        )}

        {tab === 'style' && (
          <>
            <Section label="Look">
              <Dropdown size="sm" options={LOOK_PRESETS.map((x) => ({ value: x.id, label: x.label }))} value={look} onChange={applyLook} variant="subtle" className="w-full" placeholder="Look…" />
            </Section>

            <Section label="Form">
              {type.controls.map((k) => (
                <Slider key={k} labeled label={CTRL_SPEC[k].label} min={CTRL_SPEC[k].min} max={CTRL_SPEC[k].max} step={CTRL_SPEC[k].step} value={P[k]} onChange={up(k)} variant="default" />
              ))}
              <Slider labeled label="Warp" min={0} max={0.7} step={0.01} value={P.warp} onChange={up('warp')} variant="default" />
            </Section>

            <Section label="Iridescence">
              <Dropdown size="sm" options={GRAD_PALETTES.map((x) => ({ value: x.value, label: x.label }))} value={P.palette} onChange={up('palette')} variant="subtle" className="w-full" />
              <ToggleSwitch variant="plain" label="Spectral" checked={P.spectral} onChange={up('spectral')} />
              <Slider labeled label="Iridescence" min={0} max={2.5} step={0.05} value={P.irid} onChange={up('irid')} variant="default" />
              <Slider labeled label="Hue" min={0} max={1} step={0.01} value={P.hue} onChange={up('hue')} variant="default" />
            </Section>

            <Section label="Surface">
              <Slider labeled label="Sheen" min={0} max={1.2} step={0.02} value={P.sheen} onChange={up('sheen')} variant="default" />
              <Slider labeled label="Gloss" min={4} max={80} step={1} value={P.gloss} onChange={up('gloss')} variant="default" />
              <Dropdown size="sm" options={BACKDROPS.map((x) => ({ value: x.value, label: x.label }))} value={P.backdrop} onChange={up('backdrop')} variant="subtle" className="w-full" />
              <Slider labeled label="Resolution" min={800} max={2400} step={100} value={res} onChange={setRes} variant="default" />
            </Section>
          </>
        )}
      </EditorRail>
    </div>
  )
}

// Gradients — Page › Category › Preset (Field · Pole · Volume); first category owns
// /gradients, the rest are /gradients/<cat>; types switch in the rail.
export default function GradientsPage() {
  return (
    <Routes>
      {GRADIENT_CATEGORIES.map((c) => (
        <Route key={c.id} path={c.id === GRADIENT_CATEGORIES[0].id ? '/' : c.id} element={<GradientsEditor key={c.id} category={c.id} />} />
      ))}
    </Routes>
  )
}
