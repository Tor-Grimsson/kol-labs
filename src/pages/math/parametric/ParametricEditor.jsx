import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePublishReset, usePublishRetrigger } from '../../../components/framework/pageShortcuts.jsx'
import { CATEGORIES, catRoute, PARAMETRIC_PRESETS } from '../registry'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor } from '../../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import ColorField from '../../../components/color/ColorField.jsx'
// Engines
import { makeBodies, stepBodies } from '../orbits/data/sim.js'
import SpinnerEngine from '../spinner/engine.js'
import { SPINNER_PRESETS, presetById as spinnerPreset } from '../spinner/data/presets.js'
import ThreadsEngine from '../threads/engine.js'
import { THREADS_PRESETS, presetById as threadsPreset } from '../threads/data/presets.js'
import { FORM_OPTIONS } from '../threads/data/threads.js'
import ClipEditor from '../uzumaki/components/ClipEditor'
import { CLIPS, DEFAULT_CLIP } from '../uzumaki/data/clips'

// Math · Parametric — heterogeneous engines hosted in one shell, switched by the
// Preset dropdown. Curves is the rich Uzumaki ClipEditor (kept whole, the nav is
// injected into its rail). Orbits/Spinner/Threads are canvas engines hosted into
// the Generate · Style · Animation rail via a shared stage.

const ORBITS_BG = '#06070b'

// Orbits has no engine class — adapt the inline sim to the {step,draw,reset} shape.
class OrbitsEngine {
  constructor(w, h, p) { this.w = w; this.h = h; this.p = { ...p }; this.reset() }
  reset() { this.bodies = makeBodies(this.p.count, mulberry32((this.p.seed >>> 0) || 1)) }
  setParams(p) { const re = p.count !== this.p.count || p.seed !== this.p.seed; this.p = { ...p }; if (re) this.reset() }
  resize(w, h) { this.w = w; this.h = h }
  step(dt) {
    stepBodies(this.bodies, { gravity: this.p.gravity, mutual: this.p.mutual, dt: dt * 0.5 })
    stepBodies(this.bodies, { gravity: this.p.gravity, mutual: this.p.mutual, dt: dt * 0.5 })
  }
  draw(ctx) {
    const { w, h } = this
    const s = (Math.min(w, h) / 2) * 0.92
    const cx = w / 2, cy = h / 2
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = (1 - this.p.trail) * 0.4 + 0.012
    ctx.fillStyle = ORBITS_BG
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'lighter'
    for (const b of this.bodies) {
      const px = cx + b.x * s, py = cy + b.y * s
      const color = this.p.mono ? '#cfe8ff' : `hsl(${b.hue}, 90%, 66%)`
      if (this.p.glow > 0) { ctx.shadowBlur = this.p.glow; ctx.shadowColor = color }
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(px, py, 1.7, 0, Math.PI * 2); ctx.fill()
    }
    ctx.shadowBlur = 0
    ctx.globalCompositeOperation = 'source-over'
  }
}

// ── Per-engine controls (Style + Animation tab content) ──────────────────────
function OrbitsControls({ params: p, set, tab }) {
  if (tab === 'animation') return (
    <Section label="Motion">
      <Slider labeled label="Gravity" min={0.1} max={3} step={0.05} value={p.gravity} onChange={(v) => set('gravity', v)} variant="default" />
      <Slider labeled label="Trail" min={0} max={1} step={0.01} value={p.trail} onChange={(v) => set('trail', v)} variant="default" />
    </Section>
  )
  return (<>
    <Section label="Bodies">
      <Slider labeled label="Count" min={1} max={400} step={1} value={p.count} onChange={(v) => set('count', v)} variant="default" noExpr />
      <ToggleSwitch variant="plain" label="Mutual gravity" checked={p.mutual} onChange={(v) => set('mutual', v)} />
    </Section>
    <Section label="Render">
      <Slider labeled label="Glow" min={0} max={30} step={1} value={p.glow} onChange={(v) => set('glow', v)} variant="default" />
      <ToggleSwitch variant="plain" label="Mono" checked={p.mono} onChange={(v) => set('mono', v)} />
    </Section>
  </>)
}

