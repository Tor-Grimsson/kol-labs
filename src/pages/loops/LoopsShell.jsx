import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LoopPlayer2D from '../../loops/LoopPlayer2D.js'
import { presetsInGroup, presetById, loopById, presetParams, groupById } from '../../loops/registry.js'
import { VIEW_ASPECTS, DEFAULT_ASPECT, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import ExportPanel from '../_shared/ExportPanel.jsx'
import LoopControls from './LoopControls.jsx'
import PatternControls from './PatternControls.jsx'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import TransportBar from '../../components/framework/TransportBar.jsx'
import Scrubber from '../../components/framework/Scrubber.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import SettingsPanel from '../../components/framework/SettingsPanel.jsx'
import { DEFAULT_THEME } from '../../lib/themes.js'
import { mulberry32, randomSeed, randomizeSchema } from '../../lib/rng.js'
import { themeParams } from '../../loops/theme.js'

// The loop-library shell, parameterised by GROUP. /loops mounts one of these per
// routed subpage (Simple · Pattern · Field). The rail's **Presets** tab picks a
// preset from this group's catalog (sub-grouped). The editor tabs differ by loop
// type so no panel is one giant scroll: shape = Edit; field = Edit + Camera;
// pattern = Pattern (shape/grid/colour/rules) + Animation (camera + sweep).
// Loads paused (no autoplay).

export default function LoopsShell({ group }) {
  const presets = useMemo(() => presetsInGroup(group), [group])
  const groupLabel = groupById(group).label

  const [presetId, setPresetId] = useState(presets[0].id)
  const activePreset = presetById(presetId)
  const activeLoop = loopById(activePreset.loop)

  const [params, setParams] = useState(() => presetParams(activePreset))
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [recording, setRecording] = useState(false)
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [panel, setPanel] = useState('presets')
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

  // Selected preset change → swap loop + reset params (stays paused).
  useEffect(() => {
    presetIdRef.current = presetId
    const preset = presetById(presetId)
    const loop = loopById(preset.loop)
    const def = presetParams(preset)
    setParams(def)
    playerRef.current?.setLoop(loop, def)
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

  // ── Scene settings (theme · invert · randomise · export/import) ──
  // Roll the schema with a given seed, merging over current params (skips the
  // structural noRandom params; keeps the rules array + other untouched fields).
  const rollWith = (n) => {
    const rng = mulberry32(n >>> 0)
    setParams((p) => ({ ...p, ...randomizeSchema(activeLoop.params, rng) }))
  }
  const onRandomize = () => { const n = randomSeed(); setSeed(n); rollWith(n) }

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

  // Presets grouped by their `sub` label (falls back to one "Presets" section).
  const subs = useMemo(() => {
    const out = []
    for (const p of presets) {
      const label = p.sub || 'Presets'
      let g = out.find((x) => x.label === label)
      if (!g) { g = { label, items: [] }; out.push(g) }
      g.items.push(p)
    }
    return out
  }, [presets])

  const isPattern = activeLoop.controls === 'pattern'
  const tabs = [{ value: 'presets', label: 'Presets' }]
  if (isPattern) {
    tabs.push({ value: 'pattern', label: 'Pattern' }, { value: 'animation', label: 'Animation' })
  } else {
    tabs.push({ value: 'edit', label: 'Edit' })
    if (activeLoop.camera) tabs.push({ value: 'camera', label: 'Camera' })
  }
  tabs.push({ value: 'scene', label: 'Scene' })
  const footTabs = [{ value: 'transport', label: 'Transport' }, { value: 'output', label: 'Output' }]

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="block max-w-full max-h-full" />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{activePreset.label}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{groupLabel}</div>
        </div>
        <Scrubber progressRef={progressRef} playerRef={playerRef} />
      </div>

      <EditorRail
        header={
          <>
            <RailHeader>Loops · {groupLabel}</RailHeader>
            <SegmentedToggle value={panel} onChange={setPanel} options={tabs} />
          </>
        }
        footer={
          <div className="flex flex-col gap-3">
            <SegmentedToggle value={footTab} onChange={setFootTab} options={footTabs} />
            {footTab === 'transport' ? (
              <TransportBar
                playing={playing}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onStop={() => { setPlaying(false); playerRef.current?.seek(0) }}
                onRewind={() => playerRef.current?.seek(0)}
                tempo={tempo}
                onTempo={setTempo}
                tempoMax={300}
              />
            ) : (
              <ExportPanel aspect={aspect} onAspect={setAspect} aspects={VIEW_ASPECTS} scale={scale} onScale={setScale}>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportVideo} disabled={recording}>
                  {recording ? 'Recording loop…' : 'Export loop (webm)'}
                </Button>
              </ExportPanel>
            )}
          </div>
        }
      >
        {panel === 'presets' && subs.map((s) => (
          <Section key={s.label} label={s.label}>
            {s.items.map((p) => (
              <Button
                key={p.id}
                variant="primary"
                size="sm"
                selected={p.id === presetId}
                onClick={() => pickPreset(p.id)}
                className="w-full"
                style={{ justifyContent: 'flex-start' }}
              >
                {p.label}
              </Button>
            ))}
          </Section>
        ))}

        {panel === 'edit' && (
          <LoopControls schema={activeLoop.params} values={params} onChange={updateParam} />
        )}

        {panel === 'camera' && activeLoop.camera && (
          <LoopControls schema={activeLoop.camera} values={params} onChange={updateParam} label="Camera" />
        )}

        {panel === 'pattern' && <PatternControls values={params} onChange={updateParam} tab="pattern" />}
        {panel === 'animation' && <PatternControls values={params} onChange={updateParam} tab="animation" />}

        {panel === 'scene' && (
          <SettingsPanel
            page="loops"
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
        )}

        <Divider />

        <div className="kol-helper-10 text-body flex flex-col gap-1">
          <div>space = play / pause</div>
          <div>scrub the timeline below</div>
        </div>
      </EditorRail>
    </div>
  )
}
