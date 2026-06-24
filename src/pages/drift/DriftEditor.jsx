import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DriftEngine, PALETTES, STYLES } from './engine/DriftEngine.js'
import { CATEGORIES, categoryById, presetsForCat } from './registry.js'
import { resolveDeep } from '../../lib/exprParam.js'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Button from '../../components/atoms/Button.jsx'

const BASE = 1100

// Slider descriptors — shared across families; the control spec picks which to show.
const PARAM = {
  scale:     { label: 'Scale', min: 0.3, max: 3, step: 0.05 },
  warp:      { label: 'Warp', min: 0, max: 3, step: 0.05 },
  evolve:    { label: 'Evolve', min: 0, max: 1, step: 0.01 },
  direction: { label: 'Direction', min: 0, max: 360, step: 1 },
  wind:      { label: 'Gust', min: 0, max: 1.5, step: 0.02 },
  coverage:  { label: 'Coverage', min: 0, max: 1, step: 0.01 },
  soft:      { label: 'Softness', min: 0, max: 1, step: 0.01 },
  contrast:  { label: 'Contrast', min: 0.3, max: 2.5, step: 0.05 },
  sheen:     { label: 'Sheen', min: 0, max: 1.5, step: 0.05 },
  grain:     { label: 'Grain', min: 0, max: 0.2, step: 0.005 },
  amp:       { label: 'Amplitude', min: 0, max: 1.5, step: 0.02 },
  chop:      { label: 'Choppiness', min: 0, max: 1.5, step: 0.02 },
  foam:      { label: 'Foam', min: 0, max: 1, step: 0.01 },
  light:     { label: 'Light', min: 0, max: 360, step: 1 },
  fold:      { label: 'Fold', min: 0, max: 2, step: 0.02 },
  drape:     { label: 'Drape', min: 0, max: 1.5, step: 0.02 },
  sway:      { label: 'Sway', min: 0, max: 1.5, step: 0.02 },
  period:    { label: 'Length', min: 2, max: 30, step: 0.5 },
}
// Grain is a post-process FX (lives in the FX layer, not the field) → forced off here.
// `freq` is the field-frequency state; its slider descriptor is PARAM.scale.
const PARAM_KEY = { freq: 'scale' }

// Per-family rail: Style = the look/shape sections · Animation = what moves over
// time (drift direction, evolve, loop length). 'style'/'palette' render dropdowns.
const CONTROLS = {
  air: {
    style: [
      { label: 'Field', rows: ['style', 'palette', 'freq', 'warp'] },
      { label: 'Sky', rows: ['coverage', 'soft', 'contrast', 'sheen'] },
    ],
    anim: [
      { label: 'Wind', rows: ['direction', 'wind'] },
      { label: 'Evolve', rows: ['evolve'] },
      { label: 'Loop', rows: ['period'] },
    ],
  },
  water: {
    style: [
      { label: 'Surface', rows: ['style', 'palette', 'freq', 'amp', 'chop'] },
      { label: 'Look', rows: ['light', 'foam', 'sheen', 'contrast'] },
    ],
    anim: [
      { label: 'Drift', rows: ['direction'] },
      { label: 'Evolve', rows: ['evolve'] },
      { label: 'Loop', rows: ['period'] },
    ],
  },
  cloth: {
    style: [
      { label: 'Fabric', rows: ['style', 'palette', 'freq', 'fold', 'drape'] },
      { label: 'Sheen', rows: ['light', 'sheen', 'contrast'] },
    ],
    anim: [
      { label: 'Motion', rows: ['direction', 'sway'] },
      { label: 'Evolve', rows: ['evolve'] },
      { label: 'Loop', rows: ['period'] },
    ],
  },
}

// Numeric keys per family (every row across both tabs minus the two dropdowns).
const numericKeys = (family) =>
  [...CONTROLS[family].style, ...CONTROLS[family].anim]
    .flatMap((s) => s.rows)
    .filter((k) => k !== 'style' && k !== 'palette')