function SpinnerControls({ params: p, set, tab }) {
  if (tab === 'animation') return (
    <Section label="Motion">
      <Slider labeled label="Drift" min={0} max={0.25} step={0.005} value={p.drift} onChange={(v) => set('drift', v)} variant="default" noExpr />
      <Slider labeled label="Speed" min={0.2} max={2.5} step={0.05} value={p.speed} onChange={(v) => set('speed', v)} variant="default" noExpr />
    </Section>
  )
  return (<>
    <Section label="Field">
      <Slider labeled label="Balls" min={3} max={28} step={1} value={p.count} onChange={(v) => set('count', v)} variant="default" noExpr />
      <Slider labeled label="Loop size" min={0.6} max={1.3} step={0.01} value={p.span} onChange={(v) => set('span', v)} variant="default" noExpr />
      <Slider labeled label="Reach" min={0.6} max={0.98} step={0.01} value={p.reach} onChange={(v) => set('reach', v)} variant="default" noExpr />
    </Section>
    <Section label="Render">
      <Slider labeled label="Persistence" min={0.9} max={1} step={0.001} value={p.persist} onChange={(v) => set('persist', v)} variant="default" noExpr />
      <Slider labeled label="Thread" min={0.5} max={5} step={0.1} value={p.weight} onChange={(v) => set('weight', v)} variant="default" noExpr />
      <Slider labeled label="Glow" min={0} max={28} step={1} value={p.glow} onChange={(v) => set('glow', v)} variant="default" noExpr />
      <Slider labeled label="Ball size" min={0} max={20} step={1} value={p.ballR} onChange={(v) => set('ballR', v)} variant="default" noExpr />
      <ToggleSwitch variant="plain" label="Heads" checked={p.heads !== false} onChange={(v) => set('heads', v)} />
      <ToggleSwitch variant="plain" label="Mono" checked={!!p.mono} onChange={(v) => set('mono', v)} />
    </Section>
    <Section label="Colour">
      <ColorField label="Background" value={p.bg} onChange={(hex) => set('bg', hex)} />
      {p.mono && <ColorField label="Thread" value={p.thread} onChange={(hex) => set('thread', hex)} />}
    </Section>
  </>)
}

function ThreadsControls({ params: p, set, tab }) {
  if (tab === 'animation') return (
    <Section label="Motion">
      <Slider labeled label="Ball speed" min={0.2} max={2.5} step={0.05} value={p.ballSpeed} onChange={(v) => set('ballSpeed', v)} variant="default" noExpr />
      <Slider labeled label="Line speed" min={0} max={1} step={0.01} value={p.lineSpeed} onChange={(v) => set('lineSpeed', v)} variant="default" noExpr />
      <Slider labeled label="Field" min={0.3} max={0.5} step={0.01} value={p.reach} onChange={(v) => set('reach', v)} variant="default" noExpr />
    </Section>
  )
  return (<>
    <Section label="Form">
      <Dropdown variant="subtle" size="sm" className="w-full" openUp options={FORM_OPTIONS} value={p.form || 'loops'} onChange={(v) => set('form', v)} />
    </Section>
    <Section label="Mill">
      <Slider labeled label="Wings" min={2} max={6} step={1} value={p.wings} onChange={(v) => set('wings', v)} variant="default" noExpr />
      <Slider labeled label="Balls / wing" min={1} max={8} step={1} value={p.perWing} onChange={(v) => set('perWing', v)} variant="default" noExpr />
      <Slider labeled label="Ball size" min={10} max={70} step={1} value={p.ballR} onChange={(v) => set('ballR', v)} variant="default" noExpr />
    </Section>
    <Section label="Lines">
      <Slider labeled label="Density" min={1} max={24} step={1} value={p.lines} onChange={(v) => set('lines', v)} variant="default" noExpr />
      <Slider labeled label="Thread" min={0.5} max={5} step={0.1} value={p.weight} onChange={(v) => set('weight', v)} variant="default" noExpr />
      <Slider labeled label="Glow" min={0} max={28} step={1} value={p.glow} onChange={(v) => set('glow', v)} variant="default" noExpr />
    </Section>
    <Section label="Render">
      <ToggleSwitch variant="plain" label="Balls" checked={p.heads !== false} onChange={(v) => set('heads', v)} />
      <ToggleSwitch variant="plain" label="Mono" checked={!!p.mono} onChange={(v) => set('mono', v)} />
    </Section>
    <Section label="Colour">
      <ColorField label="Background" value={p.bg} onChange={(hex) => set('bg', hex)} />
      {p.mono && <ColorField label="Thread" value={p.thread} onChange={(hex) => set('thread', hex)} />}
    </Section>
  </>)
}

