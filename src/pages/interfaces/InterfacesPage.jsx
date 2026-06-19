import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Input from '../../components/atoms/Input.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../components/molecules/ButtonGroup.jsx'
import EditorRail from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import { usePublishShortcuts, usePublishReset, usePublishRetrigger } from '../../components/framework/pageShortcuts.jsx'
import RailNav from '../../components/framework/RailNav.jsx'
import './synth.css'
import { SCREENS, SCREEN_GROUPS, screenCat } from './screens'
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
import { startClock, tempoMillis, setTempoScale, resetClock } from './lib/clock.js'
import { stop as stopAudio, recStream, isActive as audioActive, isFile as audioIsFile, seek as audioSeek, play as audioPlay, pause as audioPause, duration as audioDuration } from './lib/audio.js'
import AudioControls from './AudioControls.jsx'
import CollapsibleSection from './CollapsibleSection.jsx'
import { FONTS } from './lib/fonts.js'

/* Section kind → inspector heading. */
const SECTION_LABELS = { widgets: 'Widget', label: 'Label', statusbar: 'Status bar', transport: 'Transport', readouts: 'Readouts', strip: 'Hex strip', dual: 'Dual numbers' }

/* Proper-case display labels for the theme + cipher ids (irregular casing — KOL,
 * ROT13, Base64 — so authored explicitly rather than capitalize()'d). */
const THEME_LABEL = { default: 'Default', blood: 'Blood', ice: 'Ice', mono: 'Mono', cream: 'Cream', kol: 'KOL' }
const CIPHER_LABEL = { hex: 'Hex', binary: 'Binary', base64: 'Base64', morse: 'Morse', katakana: 'Katakana', rot13: 'ROT13', leet: 'Leet' }

/* Mode ↔ route. Generate is the index (/interfaces); the rest nest under it.
 * The mode switcher lives in the sidebar (NAV_TREE children), not the rail. */
const VIEW_PATHS = { generate: '/interfaces/generate', player: '/interfaces/player', gallery: '/interfaces/gallery', library: '/interfaces/library' }
const VIEWS = ['generate', 'player', 'gallery', 'library']

// Per-view interaction hints, surfaced in the global `s` shortcuts overlay.
const PAGE_HINTS = {
  generate: [
    ['click', 'select + edit a section'],
    ['double-click', 'section info'],
    ['×', 'remove a section'],
    ['reroll', 'reset the composition'],
    ['saved', 'live in the saved grid (Generate header → saved) — click one to load'],
    ['drag', 'reorder how elements flow into the columns'],
    ['eye', 'show / hide an element'],
    ['hover', 'locate an element on the canvas'],
    ['recording', 'needs Chrome or Edge (Region Capture)'],
  ],
  player: [
    ['space', 'play / pause'],
    ['← / →', 'step screens'],
    ['S', 'stop'],
  ],
  gallery: [['click', 'open a screen in the player']],
  library: [['click', 'tweak + download a variant']],
}
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

function PlayerStage({ def, playing, stopNonce, encodeMode, stageHostRef }) {
  const hostRef = useMount((node) => def.build(node), [def, stopNonce], playing, encodeMode)
  // surface the wrapper (holds .screen) so the Output tab can record the player too
  return (
    <ScaleToFit className="w-full h-[80vh]">
      <div className="interfaces-page bare" ref={stageHostRef}><div className={`screen theme-${def.theme ?? 'default'}`} ref={hostRef} /></div>
    </ScaleToFit>
  )
}

