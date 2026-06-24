import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePublishReset, usePublishRetrigger, usePublishShortcuts } from '../../components/framework/pageShortcuts.jsx'
import LoopPlayer2D from '../../loops/LoopPlayer2D.js'
import { presetsInGroup, presetById, loopById, presetParams, groupById, GROUPS } from '../../loops/registry.js'
import { VP_DEFAULTS, VP_KEYS } from '../../loops/viewport.js'
import { randomizeSection } from '../../loops/pattern/randomize.js'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import LoopControls from './LoopControls.jsx'
import ColorControls from './ColorControls.jsx'
import PatternControls from './PatternControls.jsx'
import Button from '../../components/atoms/Button.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Scrubber from '../../components/framework/Scrubber.jsx'
import { LiveClock } from '../../lib/liveClock.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import SettingsPanel from '../../components/framework/SettingsPanel.jsx'
import { defaultTheme, defaultAutoplay } from '../../lib/appSettings.js'
import { mulberry32, randomSeed, randomizeSchema } from '../../lib/rng.js'
import { isExpr, roundIfNum } from '../../lib/exprParam.js'
import { themeParams } from '../../loops/theme.js'

// The loop-library shell, parameterised by GROUP. /loops mounts one of these per
// routed subpage (Simple · Pattern · Field). The rail's **Presets** tab picks a
// preset from this group's catalog (sub-grouped). The editor tabs differ by loop
// type so no panel is one giant scroll: shape = Edit; field = Edit + Camera;
// pattern = Pattern (shape/grid/colour/rules) + Animation (camera + sweep).
// Loads paused (no autoplay).

const rnd = (a, b) => a + Math.random() * (b - a)
const rint = (a, b) => Math.round(rnd(a, b))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const chance = (p) => Math.random() < p

// Viewport-camera motion presets (the non-pattern Animation axes). Frame = the whole
// loop moves (spin/zoom); Form = it modulates in place (pulse/wobble). Each patches
// only its axis; 'static' is the real off. Pattern loops use PatternControls instead.
const FRAME_PRESETS = [
  { id: 'static', label: 'Static',  params: { vpSpin: 0, vpZoom: 1 } },
  { id: 'spin',   label: 'Spin',    params: { vpSpin: 1, vpZoom: 1 } },
  { id: 'spin2',  label: 'Spin ×2', params: { vpSpin: 2, vpZoom: 1 } },
  { id: 'push',   label: 'Push in', params: { vpSpin: 0, vpZoom: 1.3 } },
]
const FORM_PRESETS = [
  { id: 'static',  label: 'Static',  params: { vpPulse: 0, vpWobble: 0 } },
  { id: 'pulse',   label: 'Pulse',   params: { vpPulse: 0.3, vpWobble: 0 } },
  { id: 'wobble',  label: 'Wobble',  params: { vpPulse: 0, vpWobble: 8 } },
  { id: 'breathe', label: 'Breathe', params: { vpPulse: 0.22, vpWobble: 5 } },
]

