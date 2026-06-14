import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Input from '../../components/atoms/Input.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import EditorRail from '../../components/framework/EditorRail.jsx'
import './synth.css'
import { SCREENS } from './screens'
import { WIDGETS, CHROME, GROUPS, CATALOG, widgetFor } from './widgets/registry.js'
import { generate, renderComposition, sectionForKey, ASPECTS, THEMES, aspectFor } from './generator.js'
import ScaleToFit from './ScaleToFit.jsx'
import WidgetMount from './WidgetMount.jsx'
import WidgetCard from './WidgetCard.jsx'
import ScreenTile from './ScreenTile.jsx'
import ParamControls from './ParamControls.jsx'
import { downloadPng, recordWebm } from './lib/download.js'
import { startClock, tempoMillis, setTempoScale } from './lib/clock.js'
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

/* mount helper shared by player / generate / saved tiles */
function useMount(buildFn, deps, playing) {
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
    const cleanups = []
    node.querySelectorAll('*').forEach((n) => { if (n._cleanup) cleanups.push(n._cleanup) })
    for (const p of instances) playing ? p.loop() : p.noLoop()
    return () => {
      for (const p of instances) p.remove()
      for (const c of cleanups) c()
      instancesRef.current = []
      node.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    for (const p of instancesRef.current) playing ? p.loop() : p.noLoop()
  }, [playing])
  return hostRef
}

function PlayerStage({ def, playing, stopNonce }) {
  const hostRef = useMount((node) => def.build(node), [def, stopNonce], playing)
  return (
    <ScaleToFit className="w-full h-[80vh]">
      <div className="interfaces-page bare"><div className={`screen theme-${def.theme ?? 'default'}`} ref={hostRef} /></div>
    </ScaleToFit>
  )
}

function GenerateStage({ spec, playing, onRemove, onSelect, selSec }) {
  const hostRef = useMount((node) => renderComposition(spec, node, { editable: true }), [spec], playing)
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
  return (
    <ScaleToFit className="w-full h-[80vh]">
      <div className="interfaces-page bare" onClick={onClick}><div ref={hostRef} /></div>
    </ScaleToFit>
  )
}

/* lazy saved-composition tile (regenerates from its seed) */
function GenTile({ entry, playing, onClick, onDelete }) {
  const wrapRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const spec = useMemo(() => generate(entry.seed, { aspect: aspectFor(entry.aspectKey).ratio, theme: entry.theme, lockTheme: true }), [entry])
  const hostRef = useMount((node) => (visible ? renderComposition(spec, node) : { instances: [] }), [visible, spec], playing)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px' })
    if (wrapRef.current) io.observe(wrapRef.current)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={wrapRef} className="group relative flex flex-col gap-1">
      <button type="button" onClick={onClick} className="block">
        <ScaleToFit className="h-48 w-full rounded border border-fg-08 group-hover:border-fg-24 transition-colors">
          <div className="interfaces-page bare"><div ref={hostRef} /></div>
        </ScaleToFit>
      </button>
      <div className="flex items-center justify-between kol-helper-10 text-meta">
        <span className="truncate">{entry.theme} · {entry.aspectKey}</span>
        <button type="button" aria-label="Delete" onClick={onDelete} className="hover:text-emphasis px-1">x</button>
      </div>
    </div>
  )
}

