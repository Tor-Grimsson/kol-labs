import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FourierScope from '../fourier/FourierScope'
import ClipEditor from '../uzumaki/components/ClipEditor'
import { THEMES } from '../style/mathStyle'
import { CATEGORIES, catRoute, WAVEFORM_PRESETS } from '../registry'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import { roundIfNum } from '../../../lib/exprParam.js'
import { compileVars } from '../lib/mathfn'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Input from '../../../components/atoms/Input.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

// Math · Waveforms — Fourier epicycle synthesis on the generator archetype
// (Generate · Style · Animation). The Preset dropdown applies a curated patch
// in-rail; any edit flips it to Custom. The Frame/Form motion model is the same
// one the Scanline / Pattern pages use — Frame = the whole figure sweeps the
// artboard (Flow · Direction · Zoom · Angle); Form = the wave modulates in place
// (Speed · Stagger · Pulse · Fade · Swing). Animate is the special tool (the rich
// ClipEditor), like Expression — Expression itself is the standalone /math index.

const TAU = Math.PI * 2
// Quick-fill expressions for the function input — the wave is whatever f(t) you type.
const FUNC_EXAMPLES = [
  { value: 'sign(sin(t))', label: 'Square' },
  { value: 'mod(t/PI, 2) - 1', label: 'Sawtooth' },
  { value: '2/PI*asin(sin(t))', label: 'Triangle' },
  { value: 'sin(t)', label: 'Sine' },
  { value: 'sin(t) + 0.5*sin(3*t) + 0.25*sin(5*t)', label: 'Organ' },
  { value: 'tanh(3*sin(t))', label: 'Soft square' },
]

// Numerical Fourier synthesis: sample f(t) over one period and project onto the
// first N harmonics → epicycle terms {k, amp, phase}. amp folds in both the cos
// and sin parts (a_k, b_k) so the y-projection of the rotating-vector sum is f(t).
function termsFromFn(fn, n, rolloff = 0, samples = 512) {
  const N = Math.max(1, Math.round(n))
  if (!fn) return [{ k: 1, amp: 1, phase: 0 }]
  const a = new Array(N + 1).fill(0)
  const b = new Array(N + 1).fill(0)
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * TAU
    const v = fn(t)
    if (!Number.isFinite(v)) continue
    for (let k = 1; k <= N; k++) { a[k] += v * Math.cos(k * t); b[k] += v * Math.sin(k * t) }
  }
  const terms = []
  for (let k = 1; k <= N; k++) {
    let amp = Math.hypot(a[k], b[k]) * (2 / samples)
    if (rolloff) amp *= Math.pow(k, -rolloff)
    if (amp > 1e-3) terms.push({ k, amp, phase: Math.atan2(a[k], b[k]) })
  }
  return terms.length ? terms : [{ k: 1, amp: 1, phase: 0 }]
}

const PAN_DIRS = [
  { value: 'right', label: 'Right' }, { value: 'left', label: 'Left' },
  { value: 'up', label: 'Up' }, { value: 'down', label: 'Down' },
  { value: 'diag', label: 'Diagonal' }, { value: 'anti', label: 'Anti-Diag' },
]
const RANDOM_EXPRS = ['3*sin(6*θ)', '4*sin(24*θ/25) + 10', '3*sin(6.08*θ)', '0.5*θ', 'exp(0.15*θ)', '3 + sin(5*θ)']

// Palette = a quick-pick that seeds bg/fg (reused from the shared math themes);
// the Color swatches show the real hex and let you go custom.
const PALETTES = THEMES.map((t) => ({ value: t.id, label: t.label, bg: t.bg, fg: t.stroke }))
const palOf = (id) => PALETTES.find((p) => p.value === id) || PALETTES[0]

