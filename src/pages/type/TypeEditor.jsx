import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import KineticType from '../kinetic/engine/KineticType.js'
import { defaultInstance, normalizeVf } from '../kinetic/data/presets.js'
import { loadFonts } from '../kinetic/lib/vfAxes.js'
import { PATH_OPTIONS } from '../kinetic/engine/paths.js'
import DesignControls from '../kinetic/DesignControls.jsx'
import LayoutControls from '../kinetic/LayoutControls.jsx'
import EditControls from '../kinetic/EditControls.jsx'
import MotionControls from '../kinetic/MotionControls.jsx'
import SelectionFrame from '../kinetic/SelectionFrame.jsx'
import InstancePositioner from '../kinetic/InstancePositioner.jsx'
import MorphOverlay from '../kinetic/MorphOverlay.jsx'
import InlineTextEditor from '../kinetic/InlineTextEditor.jsx'
import patternLoop from '../../loops/pattern/patternLoop.js'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Textarea from '../../components/atoms/Textarea.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import { roundIfNum } from '../../lib/exprParam.js'
import Scrubber from '../../components/framework/Scrubber.jsx'
import EditorRail from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import { usePublishShortcuts } from '../../components/framework/pageShortcuts.jsx'
import { LiveClock } from '../../lib/liveClock.jsx'
import { defaultTheme, defaultAutoplay, defaultClipToFrame } from '../../lib/appSettings.js'
import { resolveTheme } from '../../lib/themes.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'

// Type editor — a typesetting canvas driven by the full Kinetic toolkit (font · axes ·
// morph · pattern · italic), with NONE of the gallery/preset machinery. `/type` mounts
// it blank; each sub-page (registry) seeds it with a loop composition. The router shell
// keys this by sub-page id, so navigating re-seeds from scratch.
const newInstance = (id, fill) => defaultInstance(id, { text: 'Type here', font: 'rot', fontSize: 160, fill, vf: { wdth: 100, wght: 600 } })

