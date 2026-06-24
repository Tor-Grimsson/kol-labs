import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePublishReset, usePublishRetrigger, usePublishShortcuts } from '../../../components/framework/pageShortcuts.jsx'
import Viewport3D from '../components/Viewport3D'
import StylePanel from '../components/StylePanel'
import { useMathStyle, AXIS_3D, THEMES } from '../style/mathStyle'
import { compileVars } from '../lib/mathfn'
import { resolveRate } from '../../../lib/exprParam.js'
import { ATTRACTORS, DEFAULT_ATTRACTOR, integrate } from '../attractor/data/attractors'
import { surfaceRender, attractorRender } from './render'
import { CATEGORIES, categoryById, catRoute, presetsForCat } from '../registry'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Input from '../../../components/atoms/Input.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

// Math · Surfaces — one Viewport3D shell over two render KINDS (z=f(x,y) surface ·
// strange-attractor trajectory), the visualisers picked in the rail's Preset
// dropdown. Category dropdown navigates to the other math categories. Mirrors the
// Waveforms generator setup 1:1: Generate · Style · Animation, any edit flips the
// Preset to Custom, Frame/Form patch only their own axis, palette Dropdown seeds
// colour. Glow stripped (perf) — Form breathes the stroke weight instead.

const DRAW_SECONDS = 14

const SURF_EXPRS = [
  'sin(x*1.6)*cos(y*1.6)',
  'sin(hypot(x,y)*3 - t*3)',
  'cos(x)*cos(y)*exp(-(x*x+y*y)*0.08)',
  '(x*x - y*y)*0.25',
  'sin(x*y*0.6)',
]
const SURF_RAMPS = [
  { id: 'midnight', label: 'Midnight', low: '#1b2b4a', high: '#ffd23f' },
  { id: 'neon',     label: 'Neon',     low: '#1a0b2e', high: '#ff5470' },
  { id: 'forest',   label: 'Forest',   low: '#04140f', high: '#c9f29b' },
  { id: 'mono',     label: 'Mono',     low: '#0a0a0a', high: '#ededed' },
  { id: 'arctic',   label: 'Arctic',   low: '#0b1d3a', high: '#8fd3ff' },
]
const ATT_COLORS = ['#9ec1ff', '#ffd23f', '#ff5470', '#c9f29b', '#b8a6ff']

const FALLBACK = {
  kind: 'surface',
  expr: 'sin(x*1.6)*cos(y*1.6)', domain: 3.2, res: 46, height: 1, mode: 'wire', contours: false,
  low: '#1b2b4a', high: '#ffd23f',
  attractor: 'lorenz', steps: 7000, gradient: false,
  // Frame (camera): spin = yaw drift · sway = yaw rock · tilt = pitch rock · dolly = dist breathe
  spin: 6, sway: 0, tilt: 0, dolly: 0,
  // Form (in place): morph = Breathe/Pulse · ripple = travelling wave · fade = opacity · formSpeed = master
  morph: 0, ripple: 0, fade: 0, formSpeed: 1,
} // every motion default is 0/identity → static render + existing presets unchanged

// Motion quick-select (mirrors Waveforms/Pattern). Frame = the whole figure moves
// (the orbit camera sweeps); Form = the figure modulates in place. Each preset sets
// its FULL axis so the two compose and 'Static' is the real off.
const FRAME_PRESETS = [
  { id: 'static',  label: 'Static',  params: { spin: 0,   sway: 0,  tilt: 0,  dolly: 0 } },
  { id: 'orbit',   label: 'Orbit',   params: { spin: 8,   sway: 0,  tilt: 0,  dolly: 0 } },
  { id: 'spin',    label: 'Spin',    params: { spin: 20,  sway: 0,  tilt: 0,  dolly: 0 } },
  { id: 'reverse', label: 'Reverse', params: { spin: -12, sway: 0,  tilt: 0,  dolly: 0 } },
  { id: 'rock',    label: 'Rock',    params: { spin: 0,   sway: 18, tilt: 8,  dolly: 0 } },
  { id: 'survey',  label: 'Survey',  params: { spin: 5,   sway: 0,  tilt: 12, dolly: 0.12 } },
  { id: 'push',    label: 'Push',    params: { spin: 0,   sway: 0,  tilt: 0,  dolly: 0.28 } },
]
const FORM_PRESETS = [
  { id: 'static',  label: 'Static',  params: { morph: 0,    ripple: 0,   fade: 0,   formSpeed: 1 } },
  { id: 'breathe', label: 'Breathe', params: { morph: 0.25, ripple: 0,   fade: 0,   formSpeed: 1 } },
  { id: 'pulse',   label: 'Pulse',   params: { morph: 0.5,  ripple: 0,   fade: 0,   formSpeed: 1 } },
  { id: 'ripple',  label: 'Ripple',  params: { morph: 0,    ripple: 0.6, fade: 0,   formSpeed: 1 } },
  { id: 'shimmer', label: 'Shimmer', params: { morph: 0,    ripple: 0,   fade: 0.6, formSpeed: 1.4 } },
  { id: 'rich',    label: 'Rich',    params: { morph: 0.3,  ripple: 0.4, fade: 0.3, formSpeed: 1 } },
]

