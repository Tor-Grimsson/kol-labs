import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import KineticType from './engine/KineticType.js'
import { PRESETS, presetById, presetParams, defaultInstance, mergeInstance, normalizeVf } from './data/presets.js'
import patternLoop from '../../loops/pattern/patternLoop.js'
import { SCENE_GROUPS, ELEMENT_GROUPS, sceneCat, elemCat } from './scenes/groups.js'
import { loadFonts } from './lib/vfAxes.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import CustomPathEditor from './CustomPathEditor.jsx'
import InstancePositioner from './InstancePositioner.jsx'
import MorphOverlay from './MorphOverlay.jsx'
import SelectionFrame from './SelectionFrame.jsx'
import { DEFAULT_POINTS, PATH_OPTIONS } from './engine/paths.js'
import DesignControls from './DesignControls.jsx'
import LayoutControls from './LayoutControls.jsx'
import EditControls from './EditControls.jsx'
import KineticTile from './KineticTile.jsx'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import ButtonGroup from '../../components/molecules/ButtonGroup.jsx'
import Section from '../../components/molecules/Section.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Scrubber from '../../components/framework/Scrubber.jsx'
import EditorRail from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import RailNav from '../../components/framework/RailNav.jsx'
import { usePublishShortcuts, usePublishReset, usePublishRetrigger } from '../../components/framework/pageShortcuts.jsx'
import { LiveClock } from '../../lib/liveClock.jsx'
import { defaultTheme, defaultAutoplay, defaultClipToFrame } from '../../lib/appSettings.js'
import { DEFAULT_THEME, resolveTheme } from '../../lib/themes.js'
import { mulberry32, randomSeed } from '../../lib/rng.js'

const VIEWS = ['generate', 'player', 'gallery', 'library']
const VIEW_PATHS = {
  generate: '/kinetic/generate',
  player:   '/kinetic/player',
  gallery:  '/kinetic/gallery',
  library:  '/kinetic/library',
}
const PAGE_HINTS = {
  generate: [
    ['Design', 'theme, colour, sentences'],
    ['Layout', 'instances + arrangement'],
    ['Edit',   'one instance: type, axes, OpenType, motion'],
    ['space',  'play / pause'],
    ['saved',  'live in the saved grid — click one to load'],
  ],
  player:  [['space', 'play / pause'], ['← / →', 'step scenes']],
  gallery: [['click', 'open in the player'], ['hover', 'preview the animation']],
  library: [['click', 'open in the editor'], ['hover', 'preview the animation']],
}

const SAVED_KEY = 'kol-kinetic:saved'
const readSaved  = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] } }
const writeSaved = (a) => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(a)) } catch { /* */ } }