const WF_FALLBACK = {
  // Wave — the function is whatever f(t) you type; harmonics = synthesis depth
  func: 'sign(sin(t))', harmonics: 8, rolloff: 0, phase: 0,
  // Color (one shared foreground for all trace elements; background is the artboard)
  palette: 'amber', bg: '#0c0a06', fg: '#ffb35c',
  // Trace — three elements, each with its own weight + opacity (Opacity 0 hides; colour shared)
  circlesWeight: 1,   circlesOpacity: 0.6,
  loopWeight: 1,      loopOpacity: 0.6,
  graphWeight: 1.25,  graphOpacity: 1, graphLength: 1, graphDot: 1,
  // Transform (static placement)
  posX: 0, posY: 0, baseScale: 1,
  // Frame (camera sweep) — default = no drift, neutral framing
  flow: 0, panDir: 'right', zoom: 1, angle: 0,
  // Form (in-place wave modulation) — default = the pre-change render exactly
  speed: 0.3, stagger: 0, pulse: 0, fade: 0, swing: 0,
}

// preset id → full params; `palette` seeds bg + all three element colours unless
// the preset overrides bg.
function paramsFromPreset(id) {
  const p = WAVEFORM_PRESETS.find((x) => x.id === id)
  const d = { ...WF_FALLBACK, ...(p?.defaults || {}) }
  if (d.palette && p?.defaults?.bg == null) { const pal = palOf(d.palette); d.bg = pal.bg; d.fg = pal.fg }
  return d
}

// Motion quick-select — ported 1:1 from the Scanline / Pattern model. Frame = the
// whole figure moves (camera sweep) · Form = it modulates in place. Each preset
// patches ONLY its own axis so the two compose; editing any slider on an axis
// flips THAT selector to Custom. 'Static' is the real motion-off.
const FRAME_PRESETS = [
  { id: 'static',   label: 'Static',   params: { flow: 0 } },
  { id: 'drift',    label: 'Drift',    params: { flow: 1, panDir: 'right' } },
  { id: 'reverse',  label: 'Reverse',  params: { flow: 1, panDir: 'left' } },
  { id: 'rise',     label: 'Rise',     params: { flow: 1, panDir: 'up' } },
  { id: 'fall',     label: 'Fall',     params: { flow: 1, panDir: 'down' } },
  { id: 'diagonal', label: 'Diagonal', params: { flow: 1, panDir: 'diag' } },
  { id: 'glide',    label: 'Glide',    params: { flow: 2, panDir: 'anti' } },
  { id: 'rush',     label: 'Rush',     params: { flow: 3, panDir: 'right' } },
]
const FORM_PRESETS = [
  { id: 'static',  label: 'Static',  params: { speed: 0,    stagger: 0,    pulse: 0,   fade: 0,   swing: 0 } },
  { id: 'scroll',  label: 'Scroll',  params: { speed: 0.45, stagger: 0,    pulse: 0,   fade: 0,   swing: 0 } },
  { id: 'morph',   label: 'Morph',   params: { speed: 0.3,  stagger: 0.5,  pulse: 0,   fade: 0,   swing: 0 } },
  { id: 'sway',    label: 'Sway',    params: { speed: 0.3,  stagger: 0,    pulse: 0,   fade: 0,   swing: 30 } },
  { id: 'breathe', label: 'Breathe', params: { speed: 0.3,  stagger: 0,    pulse: 0.6, fade: 0,   swing: 0 } },
  { id: 'shimmer', label: 'Shimmer', params: { speed: 0.4,  stagger: 0,    pulse: 0,   fade: 0.7, swing: 0 } },
  { id: 'rich',    label: 'Rich',    params: { speed: 0.4,  stagger: 0.35, pulse: 0.4, fade: 0.3, swing: 18 } },
]

const rnd = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const chance = (p) => Math.random() < p
// 'custom' shows in a list only while active, so it never reads as a second 'off'.
const withCustom = (opts, val) => (val === 'custom' ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts)
const PRESET_OPTS = WAVEFORM_PRESETS.map((p) => ({ value: p.id, label: p.label }))
const presetOpts = (val) => withCustom(PRESET_OPTS, val)
const motionOpts = (presets, val) => withCustom(presets.map((p) => ({ value: p.id, label: p.label })), val)