const rnd = (a, b) => a + Math.random() * (b - a)
const rint = (a, b) => Math.round(rnd(a, b))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const chance = (p) => Math.random() < p
// 'custom' shows in a motion list only while active, so it never reads as a 2nd 'off'.
const motionOpts = (presets, val) => {
  const opts = presets.map((p) => ({ value: p.id, label: p.label }))
  return (val == null || val === 'custom') ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
}
const presetOpts = (PRESETS, val) => {
  const opts = PRESETS.map((p) => ({ value: p.id, label: p.label }))
  return val === 'custom' ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
}

export default function SurfacesEditor() {
  const navigate = useNavigate()
  const category = categoryById('surfaces')
  const PRESETS = presetsForCat('surfaces')

  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [params, setParams] = useState(() => ({ ...FALLBACK, ...PRESETS[0].defaults }))
  const [style, patchStyle, applyTheme] = useMathStyle({ stroke: '#9ec1ff', weight: 1.1 })
  const [tab, setTab] = useState('style')        // generate | style | animation
  const [animTab, setAnimTab] = useState('frame') // frame (whole figure) | form (in place)
  const [framePreset, setFramePreset] = useState('custom')
  const [formPreset, setFormPreset] = useState('custom')
  const [draft, setDraft] = useState(FALLBACK.expr) // buffered expr input
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const viewRef = useRef(null)

  const isAttractor = params.kind === 'attractor'
  const applyPatch = (patch) => setParams((p) => ({ ...p, ...patch }))
  // Editing any control diverges from the curated preset → flip the Preset to Custom.
  const editParam = (k, v) => { applyPatch({ [k]: v }); setPresetId('custom') }
  const editStyle = (p) => { patchStyle(p); setPresetId('custom') }

  usePublishReset(() => viewRef.current?.resetCamera())
  usePublishShortcuts('Math', [['space', 'play / pause'], ['drag', 'orbit'], ['wheel', 'zoom'], ['r', 'reset camera'], ['shift+r', 'reroll']])

  // ── Preset / category ──────────────────────────────────────────────────────
  const applyPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0]
    const next = { ...FALLBACK, ...p.defaults }
    setPresetId(id)
    setParams(next)
    setDraft(next.expr)
    if (p.defaults.stroke) patchStyle({ stroke: p.defaults.stroke })
    setFramePreset('custom'); setFormPreset('custom')
    viewRef.current?.resetTime()
  }
  // Category dropdown navigates to the other math categories (presets pick in-rail).
  const pickCat = (id) => navigate(catRoute(id))
  // Palette quick-pick (mirrors Waveforms) — seeds bg/stroke/grid via the theme.
  const pickPalette = (id) => { applyTheme(id); setPresetId('custom') }
  const paletteId = THEMES.find((t) => t.bg === style.bg)?.id

  // ── Engine inputs (surface fn / attractor trajectory + camera extent) ───────
  const fn = useMemo(() => (params.kind === 'surface' ? compileVars(params.expr, ['x', 'y', 't']) : null), [params.kind, params.expr])
  const att = useMemo(() => (isAttractor ? (ATTRACTORS.find((a) => a.id === params.attractor) || DEFAULT_ATTRACTOR) : null), [isAttractor, params.attractor])
  const traj = useMemo(() => (att ? integrate(att, params.steps) : null), [att, params.steps])

  const ext = useMemo(() => {
    if (isAttractor) return traj?.ext || 1
    if (!fn) return 3.2
    const D0 = resolveRate(params.domain, 0, 3.2)
    const h0 = resolveRate(params.height, 0, 1)
    let m = 0
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      const xx = -D0 + (2 * D0 * i) / 11
      const yy = -D0 + (2 * D0 * j) / 11
      const z = fn(xx, yy, 0)
      if (Number.isFinite(z)) m = Math.max(m, Math.abs(z))
    }
    return Math.max(D0, m * h0 || D0)
  }, [isAttractor, traj, fn, params.domain, params.height])

  const render = (args) => {
    if (isAttractor) {
      attractorRender(args, {
        pts: traj?.pts, playing, weight: style.weight, stroke: style.stroke,
        gradient: params.gradient, morph: params.morph, fade: params.fade, formSpeed: params.formSpeed, drawSeconds: DRAW_SECONDS,
      })
    } else {
      surfaceRender(args, {
        fn, res: params.res, domain: params.domain, height: params.height, mode: params.mode,
        contours: params.contours, low: params.low, high: params.high,
        weight: style.weight, gridColor: style.gridColor, gridOpacity: style.gridOpacity,
        morph: params.morph, ripple: params.ripple, fade: params.fade, formSpeed: params.formSpeed,
      })
    }
  }

  // ── Generate — randomise a section, staying inside the current kind ──────────
  const rollShape = () => {
    if (isAttractor) applyPatch({ attractor: pick(ATTRACTORS).id, steps: rint(4000, 12000) })
    else { const ex = pick(SURF_EXPRS); setDraft(ex); applyPatch({ expr: ex, domain: +rnd(2, 6).toFixed(1), height: +rnd(0.4, 2.4).toFixed(1) }) }
  }
  const rollColor = () => {
    if (isAttractor) patchStyle({ stroke: pick(ATT_COLORS) })
    else { const r = pick(SURF_RAMPS); applyPatch({ low: r.low, high: r.high }) }
  }
  const rollFrame = () => { setFramePreset('custom'); applyPatch({ spin: pick([0, 8, 16, -10]), sway: chance(0.4) ? Math.round(rnd(8, 24)) : 0, tilt: chance(0.4) ? Math.round(rnd(5, 14)) : 0, dolly: chance(0.4) ? +rnd(0.1, 0.3).toFixed(2) : 0 }) }
  const rollForm = () => { setFormPreset('custom'); applyPatch({ morph: chance(0.5) ? +rnd(0.15, 0.5).toFixed(2) : 0, ripple: chance(0.4) ? +rnd(0.2, 0.7).toFixed(2) : 0, fade: chance(0.4) ? +rnd(0.2, 0.6).toFixed(2) : 0, formSpeed: +rnd(0.7, 1.6).toFixed(2) }) }
  const onRandomize = () => { setPresetId('custom'); rollShape(); rollColor(); rollFrame(); rollForm() }
  usePublishRetrigger(onRandomize)
  const randomize = (section) => {
    setPresetId('custom')
    if (section === 'all') { setTempo(120); onRandomize(); return }
    if (section === 'shape') return rollShape()
    if (section === 'color') return rollColor()
    if (section === 'frame') return rollFrame()
    if (section === 'form') return rollForm()
  }

  // ── Animation — Frame (spin) / Form (morph) presets ─────────────────────────
  const applyFramePreset = (id) => { setFramePreset(id); const p = FRAME_PRESETS.find((x) => x.id === id); if (p) { applyPatch(p.params); setPresetId('custom') } }
  const applyFormPreset = (id) => { setFormPreset(id); const p = FORM_PRESETS.find((x) => x.id === id); if (p) { applyPatch(p.params); setPresetId('custom') } }
  const onFrameEdit = (k, v) => { applyPatch({ [k]: v }); setFramePreset('custom'); setPresetId('custom') }
  const onFormEdit = (k, v) => { applyPatch({ [k]: v }); setFormPreset('custom'); setPresetId('custom') }

  // ── Settings / export ───────────────────────────────────────────────────────
  const getSettings = () => ({ presetId, params, style, tempo, aspect, scale, framePreset, formPreset })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.presetId) setPresetId(s.presetId)
    if (s.style) patchStyle(s.style)
    if (Number.isFinite(s.tempo)) setTempo(s.tempo)
    if (s.aspect) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.framePreset) setFramePreset(s.framePreset)
    if (s.formPreset) setFormPreset(s.formPreset)
    if (s.params) { setParams(s.params); if (s.params.expr) setDraft(s.params.expr) }
  }

  const commitExpr = () => { if (draft !== params.expr) editParam('expr', draft) }
  const loadExpr = (ex) => { setDraft(ex); editParam('expr', ex) }

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale))
    const blob = dd ? await viewRef.current?.exportBlobAt(dd.w, dd.h) : await viewRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-math-${presetId}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="relative min-w-0 flex-1">
        <Viewport3D
          ref={viewRef}
          render={render}
          ext={ext}
          paused={!playing}
          speed={tempo / 120}
          spin={params.spin}
          sway={params.sway}
          tilt={params.tilt}
          dolly={params.dolly}
          dur={isAttractor ? DRAW_SECONDS : null}
          aspect={ratioFor(aspect)}
          bg={style.bg}
          axis={style}
        />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{PRESETS.find((p) => p.id === presetId)?.label || 'Custom'}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>drag to orbit · wheel to zoom</div>
        </div>
      </div>

      <LiveClock getT={() => viewRef.current?.now()}>
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
              onStop: () => { setPlaying(false); viewRef.current?.resetTime() },
              onRewind: () => viewRef.current?.resetTime(),
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-surfaces"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={category.id} onChange={pickCat} />
          <Dropdown size="sm" variant="subtle" className="w-full" options={presetOpts(PRESETS, presetId)} value={presetId} onChange={applyPreset} />
        </Section>

        {tab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('shape')}>Shape</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('color')}>Colour</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('frame')}>Motion Frame</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('form')}>Motion Form</Button>
            </div>
          </Section>
        )}

        {tab === 'style' && (<>
          {!isAttractor && (<>
            <Section label="z = f(x, y, t)">
              <Input size="sm" width="100%" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commitExpr} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
              <Dropdown size="sm" variant="subtle" className="w-full" options={SURF_EXPRS.map((ex) => ({ value: ex, label: ex }))} value={params.expr} onChange={loadExpr} placeholder="Examples…" />
            </Section>
            <Section label="Mesh">
              <Slider labeled label="Domain" min={1} max={8} step={0.2} value={params.domain} onChange={(v) => editParam('domain', v)} variant="default" />
              <Slider labeled label="Resolution" min={12} max={80} step={2} value={params.res} onChange={(v) => editParam('res', v)} variant="default" noExpr />
              <Slider labeled label="Height" min={0.1} max={4} step={0.1} value={params.height} onChange={(v) => editParam('height', v)} variant="default" />
            </Section>
            <Section label="Render">
              <SegmentedToggle value={params.mode} onChange={(v) => editParam('mode', v)} options={[{ value: 'wire', label: 'Wire' }, { value: 'fill', label: 'Filled' }]} />
              <ToggleSwitch variant="plain" label="Contours" checked={params.contours} onChange={(v) => editParam('contours', v)} />
            </Section>
          </>)}

          {isAttractor && (<>
            <Section label="Attractor">
              <Dropdown size="sm" variant="subtle" className="w-full" options={ATTRACTORS.map((a) => ({ value: a.id, label: a.label }))} value={params.attractor} onChange={(v) => editParam('attractor', v)} />
            </Section>
            <Section label="Trajectory">
              <Slider labeled label="Points" min={1000} max={20000} step={500} value={params.steps} onChange={(v) => editParam('steps', v)} variant="default" noExpr />
              <ToggleSwitch variant="plain" label="Gradient" checked={params.gradient} onChange={(v) => editParam('gradient', v)} />
            </Section>
          </>)}

          <StylePanel style={style} onPatch={editStyle} axisOptions={AXIS_3D} showBg={false} showStroke={false} showTheme={false} showGridColor={false} />

          {!isAttractor && (
            <Section label="Color">
              <div className="flex gap-2">
                <Dropdown size="sm" variant="subtle" className="flex-1 min-w-0" options={THEMES.map((t) => ({ value: t.id, label: t.label }))} value={paletteId} onChange={pickPalette} placeholder="Palette…" />
                <Dropdown size="sm" variant="subtle" className="flex-1 min-w-0" options={SURF_RAMPS.map((r) => ({ value: r.id, label: r.label }))} value={SURF_RAMPS.find((r) => r.low === params.low && r.high === params.high)?.id ?? null} placeholder="Gradient…" onChange={(id) => { const r = SURF_RAMPS.find((x) => x.id === id); if (r) { applyPatch({ low: r.low, high: r.high }); setPresetId('custom') } }} />
              </div>
              <ColorField label="Background" value={style.bg} onChange={(v) => editStyle({ bg: v })} />
              <ColorField label="Low" value={params.low} onChange={(v) => editParam('low', v)} />
              <ColorField label="High" value={params.high} onChange={(v) => editParam('high', v)} />
              {style.axis !== 'none' && <ColorField label="Grid color" value={style.gridColor} onChange={(v) => editStyle({ gridColor: v })} />}
            </Section>
          )}
          {isAttractor && (
            <Section label="Color">
              <Dropdown size="sm" variant="subtle" className="w-full" options={THEMES.map((t) => ({ value: t.id, label: t.label }))} value={paletteId} onChange={pickPalette} placeholder="Palette…" />
              <ColorField label="Background" value={style.bg} onChange={(v) => editStyle({ bg: v })} />
              <ColorField label="Trajectory" value={style.stroke} onChange={(v) => editStyle({ stroke: v })} />
              {style.axis !== 'none' && <ColorField label="Grid color" value={style.gridColor} onChange={(v) => editStyle({ gridColor: v })} />}
            </Section>
          )}
        </>)}

        {tab === 'animation' && (<>
          <Section label="Motion">
            <LabeledControl inline label="Frame">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FRAME_PRESETS, framePreset)} value={framePreset} onChange={applyFramePreset} />
            </LabeledControl>
            <LabeledControl inline label="Form">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FORM_PRESETS, formPreset)} value={formPreset} onChange={applyFormPreset} />
            </LabeledControl>
          </Section>
          {/* Frame = the orbit camera sweeps the figure · Form = the figure modulates in place. */}
          <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
          {animTab === 'frame' && (
            <Section label="Frame">
              {/* Spin = continuous yaw drift (expr-capable) · Sway/Tilt rock the camera ·
                  Dolly breathes the distance. */}
              <Slider labeled label="Spin" min={-40} max={40} step={1} value={params.spin} onChange={(v) => onFrameEdit('spin', v)} variant="default" />
              <Slider labeled label="Sway" min={0} max={45} step={1} value={params.sway} onChange={(v) => onFrameEdit('sway', v)} variant="default" noExpr />
              <Slider labeled label="Tilt" min={0} max={30} step={1} value={params.tilt} onChange={(v) => onFrameEdit('tilt', v)} variant="default" noExpr />
              <Slider labeled label="Dolly" min={0} max={0.6} step={0.02} value={params.dolly} onChange={(v) => onFrameEdit('dolly', v)} variant="default" noExpr />
            </Section>
          )}
          {animTab === 'form' && (
            <Section label="Form">
              {/* Speed = master time-scale · Breathe/Pulse = height|weight breathe ·
                  Ripple = travelling wave (surface) · Fade = opacity breathe. */}
              <Slider labeled label="Speed" min={0} max={3} step={0.05} value={params.formSpeed} onChange={(v) => onFormEdit('formSpeed', v)} variant="default" noExpr />
              <Slider labeled label={isAttractor ? 'Pulse' : 'Breathe'} min={0} max={1} step={0.05} value={params.morph} onChange={(v) => onFormEdit('morph', v)} variant="default" noExpr />
              {!isAttractor && (
                <Slider labeled label="Ripple" min={0} max={1.5} step={0.05} value={params.ripple} onChange={(v) => onFormEdit('ripple', v)} variant="default" noExpr />
              )}
              <Slider labeled label="Fade" min={0} max={1} step={0.05} value={params.fade} onChange={(v) => onFormEdit('fade', v)} variant="default" noExpr />
            </Section>
          )}
        </>)}
      </EditorRail>
      </LiveClock>
    </div>
  )
}
