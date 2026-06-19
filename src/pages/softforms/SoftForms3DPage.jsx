import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { Routes, Route, useParams } from 'react-router-dom'
import { SoftForms3DEngine, GRAD_PALETTES, BACKDROPS } from './engine3d.js'
import { SCENE_3D_BY_ID, DEFAULT_SCENE_3D, CTRL_SPEC_3D, BASE_PARAMS_3D, NUMERIC_KEYS_3D } from './registry3d.js'
import { LOOK_PRESETS } from './registry.js'
import { resolveDeep } from '../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'

function SoftForms3DEditor({ sceneId }) {
  const scene   = SCENE_3D_BY_ID[sceneId] || SCENE_3D_BY_ID[DEFAULT_SCENE_3D]
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const dragRef   = useRef(null)
  const camRef    = useRef({ theta: 0.3, phi: 0.15, dist: 3.0 })

  const [P, setP]       = useState(() => ({ ...BASE_PARAMS_3D, ...scene.defaults }))
  const up = (k) => (v) => setP((s) => ({ ...s, [k]: v }))
  const [look, setLook] = useState('')

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
      engine.setParams(resolveDeep(num, timeRef.current))
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

  const applyLook = (id) => {
    const f = LOOK_PRESETS.find((x) => x.id === id)
    if (!f) return
    setLook(id)
    setP((s) => ({ ...s, ...f.p }))
  }

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

  const getSettings  = () => ({ ...P, look, aspect, scale })
  const applySettings = (s) => {
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
        header={<RailHeader>{`Soft Forms 3D · ${scene.label}`}</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab} onTab={setFootTab}
            transport={{
              playing, onPlay: () => setPlaying(true), onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); engineRef.current?.resetTime() },
              onRewind: () => engineRef.current?.resetTime(),
              tempo, onTempo: setTempo, tempoMax: 400,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={`softforms3d-${scene.id}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
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
          {slider('motion')}{slider('grain')}
          <Dropdown size="sm" options={BACKDROPS.map((x) => ({ value: x.value, label: x.label }))} value={P.backdrop} onChange={up('backdrop')} variant="subtle" className="w-full" />
        </Section>
      </EditorRail>
    </div>
  )
}

function EditorByParam() {
  const { scene } = useParams()
  return <SoftForms3DEditor key={scene} sceneId={scene} />
}

export default function SoftForms3DPage() {
  return (
    <Routes>
      <Route index element={<SoftForms3DEditor key="default" sceneId={DEFAULT_SCENE_3D} />} />
      <Route path=":scene" element={<EditorByParam />} />
    </Routes>
  )
}
