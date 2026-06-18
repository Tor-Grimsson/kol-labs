import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PrimitiveEngine from './engine/PrimitiveEngine.js'
import { PRIMITIVES, PRESETS } from './data/primitives.js'
import { DEFAULT_KEYFRAMES } from './data/keyframes.js'
import { ARRANGEMENTS } from './data/composition.js'
import { MATERIAL_TYPES } from './data/materials.js'
import { randomScene } from './data/generate.js'
import { VIEW_ASPECTS, DEFAULT_ASPECT, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import ExportPanel from '../../_shared/ExportPanel.jsx'
import * as audio from './lib/audio.js'
import KeyframeEditor from './KeyframeEditor.jsx'
import Button from '../../../components/atoms/Button.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'
import Divider from '../../../components/atoms/Divider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import ColorField from '../../../components/color/ColorField.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import TransportBar from '../../../components/framework/TransportBar.jsx'
import Scrubber from '../../../components/framework/Scrubber.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import { resolveTheme, DEFAULT_THEME } from '../../../lib/themes.js'
import { randomSeed } from '../../../lib/rng.js'

const SHAPE_PARAM = { torus: 'tube', torusKnot: 'pq', icosahedron: 'detail', octahedron: 'detail', dodecahedron: 'detail' }

// 3D Scene · Primitive — a small motion studio: selectable primitives, composed
// in arrangements, animated by a preset or keyframe track, styled (material /
// environment / wireframe), audio-reactive, seeded-randomisable, and exported as
// a PNG (@Nx) or a seamless webm loop. Stage = framed canvas + scrubber; rail =
// Scene/Style/Anim/Camera/View tabs + the shared transport.
export default function PrimitiveScenePage() {
  // scene
  const [primitive, setPrimitive] = useState('box')
  const [arrangement, setArrangement] = useState('single')
  const [count, setCount] = useState(1)
  const [spread, setSpread] = useState(2.2)
  const [objectSize, setObjectSize] = useState(1)
  const [stagger, setStagger] = useState(0)
  const [tube, setTube] = useState(0.32)
  const [pKnot, setPKnot] = useState(2)
  const [qKnot, setQKnot] = useState(3)
  const [detail, setDetail] = useState(0)
  const [seed, setSeed] = useState(1)
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  // animation
  const [animMode, setAnimMode] = useState('preset')
  const [preset, setPreset] = useState('spin')
  const [keyframes, setKeyframes] = useState(DEFAULT_KEYFRAMES)
  const [selKf, setSelKf] = useState(0)
  const [loop, setLoop] = useState(true)
  const [duration, setDuration] = useState(8)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  // audio
  const [audioReactive, setAudioReactive] = useState(false)
  const [audioAmount, setAudioAmount] = useState(1)
  const [audioSource, setAudioSource] = useState('off')
  // style
  const [materialType, setMaterialType] = useState('standard')
  const [environment, setEnvironment] = useState(false)
  const [color, setColor] = useState('#b9c2d0')
  const [flatShading, setFlatShading] = useState(false)
  const [roughness, setRoughness] = useState(0.38)
  const [metalness, setMetalness] = useState(0.18)
  const [rounding, setRounding] = useState(0.22)
  const [wireframe, setWireframe] = useState(false)
  const [strokeWidth, setStrokeWidth] = useState(3)
  // camera
  const [cameraMotion, setCameraMotion] = useState(false)
  const [orbitSpeed, setOrbitSpeed] = useState(1)
  const [fov, setFov] = useState(38)
  const [showAxis, setShowAxis] = useState(false)
  const [axisLength, setAxisLength] = useState(1.5)
  const [axisOpacity, setAxisOpacity] = useState(0.7)
  // view / output
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [recording, setRecording] = useState(false)
  const [panel, setPanel] = useState('scene')

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const progressRef = useRef({ t: 0, dur: 1 })
  const audioFileRef = useRef(null)
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect

  const globals = useMemo(
    () => ({
      preset, animMode, keyframes, loop, duration, paused: !playing, speed: tempo / 120,
      count, arrangement, spread, objectSize, stagger,
      cameraMotion, orbitSpeed, fov,
      wireframe, strokeWidth, materialType, environment, flatShading, rounding, roughness, metalness, color,
      showAxis, axisLength, axisOpacity, audioReactive, audioAmount,
    }),
    [preset, animMode, keyframes, loop, duration, playing, tempo, count, arrangement, spread, objectSize, stagger, cameraMotion, orbitSpeed, fov, wireframe, strokeWidth, materialType, environment, flatShading, rounding, roughness, metalness, color, showAxis, axisLength, axisOpacity, audioReactive, audioAmount],
  )

  // Fit the canvas to the chosen aspect inside the stage (letterboxed), size the
  // renderer to match. Skipped mid-record so a stray resize can't clobber the
  // export resolution.
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
    if (r) {
      h = w / r
      if (h > ah) { h = ah; w = h * r }
    }
    w = Math.max(1, Math.floor(w))
    h = Math.max(1, Math.floor(h))
    cv.style.width = `${w}px`
    cv.style.height = `${h}px`
    eng.resize(w, h)
  }, [])

  useEffect(() => {
    const engine = new PrimitiveEngine(canvasRef.current)
    engine.onProgress = (p) => { progressRef.current = p }
    engineRef.current = engine
    sizeCanvas()
    const ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(wrapRef.current)
    return () => {
      ro.disconnect()
      engine.dispose()
      engineRef.current = null
    }
  }, [sizeCanvas])

  useEffect(() => { sizeCanvas() }, [aspect, sizeCanvas])
  useEffect(() => { engineRef.current?.update({ primitive }) }, [primitive])
  useEffect(() => { engineRef.current?.update({ params: { tube, p: pKnot, q: qKnot, detail } }) }, [tube, pKnot, qKnot, detail])
  useEffect(() => { engineRef.current?.update({ globals }) }, [globals])
  useEffect(() => { engineRef.current?.setBackground(resolveTheme(themeId, invert).bg) }, [themeId, invert])
  useEffect(() => () => audio.stop(), [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'c' || e.key === 'C') engineRef.current?.resetCamera()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Seeded generator ──
  const applyScene = (cfg) => {
    setPrimitive(cfg.primitive)
    setPreset(cfg.preset)
    setAnimMode('preset')
    setArrangement(cfg.arrangement)
    setCount(cfg.count)
    setSpread(cfg.spread)
    setObjectSize(cfg.objectSize)
    setStagger(cfg.stagger)
    setColor(cfg.color)
    setMaterialType(cfg.materialType)
    setRoughness(cfg.roughness)
    setMetalness(cfg.metalness)
    setFlatShading(cfg.flatShading)
  }
  const reseed = (s) => { setSeed(s); applyScene(randomScene(s)) }
  const randomize = () => reseed(randomSeed())

  // ── Settings export / import ──
  const getSettings = () => ({
    themeId, invert, seed,
    primitive, arrangement, count, spread, objectSize, stagger, tube, pKnot, qKnot, detail,
    animMode, preset, keyframes, loop, duration,
    materialType, environment, color, flatShading, roughness, metalness, rounding, wireframe, strokeWidth,
    cameraMotion, orbitSpeed, fov, showAxis, axisLength, axisOpacity,
    aspect, scale,
  })
  const applySettings = (s) => {
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
    if (s.primitive != null) setPrimitive(s.primitive)
    if (s.arrangement != null) setArrangement(s.arrangement)
    if (s.count != null) setCount(s.count)
    if (s.spread != null) setSpread(s.spread)
    if (s.objectSize != null) setObjectSize(s.objectSize)
    if (s.stagger != null) setStagger(s.stagger)
    if (s.tube != null) setTube(s.tube)
    if (s.pKnot != null) setPKnot(s.pKnot)
    if (s.qKnot != null) setQKnot(s.qKnot)
    if (s.detail != null) setDetail(s.detail)
    if (s.animMode != null) setAnimMode(s.animMode)
    if (s.preset != null) setPreset(s.preset)
    if (s.keyframes != null) setKeyframes(s.keyframes)
    if (s.loop != null) setLoop(s.loop)
    if (s.duration != null) setDuration(s.duration)
    if (s.materialType != null) setMaterialType(s.materialType)
    if (s.environment != null) setEnvironment(s.environment)
    if (s.color != null) setColor(s.color)
    if (s.flatShading != null) setFlatShading(s.flatShading)
    if (s.roughness != null) setRoughness(s.roughness)
    if (s.metalness != null) setMetalness(s.metalness)
    if (s.rounding != null) setRounding(s.rounding)
    if (s.wireframe != null) setWireframe(s.wireframe)
    if (s.strokeWidth != null) setStrokeWidth(s.strokeWidth)
    if (s.cameraMotion != null) setCameraMotion(s.cameraMotion)
    if (s.orbitSpeed != null) setOrbitSpeed(s.orbitSpeed)
    if (s.fov != null) setFov(s.fov)
    if (s.showAxis != null) setShowAxis(s.showAxis)
    if (s.axisLength != null) setAxisLength(s.axisLength)
    if (s.axisOpacity != null) setAxisOpacity(s.axisOpacity)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  // ── Keyframe ops (track stays sorted by t; pose edits patch the selected kf) ──
  const selectKf = (i) => { setSelKf(i); setPlaying(false); engineRef.current?.seek(keyframes[i].t) }
  const patchKf = (patch) => setKeyframes((ks) => ks.map((k, i) => (i === selKf ? { ...k, ...patch } : k)))
  const addKf = () => {
    const { t = 0, dur = 1 } = progressRef.current || {}
    const u = dur > 0 ? Math.max(0, Math.min(1, t / dur)) : 0
    const base = keyframes[selKf] || keyframes[0] || { rot: [0, 0, 0], pos: [0, 0, 0], scale: 1, ease: 'inout' }
    const nk = { t: u, rot: [...(base.rot || [0, 0, 0])], pos: [...(base.pos || [0, 0, 0])], scale: base.scale ?? 1, ease: base.ease || 'inout' }
    const next = [...keyframes, nk].sort((a, b) => a.t - b.t)
    setKeyframes(next)
    setSelKf(next.indexOf(nk))
  }
  const delKf = () => {
    if (keyframes.length <= 1) return
    setKeyframes((ks) => ks.filter((_, i) => i !== selKf))
    setSelKf((s) => Math.max(0, s - 1))
  }

  // ── Audio source ──
  const pickMic = async () => { try { await audio.startMic(); setAudioSource('mic'); setAudioReactive(true) } catch { /* permission denied */ } }
  const pickFile = () => audioFileRef.current?.click()
  const onAudioFile = (e) => { const f = e.target.files?.[0]; if (f) { audio.loadFile(f); setAudioSource('file'); setAudioReactive(true) } }
  const audioOff = () => { audio.stop(); setAudioSource('off') }

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
  const tag = animMode === 'keyframe' ? 'keys' : preset
  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await engineRef.current?.exportBlobAt(d.w, d.h) : await engineRef.current?.exportBlob()
    download(blob, `kol-3d-scene-${primitive}-${tag}.png`)
  }
  const exportVideo = async () => {
    if (recording) return
    setRecording(true)
    try {
      const d = dimsFor(aspect, 1) // realtime encode → @1x for reliability
      download(await engineRef.current?.recordLoop(d?.w, d?.h, 30), `kol-3d-scene-${primitive}-${tag}.webm`)
    } finally {
      setRecording(false)
    }
  }

  const primLabel = PRIMITIVES.find((p) => p.id === primitive)?.label
  const subLabel = animMode === 'keyframe' ? `${keyframes.length} keyframes` : PRESETS.find((p) => p.id === preset)?.label
  const shape = SHAPE_PARAM[primitive]

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="block max-w-full max-h-full" />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{primLabel}{count > 1 ? ` ×${count}` : ''}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{subLabel}</div>
        </div>
        <Scrubber
          progressRef={progressRef}
          playerRef={engineRef}
          marks={animMode === 'keyframe' ? keyframes.map((k) => k.t) : []}
        />
      </div>

      <EditorRail>
        <RailHeader>Primitive Scene</RailHeader>

        <SegmentedToggle
          value={panel}
          onChange={setPanel}
          options={[
            { value: 'scene', label: 'Scene' },
            { value: 'style', label: 'Style' },
            { value: 'anim', label: 'Anim' },
            { value: 'camera', label: 'Camera' },
            { value: 'view', label: 'View' },
          ]}
        />

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
          {panel === 'scene' && (
            <>
              <SettingsPanel
                page="primitive"
                theme={themeId}
                onTheme={setThemeId}
                invert={invert}
                onInvert={setInvert}
                onRandomize={randomize}
                seed={seed}
                onSeed={reseed}
                getSettings={getSettings}
                applySettings={applySettings}
                label="Generate"
              />

              <Section label="Primitive">
                <div className="flex flex-col gap-1">
                  {PRIMITIVES.map((p) => (
                    <Button key={p.id} variant="secondary" size="sm" selected={p.id === primitive} onClick={() => setPrimitive(p.id)} className="w-full" style={{ justifyContent: 'flex-start' }}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </Section>

              {shape && (
                <Section label="Shape">
                  {shape === 'tube' && <Slider label="Tube" min={0.1} max={0.45} step={0.01} value={tube} onChange={setTube} variant="default" />}
                  {shape === 'pq' && (
                    <>
                      <Slider label="P winds" min={1} max={5} step={1} value={pKnot} onChange={(v) => setPKnot(roundIfNum(v))} variant="default" />
                      <Slider label="Q winds" min={1} max={5} step={1} value={qKnot} onChange={(v) => setQKnot(roundIfNum(v))} variant="default" />
                    </>
                  )}
                  {shape === 'detail' && <Slider label="Detail" min={0} max={3} step={1} value={detail} onChange={(v) => setDetail(roundIfNum(v))} variant="default" />}
                </Section>
              )}

              <Section label="Composition">
                <LabeledControl inline label="arrange">
                  <Dropdown size="sm" variant="subtle" className="w-full" options={ARRANGEMENTS} value={arrangement} onChange={setArrangement} />
                </LabeledControl>
                <Slider label="Count" min={1} max={24} step={1} value={count} onChange={(v) => setCount(roundIfNum(v))} variant="default" />
                <Slider label="Spread" min={0.5} max={5} step={0.1} value={spread} onChange={setSpread} variant="default" />
                <Slider label="Object size" min={0.2} max={1.5} step={0.05} value={objectSize} onChange={setObjectSize} variant="default" />
                <Slider label="Stagger" min={0} max={1} step={0.05} value={stagger} onChange={setStagger} variant="default" />
              </Section>
            </>
          )}

          {panel === 'style' && (
            <>
              <Section label="Material">
                <LabeledControl inline label="type">
                  <Dropdown size="sm" variant="subtle" className="w-full" options={MATERIAL_TYPES} value={materialType} onChange={setMaterialType} />
                </LabeledControl>
                <LabeledControl inline label="Color">
                  <ColorField value={color} onChange={setColor} />
                </LabeledControl>
                <ToggleSwitch variant="plain" label="Flat shading" checked={flatShading} onChange={setFlatShading} />
                <ToggleSwitch variant="plain" label="Environment" checked={environment} onChange={setEnvironment} />
                <Slider label="Roughness" min={0} max={1} step={0.02} value={roughness} onChange={setRoughness} variant="default" />
                <Slider label="Metalness" min={0} max={1} step={0.02} value={metalness} onChange={setMetalness} variant="default" />
                {primitive === 'box' && <Slider label="Rounding" min={0} max={0.7} step={0.02} value={rounding} onChange={setRounding} variant="default" />}
              </Section>

              <Section label="Wireframe">
                <ToggleSwitch variant="plain" label="Wireframe" checked={wireframe} onChange={setWireframe} />
                {wireframe && <Slider label="Stroke" min={1} max={10} step={0.5} value={strokeWidth} onChange={setStrokeWidth} variant="default" />}
              </Section>
            </>
          )}

          {panel === 'anim' && (
            <>
              <Section label="Animation">
                <SegmentedToggle value={animMode} onChange={setAnimMode} options={[{ value: 'preset', label: 'Preset' }, { value: 'keyframe', label: 'Keyframe' }]} />
                {animMode === 'preset' && (
                  <div className="flex flex-col gap-1">
                    {PRESETS.map((p) => (
                      <Button key={p.id} variant="secondary" size="sm" selected={p.id === preset} onClick={() => setPreset(p.id)} className="w-full" style={{ justifyContent: 'flex-start' }}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                )}
                <ToggleSwitch variant="plain" label="Loop animation" checked={loop} onChange={setLoop} />
                <Slider label="Duration (s)" min={1} max={20} step={0.5} value={duration} onChange={setDuration} variant="default" />
              </Section>

              {animMode === 'keyframe' && (
                <KeyframeEditor keyframes={keyframes} selected={selKf} onSelect={selectKf} onAdd={addKf} onDelete={delKf} onPatch={patchKf} />
              )}

              <Section label="Audio">
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" selected={audioSource === 'off'} onClick={audioOff}>Off</Button>
                  <Button variant="secondary" size="sm" className="flex-1" selected={audioSource === 'mic'} onClick={pickMic}>Mic</Button>
                  <Button variant="secondary" size="sm" className="flex-1" selected={audioSource === 'file'} onClick={pickFile}>File</Button>
                </div>
                <input ref={audioFileRef} type="file" accept="audio/*" hidden onChange={onAudioFile} />
                <ToggleSwitch variant="plain" label="Audio reactive" checked={audioReactive} onChange={setAudioReactive} />
                {audioReactive && <Slider label="Amount" min={0} max={4} step={0.1} value={audioAmount} onChange={setAudioAmount} variant="default" />}
              </Section>
            </>
          )}

          {panel === 'camera' && (
            <>
              <Section label="Camera">
                <ToggleSwitch variant="plain" label="Camera orbit" checked={cameraMotion} onChange={setCameraMotion} />
                {cameraMotion && <Slider label="Orbit speed" min={0} max={4} step={0.1} value={orbitSpeed} onChange={setOrbitSpeed} variant="default" />}
                <Slider label="Field of view" min={20} max={90} step={1} value={fov} onChange={setFov} variant="default" />
                <Button variant="primary" size="sm" onClick={() => engineRef.current?.resetCamera()}>Cam reset</Button>
              </Section>

              <Section label="Axis">
                <ToggleSwitch variant="plain" label="Show XYZ axis" checked={showAxis} onChange={setShowAxis} />
                {showAxis && (
                  <>
                    <Slider label="Axis length" min={0.5} max={4} step={0.1} value={axisLength} onChange={setAxisLength} variant="default" />
                    <Slider label="Axis opacity" min={0} max={1} step={0.05} value={axisOpacity} onChange={setAxisOpacity} variant="default" />
                  </>
                )}
              </Section>
            </>
          )}

          {panel === 'view' && (
            <>
              <ExportPanel aspect={aspect} onAspect={setAspect} aspects={VIEW_ASPECTS} scale={scale} onScale={setScale}>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportVideo} disabled={recording}>
                  {recording ? 'Recording loop…' : 'Export loop (webm)'}
                </Button>
              </ExportPanel>
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
        </div>

        <div className="border-t border-fg-08 pt-3">
          <TransportBar
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onStop={() => { setPlaying(false); engineRef.current?.seek(0) }}
            onRewind={() => engineRef.current?.seek(0)}
            tempo={tempo}
            onTempo={setTempo}
            tempoMax={300}
          />
        </div>
      </EditorRail>
    </div>
  )
}
