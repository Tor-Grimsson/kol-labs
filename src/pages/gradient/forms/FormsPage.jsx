import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePublishReset } from '../../../components/framework/pageShortcuts.jsx'
import FormsEngine from './engine/FormsEngine.js'
import { FORMS } from './data/shapes.js'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import Button from '../../../components/atoms/Button.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'
import Divider from '../../../components/atoms/Divider.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import Scrubber from '../../../components/framework/Scrubber.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import { resolveTheme } from '../../../lib/themes.js'
import { defaultTheme } from '../../../lib/appSettings.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'

// 3D Scene · Forms — the helix + 7 parametric "creatures" as real 3D point
// clouds (the de-lofi'd cousin of the interfaces lofi widgets). Orbit camera,
// scrubbable looping playhead, theme-driven colour, PNG @Nx + seamless webm.
// Loads paused (autoplay-off convention).
export default function FormsPage() {
  const [form, setForm] = useState('helix')
  const [samples, setSamples] = useState(34)
  const [cycles, setCycles] = useState(2)
  const [amp, setAmp] = useState(0.35)
  const [pointSize, setPointSize] = useState(0.05)
  const [turns, setTurns] = useState(2.5)
  const [radius, setRadius] = useState(0.85)
  const [height, setHeight] = useState(2.4)
  const [spin, setSpin] = useState(false)
  const [spinSpeed, setSpinSpeed] = useState(1)
  const [fov, setFov] = useState(40)
  const [loop, setLoop] = useState(true)
  const [duration, setDuration] = useState(8)
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [panel, setPanel] = useState('scene')
  const [footTab, setFootTab] = useState('transport')

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  usePublishReset(() => engineRef.current?.resetCamera())
  const progressRef = useRef({ t: 0, dur: 1 })
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect

  const theme = useMemo(() => resolveTheme(themeId, invert), [themeId, invert])
  const globals = useMemo(
    () => ({
      form, samples, cycles, amp, pointSize, turns, radius, height,
      spin, spinSpeed, fov, loop, duration, paused: !playing, speed: tempo / 240,
      color: theme.fg, accent: theme.accent,
    }),
    [form, samples, cycles, amp, pointSize, turns, radius, height, spin, spinSpeed, fov, loop, duration, playing, tempo, theme],
  )

  const sizeCanvas = useCallback(() => {
    const el = wrapRef.current, cv = canvasRef.current, eng = engineRef.current
    if (!el || !cv || !eng || eng.recording) return
    const aw = el.clientWidth, ah = el.clientHeight
    const r = ratioFor(aspectRef.current)
    let w = aw, h = ah
    if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h))
    cv.style.width = `${w}px`; cv.style.height = `${h}px`
    eng.resize(w, h)
  }, [])

  useEffect(() => {
    const engine = new FormsEngine(canvasRef.current)
    engine.onProgress = (p) => { progressRef.current = p }
    engineRef.current = engine
    sizeCanvas()
    const ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); engine.dispose(); engineRef.current = null }
  }, [sizeCanvas])

  useEffect(() => { sizeCanvas() }, [aspect, sizeCanvas])
  useEffect(() => { engineRef.current?.update({ form }) }, [form])
  useEffect(() => { engineRef.current?.update({ globals }) }, [globals])
  useEffect(() => { engineRef.current?.setBackground(theme.bg) }, [theme])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p) }
      else if (e.key === 'c' || e.key === 'C') engineRef.current?.resetCamera()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const onRandomize = () => {
    const s = randomSeed(); setSeed(s)
    const rng = mulberry32(s)
    setForm(FORMS[Math.floor(rng() * FORMS.length)].id)
    setCycles(1 + Math.floor(rng() * 4))
    setAmp(0.15 + rng() * 0.5)
  }

  const getSettings = () => ({ form, samples, cycles, amp, pointSize, turns, radius, height, spin, spinSpeed, fov, loop, duration, themeId, invert, seed, aspect, scale })
  const applySettings = (s) => {
    if (s.form != null) setForm(s.form)
    if (s.samples != null) setSamples(s.samples)
    if (s.cycles != null) setCycles(s.cycles)
    if (s.amp != null) setAmp(s.amp)
    if (s.pointSize != null) setPointSize(s.pointSize)
    if (s.turns != null) setTurns(s.turns)
    if (s.radius != null) setRadius(s.radius)
    if (s.height != null) setHeight(s.height)
    if (s.spin != null) setSpin(s.spin)
    if (s.spinSpeed != null) setSpinSpeed(s.spinSpeed)
    if (s.fov != null) setFov(s.fov)
    if (s.loop != null) setLoop(s.loop)
    if (s.duration != null) setDuration(s.duration)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  const download = (blob, name) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await engineRef.current?.exportBlobAt(d.w, d.h) : await engineRef.current?.exportBlob()
    download(blob, `kol-3d-scene-forms-${form}.png`)
  }
  const exportVideo = async () => {
    if (recording) return
    setRecording(true)
    try {
      const d = dimsFor(aspect, 1) // realtime encode → @1x for reliability
      download(await engineRef.current?.recordLoop(d?.w, d?.h, 30), `kol-3d-scene-forms-${form}.webm`)
    } finally {
      setRecording(false)
    }
  }

  const formLabel = FORMS.find((f) => f.id === form)?.label

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="block max-w-full max-h-full" />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{formLabel}</div>
        </div>
        <Scrubber progressRef={progressRef} playerRef={engineRef} />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Forms</RailHeader>}
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
            settingsPage="forms"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <SegmentedToggle
          value={panel}
          onChange={setPanel}
          options={[
            { value: 'scene', label: 'Scene' },
            { value: 'camera', label: 'Camera' },
          ]}
        />

        {panel === 'scene' && (
          <>
            <SettingsPanel
              page="forms"
              theme={themeId}
              onTheme={setThemeId}
              invert={invert}
              onInvert={setInvert}
              onRandomize={onRandomize}
              seed={seed}
              onSeed={setSeed}
              showIO={false}
              getSettings={getSettings}
              applySettings={applySettings}
            />

            <Section label="Form">
              <div className="flex flex-col gap-1">
                {FORMS.map((f) => (
                  <Button key={f.id} variant="secondary" size="sm" selected={f.id === form} onClick={() => setForm(f.id)} className="w-full" style={{ justifyContent: 'flex-start' }}>
                    {f.label}
                  </Button>
                ))}
              </div>
            </Section>

            <Section label="Cloud">
              <Slider labeled label="Density" min={8} max={64} step={1} value={samples} onChange={(v) => setSamples(roundIfNum(v))} variant="default" />
              <Slider labeled label="Point size" min={0.01} max={0.16} step={0.005} value={pointSize} onChange={setPointSize} variant="default" />
              <Slider labeled label="Flap amount" min={0} max={1} step={0.02} value={amp} onChange={setAmp} variant="default" />
              <Slider labeled label="Flap rate" min={1} max={6} step={1} value={cycles} onChange={(v) => setCycles(roundIfNum(v))} variant="default" />
            </Section>

            {form === 'helix' && (
              <Section label="Helix">
                <Slider labeled label="Turns" min={1} max={6} step={0.5} value={turns} onChange={setTurns} variant="default" />
                <Slider labeled label="Radius" min={0.3} max={1.6} step={0.05} value={radius} onChange={setRadius} variant="default" />
                <Slider labeled label="Height" min={1} max={4} step={0.1} value={height} onChange={setHeight} variant="default" />
              </Section>
            )}

            <Section label="Loop">
              <ToggleSwitch variant="plain" label="Loop animation" checked={loop} onChange={setLoop} />
              <Slider labeled label="Duration (s)" min={1} max={20} step={0.5} value={duration} onChange={setDuration} variant="default" />
            </Section>
          </>
        )}

        {panel === 'camera' && (
          <Section label="Camera">
            <ToggleSwitch variant="plain" label="Auto-rotate" checked={spin} onChange={setSpin} />
            {spin && <Slider labeled label="Orbit speed" min={0} max={4} step={0.1} value={spinSpeed} onChange={setSpinSpeed} variant="default" />}
            <Slider labeled label="Field of view" min={20} max={90} step={1} value={fov} onChange={(v) => setFov(roundIfNum(v))} variant="default" />
            <Button variant="primary" size="sm" onClick={() => engineRef.current?.resetCamera()}>Cam reset</Button>
          </Section>
        )}

        <Divider />

        <div className="kol-helper-10 text-body flex flex-col gap-1">
          <div>space = play / pause</div>
          <div>drag = orbit · wheel = zoom</div>
          <div>C = reset cam · scrub below</div>
        </div>
      </EditorRail>
    </div>
  )
}
