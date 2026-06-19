import { useEffect, useRef, useState } from 'react'
import { DriftEngine, PALETTES, STYLES } from './engine/DriftEngine.js'
import { resolveDeep } from '../../lib/exprParam.js'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
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

// Per-family rail layout. 'style'/'palette' render dropdowns; everything else is
// a PARAM slider. The freq slider is keyed `scale` in the UI but `freq` in state
// (uScale is the field frequency; `scale` is the export-resolution control).
const CONTROLS = {
  air: [
    { label: 'Field', rows: ['style', 'palette', 'freq', 'warp', 'evolve'] },
    { label: 'Wind', rows: ['direction', 'wind'] },
    { label: 'Sky', rows: ['coverage', 'soft', 'contrast', 'sheen', 'grain'] },
    { label: 'Loop', rows: ['period'] },
  ],
  water: [
    { label: 'Surface', rows: ['style', 'palette', 'freq', 'amp', 'chop'] },
    { label: 'Light', rows: ['direction', 'light', 'sheen'] },
    { label: 'Detail', rows: ['evolve', 'foam', 'contrast', 'grain'] },
    { label: 'Loop', rows: ['period'] },
  ],
  cloth: [
    { label: 'Fabric', rows: ['style', 'palette', 'freq', 'fold', 'drape'] },
    { label: 'Motion', rows: ['direction', 'sway', 'evolve'] },
    { label: 'Sheen', rows: ['light', 'sheen', 'contrast', 'grain'] },
    { label: 'Loop', rows: ['period'] },
  ],
}

// `freq` is the field-frequency state; its slider descriptor is PARAM.scale.
const PARAM_KEY = { freq: 'scale' }

// Drift — fullscreen seamless-loop motion field. `page` (a registry entry) seeds
// the defaults and its `family` selects the shader + control set. Sliders accept
// expressions / audio bands (resolved per-frame) so the loop can ride `bass`, `t`.
export default function DriftEditor({ page }) {
  const family = page.family
  const canvasRef = useRef(null)
  const engineRef = useRef(null)

  const [vals, setVals] = useState(() => ({ ...page.defaults }))
  const setVal = (k, v) => setVals((s) => ({ ...s, [k]: v }))

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
        // Resolve numeric params each frame so expression/audio bindings animate.
        const { style, palette, ...nums } = c.vals
        engine.setParams(resolveDeep({ ...nums, speed: c.speed }, timeRef.current))
        engine.frame(dt)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engine.destroy(); engineRef.current = null }
  }, [family])

  // Size the artboard to the chosen aspect.
  useEffect(() => {
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    engineRef.current?.resize(w, h)
  }, [aspect])

  // Non-numeric params → set on change (the loop handles the numeric ones).
  useEffect(() => { engineRef.current?.setParams({ style: vals.style, palette: vals.palette }) }, [vals.style, vals.palette])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: BASE, h: BASE }
    const blob = await engineRef.current?.exportBlob(dd.w, dd.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-drift-${page.id}-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Seamless WebM loop — step phase 0→1 deterministically over `period` seconds
  // and capture each frame. Params are frozen at their current resolved value so
  // the export is a clean single loop (no slider drift mid-record). Records at the
  // preview resolution; the live rAF yields the canvas while this runs.
  const recordLoop = async () => {
    const engine = engineRef.current
    const canvas = canvasRef.current
    if (!engine || !canvas || recordingRef.current) return
    if (typeof MediaRecorder === 'undefined') return

    const f = Number(fps) || 30
    const N = Math.max(2, Math.round((Number(vals.period) || 8) * f)) // frames in one loop
    const { style, palette, ...nums } = vals
    engine.setParams(resolveDeep({ ...nums, speed: tempo / 120 }, timeRef.current)) // freeze params

    const mimes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    const mime = mimes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm'
    const stream = canvas.captureStream(0) // 0 = manual; we push exactly N frames
    const track = stream.getVideoTracks()[0]
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const stopped = new Promise((r) => { rec.onstop = r })

    recordingRef.current = true
    setRecording(true)
    rec.start()
    for (let i = 0; i < N; i++) {
      engine.renderAtPhase(i / N) // 0 .. (N-1)/N — phase 1 == phase 0, so we omit it
      track.requestFrame?.()
      await new Promise((r) => setTimeout(r, 1000 / f)) // wall-clock spacing → real frame timestamps
    }
    rec.stop()
    recordingRef.current = false
    setRecording(false)
    await stopped

    const blob = new Blob(chunks, { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-drift-${page.id}-loop-${Date.now()}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSettings = () => ({ ...vals, aspect, scale })
  const applySettings = (s) => {
    const { aspect: a, scale: sc, ...rest } = s
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

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas ref={canvasRef} data-vcap="stage" className="max-w-full max-h-[90vh] object-contain rounded" />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>{page.label}</RailHeader>}
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
            settingsPage={`drift-${page.id}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        {CONTROLS[family].map((sec) => (
          <Section key={sec.label} label={sec.label}>
            {sec.rows.map(renderRow)}
          </Section>
        ))}

        <div className="kol-helper-10 text-body">seamless loop · 4-D looped simplex</div>
      </EditorRail>
    </div>
  )
}