// Category + Preset dropdowns — shared by the Fourier host and the Animate tool.
function WaveNav({ value, onPreset }) {
  const navigate = useNavigate()
  return (
    <Section label="Preset">
      <Dropdown size="sm" variant="subtle" className="w-full" options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value="waveforms" onChange={(id) => navigate(catRoute(id))} />
      <Dropdown size="sm" variant="subtle" className="w-full" options={presetOpts(value)} value={value} onChange={onPreset} />
    </Section>
  )
}

// ── Animate (the rich ClipEditor, seeded from a polar expression) ────────────
function AnimateView({ onPreset }) {
  const [expr, setExpr] = useState('3*sin(6*θ)')
  const [seed, setSeed] = useState(1)
  const baseClip = useMemo(() => ({
    id: `animate:polar:${expr}`, title: 'animate', ref: `r(θ) = ${expr}`, space: '2D',
    show: { trace: true }, style: { color: '#9ec1ff', weight: 1.6 }, modifiers: { repeat: 1, spiral: 0 },
    curve: { kind: 'polar', range: [0, 6 * TAU], r: expr },
    timeline: [
      { at: 0, draw: 0, cam: { yaw: -20, pitch: 18, zoom: 1 }, ease: 'inout' },
      { at: 6, draw: 1, cam: { yaw: 20, pitch: 12, zoom: 1 }, ease: 'inout' },
      { at: 9, draw: 1, cam: { yaw: 0, pitch: 30, zoom: 1 }, ease: 'inout' },
    ],
  }), [expr])
  const rollFrom = (s) => { const rng = mulberry32(s); setExpr(RANDOM_EXPRS[Math.floor(rng() * RANDOM_EXPRS.length)]) }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }
  return (
    <ClipEditor
      baseClip={baseClip}
      headerLabel="Math"
      headerSlot={<WaveNav value="animate" onPreset={onPreset} />}
      settingsPage="math-animate"
      onRandomize={onRandomize}
      seed={seed}
      onSeed={(n) => { setSeed(n); rollFrom(n) }}
      getExtraSettings={() => ({ expr })}
      applyExtraSettings={(st) => { if (st.expr != null) setExpr(st.expr) }}
    />
  )
}