export default function LoopsShell({ group }) {
  const presets = useMemo(() => presetsInGroup(group), [group])
  const railLabel = groupById(group).label

  const [presetId, setPresetId] = useState(presets[0].id)
  const activePreset = presetById(presetId)
  const activeLoop = loopById(activePreset.loop)

  const [params, setParams] = useState(() => ({ ...VP_DEFAULTS, ...presetParams(activePreset) }))
  const [tab, setTab] = useState('style') // generate | style | animation
  const [animTab, setAnimTab] = useState('frame') // frame (whole loop) | form (in place)
  const [framePreset, setFramePreset] = useState('custom')
  const [formPreset, setFormPreset] = useState('custom')
  const navigate = useNavigate()
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [recording, setRecording] = useState(false)
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [footTab, setFootTab] = useState('transport') // Transport | Output — pinned footer, matches interfaces/penrose

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const playerRef = useRef(null)
  const progressRef = useRef({ t: 0, dur: 1 })
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect
  const presetIdRef = useRef(presetId)

  const sizeCanvas = useCallback(() => {
    const el = wrapRef.current
    const cv = canvasRef.current
    const player = playerRef.current
    if (!el || !cv || !player) return
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
    player.resize(w, h)
  }, [])

  // Player created once; loop swaps via setLoop.
  useEffect(() => {
    const startPreset = presetById(presetIdRef.current)
    const startLoop = loopById(startPreset.loop)
    const player = new LoopPlayer2D(canvasRef.current, startLoop, presetParams(startPreset))
    player.onProgress = (p) => { progressRef.current = p }
    playerRef.current = player
    sizeCanvas()
    const ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(wrapRef.current)
    return () => {
      ro.disconnect()
      player.dispose()
      playerRef.current = null
    }
  }, [sizeCanvas])

  // Selected preset change → swap loop + load the preset's params, but CARRY OVER
  // any param the user has expression-bound (their live animation) for keys the
  // new preset still has. Picking a preset shouldn't null the rig you built.
  useEffect(() => {
    presetIdRef.current = presetId
    const preset = presetById(presetId)
    const loop = loopById(preset.loop)
    const def = { ...VP_DEFAULTS, ...presetParams(preset) }
    setParams((prev) => {
      const next = { ...def }
      // Carry over expr-bound params (the user's live animation) + the viewport
      // camera (a viewport setting, independent of which preset is loaded).
      for (const k of Object.keys(prev)) {
        if (VP_KEYS.includes(k)) next[k] = prev[k]
        else if (isExpr(prev[k]) && k in def) next[k] = prev[k]
      }
      playerRef.current?.setLoop(loop, next)
      return next
    })
  }, [presetId])

  useEffect(() => { sizeCanvas() }, [aspect, sizeCanvas])
  useEffect(() => { playerRef.current?.setParams(params) }, [params])
  useEffect(() => { playerRef.current?.setTransport({ paused: !playing, speed: tempo / 120 }) }, [playing, tempo])

  // Theme → recolour the loop's role-tagged colour params. Keyed on the loop too
  // so switching preset re-applies the active theme on top of the preset's reset
  // (the preset-change effect above runs first; this overrides the colours). The
  // functional updater reads the freshest params, so user colour edits made after
  // the last theme apply are only overwritten when theme/invert/loop change.
  useEffect(() => {
    setParams((p) => themeParams(p, activeLoop.params, themeId, invert))
  }, [themeId, invert, presetId, activeLoop])

  const updateParam = (k, v) => setParams((p) => ({ ...p, [k]: v }))
  const pickPreset = (id) => setPresetId(id) // stay on the Presets tab; Edit is opt-in
  usePublishReset(() => pickPreset(presets[0].id))

  // ── Scene settings (theme · invert · randomise · export/import) ──
  // Merge rolled values over current params, but NEVER overwrite a param the user
  // has expression-bound — that's their live animation, random shouldn't reset it.
  // (Also skips structural noRandom params via the schema; keeps rules + untouched.)
  const mergeRoll = (prev, schema, rng) => {
    const rolled = randomizeSchema(schema, rng)
    for (const k of Object.keys(rolled)) if (isExpr(prev[k])) delete rolled[k]
    return { ...prev, ...rolled }
  }
  const rollWith = (n) => {
    const rng = mulberry32(n >>> 0)
    setParams((p) => mergeRoll(p, activeLoop.params, rng))
  }
  const onRandomize = () => { const n = randomSeed(); setSeed(n); rollWith(n) }
  usePublishRetrigger(onRandomize)

  // Edit-tab Randomise: rerolls only the shape's transform (range/toggle) params,
  // leaving the chosen colours intact (the Scene tab's Randomise rolls everything).
  const rollTransform = () => {
    const rng = mulberry32(randomSeed() >>> 0)
    const transform = activeLoop.params.filter((p) => p.type !== 'color' && p.tab !== 'color')
    setParams((p) => mergeRoll(p, transform, rng))
  }
  usePublishShortcuts(railLabel, [['space', 'play / pause'], ['drag timeline', 'scrub'], ['r', 'reset'], ['shift+r', 'reroll']])

  const isPattern = activeLoop.controls === 'pattern'

  // Category dropdown = the 3 loop categories; switching navigates (the shell
  // remounts for that category). Presets pick in-rail (setPresetId).
  const onCat = (id) => navigate(groupById(id).route)

  // ── Generate: section randomizers (stay in the current loop ⇒ in-category) ──
  const rollColors = () => {
    const rng = mulberry32(randomSeed() >>> 0)
    setParams((p) => mergeRoll(p, activeLoop.params.filter((x) => x.type === 'color'), rng))
  }
  const rollMotionFrame = () => {
    setFramePreset('custom')
    if (isPattern) return setParams((p) => ({ ...p, ...randomizeSection(p, 'frame') }))
    setParams((p) => ({ ...p, vpSpin: pick([0, 0, 1, 2]), vpZoom: +rnd(1, 1.4).toFixed(2) }))
  }
  const rollMotionForm = () => {
    setFormPreset('custom')
    if (isPattern) return setParams((p) => ({ ...p, ...randomizeSection(p, 'motion') }))
    setParams((p) => ({ ...p, vpPulse: chance(0.5) ? 0 : +rnd(0.1, 0.4).toFixed(2), vpWobble: chance(0.5) ? 0 : rint(3, 12) }))
  }
  const randomize = (section) => {
    if (section === 'all') { setTempo(120); onRandomize(); return }
    if (section === 'shape') return rollTransform()
    if (section === 'color') return rollColors()
    if (section === 'frame') return rollMotionFrame()
    if (section === 'form') return rollMotionForm()
  }

  // ── Animation: viewport-camera Frame/Form preset dropdowns (non-pattern) ──
  const applyFramePreset = (id) => { setFramePreset(id); const p = FRAME_PRESETS.find((x) => x.id === id); if (p) setParams((v) => ({ ...v, ...p.params })) }
  const applyFormPreset = (id) => { setFormPreset(id); const p = FORM_PRESETS.find((x) => x.id === id); if (p) setParams((v) => ({ ...v, ...p.params })) }
  const onFrameEdit = (k, v) => { updateParam(k, v); setFramePreset('custom') }
  const onFormEdit = (k, v) => { updateParam(k, v); setFormPreset('custom') }
  const motionOpts = (presets, val) => {
    const opts = presets.map((p) => ({ value: p.id, label: p.label }))
    return (val == null || val === 'custom') ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
  }

  const getSettings = () => ({ presetId, params, themeId, invert, seed, tempo, aspect, scale })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.presetId) setPresetId(s.presetId)
    if (s.themeId) setThemeId(s.themeId)
    if (typeof s.invert === 'boolean') setInvert(s.invert)
    if (Number.isFinite(s.seed)) setSeed(s.seed)
    if (Number.isFinite(s.tempo)) setTempo(s.tempo)
    if (s.aspect) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    // Params last so it isn't clobbered by the preset-change effect's reset
    // (presetId change schedules setParams(def); this overrides it on the next tick).
    if (s.params) setTimeout(() => setParams(s.params), 0)
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
    const blob = d ? await playerRef.current?.exportBlobAt(d.w, d.h) : await playerRef.current?.exportBlob()
    download(blob, `kol-loop-${activePreset.id}.png`)
  }
  const exportVideo = async () => {
    if (recording) return
    setRecording(true)
    try {
      const d = dimsFor(aspect, 1)
      download(await playerRef.current?.recordLoop(d?.w, d?.h, 30), `kol-loop-${activePreset.id}.webm`)
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} data-vcap="stage" className="block max-w-full max-h-full" />
        <Scrubber progressRef={progressRef} playerRef={playerRef} />
      </div>

      <LiveClock getT={() => progressRef.current.t}>
      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>{railLabel}</RailHeader>
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
              onStop: () => { setPlaying(false); playerRef.current?.seek(0) },
              onRewind: () => playerRef.current?.seek(0),
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
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
            settingsPage="loops"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" options={GROUPS.map((g) => ({ value: g.id, label: g.label }))} value={group} onChange={onCat} variant="subtle" className="w-full" />
          <Dropdown size="sm" options={presets.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={pickPreset} variant="subtle" className="w-full" />
        </Section>

        {tab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('shape')}>{isPattern ? 'Pattern' : 'Shape'}</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('color')}>Colour</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('frame')}>Motion Frame</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('form')}>Motion Form</Button>
            </div>
          </Section>
        )}

        {tab === 'style' && (<>
          {!isPattern && <ColorControls schema={activeLoop.params} values={params} onChange={updateParam} />}
          {!isPattern && <LoopControls schema={activeLoop.params} values={params} onChange={updateParam} />}
          {isPattern && <PatternControls values={params} onChange={updateParam} tab="pattern" />}
          <SettingsPanel
            page="loops"
            showIO={false}
            theme={themeId}
            onTheme={setThemeId}
            invert={invert}
            onInvert={setInvert}
            onRandomize={onRandomize}
            seed={seed}
            onSeed={(n) => { setSeed(n); rollWith(n) }}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        </>)}

        {tab === 'animation' && (isPattern ? (
          <PatternControls values={params} onChange={updateParam} tab="animation" />
        ) : (<>
          {/* Quick-select the viewport-camera Frame + Form presets. */}
          <Section label="Motion">
            <LabeledControl inline label="Frame">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FRAME_PRESETS, framePreset)} value={framePreset} onChange={applyFramePreset} />
            </LabeledControl>
            <LabeledControl inline label="Form">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FORM_PRESETS, formPreset)} value={formPreset} onChange={applyFormPreset} />
            </LabeledControl>
          </Section>
          {/* Frame = the whole loop moves (spin/zoom) · Form = it modulates in place. */}
          <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
          {animTab === 'frame' && (
            <Section label="Frame">
              <Slider labeled label="Spin" min={0} max={4} step={1} value={params.vpSpin ?? 0} onChange={(v) => onFrameEdit('vpSpin', roundIfNum(v))} variant="default" />
              <Slider labeled label="Zoom" min={1} max={2.5} step={0.05} value={params.vpZoom ?? 1} onChange={(v) => onFrameEdit('vpZoom', v)} variant="default" />
            </Section>
          )}
          {animTab === 'form' && (
            <Section label="Form">
              <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={params.vpPulse ?? 0} onChange={(v) => onFormEdit('vpPulse', v)} variant="default" />
              <Slider labeled label="Wobble" min={0} max={30} step={1} value={params.vpWobble ?? 0} onChange={(v) => onFormEdit('vpWobble', roundIfNum(v))} variant="default" />
              <Slider labeled label="Rate" min={1} max={4} step={1} value={params.vpRate ?? 1} onChange={(v) => onFormEdit('vpRate', roundIfNum(v))} variant="default" />
            </Section>
          )}
          {/* Field loops carry their own camera schema — its native motion. */}
          {activeLoop.camera && <LoopControls schema={activeLoop.camera} values={params} onChange={updateParam} label="Camera" />}
        </>))}
      </EditorRail>
      </LiveClock>
    </div>
  )
}