const animKeys = (family) => CONTROLS[family].anim.flatMap((s) => s.rows).filter((k) => k !== 'style' && k !== 'palette')

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rndParam = (key) => {
  const d = PARAM[PARAM_KEY[key] || key]
  const v = d.min + Math.random() * (d.max - d.min)
  return d.step >= 1 ? Math.round(v) : Math.round(v / d.step) * d.step
}

// Drift — fullscreen seamless-loop motion field on the generator archetype. The
// CATEGORY (air/water/cloth) selects the shader + control set; the rail's Preset
// dropdown picks one of the 6 curated variations. Sliders accept expressions /
// audio bands (resolved per-frame) so the loop can ride `bass`, `t`.
export default function DriftEditor({ category }) {
  const navigate = useNavigate()
  const family = category
  const presets = presetsForCat(category)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)

  const [presetId, setPresetId] = useState(presets[0].id)
  const [vals, setVals] = useState(() => ({ ...presets[0].defaults }))
  const setVal = (k, v) => { setVals((s) => ({ ...s, [k]: v })); setPresetId('custom') }

  const [tab, setTab] = useState('style')
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [fps, setFps] = useState('30')
  const [recording, setRecording] = useState(false)
  const [footTab, setFootTab] = useState('transport')

  // refs read inside the loop so it needn't restart on every tweak
  const timeRef = useRef(0)
  const recordingRef = useRef(false)
  const cfg = useRef({})
  cfg.current = { vals, speed: tempo / 120, playing }

  // One engine + render loop for the editor's life.
  useEffect(() => {
    const engine = new DriftEngine(family)
    engineRef.current = engine
    engine.init(canvasRef.current)
    let alive = true
    let raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      // The recorder drives phase + params itself; yield the canvas while it runs.
      if (!recordingRef.current) {
        const c = cfg.current
        if (c.playing) timeRef.current += dt * c.speed
        const { style, palette, ...nums } = c.vals
        engine.setParams(resolveDeep({ ...nums, grain: 0, speed: c.speed }, timeRef.current))
        engine.frame(dt)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engine.destroy(); engineRef.current = null }
  }, [family])

  useEffect(() => {
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    engineRef.current?.resize(w, h)
  }, [aspect])

  useEffect(() => { engineRef.current?.setParams({ style: vals.style, palette: vals.palette }) }, [vals.style, vals.palette])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  // ── Preset / category ────────────────────────────────────────────────────────
  const loadPreset = (id) => {
    const p = presets.find((x) => x.id === id)
    if (!p) return
    setPresetId(id)
    setVals({ ...p.defaults })
  }
  const pickCat = (id) => navigate(categoryById(id).route)

  // ── Generate — randomize within the family (look-only keeps the category) ─────
  const rollLook = () => setVals((v) => {
    const next = { ...v, style: pick(STYLES[family]).value, palette: pick(PALETTES[family]).value }
    for (const k of numericKeys(family)) if (!animKeys(family).includes(k)) next[k] = rndParam(k)
    return next
  })
  const rollMotion = () => setVals((v) => { const next = { ...v }; for (const k of animKeys(family)) next[k] = rndParam(k); return next })
  const rollPalette = () => setVals((v) => ({ ...v, palette: pick(PALETTES[family]).value }))
  const rndPreset = () => loadPreset(pick(presets).id) // jump to a random curated variation
  const randomize = (which) => {
    if (which === 'preset') return rndPreset()
    setPresetId('custom')
    if (which === 'all') { setTempo(120); rollLook(); rollMotion(); return }
    if (which === 'look') return rollLook()
    if (which === 'motion') return rollMotion()
    if (which === 'palette') return rollPalette()
  }

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: BASE, h: BASE }
    const blob = await engineRef.current?.exportBlob(dd.w, dd.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-drift-${presetId}-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Seamless WebM loop — step phase 0→1 over `period` seconds, capture each frame.
  const recordLoop = async () => {
    const engine = engineRef.current
    const canvas = canvasRef.current
    if (!engine || !canvas || recordingRef.current) return
    if (typeof MediaRecorder === 'undefined') return

    const f = Number(fps) || 30
    const N = Math.max(2, Math.round((Number(vals.period) || 8) * f))
    const { style, palette, ...nums } = vals
    engine.setParams(resolveDeep({ ...nums, grain: 0, speed: tempo / 120 }, timeRef.current))

    const mimes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    const mime = mimes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm'
    const stream = canvas.captureStream(0)
    const track = stream.getVideoTracks()[0]
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const stopped = new Promise((r) => { rec.onstop = r })

    recordingRef.current = true
    setRecording(true)
    rec.start()
    for (let i = 0; i < N; i++) {
      engine.renderAtPhase(i / N)
      track.requestFrame?.()
      await new Promise((r) => setTimeout(r, 1000 / f))
    }
    rec.stop()
    recordingRef.current = false
    setRecording(false)
    await stopped

    const blob = new Blob(chunks, { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-drift-${presetId}-loop-${Date.now()}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSettings = () => ({ presetId, ...vals, aspect, scale })
  const applySettings = (s) => {
    const { aspect: a, scale: sc, presetId: pid, ...rest } = s
    if (pid) setPresetId(pid)
    setVals((v) => ({ ...v, ...rest }))
    if (a != null) setAspect(a)
    if (sc != null) setScale(sc)
  }

  const styles = STYLES[family]
  const palettes = PALETTES[family].map((p) => ({ value: p.value, label: p.label }))

  const renderRow = (key) => {
    if (key === 'style') return <Dropdown key="style" size="sm" options={styles} value={vals.style} onChange={(v) => setVal('style', v)} variant="subtle" className="w-full" />
    if (key === 'palette') return <Dropdown key="palette" size="sm" options={palettes} value={vals.palette} onChange={(v) => setVal('palette', v)} variant="subtle" className="w-full" />
    const d = PARAM[PARAM_KEY[key] || key]
    return <Slider key={key} labeled label={d.label} min={d.min} max={d.max} step={d.step} value={vals[key]} onChange={(v) => setVal(key, v)} variant="default" />
  }
  const renderSections = (secs) => secs.map((sec) => (
    <Section key={sec.label} label={sec.label}>{sec.rows.map(renderRow)}</Section>
  ))

  const presetOpts = presetId === 'custom'
    ? [{ value: 'custom', label: 'Custom' }, ...presets.map((p) => ({ value: p.id, label: p.label }))]
    : presets.map((p) => ({ value: p.id, label: p.label }))

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas ref={canvasRef} data-vcap="stage" className="max-w-full max-h-[90vh] object-contain rounded" />
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Drift</RailHeader>
            <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'animation', label: 'Animation' }]} />
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
            exportActions={
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="kol-helper-10 text-body-muted">Loop FPS</span>
                  <Dropdown size="sm" openUp variant="subtle" className="w-24"
                    options={[{ value: '24', label: '24' }, { value: '30', label: '30' }, { value: '60', label: '60' }]}
                    value={fps} onChange={setFps} />
                </div>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
                <Button variant="primary" size="sm" className="w-full" iconLeft="circle" disabled={recording} onClick={recordLoop}>
                  {recording ? 'Recording loop…' : 'Record loop (WebM)'}
                </Button>
              </div>
            }
            settingsPage={`drift-${family}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={category} onChange={pickCat} />
          <Dropdown size="sm" variant="subtle" className="w-full" options={presetOpts} value={presetId} onChange={loadPreset} />
        </Section>

        {tab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('look')}>Look</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('motion')}>Motion</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('palette')}>Palette</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('preset')}>Preset</Button>
            </div>
          </Section>
        )}

        {tab === 'style' && renderSections(CONTROLS[family].style)}
        {tab === 'animation' && renderSections(CONTROLS[family].anim)}
      </EditorRail>
    </div>
  )
}
