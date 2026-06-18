import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import KineticType from './engine/KineticType.js'
import { presetsInGroup, presetById, presetParams, groupById, normalizeVf } from './data/presets.js'
import { loadFonts } from './lib/vfAxes.js'
import { VIEW_ASPECTS, DEFAULT_ASPECT, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import ExportPanel from '../_shared/ExportPanel.jsx'
import CustomPathEditor from './CustomPathEditor.jsx'
import { DEFAULT_POINTS } from './engine/paths.js'
import TextControls from './TextControls.jsx'
import PathControls from './PathControls.jsx'
import MotionControls from './MotionControls.jsx'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import TransportBar from '../../components/framework/TransportBar.jsx'
import Scrubber from '../../components/framework/Scrubber.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import SettingsPanel from '../../components/framework/SettingsPanel.jsx'
import { DEFAULT_THEME, resolveTheme } from '../../lib/themes.js'
import { mulberry32, randomSeed } from '../../lib/rng.js'

// The Kinetic-type shell, parameterised by GROUP (Path · Variable · Motion). One
// KineticType SVG engine; the rail's Presets tab picks a preset, Text/Path/Motion
// edit it, footer = [Transport | Output]. Loads paused (no autoplay).
export default function KineticShell({ group }) {
  const presets = useMemo(() => presetsInGroup(group), [group])
  const groupLabel = groupById(group).label

  const [presetId, setPresetId] = useState(presets[0].id)
  const activePreset = presetById(presetId)

  const [params, setParams] = useState(() => presetParams(activePreset))
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [panel, setPanel] = useState('presets')
  const [footTab, setFootTab] = useState('transport')
  const [recording, setRecording] = useState(false)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)

  const hostRef = useRef(null)
  const wrapRef = useRef(null)
  const engineRef = useRef(null)
  const progressRef = useRef({ t: 0, dur: 1 })
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect
  const presetIdRef = useRef(presetId)

  const sizeStage = useCallback(() => {
    const wrap = wrapRef.current
    const eng = engineRef.current
    if (!wrap || !eng) return
    const aw = wrap.clientWidth
    const ah = wrap.clientHeight
    const r = ratioFor(aspectRef.current)
    let w = aw
    let h = ah
    if (r) {
      h = w / r
      if (h > ah) { h = ah; w = h * r }
    }
    const fw = Math.max(1, Math.floor(w))
    const fh = Math.max(1, Math.floor(h))
    eng.resize(fw, fh)
    setStage((s) => (s.w === fw && s.h === fh ? s : { w: fw, h: fh }))
  }, [])

  useEffect(() => {
    loadFonts()
    const eng = new KineticType(hostRef.current, presetParams(presetById(presetIdRef.current)))
    eng.onProgress = (p) => { progressRef.current = p }
    engineRef.current = eng
    sizeStage()
    const ro = new ResizeObserver(() => sizeStage())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); eng.dispose(); engineRef.current = null }
  }, [sizeStage])

  // Preset change → reset params (stays paused).
  useEffect(() => {
    presetIdRef.current = presetId
    const np = presetParams(presetById(presetId))
    setParams(np)
    engineRef.current?.setParams(np)
  }, [presetId])

  useEffect(() => { sizeStage() }, [aspect, sizeStage])
  useEffect(() => { engineRef.current?.setParams(params) }, [params])
  useEffect(() => { engineRef.current?.setTransport({ paused: !playing, speed: tempo / 120 }) }, [playing, tempo])

  // Theme drives the two colour-role params (bg = background, fill = text/path);
  // re-applied after a preset change (which resets them). Runs after the preset
  // effect above (declared earlier → fires first on a presetId change).
  useEffect(() => {
    const t = resolveTheme(themeId, invert)
    setParams((p) => ({ ...p, bg: t.bg, fill: t.fg }))
  }, [themeId, invert, presetId])

  // Randomise → jitter the continuous knobs (size/spacing/motion/vf); text, font,
  // path type and colours (theme-owned) are left alone, so it stays coherent.
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    setParams((p) => {
      const np = { ...p }
      np.fontSize = Math.round(60 + rng() * 200)
      np.letterSpacing = Math.round(rng() * 24 - 6)
      np.motion = { ...p.motion, cycles: 1 + Math.floor(rng() * 3), phase: Math.round(rng() * 100) / 100, amp: Math.round(rng() * 100) / 100 }
      np.vf = { ...p.vf }
      if ('wght' in np.vf) np.vf.wght = Math.round(100 + rng() * 800)
      if ('wdth' in np.vf) np.vf.wdth = Math.round(60 + rng() * 90)
      return np
    })
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }

  const getSettings = () => ({ presetId, params, themeId, invert, seed, tempo, aspect, scale })
  const applySettings = (s) => {
    if (s.presetId) setPresetId(s.presetId)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
    if (s.tempo != null) setTempo(s.tempo)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    // Params last + deferred so the presetId-change reset doesn't clobber them.
    if (s.params) setTimeout(() => setParams(s.params), 0)
  }

  // ── param setters ──
  const set = (k, v) => setParams((p) => (k === 'font' ? { ...p, font: v, vf: normalizeVf(v, p.vf) } : { ...p, [k]: v }))
  const setVf = (tag, v) => setParams((p) => ({ ...p, vf: { ...p.vf, [tag]: v } }))
  const setPath = (k, v) => setParams((p) => ({ ...p, path: { ...p.path, [k]: v } }))
  const setMotion = (k, v) => setParams((p) => ({ ...p, motion: { ...p.motion, [k]: v } }))

  // ── export ──
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
    download(blob, `kol-kinetic-${activePreset.id}.png`)
  }
  const exportVideo = async () => {
    if (recording) return
    setRecording(true)
    try {
      const d = dimsFor(aspect, 1)
      download(await engineRef.current?.recordLoop(d?.w, d?.h, 25), `kol-kinetic-${activePreset.id}.webm`)
    } finally {
      setRecording(false)
    }
  }

  // presets grouped by `sub`
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

  const tabs = [
    { value: 'presets', label: 'Presets' },
    { value: 'text', label: 'Text' },
    { value: 'path', label: 'Path' },
    { value: 'motion', label: 'Motion' },
    { value: 'scene', label: 'Scene' },
  ]
  const footTabs = [{ value: 'transport', label: 'Transport' }, { value: 'output', label: 'Output' }]

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <div ref={hostRef} className="flex items-center justify-center" />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{activePreset.label}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{groupLabel}</div>
        </div>
        {params.path.type === 'custom' && (
          <CustomPathEditor points={params.path.points || DEFAULT_POINTS} stage={stage} onChange={(pts) => setPath('points', pts)} />
        )}
        <Scrubber progressRef={progressRef} playerRef={engineRef} />
      </div>

      <EditorRail
        header={
          <>
            <RailHeader>Kinetic · {groupLabel}</RailHeader>
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
                onStop={() => { setPlaying(false); engineRef.current?.seek(0) }}
                onRewind={() => engineRef.current?.seek(0)}
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
                onClick={() => setPresetId(p.id)}
                className="w-full"
                style={{ justifyContent: 'flex-start' }}
              >
                {p.label}
              </Button>
            ))}
          </Section>
        ))}

        {panel === 'text' && <TextControls params={params} set={set} setVf={setVf} />}
        {panel === 'path' && <PathControls params={params} set={set} setPath={setPath} />}
        {panel === 'motion' && <MotionControls params={params} setMotion={setMotion} />}
        {panel === 'scene' && (
          <SettingsPanel
            page="kinetic"
            theme={themeId}
            onTheme={setThemeId}
            invert={invert}
            onInvert={setInvert}
            onRandomize={onRandomize}
            seed={seed}
            onSeed={(n) => { setSeed(n); rollFrom(n) }}
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
