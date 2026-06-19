import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePublishReset, usePublishRetrigger } from '../../../components/framework/pageShortcuts.jsx'
import RibbonEngine from './engine/RibbonEngine.js'
import { RIBBON_PRESETS, DEFAULT_RIBBON } from './data/presets.js'
import { VIEW_ASPECTS, DEFAULT_SCALE, defaultAspectFor, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import Button from '../../../components/atoms/Button.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Section from '../../../components/molecules/Section.jsx'
import ColorField from '../../../components/color/ColorField.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import Scrubber from '../../../components/framework/Scrubber.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { randomSeed } from '../../../lib/rng.js'

const MATERIALS = [{ value: 'glass', label: 'Glass' }, { value: 'chrome', label: 'Chrome' }]

// 3D Scene · Ribbon — the joe_ryba "Puddle" studio: a flat glass ribbon swept
// along a seeded folding-stadium centerline, rendered with transmission +
// dispersion on a black stage and a chromatic-aberration post. One hero form
// turning on its axis; rail = Form/Material/Post/Camera tabs + shared transport.
export default function RibbonPage() {
  const { ribbonId } = useParams()
  const preset0 = (ribbonId && RIBBON_PRESETS.find((p) => p.id === ribbonId)) || DEFAULT_RIBBON

  // form (centerline + sweep)
  const [formId, setFormId] = useState(preset0.id)
  const [seed, setSeed] = useState(preset0.seed)
  const [loops, setLoops] = useState(preset0.loops)
  const [height, setHeight] = useState(preset0.height)
  const [gap, setGap] = useState(preset0.gap)
  const [depth, setDepth] = useState(preset0.depth)
  const [curl, setCurl] = useState(preset0.curl)
  const [width, setWidth] = useState(preset0.width)
  const [ribbonThickness, setRibbonThickness] = useState(preset0.ribbonThickness)
  const [corner, setCorner] = useState(preset0.corner)
  // material
  const [materialType, setMaterialType] = useState(preset0.material)
  const [color, setColor] = useState('#cfe0ff')
  const [roughness, setRoughness] = useState(0.06)
  const [ior, setIor] = useState(1.5)
  const [dispersion, setDispersion] = useState(7)
  const [metalness, setMetalness] = useState(1)
  const [background, setBackground] = useState('#000000')
  const [wireframe, setWireframe] = useState(false)
  const [strokeWidth, setStrokeWidth] = useState(2.5)
  // post
  const [aberration, setAberration] = useState(0.5)
  const [bloom, setBloom] = useState(0)
  const [vignette, setVignette] = useState(0.4)
  const [grain, setGrain] = useState(0)
  // motion
  const [flow, setFlow] = useState(0.6)
  const [cameraOrbit, setCameraOrbit] = useState(false)
  const [orbitSpeed, setOrbitSpeed] = useState(0.6)
  const [fov, setFov] = useState(36)
  // playback
  const [loopAnim, setLoopAnim] = useState(true)
  const [duration, setDuration] = useState(12)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  // view / output
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [recording, setRecording] = useState(false)
  const [panel, setPanel] = useState('form')
  const [footTab, setFootTab] = useState('transport')

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  usePublishReset(() => engineRef.current?.resetCamera())
  const progressRef = useRef({ t: 0, dur: 1 })
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect

  const geom = useMemo(
    () => ({ seed, loops, height, gap, depth, curl, width, ribbonThickness, corner }),
    [seed, loops, height, gap, depth, curl, width, ribbonThickness, corner],
  )
  const globals = useMemo(
    () => ({
      paused: !playing, loop: loopAnim, speed: tempo / 120, duration,
      flow, cameraOrbit, orbitSpeed, fov,
      materialType, color, roughness, metalness, ior, dispersion,
      background, wireframe, strokeWidth,
      aberration, bloom, vignette, grain,
    }),
    [playing, loopAnim, tempo, duration, flow, cameraOrbit, orbitSpeed, fov, materialType, color, roughness, metalness, ior, dispersion, background, wireframe, strokeWidth, aberration, bloom, vignette, grain],
  )

  const sizeCanvas = useCallback(() => {
    const el = wrapRef.current
    const cv = canvasRef.current
    const eng = engineRef.current
    if (!el || !cv || !eng || eng.recording) return
    const aw = el.clientWidth
    const ah = el.clientHeight
    const r = ratioFor(aspectRef.current)
    let w = aw
    let h = ah
    if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
    w = Math.max(1, Math.floor(w))
    h = Math.max(1, Math.floor(h))
    cv.style.width = `${w}px`
    cv.style.height = `${h}px`
    eng.resize(w, h)
  }, [])

  useEffect(() => {
    const engine = new RibbonEngine(canvasRef.current)
    engine.onProgress = (p) => { progressRef.current = p }
    engineRef.current = engine
    sizeCanvas()
    const ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); engine.dispose(); engineRef.current = null }
  }, [sizeCanvas])

  useEffect(() => { sizeCanvas() }, [aspect, sizeCanvas])
  useEffect(() => { engineRef.current?.update({ geom }) }, [geom])
  useEffect(() => { engineRef.current?.update({ globals }) }, [globals])
  useEffect(() => { engineRef.current?.setBackground(background) }, [background])

  // Follow sidebar nav between forms.
  useEffect(() => {
    if (ribbonId && RIBBON_PRESETS.some((p) => p.id === ribbonId)) applyForm(ribbonId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ribbonId])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'c' || e.key === 'C') engineRef.current?.resetCamera()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Form presets ──
  const applyForm = (id) => {
    const p = RIBBON_PRESETS.find((x) => x.id === id)
    if (!p) return
    setFormId(p.id)
    setSeed(p.seed); setLoops(p.loops); setHeight(p.height); setGap(p.gap); setDepth(p.depth); setCurl(p.curl)
    setWidth(p.width); setRibbonThickness(p.ribbonThickness); setCorner(p.corner)
    setMaterialType(p.material)
  }
  const regenerate = () => setSeed(randomSeed())
  usePublishRetrigger(regenerate)

  // ── Settings export / import ──
  const getSettings = () => ({
    formId, seed, loops, height, gap, depth, curl, width, ribbonThickness, corner,
    materialType, color, roughness, ior, dispersion, metalness, background, wireframe, strokeWidth,
    aberration, bloom, vignette, grain, flow, cameraOrbit, orbitSpeed, fov, loopAnim, duration, aspect, scale,
  })
  const applySettings = (s) => {
    const set = (v, fn) => { if (v != null) fn(v) }
    set(s.formId, setFormId); set(s.seed, setSeed); set(s.loops, setLoops); set(s.height, setHeight)
    set(s.gap, setGap); set(s.depth, setDepth); set(s.curl, setCurl); set(s.width, setWidth)
    set(s.ribbonThickness, setRibbonThickness); set(s.corner, setCorner)
    set(s.materialType, setMaterialType); set(s.color, setColor); set(s.roughness, setRoughness)
    set(s.ior, setIor); set(s.dispersion, setDispersion); set(s.metalness, setMetalness)
    set(s.background, setBackground); set(s.wireframe, setWireframe); set(s.strokeWidth, setStrokeWidth)
    set(s.aberration, setAberration); set(s.bloom, setBloom); set(s.vignette, setVignette); set(s.grain, setGrain)
    set(s.flow, setFlow); set(s.cameraOrbit, setCameraOrbit); set(s.orbitSpeed, setOrbitSpeed); set(s.fov, setFov)
    set(s.loopAnim, setLoopAnim); set(s.duration, setDuration); set(s.aspect, setAspect); set(s.scale, setScale)
  }

  // ── Export ──
  const download = (blob, name) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await engineRef.current?.exportBlobAt(d.w, d.h) : await engineRef.current?.exportBlob()
    download(blob, `kol-3d-scene-ribbon-${formId}.png`)
  }
  const exportVideo = async () => {
    if (recording) return
    setRecording(true)
    try {
      const d = dimsFor(aspect, 1)
      download(await engineRef.current?.recordLoop(d?.w, d?.h, 30), `kol-3d-scene-ribbon-${formId}.webm`)
    } finally { setRecording(false) }
  }

  const formLabel = RIBBON_PRESETS.find((p) => p.id === formId)?.label || 'Ribbon'

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} data-vcap="stage" className="block max-w-full max-h-full" />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{formLabel}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{materialType === 'chrome' ? 'Chrome' : 'Glass · dispersion'}</div>
        </div>
        <Scrubber progressRef={progressRef} playerRef={engineRef} />
      </div>

      <LiveClock getT={() => progressRef.current.t}>
      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Ribbon</RailHeader>
            <SegmentedToggle
              value={panel}
              onChange={setPanel}
              options={[
                { value: 'form', label: 'Form' },
                { value: 'material', label: 'Material' },
                { value: 'post', label: 'Post' },
                { value: 'camera', label: 'Camera' },
              ]}
            />
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
              onStop: () => { setPlaying(false); engineRef.current?.seek(0) },
              onRewind: () => engineRef.current?.seek(0),
              tempo,
              onTempo: setTempo,
              tempoMax: 600,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={
              <>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportVideo} disabled={recording}>
                  {recording ? 'Recording loop…' : 'Export loop (webm)'}
                </Button>
              </>
            }
            settingsPage="ribbon"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        {panel === 'form' && (
          <>
            <Section label="Generate">
              <Button variant="primary" size="sm" className="w-full" iconLeft="cycle" onClick={regenerate}>Regenerate</Button>
              <div className="kol-helper-10 text-meta">seed {seed}</div>
            </Section>

            <Section label="Form">
              <div className="flex flex-col gap-1">
                {RIBBON_PRESETS.map((p) => (
                  <Button key={p.id} variant="secondary" size="sm" selected={p.id === formId} onClick={() => applyForm(p.id)} className="w-full" style={{ justifyContent: 'flex-start' }}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </Section>

            <Section label="Fold">
              <Slider labeled label="Loops" min={1} max={6} step={1} value={loops} onChange={(v) => setLoops(roundIfNum(v))} variant="default" />
              <Slider labeled label="Height" min={1} max={3.5} step={0.05} value={height} onChange={setHeight} variant="default" />
              <Slider labeled label="Gap" min={0.5} max={1.6} step={0.02} value={gap} onChange={setGap} variant="default" />
              <Slider labeled label="Depth" min={0} max={1} step={0.02} value={depth} onChange={setDepth} variant="default" />
              <Slider labeled label="Curl" min={0} max={2.5} step={0.05} value={curl} onChange={setCurl} variant="default" />
            </Section>

            <Section label="Ribbon">
              <Slider labeled label="Width" min={0.2} max={0.9} step={0.01} value={width} onChange={setWidth} variant="default" />
              <Slider labeled label="Flatness" min={0.04} max={0.3} step={0.005} value={ribbonThickness} onChange={setRibbonThickness} variant="default" />
              <Slider labeled label="Corner" min={0.01} max={0.12} step={0.005} value={corner} onChange={setCorner} variant="default" />
            </Section>
          </>
        )}

        {panel === 'material' && (
          <>
            <Section label="Material">
              <SegmentedToggle value={materialType} onChange={setMaterialType} options={MATERIALS} />
              <ColorField label="Tint" value={color} onChange={setColor} />
              <Slider labeled label="Roughness" min={0} max={0.6} step={0.01} value={roughness} onChange={setRoughness} variant="default" />
              {materialType === 'glass' ? (
                <>
                  <Slider labeled label="IOR" min={1} max={2.2} step={0.01} value={ior} onChange={setIor} variant="default" />
                  <Slider labeled label="Dispersion" min={0} max={20} step={0.2} value={dispersion} onChange={setDispersion} variant="default" />
                </>
              ) : (
                <Slider labeled label="Metalness" min={0} max={1} step={0.02} value={metalness} onChange={setMetalness} variant="default" />
              )}
            </Section>

            <Section label="Stage">
              <ColorField label="Background" value={background} onChange={setBackground} />
            </Section>

            <Section label="Wireframe">
              <ToggleSwitch variant="plain" label="Wireframe" checked={wireframe} onChange={setWireframe} />
              {wireframe && <Slider labeled label="Stroke" min={1} max={8} step={0.5} value={strokeWidth} onChange={setStrokeWidth} variant="default" />}
            </Section>
          </>
        )}

        {panel === 'post' && (
          <Section label="Post">
            <Slider labeled label="Aberration" min={0} max={3} step={0.05} value={aberration} onChange={setAberration} variant="default" />
            <Slider labeled label="Bloom" min={0} max={1.5} step={0.02} value={bloom} onChange={setBloom} variant="default" />
            <Slider labeled label="Vignette" min={0} max={1} step={0.02} value={vignette} onChange={setVignette} variant="default" />
            <Slider labeled label="Grain" min={0} max={0.4} step={0.01} value={grain} onChange={setGrain} variant="default" />
          </Section>
        )}

        {panel === 'camera' && (
          <>
            <Section label="Spine">
              <Slider labeled label="Flow" min={0} max={0.95} step={0.01} value={flow} onChange={setFlow} variant="default" />
              <ToggleSwitch variant="plain" label="Loop" checked={loopAnim} onChange={setLoopAnim} />
              <Slider labeled label="Duration (s)" min={4} max={30} step={0.5} value={duration} onChange={setDuration} variant="default" />
            </Section>

            <Section label="Camera">
              <ToggleSwitch variant="plain" label="Orbit" checked={cameraOrbit} onChange={setCameraOrbit} />
              {cameraOrbit && <Slider labeled label="Orbit speed" min={0.1} max={4} step={0.05} value={orbitSpeed} onChange={setOrbitSpeed} variant="default" />}
              <Slider labeled label="Field of view" min={20} max={70} step={1} value={fov} onChange={setFov} variant="default" />
              <Button variant="primary" size="sm" onClick={() => engineRef.current?.resetCamera()}>Cam reset</Button>
            </Section>
          </>
        )}

        <Divider />

        <div className="kol-helper-10 text-body flex flex-col gap-1">
          <div>space = play / pause</div>
          <div>drag = orbit</div>
          <div>wheel = zoom</div>
          <div>C = reset cam</div>
          <div>scrub the timeline below</div>
        </div>
      </EditorRail>
      </LiveClock>
    </div>
  )
}
