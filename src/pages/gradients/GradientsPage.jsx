import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { Routes, Route, useParams } from 'react-router-dom'
import { IridescentEngine, GRAD_PALETTES, BACKDROPS } from './engine.js'
import { TYPE_BY_ID, DEFAULT_TYPE, LOOK_PRESETS, CTRL_SPEC, BASE_PARAMS, NUMERIC_KEYS, catIndex } from './registry.js'
import { resolveDeep } from '../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'

function GradientsEditor({ typeId }) {
  const type = TYPE_BY_ID[typeId] || TYPE_BY_ID[DEFAULT_TYPE]
  const canvasRef = useRef(null)
  const engineRef = useRef(null)

  const [P, setP] = useState(() => ({ ...BASE_PARAMS, ...type.defaults }))
  const up = (k) => (v) => setP((s) => ({ ...s, [k]: v }))
  const [look, setLook] = useState('')

  const [res, setRes] = useState(1600)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  // refs read inside the loop so it needn't restart on every tweak
  const timeRef = useRef(0)
  const cfg = useRef({})
  cfg.current = { ...P, speed: tempo / 120, playing }

  // One engine + render loop for the page's life. (Remounts per sub-page via key.)
  useEffect(() => {
    const engine = new IridescentEngine()
    engineRef.current = engine
    engine.init(canvasRef.current)
    engine.setParams({ cat: catIndex(type.cat), type: type.type })
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
      // Resolve numeric params each frame so expression / audio bindings animate.
      engine.setParams(resolveDeep(num, timeRef.current))
      engine.frame(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engine.destroy(); engineRef.current = null }
  }, [])

  // Size the artboard to the chosen aspect × resolution.
  useEffect(() => {
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? res : Math.round(res * r)
    const h = r >= 1 ? Math.round(res / r) : res
    engineRef.current?.resize(w, h)
  }, [aspect, res])

  // Non-numeric params → set on change (the loop handles the animated ones).
  useEffect(() => { engineRef.current?.setParams({ palette: P.palette, spectral: P.spectral, backdrop: P.backdrop }) }, [P.palette, P.spectral, P.backdrop])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  const applyLook = (id) => {
    const f = LOOK_PRESETS.find((x) => x.id === id)
    if (!f) return
    setLook(id)
    setP((s) => ({ ...s, ...f.p }))
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

  const getSettings = () => ({ ...P, look, res, aspect, scale })
  const applySettings = (s) => {
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
        header={<RailHeader>{`Gradients · ${type.label}`}</RailHeader>}
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
              tempoMax: 400,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={`gradients-${type.id}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Look">
          <Dropdown size="sm" options={LOOK_PRESETS.map((x) => ({ value: x.id, label: x.label }))} value={look} onChange={applyLook} variant="subtle" className="w-full" />
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
          <Slider labeled label="Grain" min={0} max={0.15} step={0.005} value={P.grain} onChange={up('grain')} variant="default" />
          <Dropdown size="sm" options={BACKDROPS.map((x) => ({ value: x.value, label: x.label }))} value={P.backdrop} onChange={up('backdrop')} variant="subtle" className="w-full" />
          <Slider labeled label="Resolution" min={800} max={2400} step={100} value={res} onChange={setRes} variant="default" />
        </Section>
      </EditorRail>
    </div>
  )
}

function EditorByParam() {
  const { type } = useParams()
  return <GradientsEditor key={type} typeId={type} />
}

// Gradients · 12 explorations (Field · Pole · Volume), route picks the type.
export default function GradientsPage() {
  return (
    <Routes>
      <Route index element={<GradientsEditor key="default" typeId={DEFAULT_TYPE} />} />
      <Route path=":type" element={<EditorByParam />} />
    </Routes>
  )
}
