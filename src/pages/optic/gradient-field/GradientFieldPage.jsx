import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { MeshGradientEngine, MG_PALETTES } from './engine.js'
import { resolveDeep } from '../../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'

const BASE = 1100

// Optic · Mesh-gradient field — fullscreen domain-warped colour field.
export default function GradientFieldPage() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const [palette, setPalette] = useState('dynamics')
  const [warp, setWarp] = useState(0.35)
  const [grain, setGrain] = useState(0.04)
  const [sheen, setSheen] = useState(0.6)
  const [contrast, setContrast] = useState(1)
  const [duotone, setDuotone] = useState(false)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  // refs read inside the loop so it needn't restart on every tweak
  const timeRef = useRef(0)
  const cfg = useRef({})
  cfg.current = { warp, grain, sheen, contrast, speed: tempo / 120, playing }

  // One engine + render loop for the page's life.
  useEffect(() => {
    const engine = new MeshGradientEngine()
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
      // Resolve the numeric params each frame so expression/audio bindings animate.
      engine.setParams(resolveDeep({ warp: c.warp, grain: c.grain, sheen: c.sheen, contrast: c.contrast, speed: c.speed }, timeRef.current))
      engine.frame(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engine.destroy(); engineRef.current = null }
  }, [])

  // Size the artboard to the chosen aspect.
  useEffect(() => {
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    engineRef.current?.resize(w, h)
  }, [aspect])

  // palette/duotone are non-numeric → set on change (the loop handles the rest).
  useEffect(() => { engineRef.current?.setParams({ palette, duotone }) }, [palette, duotone])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: BASE, h: BASE }
    const blob = await engineRef.current?.exportBlob(dd.w, dd.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-gradient-field-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSettings = () => ({ palette, warp, grain, sheen, contrast, duotone, aspect, scale })
  const applySettings = (s) => {
    if (s.palette != null) setPalette(s.palette)
    if (s.warp != null) setWarp(s.warp)
    if (s.grain != null) setGrain(s.grain)
    if (s.sheen != null) setSheen(s.sheen)
    if (s.contrast != null) setContrast(s.contrast)
    if (s.duotone != null) setDuotone(s.duotone)
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
        header={<RailHeader>Mesh Gradient</RailHeader>}
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
            settingsPage="optic-gradient-field"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Field">
          <Dropdown size="sm" options={MG_PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
          <Slider labeled label="Warp" min={0} max={1} step={0.01} value={warp} onChange={setWarp} variant="default" />
          <Slider labeled label="Sheen" min={0} max={1.5} step={0.05} value={sheen} onChange={setSheen} variant="default" />
        </Section>

        <Section label="Grade">
          <Slider labeled label="Contrast" min={0.3} max={2.5} step={0.05} value={contrast} onChange={setContrast} variant="default" />
          <Slider labeled label="Grain" min={0} max={0.2} step={0.005} value={grain} onChange={setGrain} variant="default" />
          <ToggleSwitch variant="plain" label="Duotone" checked={duotone} onChange={setDuotone} />
        </Section>

        <div className="kol-helper-10 text-body">domain-warped colour field · idw blend</div>
      </EditorRail>
    </div>
  )
}
