import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePublishReset, usePublishShortcuts } from '../../../../components/framework/pageShortcuts.jsx'
import CurvePlayer from './CurvePlayer'
import CurveControls from './CurveControls'
import ClipForm from './ClipForm'
import CameraTimeline from './CameraTimeline'
import { totalDuration } from '../engine/timeline'
import { useMathStyle, THEMES } from '../../style/mathStyle'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../../../lib/appSettings.js'
import Scrubber from '../../../../components/framework/Scrubber.jsx'
import EditorRail, { RailHeader } from '../../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../../lib/liveClock.jsx'
import Button from '../../../../components/atoms/Button.jsx'
import ToggleSwitch from '../../../../components/atoms/ToggleSwitch.jsx'
import Slider from '../../../../components/atoms/Slider.jsx'
import Dropdown from '../../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'
import Section from '../../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../../components/molecules/SegmentedToggle.jsx'
import ColorField from '../../../../components/color/ColorField.jsx'

const TAU = Math.PI * 2

// Camera movements as explicit pose paths [yaw°, pitch°, dist]. EVERY path starts
// AND ends front-and-centre (0, 0, 3) so it loops seamlessly, and each is a
// distinct shape: full spin / side-swing / up-down / diagonal weave / push-pull /
// corkscrew. applyFramePreset builds an evenly-timed, eased timeline from these.
const MOTIONS = {
  orbit: [[0, 0, 3], [120, 0, 3], [240, 0, 3], [360, 0, 3]],             // full horizontal spin
  sway:  [[0, 0, 3], [55, 0, 3], [0, 0, 3], [-55, 0, 3], [0, 0, 3]],     // swing left ↔ right
  nod:   [[0, 0, 3], [0, 50, 3], [0, 0, 3], [0, -50, 3], [0, 0, 3]],     // tilt up ↕ down
  weave: [[0, 0, 3], [50, 32, 3], [0, 0, 3], [-50, -32, 3], [0, 0, 3]],  // diagonal figure-eight
  dolly: [[0, 0, 3], [0, 0, 1.4], [0, 0, 3], [0, 0, 5.2], [0, 0, 3]],    // push in / pull out
  helix: [[0, 0, 3], [120, 38, 3], [240, -38, 3], [360, 0, 3]],          // corkscrew (orbit + bob)
}
const MOTION_DUR = 8 // seconds for one full loop (camSpeed scales playback)
const FRAME_OPTS = [
  { value: 'static', label: 'Static' }, { value: 'keyframed', label: 'Keyframed' },
  { value: 'orbit', label: 'Orbit' }, { value: 'sway', label: 'Sway' }, { value: 'nod', label: 'Nod' },
  { value: 'weave', label: 'Weave' }, { value: 'dolly', label: 'Dolly' }, { value: 'helix', label: 'Helix' },
]
// Camera-tab movement dropdown (shown when motion is ON) — no 'Static' (toggle = off).
const MOVE_OPTS = FRAME_OPTS.filter((o) => o.value !== 'static')
// Form = animate the drawn figure as a CONTAINER. Four DISTINCT motions; each
// preset isolates one so they read clearly differently.
const FORM_OPTS = [
  { value: 'static', label: 'Static' }, { value: 'scale', label: 'Scale' },
  { value: 'squash', label: 'Squash' }, { value: 'sway', label: 'Sway' }, { value: 'spin', label: 'Spin' },
]
const FORM_MOTIONS = {
  static: { speed: 1, spin: 0, scale: 0, squash: 0, sway: 0 },
  scale: { speed: 1, spin: 0, scale: 0.7, squash: 0, sway: 0 },   // grow / shrink
  squash: { speed: 1, spin: 0, scale: 0, squash: 0.7, sway: 0 },  // stretch up ↕ down
  sway: { speed: 1, spin: 0, scale: 0, squash: 0, sway: 0.7 },    // zigzag left ↔ right
  spin: { speed: 1, spin: 0.6, scale: 0, squash: 0, sway: 0 },    // rotate on Z
}
const withCustom = (opts, val) => (FRAME_OPTS.concat(FORM_OPTS).some((o) => o.value === val) ? opts : [{ value: val, label: 'Custom' }, ...opts])
const ROLL_COLORS = ['#9ec1ff', '#ffd23f', '#ff5470', '#c9f29b', '#b8a6ff', '#ffb35c', '#ffffff']
const pick = (a) => a[Math.floor(Math.random() * a.length)]

