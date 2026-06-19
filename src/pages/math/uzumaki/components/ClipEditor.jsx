import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePublishReset, usePublishShortcuts } from '../../../../components/framework/pageShortcuts.jsx'
import CurvePlayer from './CurvePlayer'
import CurveControls from './CurveControls'
import ClipForm from './ClipForm'
import CameraTimeline from './CameraTimeline'
import { totalDuration } from '../engine/timeline'
import StylePanel from '../../components/StylePanel'
import { useMathStyle, AXIS_3D } from '../../style/mathStyle'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../../_shared/exportSpecs.js'
import { defaultTheme, defaultAutoplay } from '../../../../lib/appSettings.js'
import { resolveTheme } from '../../../../lib/themes.js'
import SettingsPanel from '../../../../components/framework/SettingsPanel.jsx'
import Scrubber from '../../../../components/framework/Scrubber.jsx'
import EditorRail, { RailHeader } from '../../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../../lib/liveClock.jsx'
import Button from '../../../../components/atoms/Button.jsx'
import ToggleSwitch from '../../../../components/atoms/ToggleSwitch.jsx'
import Slider from '../../../../components/atoms/Slider.jsx'
import Divider from '../../../../components/atoms/Divider.jsx'
import Dropdown from '../../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'
import Section from '../../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../../components/molecules/SegmentedToggle.jsx'

const TAU = Math.PI * 2

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
  const [playing, setPlaying] = useState(autoPlay)
  const [tempo, setTempo] = useState(120)
  const [resetKey, setResetKey] = useState(0)
  const [panel, setPanel] = useState('curve')
  const [kfSel, setKfSel] = useState(0)
  const [cameraMotion, setCameraMotion] = useState(true)
  const [cam, setCam] = useState({ yaw: 20, pitch: 20, dist: 3, zoom: 1 })
  const [style, patchStyle, applyTheme] = useMathStyle({ plane: 'xy', axis: 'axes' })
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport') // Transport · Output · File

  // Theme drives the stage chrome (bg + grid colour/opacity). The clip's own
  // stroke colour stays a per-clip choice, so it isn't overwritten here.
  useEffect(() => {
    const t = resolveTheme(themeId, invert)
    patchStyle({ bg: t.bg, gridColor: t.grid, gridOpacity: t.gridOpacity })
  }, [themeId, invert]) // eslint-disable-line react-hooks/exhaustive-deps
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
    ['r', 'reset camera'],
    ['space', 'play / pause'],
  ])

  // Toggling motion off seeds the orbit sliders from the clip's first keyframe so
  // the frozen pose doesn't jump from wherever the animation happened to be.
  const setMotion = (on) => {
    if (!on) {
      const k0 = clip.timeline[0]?.cam || {}
      setCam({ yaw: k0.yaw ?? 20, pitch: k0.pitch ?? 20, dist: k0.dist ?? 3, zoom: k0.zoom ?? 1 })
    }
    setCameraMotion(on)
  }
  const setCamParam = (k, v) => setCam((c) => ({ ...c, [k]: v }))
  // Snap to a head-on front view (looking down −z): motion off, yaw/pitch = 0,
  // keep the current distance/zoom.
  const frontView = () => { setCameraMotion(false); setCam((c) => ({ ...c, yaw: 0, pitch: 0 })) }

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
    aspect,
    scale,
    themeId,
    invert,
    seed,
  })
  const applySettings = (s) => {
    applyExtraSettings?.(s)
    if (s.edits != null) setEdits(s.edits)
    if (s.cam != null) setCam(s.cam)
    if (s.cameraMotion != null) setCameraMotion(s.cameraMotion)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null && onSeed) onSeed(s.seed)
  }

  // Camera keyframe positions as scrubber ticks (fractions of the loop).
  const dur = totalDuration(clip.timeline)
  const marks = dur > 0 ? clip.timeline.map((k) => k.at / dur) : []
  const edited = Object.keys(edits).length > 0

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
            speed={tempo / 240}
            cameraMotion={cameraMotion}
            manualCam={cam}
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
        header={<RailHeader>{headerLabel}</RailHeader>}
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
              tempoMax: 600,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={settingsPage}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        {/* Fixed: which control group is shown. */}
        <SegmentedToggle
          value={panel}
          onChange={setPanel}
          options={[
            { value: 'curve', label: 'Curve' },
            { value: 'form', label: 'Form' },
            { value: 'camera', label: 'Camera' },
            { value: 'view', label: 'View' },
          ]}
        />

        {panel === 'curve' && (
            <Section label="Curve">
              <CurveControls curve={clip.curve} onChange={editCurve} onKind={setKind} />
            </Section>
          )}

          {panel === 'form' && (
            <ClipForm
              modifiers={clip.modifiers}
              show={clip.show}
              style={clip.style}
              onMod={editMod}
              onShow={editShow}
              onStyle={editStyle}
            />
          )}

          {panel === 'camera' && (
            <Section label="Camera">
              <ToggleSwitch variant="plain" label="Camera motion" checked={cameraMotion} onChange={setMotion} />
              <Button variant="secondary" size="sm" iconLeft="grid" onClick={frontView} className="w-full">Front view · 0,0</Button>
              {cameraMotion ? (
                <CameraTimeline timeline={clip.timeline} onChange={editTimeline} selected={kfSel} onSelect={setKfSel} />
              ) : (
                <>
                  <Slider labeled label="Yaw" min={-180} max={180} step={1} value={cam.yaw} onChange={(v) => setCamParam('yaw', v)} variant="default" />
                  <Slider labeled label="Pitch" min={-89} max={89} step={1} value={cam.pitch} onChange={(v) => setCamParam('pitch', v)} variant="default" />
                  <Slider labeled label="Distance" min={1} max={8} step={0.1} value={cam.dist} onChange={(v) => setCamParam('dist', v)} variant="default" />
                  <Slider labeled label="Zoom" min={0.3} max={3} step={0.05} value={cam.zoom} onChange={(v) => setCamParam('zoom', v)} variant="default" />
                </>
              )}
            </Section>
          )}

          {panel === 'view' && (
            <>
              <StylePanel
                style={style}
                onPatch={patchStyle}
                onTheme={applyTheme}
                axisOptions={AXIS_3D}
                showStroke={false}
                showWeight={false}
                showTheme={false}
              />

              {settingsPage && (
                <SettingsPanel
                  page={settingsPage}
                  theme={themeId}
                  onTheme={setThemeId}
                  invert={invert}
                  onInvert={setInvert}
                  onRandomize={onRandomize}
                  seed={seed}
                  onSeed={onSeed}
                  getSettings={getSettings}
                  applySettings={applySettings}
                  showIO={false}
                />
              )}
            </>
          )}

          {edited && (
            <Button variant="secondary" size="sm" iconLeft="refresh" onClick={resetEdits} className="w-full">Reset edits</Button>
          )}

          {railExtras && (
            <>
              <Divider />
              {railExtras}
            </>
          )}
      </EditorRail>
      </LiveClock>
    </div>
  )
}