const MODULES = {
  orbits: {
    id: 'orbits', label: 'Orbits',
    fallback: { count: 140, gravity: 0.9, mutual: false, trail: 0.86, glow: 10, mono: false, seed: 1 },
    make: (w, h, p) => new OrbitsEngine(w, h, p), rate: 0.016, accumulates: true, bg: () => ORBITS_BG,
    Controls: OrbitsControls,
    randomize: ({ set }) => set('seed', randomSeed()),
  },
  spinner: {
    id: 'spinner', label: 'Spinner',
    fallback: { ...spinnerPreset(SPINNER_PRESETS[0].id).params },
    make: (w, h, p) => new SpinnerEngine(w, h, p), rate: 1 / 180, accumulates: false, bg: (p) => p.bg,
    Controls: SpinnerControls,
    randomize: ({ replace }) => replace({ ...spinnerPreset(SPINNER_PRESETS[Math.floor(Math.random() * SPINNER_PRESETS.length)].id).params }),
  },
  threads: {
    id: 'threads', label: 'Threads',
    fallback: { ...threadsPreset(THREADS_PRESETS[0].id).params },
    make: (w, h, p) => new ThreadsEngine(w, h, p), rate: 1 / 40, accumulates: false, bg: (p) => p.bg,
    Controls: ThreadsControls,
    randomize: ({ replace }) => replace({ ...threadsPreset(THREADS_PRESETS[Math.floor(Math.random() * THREADS_PRESETS.length)].id).params }),
  },
}

// ── Canvas stage (shared by the hosted engines) ──────────────────────────────
const BASE = 1100
const EngineStage = forwardRef(function EngineStage({ mod, params, playing, tempo, aspect }, ref) {
  const canvasRef = useRef(null)
  const engRef = useRef(null)
  const paramRef = useRef(params)
  paramRef.current = params

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    cv.width = w; cv.height = h
    engRef.current = mod.make(w, h, paramRef.current)
    const ctx = cv.getContext('2d')
    if (mod.accumulates) { ctx.fillStyle = mod.bg(paramRef.current); ctx.fillRect(0, 0, w, h) }
    else engRef.current.draw(ctx)
  }, [aspect, mod])

  useEffect(() => {
    const e = engRef.current
    if (!e) return
    e.setParams(params)
    if (!playing && !mod.accumulates) e.draw(canvasRef.current.getContext('2d'))
  }, [params, playing, mod])

  useEffect(() => {
    if (!playing) return
    const cv = canvasRef.current
    const e = engRef.current
    if (!cv || !e) return
    const ctx = cv.getContext('2d')
    let alive = true
    let raf
    const loop = () => { if (!alive) return; e.step(mod.rate * (tempo / 120)); e.draw(ctx); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [playing, tempo, mod])

  useImperativeHandle(ref, () => ({
    export: () => new Promise((res) => canvasRef.current?.toBlob((b) => res(b), 'image/png')),
    reset: () => {
      const e = engRef.current
      const cv = canvasRef.current
      if (!e || !cv) return
      e.reset()
      const ctx = cv.getContext('2d')
      if (mod.accumulates) { ctx.fillStyle = mod.bg(paramRef.current); ctx.fillRect(0, 0, cv.width, cv.height) }
      else e.draw(ctx)
    },
  }), [mod])

  return <canvas data-vcap="stage" ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" style={{ background: mod.bg(params) }} />
})