// ── Fourier scope host (Generate · Style · Animation) ────────────────────────
function FourierHost({ presetId, setPresetId }) {
  const [params, setParams] = useState(() => paramsFromPreset(presetId))
  const [draft, setDraft] = useState(() => paramsFromPreset(presetId).func) // buffered function input
  const [tab, setTab] = useState('style')         // generate | style | animation
  const [traceElem, setTraceElem] = useState('graph') // which trace element's settings show
  const [animTab, setAnimTab] = useState('frame') // frame (whole figure) | form (in place)
  const [framePreset, setFramePreset] = useState('custom')
  const [formPreset, setFormPreset] = useState('custom')
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [resetKey, setResetKey] = useState(0)
  const [footTab, setFootTab] = useState('transport')
  const scopeRef = useRef(null)

  // The wave IS a function: compile f(t) and synthesise epicycle terms from it.
  // Recomputes only when the function / harmonics / rolloff change (a Style edit
  // doesn't touch it), so the oscillation keeps running otherwise.
  const wfFn = useMemo(() => compileVars(params.func, ['t']), [params.func])
  const terms = useMemo(() => termsFromFn(wfFn, params.harmonics, params.rolloff), [wfFn, params.harmonics, params.rolloff])

  const applyPatch = (patch) => setParams((p) => ({ ...p, ...patch }))
  // Editing any control diverges from the curated preset → flip the Preset to Custom.
  const editParam = (k, v) => { applyPatch({ [k]: v }); setPresetId('custom') }
  const pickPalette = (id) => { const p = palOf(id); applyPatch({ palette: id, bg: p.bg, fg: p.fg }); setPresetId('custom') }
  // Function input — buffered (commit on blur/Enter); examples quick-fill it.
  const commitFunc = () => { if (draft !== params.func) editParam('func', draft) }
  const loadExample = (ex) => { setDraft(ex); editParam('func', ex) }

  // Preset dropdown: a curated wave applies in-rail; Animate swaps to the tool.
  const pickPreset = (id) => {
    if (id === 'animate') { setPresetId('animate'); return }
    const next = paramsFromPreset(id)
    setParams(next); setDraft(next.func); setPresetId(id)
    setFramePreset('custom'); setFormPreset('custom'); setResetKey((k) => k + 1)
  }

  // ── Generate — randomise a section, applied over the current look ───────────
  const rollWave = () => { const ex = pick(FUNC_EXAMPLES).value; setDraft(ex); applyPatch({ func: ex, harmonics: 2 + Math.floor(Math.random() * 14), rolloff: chance(0.5) ? +rnd(0, 0.8).toFixed(2) : 0 }) }
  const rollColor = () => { const p = pick(PALETTES); applyPatch({ palette: p.value, bg: p.bg, fg: p.fg }) }
  const rollFrame = () => { setFramePreset('custom'); applyPatch({ flow: +rnd(0.5, 2.5).toFixed(2), panDir: pick(PAN_DIRS).value }) }
  const rollForm = () => {
    setFormPreset('custom')
    applyPatch({ speed: +rnd(0.15, 1).toFixed(2), stagger: chance(0.5) ? +rnd(0.2, 0.7).toFixed(2) : 0, pulse: chance(0.4) ? +rnd(0.3, 0.7).toFixed(2) : 0, swing: chance(0.4) ? Math.round(rnd(10, 45)) : 0 })
  }
  const randomize = (section) => {
    setPresetId('custom')
    if (section === 'all') { setTempo(120); rollWave(); rollColor(); rollFrame(); rollForm(); return }
    if (section === 'wave') return rollWave()
    if (section === 'color') return rollColor()
    if (section === 'frame') return rollFrame()
    if (section === 'form') return rollForm()
  }

  // ── Animation — Frame / Form preset dropdowns (apply that axis only) ─────────
  const applyFramePreset = (id) => { setFramePreset(id); const p = FRAME_PRESETS.find((x) => x.id === id); if (p) { applyPatch(p.params); setPresetId('custom') } }
  const applyFormPreset = (id) => { setFormPreset(id); const p = FORM_PRESETS.find((x) => x.id === id); if (p) { applyPatch(p.params); setPresetId('custom') } }
  const onFrameEdit = (k, v) => { applyPatch({ [k]: v }); setFramePreset('custom'); setPresetId('custom') }
  const onFormEdit = (k, v) => { applyPatch({ [k]: v }); setFormPreset('custom'); setPresetId('custom') }

  // ── Settings / export ───────────────────────────────────────────────────────
  const getSettings = () => ({ presetId, params, framePreset, formPreset, tempo, aspect, scale })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.params) { setParams(s.params); if (s.params.func) setDraft(s.params.func) }
    if (s.presetId) setPresetId(s.presetId)
    if (s.framePreset) setFramePreset(s.framePreset)
    if (s.formPreset) setFormPreset(s.formPreset)
    if (Number.isFinite(s.tempo)) setTempo(s.tempo)
    if (s.aspect) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }
  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await scopeRef.current?.exportBlobAt(d.w, d.h) : await scopeRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kol-math-${presetId}.png`; a.click()
    URL.revokeObjectURL(url)
  }

  const vstyle = { bg: params.bg, stroke: params.fg }

  return (
    <div className="math-fourier-page min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 min-w-0 p-5 flex flex-col">
        <FourierScope
          ref={scopeRef}
          terms={terms} phaseOff={params.phase}
          speed={params.speed} stagger={params.stagger} pulse={params.pulse} fade={params.fade} swing={params.swing}
          flow={params.flow} panDir={params.panDir} zoom={params.zoom} angle={params.angle}
          posX={params.posX} posY={params.posY} baseScale={params.baseScale}
          circlesWeight={params.circlesWeight} circlesOpacity={params.circlesOpacity}
          loopWeight={params.loopWeight} loopOpacity={params.loopOpacity}
          graphWeight={params.graphWeight} graphOpacity={params.graphOpacity} graphLength={params.graphLength} graphDot={params.graphDot}
          playing={playing} tempo={tempo} resetKey={resetKey} aspect={ratioFor(aspect)} vstyle={vstyle}
        />
      </div>
      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Math</RailHeader>
            <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'animation', label: 'Animation' }]} />
          </>
        }
        footer={
          <EditorFooter
            tab={footTab} onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); setResetKey((k) => k + 1) },
              onRewind: () => setResetKey((k) => k + 1),
              tempo, onTempo: setTempo, tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-fourier"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <WaveNav value={presetId} onPreset={pickPreset} />

        {tab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('wave')}>Wave</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('color')}>Colour</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('frame')}>Motion Frame</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('form')}>Motion Form</Button>
            </div>
          </Section>
        )}

        {tab === 'style' && (<>
          <Section label="Function">
            {/* f(t) over one period — the wave is whatever you type; it's synthesised
                into epicycles. Harmonics = how many terms approximate it. */}
            <Input size="sm" width="100%" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commitFunc} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
            <Dropdown size="sm" variant="subtle" className="w-full" options={FUNC_EXAMPLES} value={params.func} onChange={loadExample} placeholder="Examples…" />
            <Slider labeled label="Harmonics" min={1} max={24} step={1} value={params.harmonics} onChange={(v) => editParam('harmonics', roundIfNum(v))} variant="default" noExpr />
            {/* Rolloff = extra per-harmonic amplitude decay; higher = softer, fewer overtones read. */}
            <Slider labeled label="Rolloff" min={0} max={1.5} step={0.05} value={params.rolloff} onChange={(v) => editParam('rolloff', v)} variant="default" noExpr />
            <Slider labeled label="Phase" min={0} max={360} step={1} value={params.phase} onChange={(v) => editParam('phase', roundIfNum(v))} variant="default" noExpr />
          </Section>
          <Section label="Transform">
            <Slider labeled label="Position X" min={-1} max={1} step={0.02} center={0} value={params.posX} onChange={(v) => editParam('posX', v)} variant="default" noExpr />
            <Slider labeled label="Position Y" min={-1} max={1} step={0.02} center={0} value={params.posY} onChange={(v) => editParam('posY', v)} variant="default" noExpr />
            <Slider labeled label="Scale" min={0.3} max={2} step={0.05} value={params.baseScale} onChange={(v) => editParam('baseScale', v)} variant="default" noExpr />
          </Section>
          <Section label="Trace">
            {/* Pick an element, edit ITS settings — each owns its weight + opacity
                (Opacity 0 hides it). Circles = epicycle circles · Loop = the radii/vector
                chain · Graph = the waveform trace. */}
            <SegmentedToggle value={traceElem} onChange={setTraceElem} className="w-full" options={[{ value: 'circles', label: 'Circles' }, { value: 'loop', label: 'Loop' }, { value: 'graph', label: 'Graph' }]} />
            {traceElem === 'circles' && (<>
              <Slider labeled label="Weight" min={0.25} max={12} step={0.05} value={params.circlesWeight} onChange={(v) => editParam('circlesWeight', v)} variant="default" noExpr />
              <Slider labeled label="Opacity" min={0} max={1} step={0.05} value={params.circlesOpacity} onChange={(v) => editParam('circlesOpacity', v)} variant="default" noExpr />
            </>)}
            {traceElem === 'loop' && (<>
              <Slider labeled label="Weight" min={0.25} max={12} step={0.05} value={params.loopWeight} onChange={(v) => editParam('loopWeight', v)} variant="default" noExpr />
              <Slider labeled label="Opacity" min={0} max={1} step={0.05} value={params.loopOpacity} onChange={(v) => editParam('loopOpacity', v)} variant="default" noExpr />
            </>)}
            {traceElem === 'graph' && (<>
              <Slider labeled label="Weight" min={0.5} max={12} step={0.05} value={params.graphWeight} onChange={(v) => editParam('graphWeight', v)} variant="default" noExpr />
              <Slider labeled label="Opacity" min={0} max={1} step={0.05} value={params.graphOpacity} onChange={(v) => editParam('graphOpacity', v)} variant="default" noExpr />
              <Slider labeled label="Length" min={0.05} max={1} step={0.05} value={params.graphLength} onChange={(v) => editParam('graphLength', v)} variant="default" noExpr />
              <Slider labeled label="Dot size" min={0} max={4} step={0.1} value={params.graphDot} onChange={(v) => editParam('graphDot', v)} variant="default" noExpr />
            </>)}
          </Section>
          <Section label="Color">
            <Dropdown size="sm" variant="subtle" className="w-full" options={PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={params.palette} onChange={pickPalette} />
            <ColorField label="Background" value={params.bg} onChange={(v) => editParam('bg', v)} />
            <ColorField label="Foreground" value={params.fg} onChange={(v) => editParam('fg', v)} />
          </Section>
        </>)}

        {tab === 'animation' && (<>
          {/* Quick-select the Frame + Form motion presets; the toggle + sliders below
              are the deep settings (mirrors Scanline / Pattern). */}
          <Section label="Motion">
            <LabeledControl inline label="Frame">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FRAME_PRESETS, framePreset)} value={framePreset} onChange={applyFramePreset} />
            </LabeledControl>
            <LabeledControl inline label="Form">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FORM_PRESETS, formPreset)} value={formPreset} onChange={applyFormPreset} />
            </LabeledControl>
          </Section>
          {/* Frame = the whole figure sweeps the artboard · Form = the wave modulates in place. */}
          <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
          {animTab === 'frame' && (
            <Section label="Frame">
              {/* Flow drifts the whole figure across the frame (0 = frozen); Direction is
                  the drift heading; Zoom + Angle frame it. */}
              <Slider labeled label="Flow" min={0} max={3} step={0.05} value={params.flow} onChange={(v) => onFrameEdit('flow', v)} variant="default" noExpr />
              <LabeledControl inline label="Direction">
                <Dropdown variant="subtle" size="sm" className="w-full" options={PAN_DIRS} value={params.panDir} onChange={(v) => onFrameEdit('panDir', v)} />
              </LabeledControl>
              <Slider labeled label="Zoom" min={0.3} max={3} step={0.05} value={params.zoom} onChange={(v) => onFrameEdit('zoom', v)} variant="default" noExpr />
              <Slider labeled label="Angle" min={0} max={360} step={1} value={params.angle} onChange={(v) => onFrameEdit('angle', roundIfNum(v))} variant="default" noExpr />
            </Section>
          )}
          {animTab === 'form' && (
            <Section label="Form">
              {/* Speed = epicycle rotation / scroll rate · Stagger = per-harmonic phase
                  wobble (the waveform morphs) · Pulse = amplitude breathe · Fade = trace
                  opacity breathe · Swing = global phase sway (side to side). */}
              <Slider labeled label="Speed" min={0} max={2} step={0.05} value={params.speed} onChange={(v) => onFormEdit('speed', v)} variant="default" noExpr />
              <Slider labeled label="Stagger" min={0} max={1} step={0.05} value={params.stagger} onChange={(v) => onFormEdit('stagger', v)} variant="default" noExpr />
              <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={params.pulse} onChange={(v) => onFormEdit('pulse', v)} variant="default" noExpr />
              <Slider labeled label="Fade" min={0} max={1} step={0.05} value={params.fade} onChange={(v) => onFormEdit('fade', v)} variant="default" noExpr />
              <Slider labeled label="Swing" min={0} max={90} step={1} value={params.swing} onChange={(v) => onFormEdit('swing', roundIfNum(v))} variant="default" noExpr />
            </Section>
          )}
        </>)}
      </EditorRail>
    </div>
  )
}

export default function WaveformsEditor() {
  const [presetId, setPresetId] = useState(WAVEFORM_PRESETS[0].id) // 'epicycle'
  if (presetId === 'animate') return <AnimateView key="animate" onPreset={setPresetId} />
  return <FourierHost key="fourier" presetId={presetId} setPresetId={setPresetId} />
}