// Fresh curve params per kind — seeded when the user switches the curve type.
export function defaultCurve(kind) {
  switch (kind) {
    case 'epicycle': return { kind, turns: 2, terms: [{ amp: 1, freq: 1, phase: 0 }, { amp: 0.5, freq: -3, phase: 0 }] }
    case 'polar': return { kind, range: [0, 6 * TAU], r: '3*sin(6*θ)' }
    case 'param2d': return { kind, range: [0, TAU], x: 'sin(3*t)', y: 'sin(2*t + 0.6)' }
    case 'param3d': return { kind, range: [0, 6 * TAU], x: 'cos(t)', y: 'sin(t)', z: '0.3*t' }
    case 'points': return { kind, count: 800, a: 'k*TAU/(PHI*PHI)', r: 'sqrt(k)' }
    case 'maurer': return { kind, n: 6, d: 71 }
    default: return { kind: 'polar', range: [0, 6 * TAU], r: '3*sin(6*θ)' }
  }
}

// The shared clip-editing harness: stage (live player + scrubber + title) plus
// the rail (Curve / Form / Camera / Origin tabs + transport). Editing layers an
// `edits` override over `baseClip`; switching the base clip drops the edits.
// `railExtras` is appended to the scrolling rail body (e.g. uzumaki's gallery).
//
// Both /math/uzumaki (preset base) and /math/animate (expression base) render
// this — the only difference is what feeds `baseClip` and the rail extras.
export default function ClipEditor({
  baseClip,
  headerLabel = 'editor',
  headerSlot = null,
  railExtras = null,
  autoPlay = defaultAutoplay(),
  settingsPage = null,
  onRandomize,
  seed,
  onSeed,
  getExtraSettings,
  applyExtraSettings,
}) {
  const [edits, setEdits] = useState({})
  const [tab, setTab] = useState('style') // generate | style | animation (reference 3-tab shape)
  const [animTab, setAnimTab] = useState('frame') // frame | form sub-tab
  const [frameSel, setFrameSel] = useState('static') // Frame dropdown value (default = no movement)
  const [formSel, setFormSel] = useState('static') // Form dropdown value
  const [form, setForm] = useState({ speed: 1, spin: 0, scale: 0, squash: 0, sway: 0 }) // container motion
  const [xform, setXform] = useState({ x: 0, y: 0, scale: 1 }) // figure offset + scale
  const [playing, setPlaying] = useState(autoPlay)
  const [tempo, setTempo] = useState(120)
  const [resetKey, setResetKey] = useState(0)
  const [kfSel, setKfSel] = useState(0)
  // Default: front & centre, no movement. Toggle ON reveals the movement dropdown.
  const [cameraMotion, setCameraMotion] = useState(false)
  const [cam, setCam] = useState({ yaw: 0, pitch: 0, dist: 3, zoom: 1 })
  const [camSpeed, setCamSpeed] = useState(1) // camera-sequence playback speed
  const [style, patchStyle, applyTheme] = useMathStyle({ plane: 'xy', axis: 'axes' })
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport') // Transport · Output · File
  // Palette quick-pick (matches Waveforms) — seeds bg/stroke/grid via the theme.
  const paletteId = THEMES.find((t) => t.bg === style.bg)?.id
  const playerRef = useRef(null)
  const progressRef = useRef({ t: 0, dur: 1 })
  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect

  // Reset edits when the base clip changes (preset pick / new forwarded
  // expression). Done during render (not an effect) so the merged clip never
  // flashes the old edits over the new base for a frame. Keeps playback /
  // camera prefs, which are intentionally persistent across clips.
  const prevBaseId = useRef(baseClip.id)
  if (prevBaseId.current !== baseClip.id) {
    prevBaseId.current = baseClip.id
    if (Object.keys(edits).length) setEdits({})
    setKfSel(0)
  }

  // Each edited section fully replaces the base's once touched.
  const clip = useMemo(() => ({
    ...baseClip,
    curve: edits.curve || baseClip.curve,
    modifiers: edits.modifiers || baseClip.modifiers,
    show: edits.show || baseClip.show,
    style: edits.style || baseClip.style,
    timeline: edits.timeline || baseClip.timeline,
  }), [baseClip, edits])

  // Re-sample only on geometry change (curve or spiral). repeat/show/style and
  // the camera timeline are render-time, so they must NOT bust the point cache.
  const sampleKey = useMemo(
    () => `${clip.id}|${JSON.stringify(clip.curve)}|s${clip.modifiers?.spiral || 0}`,
    [clip],
  )

  const editCurve = (patch) => setEdits((e) => ({ ...e, curve: { ...(e.curve || baseClip.curve), ...patch } }))
  const setKind = (kind) => setEdits((e) => ({ ...e, curve: defaultCurve(kind) }))
  const editMod = (patch) => setEdits((e) => ({ ...e, modifiers: { ...(e.modifiers || baseClip.modifiers || {}), ...patch } }))
  const editShow = (patch) => setEdits((e) => ({ ...e, show: { ...(e.show || baseClip.show || {}), ...patch } }))
  const editStyle = (patch) => setEdits((e) => ({ ...e, style: { ...(e.style || baseClip.style || {}), ...patch } }))
  const editTimeline = (tl) => setEdits((e) => ({ ...e, timeline: tl }))
  const resetEdits = () => { setEdits({}); setKfSel(0) }
  usePublishReset(resetEdits)
  usePublishShortcuts(headerLabel, [
    ['drag', 'orbit camera'],
    ['wheel', 'zoom'],
    ['← → ↑ ↓', 'orbit ±5°'],
    ['[ ]', 'distance ±'],
    ['r', 'reset edits'],
    ['space', 'play / pause'],
  ])

  // The toggle: OFF = front & centre static (the default); ON = movement (the
  // dropdown picks which). Off snaps the camera head-on (yaw/pitch 0).
  const setMotion = (on) => {
    setCameraMotion(on)
    if (on) { if (frameSel === 'static') setFrameSel('keyframed') }
    else { setFrameSel('static'); setCam((c) => ({ ...c, yaw: 0, pitch: 0 })) }
  }
  const setCamParam = (k, v) => setCam((c) => ({ ...c, [k]: v }))

  // Frame/movement dropdown drives the camera: Static = motion off (front), Keyframed
  // = the clip's own path, the rest rewrite every keyframe's cam to a motion preset.
  const applyFramePreset = (name) => {
    setFrameSel(name)
    if (name === 'static') { setCameraMotion(false); setCam((c) => ({ ...c, yaw: 0, pitch: 0 })); return }
    setCameraMotion(true)
    if (name === 'keyframed') return
    const poses = MOTIONS[name]
    if (!poses) return
    // Build a fresh, evenly-timed, eased loop from the pose path (front→…→front).
    const n = poses.length
    editTimeline(poses.map(([yaw, pitch, dist], i) => ({
      at: (i / (n - 1)) * MOTION_DUR,
      draw: 1,
      cam: { yaw, pitch, zoom: 1, dist },
      ease: 'inout',
    })))
  }
  // Form dropdown / sliders drive the figure's in-place motion (speed/pulse/spin).
  const applyFormPreset = (name) => { setFormSel(name); const f = FORM_MOTIONS[name]; if (f) setForm(f) }
  const onFormSlider = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFormSel('custom') }
  const setReveal = (v) => editTimeline(clip.timeline.map((k) => ({ ...k, draw: v })))

  // Generate · section rerolls. Colour rerolls the PALETTE (bg + grid) and the
  // stroke; Camera randomises the movement (only this button enables it — camera
  // is off by default otherwise).
  const rollColour = () => { applyTheme(pick(THEMES).id); editStyle({ color: pick(ROLL_COLORS) }) }
  const rollCamera = () => applyFramePreset(pick(['orbit', 'sway', 'nod', 'weave', 'dolly', 'helix']))
  const rollTransform = () => setXform({ x: +(Math.random() * 0.8 - 0.4).toFixed(2), y: +(Math.random() * 0.8 - 0.4).toFixed(2), scale: +(0.6 + Math.random()).toFixed(2) })
  const rollMods = () => editMod({ repeat: 1 + Math.floor(Math.random() * 8), spiral: Math.random() < 0.5 ? +(Math.random() * 5).toFixed(1) : 0 })
  const rollForm = () => { setFormSel('custom'); const r = () => Math.random() < 0.5 ? +(0.3 + Math.random() * 0.5).toFixed(2) : 0; setForm({ speed: +(0.7 + Math.random()).toFixed(2), spin: r(), scale: r(), squash: r(), sway: r() }) }

  // Letterbox the stage to the chosen aspect (JS-fit; CurvePlayer's own
  // ResizeObserver then resizes its backing store to the box).
  const fit = useCallback(() => {
    const stage = stageRef.current
    const box = boxRef.current
    if (!stage || !box) return
    const aw = stage.clientWidth
    const ah = stage.clientHeight
    const r = ratioFor(aspectRef.current)
    let w = aw
    let h = ah
    if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
    box.style.width = `${Math.max(1, Math.floor(w))}px`
    box.style.height = `${Math.max(1, Math.floor(h))}px`
  }, [])
  useEffect(() => {
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [fit])
  useEffect(() => { fit() }, [aspect, fit])

  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await playerRef.current?.exportBlobAt(d.w, d.h) : await playerRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-${headerLabel.split(' ')[0]}-${clip.curve?.kind || 'curve'}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Settings snapshot: the editor's own state (theme / edits / camera / frame)
  // merged with the page-provided clip identity (preset id or forwarded expr).
  const getSettings = () => ({
    ...(getExtraSettings?.() || {}),
    edits,
    cam,
    cameraMotion,
    camSpeed,
    form,
    xform,
    aspect,
    scale,
    style,
    seed,
  })
  const applySettings = (s) => {
    applyExtraSettings?.(s)
    if (s.edits != null) setEdits(s.edits)
    if (s.cam != null) setCam(s.cam)
    if (s.cameraMotion != null) setCameraMotion(s.cameraMotion)
    if (Number.isFinite(s.camSpeed)) setCamSpeed(s.camSpeed)
    if (s.form != null) setForm(s.form)
    if (s.xform != null) setXform(s.xform)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.style != null) patchStyle(s.style)
    if (s.seed != null && onSeed) onSeed(s.seed)
  }

  // Camera keyframe positions as scrubber ticks (fractions of the loop).
  const dur = totalDuration(clip.timeline)
  const marks = dur > 0 ? clip.timeline.map((k) => k.at / dur) : []

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={stageRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <div ref={boxRef} className="relative" style={{ width: '100%', height: '100%' }}>
          <CurvePlayer
            key={resetKey}
            ref={playerRef}
            clip={clip}
            sampleKey={sampleKey}
            paused={!playing}
            speed={(tempo / 120) * camSpeed}
            cameraMotion={cameraMotion}
            manualCam={cam}
            form={form}
            transform={xform}
            bg={style.bg}
            axis={style}
            onProgress={(p) => { progressRef.current = p }}
          />
        </div>
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{clip.title}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{clip.ref}</div>
        </div>
        <Scrubber progressRef={progressRef} playerRef={playerRef} marks={marks} />
      </div>

      <LiveClock getT={() => progressRef.current.t}>
      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>{headerLabel}</RailHeader>
            <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'animation', label: 'Animation' }, { value: 'camera', label: 'Camera' }]} />
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
              onStop: () => { setPlaying(false); setResetKey((k) => k + 1) },
              onRewind: () => setResetKey((k) => k + 1),
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={settingsPage}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        {/* Preset nav (Category + Preset dropdowns) — always above the tab content. */}
          {headerSlot}

          {tab === 'generate' && (
            <Section label="Generate">
              <Button variant="primary" size="sm" className="w-full" onClick={onRandomize}>Randomize all</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" size="sm" onClick={onRandomize}>Shape</Button>
                <Button variant="primary" size="sm" onClick={rollColour}>Colour</Button>
                <Button variant="primary" size="sm" onClick={rollTransform}>Transform</Button>
                <Button variant="primary" size="sm" onClick={rollMods}>Modifiers</Button>
                <Button variant="primary" size="sm" onClick={rollForm}>Motion Form</Button>
                <Button variant="primary" size="sm" onClick={rollCamera}>Camera</Button>
              </div>
            </Section>
          )}

          {tab === 'style' && (
            <>
              {/* Shape picker (the clip dropdown) — passed by the page as railExtras. */}
              {railExtras}

              <Section label="Transform">
                <Slider labeled label="Position X" min={-1} max={1} step={0.02} center={0} value={xform.x} onChange={(v) => setXform((t) => ({ ...t, x: v }))} variant="default" noExpr />
                <Slider labeled label="Position Y" min={-1} max={1} step={0.02} center={0} value={xform.y} onChange={(v) => setXform((t) => ({ ...t, y: v }))} variant="default" noExpr />
                <Slider labeled label="Scale" min={0.3} max={2} step={0.05} value={xform.scale} onChange={(v) => setXform((t) => ({ ...t, scale: v }))} variant="default" noExpr />
              </Section>

              <Section label="Curve">
                <CurveControls curve={clip.curve} onChange={editCurve} onKind={setKind} />
              </Section>

              <ClipForm
                modifiers={clip.modifiers}
                show={clip.show}
                style={clip.style}
                onMod={editMod}
                onShow={editShow}
                onStyle={editStyle}
              />

              {/* Color = palette dropdown + swatches ONLY (what the other pages do). */}
              <Section label="Color">
                <Dropdown size="sm" variant="subtle" className="w-full" options={THEMES.map((t) => ({ value: t.id, label: t.label }))} value={paletteId} onChange={applyTheme} placeholder="Palette…" />
                <ColorField label="Background" value={style.bg} onChange={(v) => patchStyle({ bg: v })} />
                <ColorField label="Stroke" value={clip.style?.color || '#ffffff'} onChange={(c) => editStyle({ color: c })} />
                <ColorField label="Grid color" value={style.gridColor} onChange={(v) => patchStyle({ gridColor: v })} />
              </Section>

            </>
          )}

          {tab === 'animation' && (
            <>
              {/* Motion = Frame (camera) + Form (reveal) dropdowns, the reference shape.
                  Deep keyframe authoring is tucked into the separate Camera tab. */}
              <Section label="Motion">
                <LabeledControl inline label="Frame">
                  <Dropdown variant="subtle" size="sm" className="w-full" options={withCustom(FRAME_OPTS, frameSel)} value={frameSel} onChange={applyFramePreset} />
                </LabeledControl>
                <LabeledControl inline label="Form">
                  <Dropdown variant="subtle" size="sm" className="w-full" options={withCustom(FORM_OPTS, formSel)} value={formSel} onChange={applyFormPreset} />
                </LabeledControl>
              </Section>
              <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
              {animTab === 'frame' && (
                <Section label="Frame">
                  {/* When a movement is active the timeline drives the camera (pose
                      sliders would be dead) → show the sequence Speed instead; when
                      Static, frame the shot with the manual pose. Always live. */}
                  {cameraMotion ? (
                    <Slider labeled label="Speed" min={0.1} max={3} step={0.05} value={camSpeed} onChange={setCamSpeed} variant="default" noExpr />
                  ) : (
                    <>
                      <Slider labeled label="Yaw" min={-180} max={180} step={1} value={cam.yaw} onChange={(v) => setCamParam('yaw', v)} variant="default" noExpr />
                      <Slider labeled label="Pitch" min={-89} max={89} step={1} value={cam.pitch} onChange={(v) => setCamParam('pitch', v)} variant="default" noExpr />
                      <Slider labeled label="Zoom" min={0.3} max={3} step={0.05} value={cam.zoom} onChange={(v) => setCamParam('zoom', v)} variant="default" noExpr />
                      <Slider labeled label="Distance" min={1} max={8} step={0.1} value={cam.dist} onChange={(v) => setCamParam('dist', v)} variant="default" noExpr />
                    </>
                  )}
                </Section>
              )}
              {animTab === 'form' && (
                <Section label="Form">
                  {/* The drawn figure is one container. Four distinct motions: Scale =
                      grow/shrink · Squash = vertical stretch · Sway = left↔right zigzag ·
                      Spin = rotate Z. None of these touch the curve math. */}
                  <Slider labeled label="Reveal" min={0} max={1} step={0.01} value={clip.timeline[clip.timeline.length - 1]?.draw ?? 1} onChange={setReveal} variant="default" noExpr />
                  <Slider labeled label="Speed" min={0} max={3} step={0.05} value={form.speed} onChange={(v) => onFormSlider('speed', v)} variant="default" noExpr />
                  <Slider labeled label="Scale" min={0} max={1} step={0.05} value={form.scale} onChange={(v) => onFormSlider('scale', v)} variant="default" noExpr />
                  <Slider labeled label="Squash" min={0} max={1} step={0.05} value={form.squash} onChange={(v) => onFormSlider('squash', v)} variant="default" noExpr />
                  <Slider labeled label="Sway" min={0} max={1} step={0.05} value={form.sway} onChange={(v) => onFormSlider('sway', v)} variant="default" noExpr />
                  <Slider labeled label="Spin" min={0} max={2} step={0.05} value={form.spin} onChange={(v) => onFormSlider('spin', v)} variant="default" noExpr />
                </Section>
              )}
            </>
          )}

          {tab === 'camera' && (
            <Section label="Camera">
              {/* OFF = front & centre (default). ON = movement; the dropdown picks which. */}
              <ToggleSwitch variant="plain" label="Camera motion" checked={cameraMotion} onChange={setMotion} />
              {cameraMotion && (
                <>
                  <LabeledControl inline label="Movement">
                    <Dropdown size="sm" variant="subtle" className="w-full" options={withCustom(MOVE_OPTS, frameSel)} value={frameSel} onChange={applyFramePreset} />
                  </LabeledControl>
                  <CameraTimeline timeline={clip.timeline} onChange={editTimeline} selected={kfSel} onSelect={setKfSel} camSpeed={camSpeed} onCamSpeed={setCamSpeed} />
                </>
              )}
            </Section>
          )}
      </EditorRail>
      </LiveClock>
    </div>
  )
}