export default function KineticPage() {
  const navigate   = useNavigate()
  const modeParts  = (useParams()['*'] || '').split('/').filter(Boolean)
  const view       = VIEWS.includes(modeParts[0]) ? modeParts[0] : 'generate'
  const galleryCat   = view === 'gallery' && SCENE_GROUPS.some((g) => g.key === modeParts[1]) ? modeParts[1] : null
  const libraryGroup = view === 'library' && ELEMENT_GROUPS.some((g) => g.key === modeParts[1]) ? modeParts[1] : null

  usePublishShortcuts('Kinetic', PAGE_HINTS[view] || [])
  useEffect(() => { if (!modeParts.length) navigate(VIEW_PATHS.generate, { replace: true }) }, [modeParts.length, navigate])

  // ── player pager ──
  const [idx, setIdx] = useState(0)

  // ── working composition (Generate) ──
  const first = useMemo(() => presetParams(PRESETS[0]), [])
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [frameBg, setFrameBg]   = useState(first.bg)
  const [instances, setInstances] = useState(first.instances)
  const [selId, setSelId]       = useState(first.instances[0]?.id)
  const [genTab, setGenTab]     = useState('design')   // design | layout | edit
  const [genView, setGenView]   = useState('current')  // current | saved
  const [saved, setSaved]       = useState(readSaved)
  const [savedIdx, setSavedIdx] = useState(0)
  const [addType, setAddType]   = useState('line') // arrangement for a newly added instance
  const addIdRef = useRef(1)

  // ── transport / export / scene ──
  const [playing, setPlaying]     = useState(() => defaultAutoplay())
  const [tempo, setTempo]         = useState(120)
  const [bottomTab, setBottomTab] = useState('transport')
  const [aspect, setAspect]       = useState(() => defaultAspectFor('view'))
  const [scale, setScale]         = useState(DEFAULT_SCALE)
  const [recording, setRecording] = useState(false)
  const [themeId, setThemeId]     = useState(() => defaultTheme())
  const [invert, setInvert]       = useState(false)
  const [seed, setSeed]           = useState(1)
  const [clip]                    = useState(() => defaultClipToFrame())
  const [pattern, setPattern]     = useState(() => ({ on: false, ...patternLoop.defaults }))
  const onPattern = (k, v) => setPattern((s) => ({ ...s, [k]: v }))

  // ── engine ──
  const [stage, setStage]   = useState({ w: 0, h: 0 })
  const hostRef    = useRef(null)
  const wrapRef    = useRef(null)
  const engineRef  = useRef(null)
  const progressRef = useRef({ t: 0, dur: 1 })
  const aspectRef  = useRef(aspect)
  aspectRef.current = aspect

  const stageVisible = (view === 'generate' && genView === 'current') || view === 'player'

  // engine sees the working composition in Generate, the picked preset in Player.
  // Glyph-mode pattern fill tiles the SELECTED instance — pass a reference so the
  // engine reads its live text/font/axes/italic (no per-field copying).
  const effPattern = useMemo(() => (pattern.on && pattern.shape === 'glyph') ? { ...pattern, glyphInstance: selId } : pattern, [pattern, selId])
  const engineParams = useMemo(
    () => (view === 'player' ? { ...presetParams(PRESETS[idx]), clip } : { bg: frameBg, instances, clip, pattern: effPattern }),
    [view, idx, frameBg, instances, clip, effPattern],
  )
  const paramsRef = useRef(engineParams)
  paramsRef.current = engineParams

  const sizeStage = useCallback(() => {
    const wrap = wrapRef.current
    const eng  = engineRef.current
    if (!wrap || !eng) return
    const aw = wrap.clientWidth
    const ah = wrap.clientHeight
    if (aw === 0 || ah === 0) return
    const r = ratioFor(aspectRef.current)
    let w = aw, h = ah
    if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
    const fw = Math.max(1, Math.floor(w))
    const fh = Math.max(1, Math.floor(h))
    eng.resize(fw, fh)
    setStage((s) => (s.w === fw && s.h === fh ? s : { w: fw, h: fh }))
  }, [])

  useEffect(() => {
    if (!stageVisible) return
    loadFonts()
    const eng = new KineticType(hostRef.current, paramsRef.current)
    eng.onProgress = (p) => { progressRef.current = p }
    engineRef.current = eng
    sizeStage()
    const ro = new ResizeObserver(() => sizeStage())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); eng.dispose(); engineRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageVisible, sizeStage])

  useEffect(() => { sizeStage() }, [aspect, sizeStage])
  useEffect(() => { engineRef.current?.setParams(engineParams) }, [engineParams])
  useEffect(() => { engineRef.current?.setTransport({ paused: !playing, speed: tempo / 120 }) }, [playing, tempo])

  // keep the selection valid as instances are added/removed
  useEffect(() => {
    if (!instances.find((x) => x.id === selId)) setSelId(instances[0]?.id)
  }, [instances, selId])

  const selected = instances.find((x) => x.id === selId) || null

  // ── instance mutation ──
  const setInst = (id, k, v) => setInstances((arr) => arr.map((x) => {
    if (x.id !== id) return x
    if (k === 'font') return { ...x, font: v, vf: normalizeVf(v, x.vf) }
    return { ...x, [k]: v }
  }))
  const setInstVf     = (id, tag, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, vf: { ...x.vf, [tag]: v } } : x))
  const setInstOt     = (id, tag, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, opentype: { ...x.opentype, [tag]: v } } : x))
  const setInstMorph  = (id, k, v)   => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, morph: { ...x.morph, [k]: v } } : x))
  const setInstMorphVf2 = (id, tag, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, morph: { ...x.morph, vf2: { ...x.morph?.vf2, [tag]: v } } } : x))
  const setInstPath   = (id, k, v)   => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, path: { ...x.path, [k]: v } } : x))
  const setInstMotion = (id, k, v)   => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, motion: { ...x.motion, [k]: v } } : x))
  const setInstMotions = (id, next)  => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, motions: next } : x))
  const setInstText   = (id, text)   => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, text } : x))

  const addInstance = (type = 'line') => {
    const id = `n${addIdRef.current++}`
    setInstances((arr) => [...arr, defaultInstance(id, { fill: arr[0]?.fill || '#e8e4dc', text: 'Text', path: { type } })])
    setSelId(id)
  }
  const removeInstance = (id) => setInstances((arr) => (arr.length <= 1 ? arr : arr.filter((x) => x.id !== id)))
  const reorderInstances = (from, to) => setInstances((arr) => { const next = [...arr]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next })
  // repeat an instance — clone it (deep on the nested objects) right after itself.
  const duplicateInstance = (id) => {
    const nid = `n${addIdRef.current++}`
    setInstances((arr) => {
      const idx = arr.findIndex((x) => x.id === id)
      if (idx < 0) return arr
      const s = arr[idx]
      const clone = { ...s, id: nid, vf: { ...s.vf }, opentype: { ...s.opentype }, path: { ...s.path }, motion: { ...s.motion }, motions: (s.motions || []).map((mm) => ({ ...mm })), offset: { ...s.offset }, morph: { ...s.morph, vf2: { ...(s.morph?.vf2 || {}) } } }
      const next = [...arr]; next.splice(idx + 1, 0, clone); return next
    })
    setSelId(nid)
  }

  // ── frame / colour ──
  const applyThemeColors = (id, inv) => {
    const t = resolveTheme(id, inv)
    setFrameBg(t.bg)
    setInstances((arr) => arr.map((x) => ({ ...x, fill: t.fg })))
  }
  const onTheme  = (id) => { setThemeId(id); applyThemeColors(id, invert) }
  const onInvert = (v)  => { setInvert(v); applyThemeColors(themeId, v) }
  const onAllFill = (hex) => setInstances((arr) => arr.map((x) => ({ ...x, fill: hex })))

  // ── presets / save ──
  // highest numeric id suffix present (e.g. 'n5' → 5) so the add-counter never
  // mints a colliding id after loading external instances.
  const maxInstId = (arr) => (arr || []).reduce((m, x) => { const n = parseInt(String(x.id).replace(/\D/g, ''), 10); return Number.isFinite(n) ? Math.max(m, n) : m }, 0)
  // re-normalise external instances (old/partial saves) to the full shape and
  // bump the id counter past anything present — fixes undefined-field access +
  // duplicate-id collisions in the engine's runtime map.
  const adoptInstances = (raw) => {
    const merged = (raw || []).map((p, i) => mergeInstance(p, i))
    addIdRef.current = Math.max(addIdRef.current, maxInstId(merged) + 1)
    return merged
  }
  const loadPreset = (preset) => {
    const c = presetParams(preset)
    setPresetId(preset.id)
    setFrameBg(c.bg)
    setInstances(c.instances)
    setSelId(c.instances[0]?.id)
    addIdRef.current = Math.max(addIdRef.current, maxInstId(c.instances) + 1)
  }
  const saveComposition = () => setSaved((prev) => {
    const next = [{ presetId, frameBg, instances, themeId, invert, clip, ts: Date.now() }, ...prev].slice(0, 60)
    writeSaved(next)
    return next
  })
  const loadComposition = (e) => {
    const merged = adoptInstances(e.instances)
    setPresetId(e.presetId || PRESETS[0].id)
    setFrameBg(e.frameBg || '#16202E')
    setInstances(merged)
    setSelId(merged[0]?.id)
    setThemeId(e.themeId ?? DEFAULT_THEME)
    setInvert(!!e.invert)

    setGenView('current')
  }
  const deleteComposition = (ts) => {
    setSaved((s) => { const next = s.filter((e) => e.ts !== ts); writeSaved(next); return next })
    setSavedIdx((i) => Math.max(0, Math.min(i, saved.length - 2))) // clamp into the shrunk list
  }
  const goSaved = (d) => { if (saved.length) setSavedIdx((i) => (i + d + saved.length) % saved.length) }

  // ── reroll / reset ──
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    setInstances((arr) => arr.map((x) => {
      const nx = { ...x }
      nx.fontSize = Math.round(48 + rng() * 200)
      nx.letterSpacing = Math.round(rng() * 24 - 6)
      nx.motion = { ...x.motion, cycles: 1 + Math.floor(rng() * 3), phase: Math.round(rng() * 100) / 100, amp: Math.round(rng() * 100) / 100 }
      nx.vf = { ...x.vf }
      if ('wght' in nx.vf) nx.vf.wght = Math.round(100 + rng() * 800)
      if ('wdth' in nx.vf) nx.vf.wdth = Math.round(60 + rng() * 90)
      return nx
    }))
  }
  const reroll   = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }
  const resetAll = () => { setThemeId(DEFAULT_THEME); setInvert(false); loadPreset(presetById(presetId)) }
  usePublishReset(resetAll)
  usePublishRetrigger(reroll)

  // ── export ──
  const dl = (blob, name) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }
  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await engineRef.current?.exportBlobAt(d.w, d.h) : await engineRef.current?.exportBlob()
    dl(blob, `kol-kinetic-${presetId}.png`)
  }
  const exportVideo = async () => {
    if (recording) return
    setRecording(true)
    try {
      const d = dimsFor(aspect, 1)
      dl(await engineRef.current?.recordLoop(d?.w, d?.h, 25), `kol-kinetic-${presetId}.webm`)
    } finally { setRecording(false) }
  }

  const getSettings  = () => ({ presetId, frameBg, instances, themeId, invert, seed, tempo, aspect, scale, pattern })
  const applySettings = (s) => {
    if (s.presetId) setPresetId(s.presetId)
    if (s.frameBg  != null) setFrameBg(s.frameBg)
    if (s.instances) { const m = adoptInstances(s.instances); setInstances(m); setSelId(m[0]?.id) }
    if (s.themeId  != null) setThemeId(s.themeId)
    if (s.invert   != null) setInvert(s.invert)

    if (s.seed     != null) setSeed(s.seed)
    if (s.tempo    != null) setTempo(s.tempo)
    if (s.aspect   != null) setAspect(s.aspect)
    if (s.scale    != null) setScale(s.scale)
    if (s.pattern) setPattern({ on: false, ...patternLoop.defaults, ...s.pattern })
  }

  // ── navigation ──
  const go           = (d)  => setIdx((i) => (i + d + PRESETS.length) % PRESETS.length)
  const openInPlayer = (i)  => { setIdx(i); navigate(VIEW_PATHS.player) }
  const openInEditor = (p)  => { loadPreset(p); setGenView('current'); setGenTab('design'); navigate(VIEW_PATHS.generate) }

  const def = PRESETS[idx]

  const browseToggle = (
    <SegmentedToggle
      value={view === 'gallery' ? 'scenes' : 'elements'}
      onChange={(v) => navigate(v === 'scenes' ? VIEW_PATHS.gallery : VIEW_PATHS.library)}
      options={[{ value: 'scenes', label: 'Scenes' }, { value: 'elements', label: 'Elements' }]}
    />
  )

  const footer = (
    <EditorFooter
      tab={bottomTab}
      onTab={setBottomTab}
      transport={{
        playing,
        onPlay:   () => setPlaying(true),
        onPause:  () => setPlaying(false),
        onStop:   () => { setPlaying(false); engineRef.current?.seek(0) },
        onRewind: () => engineRef.current?.seek(0),
        tempo, onTempo: setTempo, tempoMax: 300,
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
      settingsPage="kinetic"
      getSettings={getSettings}
      applySettings={applySettings}
    />
  )

  // Generate's nav + Design/Layout/Edit toggle are PINNED in the rail header so
  // they never scroll out of reach behind a tall tab.
  const railHeader = view === 'generate' ? (
    <>
      <RailNav
        title="Generate"
        toggleLabel={genView === 'current' ? `Saved (${saved.length})` : 'Current'}
        onToggle={() => setGenView(genView === 'current' ? 'saved' : 'current')}
        index={savedIdx}
        total={genView === 'saved' ? saved.length : 0}
        onPrev={() => goSaved(-1)}
        onNext={() => goSaved(1)}
      />
      {genView === 'current' && (
        <SegmentedToggle value={genTab} onChange={setGenTab} options={[{ value: 'design', label: 'Design' }, { value: 'layout', label: 'Layout' }, { value: 'edit', label: 'Edit' }]} />
      )}
    </>
  ) : null

  return (
    <div className="flex min-h-dvh">

      {/* ── stage ── */}
      <div className="flex-1 min-w-0 h-dvh bg-surface-secondary overflow-hidden">
        {stageVisible && (
          <div ref={wrapRef} className="relative h-full flex items-center justify-center">
            <div ref={hostRef} data-vcap="stage" className="w-fit flex items-center justify-center" />
            {view === 'generate' && selected?.path?.type === 'custom' && (
              <CustomPathEditor
                points={selected.path.points || DEFAULT_POINTS}
                stage={stage}
                onChange={(pts) => setInstPath(selId, 'points', pts)}
              />
            )}
            {view === 'generate' && selected && (
              <InstancePositioner
                offset={selected.offset}
                stage={stage}
                onChange={(o) => setInst(selId, 'offset', o)}
              />
            )}
            {view === 'generate' && selected && (
              <SelectionFrame
                engineRef={engineRef}
                selId={selId}
                stage={stage}
                instance={selected}
                onAlign={(v) => setInst(selId, 'align', v)}
                onWeight={(v) => setInstVf(selId, 'wght', v)}
                onItalic={(v) => setInst(selId, 'italic', v)}
                onFill={(c) => setInst(selId, 'fill', c)}
                onDelete={() => removeInstance(selId)}
              />
            )}
            {view === 'generate' && selected?.morph?.on && (
              <MorphOverlay
                instance={selected}
                stage={stage}
                onBlend={(v) => setInstMorph(selId, 'blend', v)}
              />
            )}
            <Scrubber progressRef={progressRef} playerRef={engineRef} />
          </div>
        )}

        {view === 'generate' && genView === 'saved' && (
          <div className="h-full overflow-y-auto p-6">
            {saved.length === 0
              ? <div className="kol-mono-12 text-meta">No saved compositions yet — tweak one and hit Save.</div>
              : (
                <div className="flex flex-wrap gap-4">
                  {saved.map((e, i) => (
                    <KineticTile
                      key={e.ts}
                      params={{ bg: e.frameBg, instances: e.instances }}
                      label={`${presetById(e.presetId).label}`}
                      keyId={e.ts}
                      playing
                      focused={i === savedIdx}
                      onClick={() => setSavedIdx(i)}
                      onOpen={() => loadComposition(e)}
                      onDelete={() => deleteComposition(e.ts)}
                    />
                  ))}
                </div>
              )}
          </div>
        )}

        {view === 'gallery' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">
            {(galleryCat ? SCENE_GROUPS.filter((g) => g.key === galleryCat) : SCENE_GROUPS).map((g) => {
              const items = PRESETS.filter((p) => sceneCat(p) === g.key)
              if (!items.length) return null
              return (
                <section key={g.key}>
                  <div className="kol-helper-10 text-meta mb-3">{g.label}</div>
                  <div className="flex flex-wrap gap-4">
                    {items.map((p) => (
                      <KineticTile key={p.id} params={presetParams(p)} label={p.label} keyId={p.id} playing focused={p.id === def?.id} onClick={() => setIdx(PRESETS.indexOf(p))} onOpen={() => openInPlayer(PRESETS.indexOf(p))} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {view === 'library' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">
            {(libraryGroup ? ELEMENT_GROUPS.filter((g) => g.key === libraryGroup) : ELEMENT_GROUPS).map((g) => {
              const items = PRESETS.filter((p) => elemCat(p) === g.key)
              if (!items.length) return null
              return (
                <section key={g.key}>
                  <div className="kol-helper-10 text-meta mb-3">{g.label}</div>
                  <div className="flex flex-wrap gap-4">
                    {items.map((p) => (
                      <KineticTile key={p.id} params={presetParams(p)} label={p.label} keyId={p.id} playing focused={p.id === def?.id} onClick={() => setIdx(PRESETS.indexOf(p))} onOpen={() => openInEditor(p)} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* ── rail ── */}
      <LiveClock getT={() => progressRef.current.t}>
        <EditorRail header={railHeader} footerBare={stageVisible} footer={stageVisible ? footer : null}>
          {/* ── Generate ── */}
          {view === 'generate' && (genView === 'current' ? (
            <>
              {genTab === 'design' && (
                <>
                  <DesignControls
                    themeId={themeId} onTheme={onTheme}
                    invert={invert} onInvert={onInvert}
                    frameBg={frameBg} onFrameBg={setFrameBg}
                    onAllFill={onAllFill}
                    instances={instances} onText={setInstText}
                    pattern={pattern} onPattern={onPattern}
                  />
                  <Divider />
                  <ButtonGroup orientation="vertical" className="w-full">
                    <Button variant="primary" size="sm" iconLeft="cycle" onClick={reroll}>Reroll</Button>
                    <Button variant="primary" size="sm" onClick={resetAll}>Reset to default</Button>
                  </ButtonGroup>
                </>
              )}

              {genTab === 'layout' && (
                <LayoutControls
                  instances={instances}
                  selId={selId}
                  onSelect={setSelId}
                  onEdit={(id) => { setSelId(id); setGenTab('edit') }}
                  onRemove={removeInstance}
                  onDuplicate={duplicateInstance}
                  onReorder={reorderInstances}
                  onPath={setInstPath}
                  onMotion={setInstMotion}
                  onMotions={setInstMotions}
                  set={setInst}
                />
              )}

              {genTab === 'edit' && (
                <>
                  {instances.length > 1 && (
                    <SegmentedToggle
                      value={selId}
                      onChange={setSelId}
                      options={instances.map((ins, i) => ({ value: ins.id, label: String(i + 1) }))}
                    />
                  )}
                  <EditControls
                    instance={selected}
                    set={(k, v) => setInst(selId, k, v)}
                    setVf={(tag, v) => setInstVf(selId, tag, v)}
                    setOt={(tag, v) => setInstOt(selId, tag, v)}
                    setMorph={(k, v) => setInstMorph(selId, k, v)}
                    setMorphVf2={(tag, v) => setInstMorphVf2(selId, tag, v)}
                  />
                  <Divider />
                  <Section label="Add instance">
                    <Dropdown size="sm" variant="subtle" openUp className="w-full" value={addType} onChange={setAddType} options={PATH_OPTIONS} />
                    <Button variant="primary" size="sm" className="w-full" onClick={() => addInstance(addType)}>Add to composition</Button>
                  </Section>
                  <Button variant="primary" size="sm" className="w-full" onClick={saveComposition}>Save composition</Button>
                  <div className="kol-helper-10 text-body">{presetById(presetId).label} · {instances.length} instance{instances.length === 1 ? '' : 's'}</div>
                </>
              )}
            </>
          ) : (
            <div className="kol-mono-10 text-body">{saved.length} saved · click to load, × to remove.</div>
          ))}

          {/* ── Player ── */}
          {view === 'player' && (
            <RailNav title={def?.label || ''} toggleLabel="Scenes" onToggle={() => navigate(VIEW_PATHS.gallery)} index={idx} total={PRESETS.length} onPrev={() => go(-1)} onNext={() => go(1)} />
          )}

          {/* ── Gallery ── */}
          {view === 'gallery' && (
            <>
              <div className="kol-helper-12 text-emphasis">{galleryCat ? SCENE_GROUPS.find((g) => g.key === galleryCat)?.label : 'Scenes'}</div>
              {browseToggle}
              <RailNav toggleLabel="Single" onToggle={() => navigate(VIEW_PATHS.player)} index={idx} total={PRESETS.length} onPrev={() => go(-1)} onNext={() => go(1)} />
            </>
          )}

          {/* ── Library ── */}
          {view === 'library' && (
            <>
              <div className="kol-helper-12 text-emphasis">{libraryGroup ? ELEMENT_GROUPS.find((g) => g.key === libraryGroup)?.label : 'Elements'}</div>
              {browseToggle}
              <RailNav toggleLabel="Single" onToggle={() => navigate(VIEW_PATHS.player)} index={idx} total={PRESETS.length} onPrev={() => go(-1)} onNext={() => go(1)} />
            </>
          )}
        </EditorRail>
      </LiveClock>
    </div>
  )
}
