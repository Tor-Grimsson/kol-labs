import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Input from '../../components/atoms/Input.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../components/molecules/ButtonGroup.jsx'
import EditorRail from '../../components/framework/EditorRail.jsx'
import RailNav from '../../components/framework/RailNav.jsx'
import TransportBar from '../../components/framework/TransportBar.jsx'
import './synth.css'
import { SCREENS } from './screens'
import { WIDGETS, CHROME, GROUPS, CATALOG, widgetFor } from './widgets/registry.js'
import { generate, renderComposition, sectionForKey, ASPECTS, THEMES, aspectFor } from './generator.js'
import { encode, encodeDom, setLiveEncode, CIPHER_MODES } from './widgets/cipher.js'
import ScaleToFit from './ScaleToFit.jsx'
import WidgetMount from './WidgetMount.jsx'
import WidgetCard from './WidgetCard.jsx'
import ScreenTile from './ScreenTile.jsx'
import ParamControls from './ParamControls.jsx'
import { downloadPng, recordWebm } from './lib/download.js'
import { recordRegion, regionCaptureSupported } from './lib/capture.js'
import { startClock, tempoMillis, setTempoScale } from './lib/clock.js'
import { stop as stopAudio, recStream, isActive as audioActive, isFile as audioIsFile, seek as audioSeek, play as audioPlay, pause as audioPause, duration as audioDuration } from './lib/audio.js'
import AudioControls from './AudioControls.jsx'
import CollapsibleSection from './CollapsibleSection.jsx'
import { FONTS } from './lib/fonts.js'

/* Section kind → inspector heading. */
const SECTION_LABELS = { widgets: 'Widget', label: 'Label', statusbar: 'Status bar', transport: 'Transport', readouts: 'Readouts', strip: 'Hex strip', dual: 'Dual numbers' }

/* Mode ↔ route. Generate is the index (/interfaces); the rest nest under it.
 * The mode switcher lives in the sidebar (NAV_TREE children), not the rail. */
const VIEW_PATHS = { generate: '/interfaces', player: '/interfaces/player', gallery: '/interfaces/gallery', library: '/interfaces/library' }
const VIEWS = ['player', 'gallery', 'library']
const ALL = [...WIDGETS, ...CHROME]
const SAVED_KEY = 'kol-interfaces:gen'
const readSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] } }
const writeSaved = (a) => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(a)) } catch { /* */ } }

/* Live working-draft autosave (reload-safe recall). Distinct from SAVED_KEY:
 * SAVED_KEY holds explicitly-kept compositions; DRAFT_KEY mirrors the current
 * in-progress edit so an accidental reload drops you back where you were. */
const DRAFT_KEY = 'kol-interfaces:draft'
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {} } catch { return {} } }

/* Factory layout — shared by initial state and Reset to default so they can't drift. */
const DEFAULT_LAYOUT = { padT: 18, padR: 16, padB: 16, padL: 16, gap: 8, scale: 1 }

/* mount helper shared by player / generate / saved tiles */
function useMount(buildFn, deps, playing, encodeMode) {
  const hostRef = useRef(null)
  const instancesRef = useRef([])
  useEffect(() => {
    const node = hostRef.current
    const res = buildFn(node)
    const instances = Array.isArray(res) ? res : res.instances
    instancesRef.current = instances
    // route every widget's clock through the shared tempo clock so one slider
    // scales all animation (widgets read time via p.millis()).
    startClock()
    for (const p of instances) { if (p && typeof p.millis === 'function') p.millis = () => tempoMillis() }
    encodeDom(node, encodeMode) // global "looks encoded" pass over the rendered DOM text
    const cleanups = []
    node.querySelectorAll('*').forEach((n) => { if (n._cleanup) cleanups.push(n._cleanup); n._setPlaying?.(playing) })
    for (const p of instances) playing ? p.loop() : p.noLoop()
    return () => {
      for (const p of instances) p.remove()
      for (const c of cleanups) c()
      instancesRef.current = []
      node.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, encodeMode])
  useEffect(() => {
    for (const p of instancesRef.current) playing ? p.loop() : p.noLoop()
    // DOM widgets (hex strip / dual numbers / codeScroll) aren't p5 instances —
    // they expose _setPlaying so the transport freezes them too.
    hostRef.current?.querySelectorAll('*').forEach((n) => n._setPlaying?.(playing))
  }, [playing])
  return hostRef
}

function PlayerStage({ def, playing, stopNonce, encodeMode }) {
  const hostRef = useMount((node) => def.build(node), [def, stopNonce], playing, encodeMode)
  return (
    <ScaleToFit className="w-full h-[80vh]">
      <div className="interfaces-page bare"><div className={`screen theme-${def.theme ?? 'default'}`} ref={hostRef} /></div>
    </ScaleToFit>
  )
}

function GenerateStage({ spec, playing, onRemove, onSelect, onInfo, selSec, encodeMode, stageHostRef }) {
  const hostRef = useMount((node) => renderComposition(spec, node, { editable: true }), [spec], playing, encodeMode)
  // surface the host node so the Output tab can target its .screen for capture
  useEffect(() => { if (stageHostRef) stageHostRef.current = hostRef.current })
  // selection is a class toggle (not a rebuild) so changing it never re-mounts
  // the p5 instances; re-runs after each rebuild too (spec in deps).
  useEffect(() => {
    const node = hostRef.current
    if (!node) return
    node.querySelectorAll('.gen-section').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.sec) === selSec)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSec, spec])
  const onClick = (e) => {
    const btn = e.target.closest?.('.gen-remove')
    if (btn) { e.stopPropagation(); e.preventDefault(); onRemove?.(Number(btn.dataset.sec)); return }
    const secEl = e.target.closest?.('.gen-section')
    onSelect?.(secEl && secEl.dataset.sec != null ? Number(secEl.dataset.sec) : null)
  }
  const onDouble = (e) => {
    const secEl = e.target.closest?.('.gen-section')
    if (secEl && secEl.dataset.sec != null) { e.preventDefault(); onInfo?.(Number(secEl.dataset.sec)) }
  }
  return (
    <ScaleToFit className="w-full h-[80vh]">
      <div className="interfaces-page bare" onClick={onClick} onDoubleClick={onDouble}><div ref={hostRef} /></div>
    </ScaleToFit>
  )
}