export default function InterfacesPage() {
  const navigate = useNavigate()
  const mode = useParams()['*'] || ''
  const view = VIEWS.includes(mode) ? mode : 'generate'
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [stopNonce, setStopNonce] = useState(0)
  const [selKey, setSelKey] = useState(null)
  const [opts, setOpts] = useState({})
  const [recording, setRecording] = useState(false)
  // generate
  const [genSeed, setGenSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [aspectKey, setAspectKey] = useState('9:16')
  const [themeSel, setThemeSel] = useState('random')
  const [genView, setGenView] = useState('current')
  const [saved, setSaved] = useState(readSaved)
  const [removed, setRemoved] = useState(() => new Set())
  const [showChrome, setShowChrome] = useState(true)
  const [added, setAdded] = useState([])
  const [edits, setEdits] = useState({}) // { [sectionId]: partial section override }
  const [selSec, setSelSec] = useState(null) // selected section id (generate)
  const [addPick, setAddPick] = useState('eqBars')
  // global controls (persist across rerolls)
  const [tempo, setTempo] = useState(50) // 0–100; 50 = realtime
  const [genFont, setGenFont] = useState('mono')
  const [renderStyle, setRenderStyle] = useState('lofi')
  const [layout, setLayout] = useState({ padT: 18, padR: 16, padB: 16, padL: 16, gap: 8, scale: 1 })
  const setLay = (k, v) => setLayout((l) => ({ ...l, [k]: v }))
  const addIdRef = useRef(1000)
  const canvasRef = useRef(null)
  const recStopRef = useRef(null)

  const def = SCREENS[idx]
  const widget = selKey ? widgetFor(selKey) : null
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
    layout, uiFont: genFont, renderStyle,
    sections: [
      ...spec.sections.filter((s) => !removed.has(s.id) && (showChrome || (s.kind !== 'statusbar' && s.kind !== 'transport'))),
      ...added,
    ].map(applyEdit),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [spec, removed, showChrome, added, edits, layout, genFont, renderStyle])
  const selectedSection = useMemo(() => visibleSpec.sections.find((s) => s.id === selSec) || null, [visibleSpec, selSec])

  const go = (d) => setIdx((i) => (i + d + SCREENS.length) % SCREENS.length)
  const doStop = () => { setPlaying(false); setStopNonce((n) => n + 1) }
  const openScreen = (i) => { setIdx(i); navigate(VIEW_PATHS.player) }
  const selectWidget = (key, presetOpts) => { setSelKey(key); setOpts(presetOpts ? { ...presetOpts } : { ...widgetFor(key).defaults }) }
  const reroll = () => setGenSeed(Math.floor(Math.random() * 1e9))
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

  // a fresh reroll / aspect / theme starts with all sections back
  useEffect(() => { setRemoved(new Set()); setAdded([]); setEdits({}); setSelSec(null) }, [genSeed, aspectKey, themeSel])

  // tempo slider → shared clock scale (50 = realtime, 0 = frozen, 100 = 2×)
  useEffect(() => { setTempoScale(tempo / 50) }, [tempo])

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
      document.querySelectorAll('.js-clock').forEach((n) => { n.textContent = `${hh}:${mm}` })
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  const toggleRec = () => {
    if (recording) { recStopRef.current?.(); setRecording(false); return }
    if (!canvasRef.current) return
    setRecording(true)
    recStopRef.current = recordWebm(canvasRef.current, selKey, { seconds: 5 })
    setTimeout(() => setRecording(false), 5000)
  }

  return (
    <div className="flex min-h-dvh">
      {/* ── stage ── */}
      <div className="flex-1 min-w-0 h-dvh bg-surface-primary">
        {view === 'generate' && genView === 'current' && (
          <div className="h-full flex items-center justify-center"><GenerateStage spec={visibleSpec} playing={playing} onRemove={removeSection} onSelect={setSelSec} selSec={selSec} /></div>
        )}
        {view === 'generate' && genView === 'saved' && (
          <div className="h-full overflow-y-auto p-6">
            {saved.length === 0
              ? <div className="kol-helper-12 text-meta">No saved compositions yet — reroll and hit Save.</div>
              : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                  {saved.map((e) => (
                    <GenTile key={e.ts} entry={e} playing={playing} onClick={() => loadComposition(e)} onDelete={() => deleteComposition(e.ts)} />
                  ))}
                </div>
              )}
          </div>
        )}

        {view === 'player' && <div className="h-full flex items-center justify-center"><PlayerStage def={def} playing={playing} stopNonce={stopNonce} /></div>}

        {view === 'gallery' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {SCREENS.map((s, i) => (
                <ScreenTile key={s.id} def={s} playing={playing} onClick={() => openScreen(i)} />
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
                      <WidgetCard key={v.id} widget={v.widget} opts={v.opts} label={v.label} playing={playing} onClick={() => selectWidget(v.widget.key, v.opts)} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {view === 'library' && widget && (
          <div className="h-full flex items-center justify-center p-8">
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
            <SegmentedToggle value={genView} onChange={setGenView} options={[{ value: 'current', label: 'Current' }, { value: 'saved', label: `Saved (${saved.length})` }]} />
            {genView === 'current' ? (
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
                        <Section key={i} label={w.label}>
                          <ParamControls params={w.params} opts={wd.opts} onChange={(k, v) => editWidgetParam(selSec, i, k, v)} />
                        </Section>
                      )
                    })}
                    {selectedSection.kind === 'label' && (
                      <Section label="Text">
                        <Input value={selectedSection.left ?? ''} onChange={(e) => editField(selSec, 'left', e.target.value)} placeholder="left" />
                        <Input value={selectedSection.right ?? ''} onChange={(e) => editField(selSec, 'right', e.target.value)} placeholder="right" />
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
                      <div className="kol-helper-10 text-meta">{selectedSection.items.length} readout rows · randomised live.</div>
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
                <Button variant="primary" size="sm" className="w-full" iconLeft="cycle" onClick={reroll}>Reroll</Button>
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
                    <div className="kol-helper-10 text-meta mb-1">Render</div>
                    <SegmentedToggle value={renderStyle} onChange={setRenderStyle} options={[{ value: 'lofi', label: 'Lofi' }, { value: 'smooth', label: 'Smooth' }]} />
                  </div>
                  <Slider label="Gap" min={0} max={32} step={1} value={layout.gap} onChange={(v) => setLay('gap', v)} />
                  <Slider label="Scale" min={0.5} max={1.5} step={0.05} value={layout.scale} onChange={(v) => setLay('scale', v)} />
                  <Slider label="Pad top" min={0} max={48} step={1} value={layout.padT} onChange={(v) => setLay('padT', v)} />
                  <Slider label="Pad right" min={0} max={48} step={1} value={layout.padR} onChange={(v) => setLay('padR', v)} />
                  <Slider label="Pad bottom" min={0} max={48} step={1} value={layout.padB} onChange={(v) => setLay('padB', v)} />
                  <Slider label="Pad left" min={0} max={48} step={1} value={layout.padL} onChange={(v) => setLay('padL', v)} />
                </Section>
                <Section label="Add block">
                  <Dropdown size="sm" variant="subtle" className="w-full" value={addPick} onChange={setAddPick} options={ALL.map((w) => ({ value: w.key, label: w.label }))} />
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => addBlock(addPick)}>Add to composition</Button>
                </Section>
                <Section label="Transport">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" iconOnly="play" title="Play" selected={playing} onClick={() => setPlaying(true)} />
                    <Button variant="ghost" size="sm" iconOnly="pause" title="Pause" selected={!playing} onClick={() => setPlaying(false)} />
                  </div>
                  <Slider label="Tempo" min={0} max={100} step={1} value={tempo} onChange={setTempo} />
                </Section>
                <Button variant="primary" size="sm" className="w-full" onClick={saveComposition}>Save composition</Button>
                <div className="kol-helper-10 text-body">seed {spec.seed} · {spec.theme} · {spec.columns} col</div>
                <p className="kol-helper-10 text-meta">click a section to select + edit it · × removes it · reroll resets.</p>
              </>
            ) : (
              <div className="kol-helper-10 text-body">{saved.length} saved · click to load, × to remove.</div>
            )}
          </>
        )}

        {view === 'player' && (
          <>
            <div className="kol-helper-12 text-emphasis"><b>{def.id}</b> / {String(SCREENS.length).padStart(2, '0')} · {def.title}</div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" className="flex-1" onClick={() => go(-1)}>← prev</Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={() => go(1)}>next →</Button>
            </div>
            <Section label="Transport">
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" iconOnly="stop" title="Stop & reset (S)" onClick={doStop} />
                <Button variant="ghost" size="sm" iconOnly="play" title="Play (Space)" selected={playing} onClick={() => setPlaying(true)} />
                <Button variant="ghost" size="sm" iconOnly="pause" title="Pause (Space)" selected={!playing} onClick={() => setPlaying(false)} />
              </div>
              <Slider label="Tempo" min={0} max={100} step={1} value={tempo} onChange={setTempo} />
            </Section>
            <div className="kol-helper-10 text-body flex flex-col gap-1">
              <div>SPACE · PLAY/PAUSE</div>
              <div>←/→ · SCREEN</div>
              <div>S · STOP</div>
            </div>
            <div className="kol-helper-10 text-body">{def.subtitle}</div>
          </>
        )}

        {view === 'gallery' && <div className="kol-helper-10 text-body">{SCREENS.length} screens · click one to open it in the player.</div>}

        {view === 'library' && !widget && <div className="kol-helper-10 text-body">{CATALOG.length} variants · {ALL.length} elements across {GROUPS.length} groups · click one to tweak + download.</div>}

        {view === 'library' && widget && (
          <>
            <div className="flex items-center justify-between">
              <span className="kol-helper-12 text-emphasis">{widget.label}</span>
              <button type="button" onClick={() => setSelKey(null)} className="kol-helper-10 text-meta hover:text-emphasis">← library</button>
            </div>
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
                  <Button variant={recording ? 'primary' : 'outline'} size="sm" className="w-full" iconLeft="circle" onClick={toggleRec}>{recording ? 'Stop recording' : 'Record webm (5s)'}</Button>
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