export default function TypeEditor({ page = null }) {
  const theme0 = useMemo(() => resolveTheme(defaultTheme(), false), [])
  // Seed from the sub-page's loop composition (fresh ids), else a blank instance.
  const seed = useMemo(() => {
    const loop = page?.loop
    if (loop?.instances?.length) return { insts: loop.instances.map((p, i) => ({ ...p, id: `t${i + 1}` })), bg: loop.bg ?? theme0.bg }
    return { insts: [newInstance('t1', theme0.fg)], bg: theme0.bg }
  }, [page, theme0])

  const [instances, setInstances] = useState(() => seed.insts)
  const [selId, setSelId] = useState(() => seed.insts[0]?.id)
  const [frameBg, setFrameBg] = useState(() => seed.bg)
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [pattern, setPattern] = useState(() => ({ on: false, ...patternLoop.defaults }))
  const [tab, setTab] = useState('type')   // type | motion | layout | frame
  const [editing, setEditing] = useState(false) // inline text-edit on the canvas
  const [marked, setMarked] = useState([])       // rows ticked for grouping
  const groupRef = useRef(1)
  const [addType, setAddType] = useState('line')
  const idRef = useRef(seed.insts.length + 1)

  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [bottomTab, setBottomTab] = useState('transport')
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [recording, setRecording] = useState(false)
  const [clip] = useState(() => defaultClipToFrame())
  const [stage, setStage] = useState({ w: 0, h: 0 })

  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const engineRef = useRef(null)
  const progressRef = useRef({ t: 0, dur: 1 })
  const aspectRef = useRef(aspect); aspectRef.current = aspect

  // Pattern fill in glyph mode tiles the SELECTED instance itself (the engine reads
  // its live text/font/axes/italic) — pass the reference, not copied fields.
  const effPattern = useMemo(() => (pattern.on && pattern.shape === 'glyph') ? { ...pattern, glyphInstance: selId } : pattern, [pattern, selId])
  const params = useMemo(() => ({ bg: frameBg, instances, clip, pattern: effPattern }), [frameBg, instances, clip, effPattern])
  const paramsRef = useRef(params); paramsRef.current = params
  const selected = instances.find((x) => x.id === selId) || null
  const onPattern = (k, v) => setPattern((s) => ({ ...s, [k]: v }))

  // ── instance mutation (mirrors KineticPage) ──
  const setInst = (id, k, v) => setInstances((arr) => arr.map((x) => {
    if (x.id !== id) return x
    if (k === 'font') return { ...x, font: v, vf: normalizeVf(v, x.vf) }
    return { ...x, [k]: v }
  }))
  const setInstVf = (id, t, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, vf: { ...x.vf, [t]: v } } : x))
  const setInstOt = (id, t, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, opentype: { ...x.opentype, [t]: v } } : x))
  const setInstMorph = (id, k, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, morph: { ...x.morph, [k]: v } } : x))
  const setInstMorphVf2 = (id, t, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, morph: { ...x.morph, vf2: { ...x.morph?.vf2, [t]: v } } } : x))
  const setInstPath = (id, k, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, path: { ...x.path, [k]: v } } : x))
  const setInstMotion = (id, k, v) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, motion: { ...x.motion, [k]: v } } : x))
  const setInstMotions = (id, next) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, motions: next } : x))
  const setInstText = (id, text) => setInstances((arr) => arr.map((x) => x.id === id ? { ...x, text } : x))

  const addInstance = (type = 'line') => {
    const id = `t${idRef.current++}`
    // radial spokes / rings vortex set a whole phrase along each spoke/ring, so they
    // start smaller (a sentence has to fit) and seed a phrase instead of one word.
    const burst = type === 'radial' || type === 'rings'
    const ovr = burst
      ? { text: 'Without a soul, is it a place?', fontSize: 38 }
      : { text: 'Text', fontSize: 140 }
    setInstances((arr) => [...arr, defaultInstance(id, { ...ovr, font: 'rot', fill: arr[0]?.fill || theme0.fg, path: { type } })])
    setSelId(id)
  }
  const removeInstance = (id) => setInstances((arr) => (arr.length <= 1 ? arr : arr.filter((x) => x.id !== id)))

  // ── grouping: ticked rows → a shared group id; grouped blocks move/scale together ──
  const toggleMark = (id) => setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const groupMarked = () => {
    if (marked.length < 2) return
    const gid = `g${groupRef.current++}`
    setInstances((arr) => arr.map((x) => (marked.includes(x.id) ? { ...x, group: gid } : x)))
    setMarked([])
  }
  const ungroupMarked = () => { setInstances((arr) => arr.map((x) => (marked.includes(x.id) ? { ...x, group: null } : x))); setMarked([]) }
  // the selected block's group members (or just itself) — for the union frame + group transforms
  const memberIds = selected?.group ? instances.filter((x) => x.group === selected.group).map((x) => x.id) : (selId ? [selId] : [])
  // group-aware setters (functional → read live membership): toolbar styling applies
  // to the whole group when a grouped block is selected, else just the primary.
  const groupIds = (arr) => { const prim = arr.find((x) => x.id === selId); return prim?.group ? arr.filter((x) => x.group === prim.group).map((x) => x.id) : (selId ? [selId] : []) }
  const setGroupKey = (k, v) => setInstances((arr) => { const ids = groupIds(arr); return arr.map((x) => (ids.includes(x.id) ? { ...x, [k]: v } : x)) })
  const setGroupVf = (tag, v) => setInstances((arr) => { const ids = groupIds(arr); return arr.map((x) => (ids.includes(x.id) ? { ...x, vf: { ...x.vf, [tag]: v } } : x)) })
  // move the whole group by the drag delta (functional update reads live offsets)
  const moveGroup = (o) => setInstances((arr) => {
    const prim = arr.find((x) => x.id === selId)
    if (!prim) return arr
    const ids = prim.group ? arr.filter((x) => x.group === prim.group).map((x) => x.id) : [selId]
    if (ids.length <= 1) return arr.map((x) => (x.id === selId ? { ...x, offset: o } : x))
    const cur = prim.offset || { x: 0, y: 0 }
    const dx = o.x - cur.x, dy = o.y - cur.y
    return arr.map((x) => (ids.includes(x.id) ? { ...x, offset: { x: (x.offset?.x || 0) + dx, y: (x.offset?.y || 0) + dy } } : x))
  })
  // scale the whole group by the same factor (relative to the primary's live size)
  const scaleGroup = (v) => setInstances((arr) => {
    const prim = arr.find((x) => x.id === selId)
    if (!prim) return arr
    const ids = prim.group ? arr.filter((x) => x.group === prim.group).map((x) => x.id) : [selId]
    if (ids.length <= 1) return arr.map((x) => (x.id === selId ? { ...x, fontSize: v } : x))
    const base = typeof prim.fontSize === 'number' ? prim.fontSize : 100
    const factor = base ? v / base : 1
    return arr.map((x) => (ids.includes(x.id) ? { ...x, fontSize: Math.max(4, Math.min(1200, Math.round((typeof x.fontSize === 'number' ? x.fontSize : 100) * factor))) } : x))
  })
  const reorderInstances = (from, to) => setInstances((arr) => { const n = [...arr]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n })
  const duplicateInstance = (id) => {
    const nid = `t${idRef.current++}`
    setInstances((arr) => {
      const idx = arr.findIndex((x) => x.id === id)
      if (idx < 0) return arr
      const s = arr[idx]
      const clone = { ...s, id: nid, vf: { ...s.vf }, opentype: { ...s.opentype }, path: { ...s.path }, motion: { ...s.motion }, motions: (s.motions || []).map((mm) => ({ ...mm })), offset: { ...s.offset }, morph: { ...s.morph, vf2: { ...(s.morph?.vf2 || {}) } } }
      const n = [...arr]; n.splice(idx + 1, 0, clone); return n
    })
    setSelId(nid)
  }
  // ── theme / colour ──
  const applyThemeColors = (tid, inv) => { const t = resolveTheme(tid, inv); setFrameBg(t.bg); setInstances((arr) => arr.map((x) => ({ ...x, fill: t.fg }))) }
  const onTheme = (tid) => { setThemeId(tid); applyThemeColors(tid, invert) }
  const onInvert = (v) => { setInvert(v); applyThemeColors(themeId, v) }
  const onAllFill = (hex) => setInstances((arr) => arr.map((x) => ({ ...x, fill: hex })))

  // Re-home selection only when the selected id was DELETED (dangling). A deliberate
  // null (clicked empty canvas) must stick — else you could never deselect.
  useEffect(() => { if (selId != null && !instances.find((x) => x.id === selId)) setSelId(instances[0]?.id ?? null) }, [instances, selId])

  // ── engine ──
  const sizeStage = useCallback(() => {
    const wrap = wrapRef.current, eng = engineRef.current
    if (!wrap || !eng) return
    const aw = wrap.clientWidth, ah = wrap.clientHeight
    if (!aw || !ah) return
    const r = ratioFor(aspectRef.current)
    let w = aw, h = ah
    if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
    const fw = Math.max(1, Math.floor(w)), fh = Math.max(1, Math.floor(h))
    eng.resize(fw, fh)
    setStage((s) => (s.w === fw && s.h === fh ? s : { w: fw, h: fh }))
  }, [])

  useEffect(() => {
    loadFonts()
    const eng = new KineticType(hostRef.current, paramsRef.current)
    eng.onProgress = (p) => { progressRef.current = p }
    engineRef.current = eng
    sizeStage()
    const ro = new ResizeObserver(() => sizeStage())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); eng.dispose(); engineRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeStage])

  useEffect(() => { sizeStage() }, [aspect, sizeStage])
  useEffect(() => { engineRef.current?.setParams(params) }, [params])
  useEffect(() => { engineRef.current?.setTransport({ paused: !playing, speed: tempo / 120 }) }, [playing, tempo])

  usePublishShortcuts('Type', [['space', 'play / pause'], ['Design', 'text + colour'], ['Layout', 'blocks + arrangement'], ['Edit', 'type, morph, pattern']])

  // ── export ──
  const dl = (blob, name) => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url) }
  const exportPng = async () => { const d = dimsFor(aspect, Number(scale)); dl(d ? await engineRef.current?.exportBlobAt(d.w, d.h) : await engineRef.current?.exportBlob(), 'kol-type.png') }
  const exportVideo = async () => {
    if (recording) return
    setRecording(true)
    try { const d = dimsFor(aspect, 1); dl(await engineRef.current?.recordLoop(d?.w, d?.h, 25), 'kol-type.webm') } finally { setRecording(false) }
  }

  const getSettings = () => ({ instances, frameBg, themeId, invert, pattern, aspect, scale, tempo })
  const applySettings = (s) => {
    if (s.instances) { setInstances(s.instances); setSelId(s.instances[0]?.id) }
    if (s.frameBg != null) setFrameBg(s.frameBg)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.pattern) setPattern({ on: false, ...patternLoop.defaults, ...s.pattern })
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.tempo != null) setTempo(s.tempo)
  }

  const footer = (
    <EditorFooter
      tab={bottomTab} onTab={setBottomTab}
      transport={{ playing, onPlay: () => setPlaying(true), onPause: () => setPlaying(false), onStop: () => { setPlaying(false); engineRef.current?.seek(0) }, onRewind: () => engineRef.current?.seek(0), tempo, onTempo: setTempo, tempoMax: 300 }}
      exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
      exportActions={
        <>
          <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
          <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportVideo} disabled={recording}>{recording ? 'Recording…' : 'Export loop (webm)'}</Button>
        </>
      }
      settingsPage="type" getSettings={getSettings} applySettings={applySettings}
    />
  )

  const header = (
    <>
      <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'type', label: 'Type' }, { value: 'motion', label: 'Motion' }, { value: 'layout', label: 'Layout' }, { value: 'frame', label: 'Frame' }]} />
      {instances.length > 1 && (tab === 'type' || tab === 'motion') && (
        <SegmentedToggle value={selId} onChange={setSelId} options={instances.map((ins, i) => ({ value: ins.id, label: String(i + 1) }))} />
      )}
    </>
  )

  return (
    <div className="flex min-h-dvh">
      <div className="flex-1 min-w-0 h-dvh bg-surface-secondary overflow-hidden">
        <div
          ref={wrapRef}
          className="relative h-full flex items-center justify-center"
          onPointerDown={(e) => { if (editing) return; setSelId(engineRef.current?.hitTest?.(e.clientX, e.clientY) ?? null) }}
          onDoubleClick={(e) => { const id = engineRef.current?.hitTest?.(e.clientX, e.clientY); if (id) { setSelId(id); setEditing(true) } }}
        >
          <div ref={hostRef} data-vcap="stage" className="w-fit flex items-center justify-center" />
          {selected && !editing && <InstancePositioner offset={selected.offset} stage={stage} onChange={moveGroup} />}
          {selected && !editing && (
            <SelectionFrame
              engineRef={engineRef} selId={selId} stage={stage} instance={selected} rectIds={memberIds}
              onAlign={(v) => setGroupKey('align', v)}
              onWeight={(v) => setGroupVf('wght', v)}
              onItalic={(v) => setGroupKey('italic', v)}
              onFill={(c) => setGroupKey('fill', c)}
              onSize={scaleGroup}
              onDelete={() => removeInstance(selId)}
            />
          )}
          {selected?.morph?.on && !editing && <MorphOverlay instance={selected} stage={stage} onBlend={(v) => setInstMorph(selId, 'blend', v)} />}
          {selected && editing && (
            <InlineTextEditor
              engineRef={engineRef} selId={selId} stage={stage}
              value={selected.text}
              onChange={(t) => setInstText(selId, t)}
              onDone={() => setEditing(false)}
            />
          )}
          <Scrubber progressRef={progressRef} playerRef={engineRef} />
        </div>
      </div>

      <LiveClock getT={() => progressRef.current.t}>
        <EditorRail header={header} footerBare footer={footer}>
          {tab === 'type' && (
            <>
              {/* the word itself */}
              <Section label="Text">
                <Textarea value={selected?.text ?? ''} onChange={(e) => setInstText(selId, e.target.value)} rows={2} resize="vertical" placeholder="Type…" />
              </Section>
              {/* character settings (font · size · axes · case · italic · tracking · fill · OpenType · morph) */}
              <EditControls
                instance={selected}
                set={(k, v) => setInst(selId, k, v)}
                setVf={(t, v) => setInstVf(selId, t, v)}
                setOt={(t, v) => setInstOt(selId, t, v)}
                setMorph={(k, v) => setInstMorph(selId, k, v)}
                setMorphVf2={(t, v) => setInstMorphVf2(selId, t, v)}
              />
              {/* paragraph settings */}
              {selected && (
                <Section label="Paragraph">
                  <Slider labeled label="Copies" min={1} max={24} step={1} value={selected.multiply ?? 1} onChange={(v) => setInst(selId, 'multiply', roundIfNum(v))} variant="default" />
                  <ToggleSwitch variant="plain" labeled label="Paragraph (contain)" checked={selected.flow === 'contain'} onChange={(c) => setInst(selId, 'flow', c ? 'contain' : 'flow')} />
                  <ToggleSwitch variant="plain" labeled label="Show path" checked={!!selected.showPath} onChange={(c) => setInst(selId, 'showPath', c)} />
                </Section>
              )}
            </>
          )}

          {tab === 'motion' && (
            selected
              ? <MotionControls params={selected} setMotion={(k, v) => setInstMotion(selId, k, v)} setMotions={(next) => setInstMotions(selId, next)} />
              : <div className="kol-mono-12 text-meta">Add a text block first.</div>
          )}

          {tab === 'layout' && (
            <>
              <Section label="Add">
                <Dropdown size="sm" variant="subtle" className="w-full" value={addType} onChange={setAddType} options={PATH_OPTIONS} />
                <Button variant="primary" size="sm" className="w-full" iconLeft="plus" onClick={() => addInstance(addType)}>Add text</Button>
              </Section>
              <Divider />
              <LayoutControls
                instances={instances} selId={selId}
                onSelect={setSelId}
                onEdit={(id) => { setSelId(id); setTab('type') }}
                onRemove={removeInstance}
                onDuplicate={duplicateInstance}
                onReorder={reorderInstances}
                onPath={setInstPath}
                onMotion={setInstMotion}
                onMotions={setInstMotions}
                set={setInst}
                showMotion={false}
                marked={marked}
                onMark={toggleMark}
                onGroup={groupMarked}
                onUngroup={ungroupMarked}
              />
            </>
          )}

          {tab === 'frame' && (
            <DesignControls
              themeId={themeId} onTheme={onTheme}
              invert={invert} onInvert={onInvert}
              frameBg={frameBg} onFrameBg={setFrameBg}
              onAllFill={onAllFill}
              instances={instances} onText={setInstText}
              pattern={pattern} onPattern={onPattern}
              hideContent
            />
          )}
        </EditorRail>
      </LiveClock>
    </div>
  )
}