/* lazy saved-composition tile (regenerates from its seed) */
function GenTile({ entry, playing, focused, onClick, onDelete }) {
  const wrapRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const spec = useMemo(() => generate(entry.seed, { aspect: aspectFor(entry.aspectKey).ratio, theme: entry.theme, lockTheme: true }), [entry])
  const hostRef = useMount((node) => (visible ? renderComposition(spec, node) : { instances: [] }), [visible, spec], playing)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px' })
    if (wrapRef.current) io.observe(wrapRef.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => { if (focused) wrapRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [focused])
  return (
    <div ref={wrapRef} className="group relative flex flex-col gap-1">
      <button type="button" onClick={onClick} className="block">
        <ScaleToFit className={`h-48 w-full rounded border transition-colors ${focused ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-fg-08 group-hover:border-fg-24'}`}>
          <div className="interfaces-page bare"><div ref={hostRef} /></div>
        </ScaleToFit>
      </button>
      <div className="flex items-center justify-between kol-helper-10 text-meta">
        <span className="truncate">{entry.theme} · {entry.aspectKey}</span>
        <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Delete" onClick={onDelete} />
      </div>
    </div>
  )
}

/* Double-click info overlay — precise read of a section's contents + slots. */
function SectionInfo({ sec, onClose }) {
  if (!sec) return null
  const rows = []
  if (sec.kind === 'widgets') {
    for (const wd of sec.widgets) {
      const w = widgetFor(wd.key)
      rows.push([w?.label || wd.key, `${w?.params?.length ?? 0} slots`])
      for (const p of (w?.params || [])) rows.push([`  ${p.label || p.key}`, String(wd.opts?.[p.key] ?? '—')])
    }
  } else if (sec.kind === 'readouts') {
    rows.push(['Readouts', `${sec.items.length} rows`])
    for (const [k, v] of sec.items) rows.push([`  ${k}`, v])
  } else if (sec.kind === 'strip') { rows.push(['Hex strip', `${sec.groups} × ${sec.per}`]) }
  else if (sec.kind === 'dual') { rows.push(['Dual numbers', `${sec.rows} rows`]) }
  else { rows.push([sec.kind, sec.left || sec.right || sec.label || '—']) }
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="max-w-[320px] w-full bg-surface-primary border border-fg-16 rounded p-4 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="kol-helper-12 text-emphasis uppercase tracking-widest">{SECTION_LABELS[sec.kind] || sec.kind} · info</span>
          <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} onClick={onClose} />
        </div>
        <div className="flex flex-col gap-1 kol-mono-10">
          {rows.map(([k, v], i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-meta whitespace-pre">{k}</span>
              <span className="text-emphasis tabular-nums text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function InterfacesPage() {
  const navigate = useNavigate()
  const mode = useParams()['*'] || ''
  const view = VIEWS.includes(mode) ? mode : 'generate'
  // restore the autosaved working draft once per mount (reload-safe recall)
  const draftRef = useRef(undefined)
  if (draftRef.current === undefined) draftRef.current = readDraft()
  const draft = draftRef.current
  const [idx, setIdx] = useState(draft.idx ?? 0)
  const [libIdx, setLibIdx] = useState(draft.libIdx ?? 0)
  const [savedIdx, setSavedIdx] = useState(0)
  const [playing, setPlaying] = useState(draft.playing ?? true)
  const [stopNonce, setStopNonce] = useState(0)
  const [selKey, setSelKey] = useState(draft.selKey ?? null)
  const [opts, setOpts] = useState(draft.opts ?? {})
  const [recording, setRecording] = useState(false)
  // generate
  const [genSeed, setGenSeed] = useState(() => draft.genSeed ?? Math.floor(Math.random() * 1e9))
  const [aspectKey, setAspectKey] = useState(draft.aspectKey ?? '9:16')
  const [themeSel, setThemeSel] = useState(draft.themeSel ?? 'random')
  const [genView, setGenView] = useState(draft.genView ?? 'current')
  const [saved, setSaved] = useState(readSaved)
  const [removed, setRemoved] = useState(() => new Set(draft.removed ?? []))
  const [showChrome, setShowChrome] = useState(draft.showChrome ?? true)
  const [added, setAdded] = useState(draft.added ?? [])
  const [edits, setEdits] = useState(draft.edits ?? {}) // { [sectionId]: partial section override }
  const [selSec, setSelSec] = useState(draft.selSec ?? null) // selected section id (generate)
  const [addPick, setAddPick] = useState(draft.addPick ?? 'eqBars')
  const [genTab, setGenTab] = useState('edit') // generate rail tab: edit | design | mix
  const [infoSec, setInfoSec] = useState(null) // section id whose info overlay is open
  // global controls (persist across rerolls)
  const [tempo, setTempo] = useState(draft.tempo ?? 50) // 0–100; 50 = realtime
  const [genFont, setGenFont] = useState(draft.genFont ?? 'mono')
  const [encodeMode, setEncodeMode] = useState(draft.encodeMode ?? 'off') // global text-encode scheme
  setLiveEncode(encodeMode) // keep interval-driven painters (hex strip / dual numbers) in sync
  const [layout, setLayout] = useState(draft.layout ?? DEFAULT_LAYOUT)
  const setLay = (k, v) => setLayout((l) => ({ ...l, [k]: v }))
  // next added-block id: clear of any restored added ids so new blocks don't collide
  const addIdRef = useRef(null)
  if (addIdRef.current === null) addIdRef.current = (draft.added ?? []).reduce((m, s) => Math.max(m, (s.id ?? 0) + 1), 1000)
  const canvasRef = useRef(null)
  const recStopRef = useRef(null)
  // composition capture (Output tab)
  const [recLen, setRecLen] = useState(10) // seconds
  const [capturing, setCapturing] = useState(false)
  const [recElapsed, setRecElapsed] = useState(0) // live counter while recording
  const capStopRef = useRef(null)
  const recTickRef = useRef(null)
  const stageHostRef = useRef(null) // the GenerateStage host node (holds the .screen crop target)

  const def = SCREENS[idx]
  const widget = selKey ? widgetFor(selKey) : null
  const focusVariant = CATALOG[libIdx]
  const lockTheme = themeSel !== 'random'
  const spec = useMemo(
    () => generate(genSeed, { aspect: aspectFor(aspectKey).ratio, theme: lockTheme ? themeSel : null, lockTheme }),
    [genSeed, aspectKey, themeSel, lockTheme],
  )
  // what actually renders: generated sections (minus removed / hidden bars) +
  // manually added blocks, each with its per-section edit override applied.
  const applyEdit = (s) => (edits[s.id] ? { ...s, ...edits[s.id] } : s)
  const visibleSpec = useMemo(() => ({
    ...spec,
    layout, uiFont: genFont,
    sections: [
      ...spec.sections.filter((s) => !removed.has(s.id) && (showChrome || (s.kind !== 'statusbar' && s.kind !== 'transport'))),
      ...added,
    ].map(applyEdit),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [spec, removed, showChrome, added, edits, layout, genFont])
  const selectedSection = useMemo(() => visibleSpec.sections.find((s) => s.id === selSec) || null, [visibleSpec, selSec])

  const go = (d) => setIdx((i) => (i + d + SCREENS.length) % SCREENS.length)
  const doStop = () => { setPlaying(false); setStopNonce((n) => n + 1) }
  const openScreen = (i) => { setIdx(i); navigate(VIEW_PATHS.player) }
  const selectWidget = (key, presetOpts) => { setSelKey(key); setOpts(presetOpts ? { ...presetOpts } : { ...widgetFor(key).defaults }) }
  // library: pager over CATALOG variants; in detail view it also reloads the shown widget
  const openVariant = (i) => { setLibIdx(i); const v = CATALOG[i]; selectWidget(v.widget.key, v.opts) }
  const goLib = (d) => {
    const n = (libIdx + d + CATALOG.length) % CATALOG.length
    setLibIdx(n)
    if (widget) { const v = CATALOG[n]; selectWidget(v.widget.key, v.opts) }
  }
  // generate: pager over saved compositions (saved grid)
  const goSaved = (d) => { if (saved.length) setSavedIdx((i) => (i + d + saved.length) % saved.length) }
  const reroll = () => setGenSeed(Math.floor(Math.random() * 1e9))
  // Full factory reset across all three tabs — keeps the current seed (the
  // composition identity), strips every tweak. Edit: sections/edits/selection.
  // Design: aspect/theme/chrome/font/encode/layout. Mix: tempo. (Playback +
  // audio are momentary I/O, left as-is.)
  const resetAll = () => {
    setRemoved(new Set()); setAdded([]); setEdits({}); setSelSec(null); setAddPick('eqBars')
    setShowChrome(true); setAspectKey('9:16'); setThemeSel('random'); setGenFont('mono'); setEncodeMode('off'); setLayout(DEFAULT_LAYOUT)
    setTempo(50)
  }
  const saveComposition = () => {
    setSaved((s) => {
      const next = [{ seed: genSeed, aspectKey, theme: spec.theme, ts: Date.now() }, ...s].slice(0, 60)
      writeSaved(next)
      return next
    })
  }
  const loadComposition = (e) => { setGenSeed(e.seed); setAspectKey(e.aspectKey); setThemeSel(e.theme); setGenView('current') }
  const deleteComposition = (ts) => setSaved((s) => { const next = s.filter((e) => e.ts !== ts); writeSaved(next); return next })
  const removeSection = (id) => {
    setAdded((a) => a.filter((s) => s.id !== id))
    setRemoved((r) => new Set(r).add(id))
    setSelSec((s) => (s === id ? null : s))
  }
  // per-section edits: merge a partial override keyed by section id
  const patchSection = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }))
  const editField = (id, key, value) => patchSection(id, { [key]: value })
  const editWidgetParam = (id, wi, key, value) => {
    const sec = visibleSpec.sections.find((s) => s.id === id)
    if (!sec) return
    const widgets = sec.widgets.map((w, i) => (i === wi ? { ...w, opts: { ...w.opts, [key]: value } } : w))
    patchSection(id, { widgets })
  }
  const addBlock = (key) => {
    const sec = sectionForKey(key, Math.floor(Math.random() * 1e9))
    if (!sec) return
    sec.id = addIdRef.current++
    setAdded((a) => [...a, sec])
  }

  // a fresh reroll / aspect / theme starts with all sections back — but skip the
  // first run so a restored draft's edits/added/removed survive mount.
  const skipResetRef = useRef(true)
  useEffect(() => {
    if (skipResetRef.current) { skipResetRef.current = false; return }
    setRemoved(new Set()); setAdded([]); setEdits({}); setSelSec(null)
  }, [genSeed, aspectKey, themeSel])

  // autosave the live working draft so an accidental reload restores it exactly
  // (explicit Save composition is separate — that's for named keepers).
  useEffect(() => {
    const out = {
      idx, libIdx, playing, selKey, opts,
      genSeed, aspectKey, themeSel, genView, showChrome,
      removed: [...removed], added, edits, selSec, addPick,
      tempo, genFont, encodeMode, layout,
    }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(out)) } catch { /* */ }
  }, [idx, libIdx, playing, selKey, opts, genSeed, aspectKey, themeSel, genView, showChrome, removed, added, edits, selSec, addPick, tempo, genFont, encodeMode, layout])

  // tempo slider → shared clock scale (50 = realtime, 0 = frozen, 100 = 2×)
  useEffect(() => { setTempoScale(tempo / 50) }, [tempo])

  // release the mic when leaving interfaces
  useEffect(() => () => stopAudio(), [])

  // keyboard transport — player only
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (view !== 'player') return
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault() }
      else if (e.key === 'ArrowRight') { go(1); e.preventDefault() }
      else if (e.code === 'Space') { setPlaying((p) => !p); e.preventDefault() }
      else if (e.key === 's' || e.key === 'S') { doStop() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view])

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      document.querySelectorAll('.js-clock').forEach((n) => { n.textContent = encode(`${hh}:${mm}`, encodeMode) })
    }, 10_000)
    return () => clearInterval(id)
  }, [encodeMode])

  const toggleRec = () => {
    if (recording) { recStopRef.current?.(); setRecording(false); return }
    if (!canvasRef.current) return
    setRecording(true)
    recStopRef.current = recordWebm(canvasRef.current, selKey, { seconds: 5 })
    setTimeout(() => setRecording(false), 5000)
  }

  // Output tab — record the whole composition (canvas + DOM + optional audio)
  // via Region Capture. Crop target is the live .screen inside the stage host.
  const startCapture = async () => {
    const screen = stageHostRef.current?.querySelector('.screen')
    if (!screen || capturing) return
    setSelSec(null) // drop the edit-selection outline / × badge so it isn't filmed
    setCapturing(true)
    const withAudio = audioActive()
    const stop = await recordRegion(screen, {
      seconds: Math.max(1, recLen),
      name: `interfaces-${spec.seed}`,
      audioStream: withAudio ? recStream() : null,
      // start file playback + the counter only once recording truly begins (a
      // cancelled share prompt then never leaves the track playing/ticking)
      onStart: () => {
        if (withAudio && audioIsFile()) { audioSeek(0); audioPlay(); setPlaying(true) }
        const t0 = performance.now()
        setRecElapsed(0)
        recTickRef.current = setInterval(() => setRecElapsed((performance.now() - t0) / 1000), 200)
      },
      onStop: () => {
        clearInterval(recTickRef.current); recTickRef.current = null
        setRecElapsed(0)
        setCapturing(false)
        capStopRef.current = null
        if (withAudio && audioIsFile()) { audioPause(); setPlaying(false) }
      },
    })
    capStopRef.current = stop
  }
  const stopCapture = () => capStopRef.current?.()
  // end any in-flight capture + counter if the page unmounts mid-record
  useEffect(() => () => { clearInterval(recTickRef.current); capStopRef.current?.() }, [])

  // Browse = the two overview grids on one sidebar entry; this segmented
  // toggle is the Screens↔Elements switch, routed between the gallery/library
  // routes so existing cross-nav (player ↔ screens, variant detail) is intact.
  const browseTab = view === 'library' ? 'elements' : 'screens'
  const browseToggle = (
    <SegmentedToggle
      value={browseTab}
      onChange={(v) => navigate(v === 'elements' ? VIEW_PATHS.library : VIEW_PATHS.gallery)}
      options={[{ value: 'screens', label: 'Screens' }, { value: 'elements', label: 'Elements' }]}
    />
  )

  return (
    <div className="flex min-h-dvh">
      {/* ── stage ── */}
      <div className="flex-1 min-w-0 h-dvh bg-surface-secondary">
        {view === 'generate' && genView === 'current' && (
          <div data-audio-stage className="relative h-full flex items-center justify-center">
            <GenerateStage spec={visibleSpec} playing={playing} onRemove={removeSection} onSelect={setSelSec} onInfo={setInfoSec} selSec={selSec} encodeMode={encodeMode} stageHostRef={stageHostRef} />
            {infoSec != null && <SectionInfo sec={visibleSpec.sections.find((s) => s.id === infoSec)} onClose={() => setInfoSec(null)} />}
          </div>
        )}
        {view === 'generate' && genView === 'saved' && (
          <div className="h-full overflow-y-auto p-6">
            {saved.length === 0
              ? <div className="kol-mono-12 text-meta">No saved compositions yet — reroll and hit Save.</div>
              : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                  {saved.map((e, i) => (
                    <GenTile key={e.ts} entry={e} playing={playing} focused={i === savedIdx} onClick={() => loadComposition(e)} onDelete={() => deleteComposition(e.ts)} />
                  ))}
                </div>
              )}
          </div>
        )}

        {view === 'player' && <div data-audio-stage className="h-full flex items-center justify-center"><PlayerStage def={def} playing={playing} stopNonce={stopNonce} encodeMode={encodeMode} /></div>}

        {view === 'gallery' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {SCREENS.map((s, i) => (
                <ScreenTile key={s.id} def={s} playing focused={i === idx} onClick={() => openScreen(i)} />
              ))}
            </div>
          </div>
        )}

        {view === 'library' && !widget && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">
            {GROUPS.map((g) => {
              const items = CATALOG.filter((v) => v.widget.group === g.key)
              if (!items.length) return null
              return (
                <section key={g.key}>
                  <div className="kol-helper-10 uppercase tracking-widest text-meta mb-2">{g.label}</div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
                    {items.map((v) => (
                      <WidgetCard key={v.id} widget={v.widget} opts={v.opts} label={v.label} playing focused={focusVariant?.id === v.id} onClick={() => openVariant(CATALOG.indexOf(v))} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {view === 'library' && widget && (
          <div data-audio-stage className="h-full flex items-center justify-center p-8">
            <ScaleToFit className="w-[min(70vh,520px)] h-[min(70vh,520px)] bg-black rounded border border-fg-08 p-8">
              <WidgetMount factory={widget.factory} opts={opts} playing={playing} themed={widget.themed} onCanvas={(cv) => { canvasRef.current = cv }} />
            </ScaleToFit>
          </div>
        )}
      </div>

      {/* ── rail ── */}
      <EditorRail>
        {view === 'generate' && (
          <>
            <RailNav
              title="Generate"
              toggleLabel={genView === 'current' ? `saved (${saved.length})` : 'current'}
              onToggle={() => setGenView(genView === 'current' ? 'saved' : 'current')}
              index={savedIdx}
              total={genView === 'saved' ? saved.length : 0}
              onPrev={() => goSaved(-1)}
              onNext={() => goSaved(1)}
            />
            {genView === 'current' ? (
              <>
                <SegmentedToggle value={genTab} onChange={setGenTab} options={[{ value: 'edit', label: 'Edit' }, { value: 'design', label: 'Design' }, { value: 'output', label: 'Output' }]} />

                {genTab === 'edit' && (
                  <>
                    {selectedSection && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="kol-helper-12 text-emphasis">Selected · {SECTION_LABELS[selectedSection.kind] || selectedSection.kind}</span>
                          <button type="button" onClick={() => setSelSec(null)} className="kol-helper-10 text-meta hover:text-emphasis">deselect</button>
                        </div>
                        {selectedSection.kind === 'widgets' && selectedSection.widgets.map((wd, i) => {
                          const w = widgetFor(wd.key)
                          if (!w || !w.params.length) return null
                          return (
                            <CollapsibleSection key={i} label={w.label}>
                              <ParamControls params={w.params} opts={wd.opts} onChange={(k, v) => editWidgetParam(selSec, i, k, v)} />
                            </CollapsibleSection>
                          )
                        })}
                        {selectedSection.kind === 'label' && (
                          <Section label="Text">
                            <Input value={selectedSection.left ?? ''} onChange={(e) => editField(selSec, 'left', e.target.value)} placeholder="Left" />
                            <Input value={selectedSection.right ?? ''} onChange={(e) => editField(selSec, 'right', e.target.value)} placeholder="Right" />
                          </Section>
                        )}
                        {selectedSection.kind === 'statusbar' && (
                          <Section label="Text"><Input value={selectedSection.right ?? ''} onChange={(e) => editField(selSec, 'right', e.target.value)} /></Section>
                        )}
                        {selectedSection.kind === 'transport' && (
                          <Section label="Text"><Input value={selectedSection.label ?? ''} onChange={(e) => editField(selSec, 'label', e.target.value)} /></Section>
                        )}
                        {selectedSection.kind === 'strip' && (
                          <Section label="Hex strip">
                            <Slider label="groups" min={1} max={3} step={1} value={selectedSection.groups} onChange={(v) => editField(selSec, 'groups', v)} />
                            <Slider label="per" min={4} max={16} step={1} value={selectedSection.per} onChange={(v) => editField(selSec, 'per', v)} />
                          </Section>
                        )}
                        {selectedSection.kind === 'dual' && (
                          <Section label="Dual numbers"><Slider label="rows" min={3} max={10} step={1} value={selectedSection.rows} onChange={(v) => editField(selSec, 'rows', v)} /></Section>
                        )}
                        {selectedSection.kind === 'readouts' && (
                          <CollapsibleSection label={`Readouts (${selectedSection.items.length})`} defaultOpen>
                            {selectedSection.items.map((it, ri) => (
                              <div key={ri} className="flex gap-1">
                                <Input size="sm" className="w-2/5" value={it[0]} onChange={(e) => editField(selSec, 'items', selectedSection.items.map((x, j) => (j === ri ? [e.target.value, x[1]] : x)))} />
                                <Input size="sm" className="flex-1" value={it[1]} onChange={(e) => editField(selSec, 'items', selectedSection.items.map((x, j) => (j === ri ? [x[0], e.target.value] : x)))} />
                              </div>
                            ))}
                          </CollapsibleSection>
                        )}
                        <div>
                          <div className="kol-helper-10 text-meta mb-1">Font</div>
                          <Dropdown size="sm" variant="subtle" className="w-full" value={selectedSection.font || 'inherit'}
                            onChange={(v) => editField(selSec, 'font', v === 'inherit' ? undefined : v)}
                            options={[{ value: 'inherit', label: 'Inherit (UI)' }, ...FONTS.map((f) => ({ value: f.key, label: f.label }))]} />
                        </div>
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => removeSection(selSec)}>Remove element</Button>
                        <Divider />
                      </>
                    )}
                    <ButtonGroup orientation="vertical" className="w-full">
                      <Button variant="primary" size="sm" iconLeft="cycle" onClick={reroll}>Reroll</Button>
                      <Button variant="secondary" size="sm" onClick={resetAll}>Reset to default</Button>
                    </ButtonGroup>
                    <Section label="Add block">
                      <Dropdown size="sm" variant="subtle" className="w-full" value={addPick} onChange={setAddPick} options={ALL.map((w) => ({ value: w.key, label: w.label }))} />
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => addBlock(addPick)}>Add to composition</Button>
                    </Section>
                    <Button variant="primary" size="sm" className="w-full" onClick={saveComposition}>Save composition</Button>
                    <div className="kol-helper-10 text-body">seed {spec.seed} · {spec.theme} · {spec.columns} col</div>
                    <p className="kol-mono-10 text-meta">Click a section to select + edit · double-click for info · × removes · reroll resets.</p>
                  </>
                )}

                {genTab === 'design' && (
                  <>
                    <Section label="Output">
                      <div>
                        <div className="kol-helper-10 text-meta mb-1">Aspect</div>
                        <Dropdown size="sm" variant="subtle" className="w-full" value={aspectKey} onChange={setAspectKey} options={ASPECTS.map((a) => ({ value: a.key, label: a.label }))} />
                      </div>
                      <div>
                        <div className="kol-helper-10 text-meta mb-1">Theme</div>
                        <Dropdown size="sm" variant="subtle" className="w-full" value={themeSel} onChange={setThemeSel}
                          options={[{ value: 'random', label: 'Random' }, ...THEMES.map((t) => ({ value: t, label: t }))]} />
                      </div>
                      <div>
                        <div className="kol-helper-10 text-meta mb-1">Status bars (top + bottom)</div>
                        <SegmentedToggle value={showChrome ? 'on' : 'off'} onChange={(v) => setShowChrome(v === 'on')} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
                      </div>
                    </Section>
                    <Section label="Layout">
                      <div>
                        <div className="kol-helper-10 text-meta mb-1">UI font</div>
                        <Dropdown size="sm" variant="subtle" className="w-full" value={genFont} onChange={setGenFont} options={FONTS.map((f) => ({ value: f.key, label: f.label }))} />
                      </div>
                      <div>
                        <div className="kol-helper-10 text-meta mb-1">Encode</div>
                        <Dropdown size="sm" variant="subtle" className="w-full" value={encodeMode} onChange={setEncodeMode} options={[{ value: 'off', label: 'Off' }, ...CIPHER_MODES.map((m) => ({ value: m, label: m }))]} />
                      </div>
                      <Slider label="Gap" min={0} max={32} step={1} value={layout.gap} onChange={(v) => setLay('gap', v)} />
                      <Slider label="Scale" min={0.5} max={1.5} step={0.05} value={layout.scale} onChange={(v) => setLay('scale', v)} />
                      <Slider label="Pad top" min={0} max={48} step={1} value={layout.padT} onChange={(v) => setLay('padT', v)} />
                      <Slider label="Pad right" min={0} max={48} step={1} value={layout.padR} onChange={(v) => setLay('padR', v)} />
                      <Slider label="Pad bottom" min={0} max={48} step={1} value={layout.padB} onChange={(v) => setLay('padB', v)} />
                      <Slider label="Pad left" min={0} max={48} step={1} value={layout.padL} onChange={(v) => setLay('padL', v)} />
                    </Section>
                  </>
                )}

                {genTab === 'output' && (
                  <Section label="Record composition">
                    <div className="flex gap-1.5">
                      {[5, 10, 20, 30, 60].map((s) => (
                        <button key={s} type="button" onClick={() => setRecLen(s)}
                          className={`flex-1 rounded kol-helper-10 py-1 border transition-colors ${recLen === s ? 'bg-surface-secondary text-emphasis border-fg-48' : 'text-meta border-fg-08 hover:text-emphasis hover:border-fg-24'}`}>
                          {s}s
                        </button>
                      ))}
                    </div>
                    <Slider label="Length (s)" min={1} max={120} step={1} value={recLen} onChange={setRecLen} />
                    {audioActive() && audioIsFile() && audioDuration() > 0 && (
                      <button type="button" onClick={() => setRecLen(Math.ceil(audioDuration()))} className="kol-helper-10 text-meta hover:text-emphasis text-left">
                        audio track is {Math.ceil(audioDuration())}s · use track length
                      </button>
                    )}
                    {capturing && (
                      <div className="kol-mono-12 text-emphasis flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Recording · {Math.floor(recElapsed)} / {recLen}s
                      </div>
                    )}
                    {regionCaptureSupported() ? (
                      <Button variant={capturing ? 'accent' : 'primary'} size="sm" className="w-full" iconLeft="circle" onClick={capturing ? stopCapture : startCapture}>
                        {capturing ? 'Stop recording' : 'Record composition'}
                      </Button>
                    ) : (
                      <div className="kol-mono-10 text-meta">Composition recording needs Chrome or Edge (Region Capture).</div>
                    )}
                    <p className="kol-mono-10 text-body">
                      Captures the live composition — canvas + UI{audioActive() ? ' + audio' : ''} — as a webm at screen resolution. You'll be asked to share this tab; pick this tab to start.
                    </p>
                  </Section>
                )}

                {/* Mix pinned to the rail bottom — transport + audio stay relevant across Edit/Design */}
                <div className="mt-auto sticky bottom-0 -mx-5 -mb-5 px-5 pt-3 pb-5 bg-surface-primary border-t border-fg-08 flex flex-col gap-3">
                  <TransportBar
                    playing={playing}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onStop={() => setPlaying(false)}
                    tempo={tempo}
                    onTempo={setTempo}
                  />
                  <AudioControls />
                </div>
              </>
            ) : (
              <div className="kol-mono-10 text-body">{saved.length} saved · click to load, × to remove.</div>
            )}
          </>
        )}

        {view === 'player' && (
          <>
            <RailNav title={def.title} toggleLabel="screens" onToggle={() => navigate(VIEW_PATHS.gallery)} index={idx} total={SCREENS.length} onPrev={() => go(-1)} onNext={() => go(1)} />
            <Section label="Transport">
              <div className="w-full rounded bg-surface-secondary text-emphasis kol-mono-12 text-center py-1.5">Transport Controls</div>
              <TransportBar
                playing={playing}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onStop={doStop}
                tempo={tempo}
                onTempo={setTempo}
              />
            </Section>
            <AudioControls />
            <div>
              <div className="kol-helper-10 text-meta mb-1">Encode</div>
              <Dropdown size="sm" variant="subtle" className="w-full" value={encodeMode} onChange={setEncodeMode} options={[{ value: 'off', label: 'Off' }, ...CIPHER_MODES.map((m) => ({ value: m, label: m }))]} />
            </div>
            <div className="kol-helper-10 text-body flex flex-col gap-1">
              <div>SPACE · PLAY/PAUSE</div>
              <div>←/→ · SCREEN</div>
              <div>S · STOP</div>
            </div>
            <div className="kol-mono-10 text-body">{def.subtitle}</div>
          </>
        )}

        {view === 'gallery' && (
          <>
            {browseToggle}
            <RailNav title={def.title} toggleLabel="single" onToggle={() => navigate(VIEW_PATHS.player)} index={idx} total={SCREENS.length} onPrev={() => go(-1)} onNext={() => go(1)} />
            <div className="kol-mono-10 text-body">{SCREENS.length} screens · click one to open it in the player.</div>
          </>
        )}

        {view === 'library' && !widget && (
          <>
            {browseToggle}
            <RailNav title="Elements" toggleLabel="single" onToggle={() => openVariant(libIdx)} index={libIdx} total={CATALOG.length} onPrev={() => goLib(-1)} onNext={() => goLib(1)} />
            <div className="kol-mono-10 text-body">{CATALOG.length} variants · {ALL.length} elements across {GROUPS.length} groups · click one to tweak + download.</div>
          </>
        )}

        {view === 'library' && widget && (
          <>
            {browseToggle}
            <RailNav title={widget.label} toggleLabel="elements" onToggle={() => setSelKey(null)} index={libIdx} total={CATALOG.length} onPrev={() => goLib(-1)} onNext={() => goLib(1)} />
            {['eqBars', 'hBars', 'vu'].includes(selKey) && <AudioControls getCanvas={() => canvasRef.current} />}
            {widget.params.length > 0 && (
              <Section label="Parameters">
                <ParamControls params={widget.params} opts={opts} onChange={(k, v) => setOpts((o) => ({ ...o, [k]: v }))} />
              </Section>
            )}
            {!widget.themed && (
              <>
                <Divider />
                <Section label="Export">
                  <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={() => downloadPng(canvasRef.current, selKey)}>PNG ×4</Button>
                  <Button variant={recording ? 'accent' : 'primary'} size="sm" className="w-full" iconLeft="circle" onClick={toggleRec}>{recording ? 'Stop recording' : 'Record webm (5s)'}</Button>
                </Section>
              </>
            )}
            {widget.params.length > 0 && <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpts({ ...widget.defaults })}>Reset params</Button>}
          </>
        )}
      </EditorRail>
    </div>
  )
}