// Category + Preset dropdowns — shared by the canvas host and injected into the
// ClipEditor rail for the Curves preset.
function PresetNav({ presetId, onPreset }) {
  const navigate = useNavigate()
  return (
    <Section label="Preset">
      <Dropdown size="sm" variant="subtle" className="w-full" options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value="parametric" onChange={(id) => navigate(catRoute(id))} />
      <Dropdown size="sm" variant="subtle" className="w-full" options={PARAMETRIC_PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={onPreset} />
    </Section>
  )
}

// ── Curves (the rich ClipEditor, kept whole) ─────────────────────────────────
function CurvesView({ headerSlot }) {
  const [clipId, setClipId] = useState(DEFAULT_CLIP.id)
  const [seed, setSeed] = useState(1)
  const base = CLIPS.find((c) => c.id === clipId) || DEFAULT_CLIP
  const rollFrom = (s) => { const rng = mulberry32(s); const c = CLIPS[Math.floor(rng() * CLIPS.length)]; if (c) setClipId(c.id) }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }
  // Short, clean labels from the clip id (like the Preset list — no →/notation/ratios).
  // e.g. 'looped-square' → 'Looped square', 'helix-3d' → 'Helix 3D'.
  const shapeLabel = (id) => id.replace(/-/g, ' ').replace(/(\d)d\b/g, '$1D').replace(/^./, (c) => c.toUpperCase())
  const shapePicker = (
    <Section label="Shape">
      <Dropdown size="sm" variant="subtle" className="w-full" options={CLIPS.map((c) => ({ value: c.id, label: shapeLabel(c.id) }))} value={clipId} onChange={setClipId} />
    </Section>
  )
  return (
    <ClipEditor
      baseClip={base}
      headerLabel="Math"
      headerSlot={headerSlot}
      railExtras={shapePicker}
      settingsPage="math-uzumaki"
      onRandomize={onRandomize}
      seed={seed}
      onSeed={(n) => { setSeed(n); rollFrom(n) }}
      getExtraSettings={() => ({ clipId })}
      applyExtraSettings={(st) => { if (st.clipId != null) setClipId(st.clipId) }}
    />
  )
}

// ── Canvas-engine host (Generate · Style · Animation) ────────────────────────
function CanvasHost({ mod, nav }) {
  const [params, setParams] = useState(() => ({ ...mod.fallback }))
  const [tab, setTab] = useState('style')
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const stageRef = useRef(null)
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))
  const replace = (p) => setParams(p)
  const Controls = mod.Controls

  usePublishReset(() => stageRef.current?.reset())
  usePublishRetrigger(() => mod.randomize({ set, replace, params }))

  const exportPng = async () => {
    const blob = await stageRef.current?.export()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kol-math-${mod.id}.png`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <EngineStage ref={stageRef} mod={mod} params={params} playing={playing} tempo={tempo} aspect={aspect} />
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
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); stageRef.current?.reset() },
              onRewind: () => stageRef.current?.reset(),
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={`math-${mod.id}`}
            getSettings={() => ({ params, tempo, aspect, scale })}
            applySettings={(s) => { if (s.params) setParams(s.params); if (Number.isFinite(s.tempo)) setTempo(s.tempo); if (s.aspect) setAspect(s.aspect); if (s.scale != null) setScale(s.scale) }}
          />
        }
      >
        {nav}
        {tab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => { setTempo(120); mod.randomize({ set, replace, params }) }}>Randomize all</Button>
          </Section>
        )}
        {tab === 'style' && <Controls params={params} set={set} tab="style" />}
        {tab === 'animation' && <Controls params={params} set={set} tab="animation" />}
      </EditorRail>
    </div>
  )
}

export default function ParametricEditor() {
  const [presetId, setPresetId] = useState(PARAMETRIC_PRESETS[0].id) // 'curves'
  const nav = <PresetNav presetId={presetId} onPreset={setPresetId} />
  if (presetId === 'curves') return <CurvesView key="curves" headerSlot={nav} />
  return <CanvasHost key={presetId} mod={MODULES[presetId]} nav={nav} />
}