function GenerateStage({ spec, playing, onRemove, onSelect, onInfo, selSec, encodeMode, stageHostRef, layoutMode, hoverSec, onRendered }) {
  const hostRef = useMount((node) => renderComposition(spec, node, { editable: true, onRendered }), [spec], playing, encodeMode)
  // surface the host node so the Output tab can target its .screen for capture
  useEffect(() => { if (stageHostRef) stageHostRef.current = hostRef.current })
  // outline every section while the Layout tab is open
  useEffect(() => { hostRef.current?.classList.toggle('layout-mode', !!layoutMode) }, [layoutMode, spec])
  // highlight the section currently hovered in the Layout list
  useEffect(() => {
    hostRef.current?.querySelectorAll('.gen-section').forEach((el) => el.classList.toggle('layout-hover', Number(el.dataset.sec) === hoverSec))
  }, [hoverSec, spec])
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
  const modeParts = (useParams()['*'] || '').split('/').filter(Boolean)
  const view = VIEWS.includes(modeParts[0]) ? modeParts[0] : 'generate'
  // Library can be filtered to one widget group: /interfaces/library/<group>.
  const libGroup = view === 'library' && GROUPS.some((g) => g.key === modeParts[1]) ? modeParts[1] : null
  // Gallery can be filtered to one screen category: /interfaces/gallery/<cat>.
  const galleryCat = view === 'gallery' && SCREEN_GROUPS.some((g) => g.key === modeParts[1]) ? modeParts[1] : null
  // CATALOG indices in the active group (all of them when unfiltered).
  const libFiltered = libGroup ? CATALOG.flatMap((v, i) => (v.widget.group === libGroup ? [i] : [])) : CATALOG.map((_, i) => i)
  usePublishShortcuts('Interfaces', PAGE_HINTS[view] || [])
  // Generate's canonical slug is /interfaces/generate; bare /interfaces redirects.
  useEffect(() => { if (!modeParts.length) navigate(VIEW_PATHS.generate, { replace: true }) }, [modeParts.length, navigate])
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
  const [removed, setRemoved] = useState(() => new Set(draft.removed ?? [])) // hidden (eye toggle)
  const [deleted, setDeleted] = useState(() => new Set(draft.deleted ?? [])) // deleted (×) — gone from the list
  const [renderedIds, setRenderedIds] = useState(null) // ids the composition actually rendered (post height-trim)
  const [showChrome, setShowChrome] = useState(draft.showChrome ?? true)
  const [added, setAdded] = useState(draft.added ?? [])
  const [edits, setEdits] = useState(draft.edits ?? {}) // { [sectionId]: partial section override }
  const [order, setOrder] = useState(draft.order ?? []) // Layout-tab body reorder (array of section ids)
  const [dragOver, setDragOver] = useState(null) // Layout drop-target index (yellow insertion line)
  const [hoverSec, setHoverSec] = useState(null) // Layout: list-hovered section id (highlights it on stage)
  const [selSec, setSelSec] = useState(draft.selSec ?? null) // selected section id (generate)
  const [addPick, setAddPick] = useState(draft.addPick ?? 'eqBars')
  const [genTab, setGenTab] = useState('design') // generate rail tab: design | layout | edit
  const [bottomTab, setBottomTab] = useState('transport') // pinned bottom panel: transport | output
  const [infoSec, setInfoSec] = useState(null) // section id whose info overlay is open
  // global controls (persist across rerolls)
  const [tempo, setTempo] = useState(120) // BPM; 120 = realtime baseline (not drafted — always defaults to 120)
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
  const dragFrom = useRef(null) // Layout drag source index

  const def = SCREENS[idx]
  const selWidget = selKey ? widgetFor(selKey) : null
  // In a category, only show a detail for a widget that belongs to it — landing
  // on a category otherwise shows that category's grid.
  const widget = selWidget && (!libGroup || selWidget.group === libGroup) ? selWidget : null
  const focusVariant = CATALOG[libIdx]
  const lockTheme = themeSel !== 'random'
  const spec = useMemo(
    () => generate(genSeed, { aspect: aspectFor(aspectKey).ratio, theme: lockTheme ? themeSel : null, lockTheme }),
    [genSeed, aspectKey, themeSel, lockTheme],
  )
  // what actually renders: generated sections (minus removed / hidden bars) +
  // manually added blocks, each with its per-section edit override applied.
  const applyEdit = (s) => (edits[s.id] ? { ...s, ...edits[s.id] } : s)
  // every section (generated + added), edited + ordered — the Layout list source
  // (keeps hidden ones so they can be toggled back on).
  const allSections = useMemo(() => {
    const secs = [...spec.sections, ...added].filter((s) => !deleted.has(s.id)).map(applyEdit)
    if (order.length) {
      const at = new Map(order.map((id, i) => [id, i]))
      secs.sort((a, b) => (at.get(a.id) ?? 1e9) - (at.get(b.id) ?? 1e9))
    }
    return secs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, added, edits, order, deleted])
  // what renders: drop hidden (removed) + chrome when showChrome is off
  const visibleSpec = useMemo(() => ({
    ...spec, layout, uiFont: genFont,
    // eye-hidden sections stay in place as invisible spacers (keep their slot) so
    // hiding never frees space for the trim to backfill. showChrome-off chrome is dropped outright.
    sections: allSections
      .filter((s) => showChrome || (s.kind !== 'statusbar' && s.kind !== 'transport'))
      .map((s) => (removed.has(s.id) ? { ...s, hidden: true } : s)),
  }), [spec, allSections, removed, showChrome, layout, genFont])
  const selectedSection = useMemo(() => visibleSpec.sections.find((s) => s.id === selSec) || null, [visibleSpec, selSec])
  // Layout tab lists ALL sections incl. hidden. Status bar AND transport both flow
  // as normal body items now — reorderable, nothing pinned.
  // the Layout list mirrors what actually renders (post height-trim) + anything hidden
  const listSections = renderedIds ? allSections.filter((s) => renderedIds.has(s.id) || removed.has(s.id)) : allSections
  const bodySections = listSections
  const dropRow = (to) => {
    const from = dragFrom.current; dragFrom.current = null
    if (from == null || from === to) return
    const ids = bodySections.map((s) => s.id)
    const [moved] = ids.splice(from, 1); ids.splice(to, 0, moved)
    setOrder(ids)
  }
  const toggleHidden = (id) => setRemoved((r) => { const n = new Set(r); n.has(id) ? n.delete(id) : n.add(id); return n })
  // the composition reports which sections survived its height-trim
  const handleRendered = useCallback((ids) => {
    setRenderedIds((prev) => (prev && prev.size === ids.length && ids.every((id) => prev.has(id)) ? prev : new Set(ids)))
  }, [])

  const go = (d) => setIdx((i) => (i + d + SCREENS.length) % SCREENS.length)
  const doStop = () => { setPlaying(false); setStopNonce((n) => n + 1) }
  const openScreen = (i) => { setIdx(i); navigate(VIEW_PATHS.player) }
  const selectWidget = (key, presetOpts) => { setSelKey(key); setOpts(presetOpts ? { ...presetOpts } : { ...widgetFor(key).defaults }) }
  // library: pager over CATALOG variants; in detail view it also reloads the shown widget
  const openVariant = (i) => { setLibIdx(i); const v = CATALOG[i]; selectWidget(v.widget.key, v.opts) }
  const goLib = (d) => {
    const cur = libFiltered.indexOf(libIdx)
    const base = cur < 0 ? 0 : cur
    const n = libFiltered[(base + d + libFiltered.length) % libFiltered.length]
    setLibIdx(n)
    if (widget) { const v = CATALOG[n]; selectWidget(v.widget.key, v.opts) }
  }
  // If the active library group no longer contains the focused variant, jump to
  // its first (mirrors penrose's category filter).
  useEffect(() => {
    if (view !== 'library' || !libGroup) return
    // landing on a category shows its grid, not a stale (possibly cross-group) detail
    setSelKey(null)
    if (!libFiltered.includes(libIdx)) setLibIdx(libFiltered[0] ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libGroup])
  // generate: pager over saved compositions (saved grid)
  const goSaved = (d) => { if (saved.length) setSavedIdx((i) => (i + d + saved.length) % saved.length) }
  const reroll = () => setGenSeed(Math.floor(Math.random() * 1e9))
  // Full factory reset across all three tabs — keeps the current seed (the
  // composition identity), strips every tweak. Edit: sections/edits/selection.
  // Design: aspect/theme/chrome/font/encode/layout. Mix: tempo. (Playback +
  // audio are momentary I/O, left as-is.)
  const resetAll = () => {
    setRemoved(new Set()); setDeleted(new Set()); setAdded([]); setEdits({}); setOrder([]); setSelSec(null); setAddPick('eqBars')
    setShowChrome(true); setAspectKey('9:16'); setThemeSel('random'); setGenFont('mono'); setEncodeMode('off'); setLayout(DEFAULT_LAYOUT)
    setTempo(60)
  }
  usePublishReset(resetAll)
  usePublishRetrigger(reroll)
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
    setAdded((a) => a.filter((s) => s.id !== id)) // added block → drop it
    setDeleted((d) => new Set(d).add(id))          // generated → delete (gone from the list; eye = hide instead)
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
  // Browse → element detail: drop the element (with its tweaked params) into the
  // Generate composition, then jump there with it selected.
  const addToGenerate = (key, withOpts) => {
    const sec = sectionForKey(key, Math.floor(Math.random() * 1e9))
    if (!sec) return
    if (withOpts) {
      if (sec.kind === 'widgets') sec.widgets = sec.widgets.map((wd) => ({ ...wd, opts: { ...withOpts } }))
      else Object.assign(sec, withOpts) // chrome: carry the variant's fields (rows, cols, …)
    }
    sec.id = addIdRef.current++
    setAdded((a) => [...a, sec])
    navigate(VIEW_PATHS.generate)
    setGenView('current'); setGenTab('edit'); setSelSec(sec.id)
  }

  // a fresh reroll / aspect / theme starts with all sections back — but skip the
  // first run so a restored draft's edits/added/removed survive mount.
  const skipResetRef = useRef(true)
  useEffect(() => {
    if (skipResetRef.current) { skipResetRef.current = false; return }
    setRemoved(new Set()); setDeleted(new Set()); setAdded([]); setEdits({}); setOrder([]); setSelSec(null)
  }, [genSeed, aspectKey, themeSel])

  // autosave the live working draft so an accidental reload restores it exactly
  // (explicit Save composition is separate — that's for named keepers).
  useEffect(() => {
    const out = {
      idx, libIdx, playing, selKey, opts,
      genSeed, aspectKey, themeSel, genView, showChrome,
      removed: [...removed], deleted: [...deleted], added, edits, order, selSec, addPick,
      genFont, encodeMode, layout,
    }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(out)) } catch { /* */ }
  }, [idx, libIdx, playing, selKey, opts, genSeed, aspectKey, themeSel, genView, showChrome, removed, added, edits, order, selSec, addPick, tempo, genFont, encodeMode, layout, deleted])

  // tempo (BPM) → shared clock scale (120 = realtime, 0 = frozen, 240 = 2×)
  useEffect(() => { setTempoScale(tempo / 240) }, [tempo])

  // release the mic when leaving interfaces
  useEffect(() => () => stopAudio(), [])

  // keyboard transport — player only
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (view !== 'player') return
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault() }
      else if (e.key === 'ArrowRight') { go(1); e.preventDefault() }
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

  // Shared Output panel — bespoke composition capture (not the aspect×scale
  // ExportPanel). Used by both the generate and player footers. Recording needs
  // Region Capture (Chrome/Edge) → button disabled otherwise; the why is in the
  // `s` overlay, not inline noise.
  const recordOutput = (
    <>
      <div className="flex gap-1.5">
        {[5, 10, 20, 30, 60].map((s) => (
          <button key={s} type="button" onClick={() => setRecLen(s)}
            className={`flex-1 rounded kol-helper-10 py-1 border transition-colors ${recLen === s ? 'bg-surface-secondary text-emphasis border-fg-48' : 'text-meta border-fg-08 hover:text-emphasis hover:border-fg-24'}`}>
            {s}s
          </button>
        ))}
      </div>
      <Slider labeled label="Length (s)" min={1} max={120} step={1} value={recLen} onChange={setRecLen} />
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
      <Button variant={capturing ? 'accent' : 'primary'} size="sm" className="w-full" iconLeft="circle" disabled={!regionCaptureSupported()} onClick={capturing ? stopCapture : startCapture}>
        {capturing ? 'Stop recording' : 'Record composition'}
      </Button>
    </>
  )

  // generate/current rail footer — Transport · Output · File. Output = aspect
  // (export frame) + composition capture; File = audio source + save composition.
  const generateFooter = (
    <EditorFooter
      tab={bottomTab}
      onTab={setBottomTab}
      transport={{
        playing,
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onStop: () => setPlaying(false),
        onRewind: () => resetClock(),
        tempo,
        onTempo: setTempo,
        tempoMax: 600,
      }}
      output={(
        <>
          <LabeledControl label="Aspect">
            <Dropdown size="sm" variant="subtle" className="w-full" openUp value={aspectKey} onChange={setAspectKey} options={ASPECTS.map((a) => ({ value: a.key, label: a.label }))} />
          </LabeledControl>
          {recordOutput}
        </>
      )}
      file={(
        <>
          <AudioControls />
          <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={saveComposition}>Save composition</Button>
        </>
      )}
    />
  )

  // player rail footer — the SAME EditorFooter shell. Output records the screen,
  // File is the audio source; Transport drives the screen animation.
  const playerFooter = (
    <EditorFooter
      tab={bottomTab}
      onTab={setBottomTab}
      transport={{
        playing,
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onStop: doStop,
        onRewind: () => { resetClock(); setStopNonce((n) => n + 1) },
        tempo,
        onTempo: setTempo,
        tempoMax: 600,
      }}
      output={recordOutput}
      file={<AudioControls />}
    />
  )

  // library detail rail footer — the SAME EditorFooter shell. Transport drives
  // the widget animation; Output is the per-widget PNG/webm (canvas-res, not the
  // aspect×scale ExportPanel — themed elements have none); File is the audio
  // source for the reactive widgets.
  const libraryFooter = (
    <EditorFooter
      tab={bottomTab}
      onTab={setBottomTab}
      transport={{
        playing,
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onStop: () => setPlaying(false),
        onRewind: () => resetClock(),
        tempo,
        onTempo: setTempo,
        tempoMax: 600,
      }}
      output={widget && !widget.themed ? (
        <>
          <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={() => downloadPng(canvasRef.current, selKey)}>PNG ×4</Button>
          <Button variant={recording ? 'accent' : 'primary'} size="sm" className="w-full" iconLeft="circle" onClick={toggleRec}>{recording ? 'Stop recording' : 'Record webm (5s)'}</Button>
        </>
      ) : null}
      file={<AudioControls getCanvas={() => canvasRef.current} />}
    />
  )

  return (
    <div className="flex min-h-dvh">
      {/* ── stage ── */}
      <div className="flex-1 min-w-0 h-dvh bg-surface-secondary">
        {view === 'generate' && genView === 'current' && (
          <div data-audio-stage className="relative h-full flex items-center justify-center">
            <GenerateStage spec={visibleSpec} playing={playing} onRemove={removeSection} onSelect={setSelSec} onInfo={setInfoSec} selSec={selSec} encodeMode={encodeMode} stageHostRef={stageHostRef} layoutMode={genTab === 'layout'} hoverSec={hoverSec} onRendered={handleRendered} />
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

        {view === 'player' && <div data-audio-stage className="h-full flex items-center justify-center"><PlayerStage def={def} playing={playing} stopNonce={stopNonce} encodeMode={encodeMode} stageHostRef={stageHostRef} /></div>}

        {view === 'gallery' && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">
            {(galleryCat ? SCREEN_GROUPS.filter((g) => g.key === galleryCat) : SCREEN_GROUPS).map((g) => {
              const items = SCREENS.filter((s) => screenCat(s.id) === g.key)
              if (!items.length) return null
              return (
                <section key={g.key}>
                  <div className="kol-helper-10 uppercase tracking-widest text-meta mb-2">{g.label}</div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                    {items.map((s) => {
                      const gi = SCREENS.indexOf(s)
                      return <ScreenTile key={s.id} def={s} playing focused={gi === idx} onClick={() => openScreen(gi)} />
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {view === 'library' && !widget && (
          <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">
            {(libGroup ? GROUPS.filter((g) => g.key === libGroup) : GROUPS).map((g) => {
              const items = CATALOG.filter((v) => v.widget.group === g.key)
              if (!items.length) return null
              return (
                <section key={g.key}>
                  <div className="kol-helper-10 uppercase tracking-widest text-meta mb-2">{g.label}</div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
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
      <EditorRail
        footerBare={view === 'player' || (view === 'generate' && genView === 'current') || (view === 'library' && !!widget)}
        footer={view === 'player' ? playerFooter : (view === 'generate' && genView === 'current' ? generateFooter : (view === 'library' && widget ? libraryFooter : null))}
      >
        {view === 'generate' && (
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
            {genView === 'current' ? (
              <>
                <SegmentedToggle value={genTab} onChange={setGenTab} options={[{ value: 'design', label: 'Design' }, { value: 'layout', label: 'Layout' }, { value: 'edit', label: 'Edit' }]} />

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
                          <LabeledControl label="Text"><Input value={selectedSection.right ?? ''} onChange={(e) => editField(selSec, 'right', e.target.value)} /></LabeledControl>
                        )}
                        {selectedSection.kind === 'transport' && (
                          <LabeledControl label="Text"><Input value={selectedSection.label ?? ''} onChange={(e) => editField(selSec, 'label', e.target.value)} /></LabeledControl>
                        )}
                        {selectedSection.kind === 'strip' && (
                          <Section label="Hex strip">
                            <Slider labeled label="groups" min={1} max={3} step={1} value={selectedSection.groups} onChange={(v) => editField(selSec, 'groups', v)} />
                            <Slider labeled label="per" min={4} max={16} step={1} value={selectedSection.per} onChange={(v) => editField(selSec, 'per', v)} />
                          </Section>
                        )}
                        {selectedSection.kind === 'dual' && (
                          <Section label="Dual numbers">
                            <Slider labeled label="rows" min={3} max={10} step={1} value={selectedSection.rows} onChange={(v) => editField(selSec, 'rows', v)} />
                            <Slider labeled label="columns" min={1} max={4} step={1} value={selectedSection.cols ?? 2} onChange={(v) => editField(selSec, 'cols', v)} />
                          </Section>
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
                        <LabeledControl label="Font">
                          <Dropdown size="sm" variant="subtle" className="w-full" value={selectedSection.font || 'inherit'}
                            onChange={(v) => editField(selSec, 'font', v === 'inherit' ? undefined : v)}
                            options={[{ value: 'inherit', label: 'Inherit (UI)' }, ...FONTS.map((f) => ({ value: f.key, label: f.label }))]} />
                        </LabeledControl>
                        <Button variant="primary" size="sm" className="w-full" onClick={() => removeSection(selSec)}>Remove element</Button>
                        <Divider />
                      </>
                    )}
                    <ButtonGroup orientation="vertical" className="w-full">
                      <Button variant="primary" size="sm" iconLeft="cycle" onClick={reroll}>Reroll</Button>
                      <Button variant="primary" size="sm" onClick={resetAll}>Reset to default</Button>
                    </ButtonGroup>
                    <Section label="Add block">
                      <Dropdown size="sm" variant="subtle" className="w-full" value={addPick} onChange={setAddPick} options={ALL.map((w) => ({ value: w.key, label: w.label }))} />
                      <Button variant="primary" size="sm" className="w-full" onClick={() => addBlock(addPick)}>Add to composition</Button>
                    </Section>
                    <Button variant="primary" size="sm" className="w-full" onClick={saveComposition}>Save composition</Button>
                    <div className="kol-helper-10 text-body">seed {spec.seed} · {spec.theme} · {spec.columns} col</div>
                  </>
                )}

                {genTab === 'design' && (
                  <>
                    <LabeledControl label="Theme">
                      <Dropdown size="sm" variant="subtle" className="w-full" value={themeSel} onChange={setThemeSel}
                        options={[{ value: 'random', label: 'Random' }, ...THEMES.map((t) => ({ value: t, label: THEME_LABEL[t] ?? t }))]} />
                    </LabeledControl>
                    <LabeledControl label="Status bars (top + bottom)">
                      <SegmentedToggle value={showChrome ? 'on' : 'off'} onChange={(v) => setShowChrome(v === 'on')} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
                    </LabeledControl>
                    <Divider />
                    <LabeledControl label="UI font">
                      <Dropdown size="sm" variant="subtle" className="w-full" value={genFont} onChange={setGenFont} options={FONTS.map((f) => ({ value: f.key, label: f.label }))} />
                    </LabeledControl>
                    <LabeledControl label="Encode">
                      <Dropdown size="sm" variant="subtle" className="w-full" value={encodeMode} onChange={setEncodeMode} options={[{ value: 'off', label: 'Off' }, ...CIPHER_MODES.map((m) => ({ value: m, label: CIPHER_LABEL[m] ?? m }))]} />
                    </LabeledControl>
                    <Section label="Spacing">
                      <Slider labeled label="Gap" min={0} max={32} step={1} value={layout.gap} onChange={(v) => setLay('gap', v)} />
                      <Slider labeled label="Scale" min={0.5} max={1.5} step={0.05} value={layout.scale} onChange={(v) => setLay('scale', v)} />
                      <Slider labeled label="Pad top" min={0} max={48} step={1} value={layout.padT} onChange={(v) => setLay('padT', v)} />
                      <Slider labeled label="Pad right" min={0} max={48} step={1} value={layout.padR} onChange={(v) => setLay('padR', v)} />
                      <Slider labeled label="Pad bottom" min={0} max={48} step={1} value={layout.padB} onChange={(v) => setLay('padB', v)} />
                      <Slider labeled label="Pad left" min={0} max={48} step={1} value={layout.padL} onChange={(v) => setLay('padL', v)} />
                    </Section>
                  </>
                )}

                {genTab === 'layout' && (
                  <>
                    <div className="flex flex-col gap-1">
                      {bodySections.map((s, i) => {
                        const hidden = removed.has(s.id)
                        return (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={() => { dragFrom.current = i }}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
                            onDrop={() => { dropRow(i); setDragOver(null) }}
                            onDragEnd={() => setDragOver(null)}
                            onMouseEnter={() => setHoverSec(s.id)} onMouseLeave={() => setHoverSec(null)}
                            onDoubleClick={() => { setSelSec(s.id); setGenTab('edit') }}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded bg-fg-04 cursor-grab kol-helper-12 border-t-2 ${dragOver === i ? 'border-yellow-400' : 'border-transparent'} ${hidden ? 'text-meta opacity-50' : 'text-body hover:text-emphasis'}`}
                          >
                            <span className="text-meta select-none">⠿</span>
                            <span className="truncate">{SECTION_LABELS[s.kind] || s.kind}</span>
                            <span className="ml-auto kol-helper-10 text-meta">{i + 1}</span>
                            <Button variant="ghost" size="sm" quiet iconOnly={hidden ? 'eye-off' : 'eye-on'} iconSize={14} aria-label={hidden ? 'Show' : 'Hide'} onClick={(e) => { e.stopPropagation(); toggleHidden(s.id) }} />
                            <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Delete" onClick={(e) => { e.stopPropagation(); removeSection(s.id) }} />
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="kol-mono-10 text-body">{saved.length} saved · click to load, × to remove.</div>
            )}
          </>
        )}

        {view === 'player' && (
          <>
            <RailNav title={def.title} toggleLabel="Screens" onToggle={() => navigate(VIEW_PATHS.gallery)} index={idx} total={SCREENS.length} onPrev={() => go(-1)} onNext={() => go(1)} />
            <LabeledControl label="Encode">
              <Dropdown size="sm" variant="subtle" className="w-full" value={encodeMode} onChange={setEncodeMode} options={[{ value: 'off', label: 'Off' }, ...CIPHER_MODES.map((m) => ({ value: m, label: CIPHER_LABEL[m] ?? m }))]} />
            </LabeledControl>
          </>
        )}

        {view === 'gallery' && (
          <>
            <div className="kol-helper-12 text-emphasis">{def.title}</div>
            {browseToggle}
            <RailNav toggleLabel="Single" onToggle={() => navigate(VIEW_PATHS.player)} index={idx} total={SCREENS.length} onPrev={() => go(-1)} onNext={() => go(1)} />
          </>
        )}

        {view === 'library' && !widget && (
          <>
            <div className="kol-helper-12 text-emphasis">{libGroup ? GROUPS.find((g) => g.key === libGroup)?.label : 'Elements'}</div>
            {browseToggle}
            <RailNav toggleLabel="Single" onToggle={() => openVariant(libIdx)} index={Math.max(0, libFiltered.indexOf(libIdx))} total={libFiltered.length} onPrev={() => goLib(-1)} onNext={() => goLib(1)} />
          </>
        )}

        {view === 'library' && widget && (
          <>
            <div className="kol-helper-12 text-emphasis">{widget.label}</div>
            {browseToggle}
            <RailNav toggleLabel="Elements" onToggle={() => setSelKey(null)} index={Math.max(0, libFiltered.indexOf(libIdx))} total={libFiltered.length} onPrev={() => goLib(-1)} onNext={() => goLib(1)} />
            <Button variant="primary" size="sm" className="w-full" iconLeft="plus" onClick={() => addToGenerate(selKey, opts)}>Add to Generate</Button>
            {widget.params.length > 0 && (
              <Section label="Parameters">
                <ParamControls params={widget.params} opts={opts} onChange={(k, v) => setOpts((o) => ({ ...o, [k]: v }))} />
              </Section>
            )}
            {widget.params.length > 0 && <Button variant="primary" size="sm" className="w-full" onClick={() => setOpts({ ...widget.defaults })}>Reset params</Button>}
          </>
        )}
      </EditorRail>
    </div>
  )
}
