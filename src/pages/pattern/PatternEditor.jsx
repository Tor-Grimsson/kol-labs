import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import patternLoop from '../../loops/pattern/patternLoop.js'
import PatternControls from '../loops/PatternControls.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Button from '../../components/atoms/Button.jsx'
import Section from '../../components/molecules/Section.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import { applyCanvasFx } from '../radar/hooks/useCanvasFx.js'
import { randomizeSection } from '../../loops/pattern/randomize.js'
import { usePublishShortcuts } from '../../components/framework/pageShortcuts.jsx'
import { resolveParams } from '../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { CATEGORIES, SUBPAGES, categoryById } from './registry.js'

// The Animation-tab "motion layer" — camera (Frame) + per-cell sweep (Form) +
// their two preset selectors. Switching the Pattern preset (a registry sub-page)
// swaps only the STRUCTURAL params (shape/grid/colour/rules) and PRESERVES these,
// so your chosen motion + Frame/Form presets survive a preset change. (color2 is
// shared with the palette, so it follows the structure — deliberately omitted.)
const MOTION_KEYS = [
  'camZoom', 'camFlow', 'camAngle', 'panDir', 'spin',
  'animAxis', 'animCycles', 'animWaves',
  'pulse', 'fade', 'swing', 'colorMix', 'framePreset', 'formPreset',
  'waveFlow', 'fieldSway', 'fieldStagger', 'fieldPulse', 'fieldShimmer', 'fieldCycles',
]

// Pattern studio — the kolkrabbi rule/tiling system (Image #4 from the brand
// editor) as a standalone vector-pattern generator. `page` (a registry sub-page)
// seeds the full engine config; everything stays editable in the rail. Reuses the
// ported `patternLoop` engine + the `PatternControls` rail UI (shape · grid ·
// colour · rules · camera · sweep) so nothing is duplicated — this is just the
// page shell + Canvas2D render loop. An Effect tab stacks the same pure
// `applyCanvasFx` post-chain the Radar pages use on top of the pattern.
// Loads paused (autoplay-off); the engine only moves when camera/spin/sweep run.
export default function PatternEditor({ page }) {
  const [values, setValues] = useState(() => ({ ...patternLoop.defaults, ...(page?.params || {}) }))
  const [tab, setTab] = useState('pattern')
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [bottomTab, setBottomTab] = useState('transport')
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [fxChain, setFxChain] = useState([])

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const valuesRef = useRef(values); valuesRef.current = values
  const playingRef = useRef(playing); playingRef.current = playing
  const tempoRef = useRef(tempo); tempoRef.current = tempo
  const fxChainRef = useRef(fxChain); fxChainRef.current = fxChain
  const uRef = useRef(0)
  const lastRef = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  // Redraw-on-demand: when PAUSED, only re-render when something changed (dirty).
  // The old loop re-rendered every rAF even paused — wasted full frames at idle.
  const dirtyRef = useRef(true)

  const onChange = (k, v) => setValues((s) => ({ ...s, [k]: v }))

  // Preset switcher (moved out of the sidebar into the rail). Category + preset
  // dropdowns navigate the registry routes; the page mounts keyed by sub-page id
  // so switching re-seeds the editor. `page` is the current preset.
  const navigate = useNavigate()
  const cat = page?.cat || CATEGORIES[0].id
  const presetsInCat = SUBPAGES[cat] || []
  const onCat = (c) => { const first = SUBPAGES[c]?.[0]; if (first) navigate(first.route) }
  const onPreset = (id) => { const p = presetsInCat.find((s) => s.id === id); if (p) navigate(p.route) }

  // On a preset (page) switch, remember the outgoing preset's full state in-session
  // and restore the incoming one exactly if we've edited it before — so stripe →
  // block → stripe brings your stripe edits back instead of wiping them. A preset
  // visited for the FIRST time seeds from its defaults but inherits the live motion
  // layer (MOTION_KEYS) so a chosen motion follows you while exploring. Editor isn't
  // remounted on a switch (PatternPage drives `page` from the URL); this effect loads
  // the new preset. Initial run is skipped (useState already seeded it).
  const seededRef = useRef(false)
  const memoryRef = useRef({})            // page.id → last edited values (this session)
  const prevPageIdRef = useRef(page?.id)
  useEffect(() => {
    if (!seededRef.current) { seededRef.current = true; prevPageIdRef.current = page?.id; return }
    setValues((prev) => {
      if (prevPageIdRef.current) memoryRef.current[prevPageIdRef.current] = prev // stash outgoing
      prevPageIdRef.current = page?.id
      const remembered = memoryRef.current[page?.id]
      if (remembered) return remembered   // revisit → restore exactly as left
      const next = { ...patternLoop.defaults, ...(page?.params || {}) } // first visit → seed…
      for (const k of MOTION_KEYS) if (prev[k] !== undefined) next[k] = prev[k] // …+ motion follows
      return next
    })
  }, [page?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Undo / redo for `values` (⌘Z / ⌘⇧Z). Snapshots are debounced so a slider drag
  // collapses to one history entry; history resets per preset (own timeline each).
  const histRef = useRef({ stack: [values], i: 0 })
  const skipPushRef = useRef(false)
  useEffect(() => { histRef.current = { stack: [valuesRef.current], i: 0 } }, [page?.id])
  useEffect(() => {
    if (skipPushRef.current) { skipPushRef.current = false; return }
    const t = setTimeout(() => {
      const h = histRef.current
      h.stack = h.stack.slice(0, h.i + 1)
      h.stack.push(valuesRef.current)
      if (h.stack.length > 100) h.stack.shift()
      h.i = h.stack.length - 1
    }, 300)
    return () => clearTimeout(t)
  }, [values])
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.target.matches?.('input, textarea')) return // let native undo handle text fields
        const h = histRef.current
        const to = e.shiftKey ? h.i + 1 : h.i - 1
        if (to < 0 || to >= h.stack.length) { e.preventDefault(); return }
        e.preventDefault(); h.i = to; skipPushRef.current = true; setValues(h.stack[to])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const getSettings = () => ({ values, aspect, scale, tempo, fxChain })
  const applySettings = (s) => {
    if (s.values) setValues({ ...patternLoop.defaults, ...s.values })
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.tempo != null) setTempo(s.tempo)
    if (s.fxChain) setFxChain(s.fxChain)
  }

  // Generate — randomise a section (or all), merged over the current values. Feeds
  // the undo history like any edit, so ⌘Z reverts a randomise.
  const randomize = (section) => setValues((v) => ({ ...v, ...randomizeSection(v, section) }))

  const sizeStage = useCallback(() => {
    const wrap = wrapRef.current, cv = canvasRef.current
    if (!wrap || !cv) return
    const aw = wrap.clientWidth, ah = wrap.clientHeight
    if (!aw || !ah) return
    const r = ratioFor(aspect) || aw / ah
    let w = aw, h = aw / r
    if (h > ah) { h = ah; w = h * r }
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const fw = Math.max(1, Math.floor(w)), fh = Math.max(1, Math.floor(h))
    cv.style.width = `${fw}px`; cv.style.height = `${fh}px`
    cv.width = Math.floor(fw * dpr); cv.height = Math.floor(fh * dpr)
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
    sizeRef.current = { w: fw, h: fh }
    dirtyRef.current = true
  }, [aspect])

  useEffect(() => {
    let raf
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const cv = canvasRef.current
      if (!cv) return
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0
      lastRef.current = now
      const dur = patternLoop.duration || 8
      if (playingRef.current) uRef.current = (uRef.current + dt * (tempoRef.current / 120) / dur) % 1
      const { w, h } = sizeRef.current
      // Render only while playing OR when marked dirty (a control/size changed).
      // Paused + unchanged ⇒ skip the frame entirely → ~0 idle cost.
      if (w && h && (playingRef.current || dirtyRef.current)) {
        patternLoop.draw(cv.getContext('2d'), uRef.current, w, h, resolveParams(valuesRef.current, uRef.current * dur))
        if (fxChainRef.current.length) applyCanvasFx(cv, fxChainRef.current)
        dirtyRef.current = false
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Mark dirty on any control/aspect/scale/fx change so the paused canvas repaints once.
  useEffect(() => { dirtyRef.current = true }, [values, aspect, scale, fxChain])

  useEffect(() => {
    sizeStage()
    const ro = new ResizeObserver(() => sizeStage())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [sizeStage])

  usePublishShortcuts('Pattern', [['space', 'play / pause'], ['⌘Z / ⌘⇧Z', 'undo / redo'], ['Generate', 'randomize all or a section'], ['Pattern', 'shape · grid · colour · rules'], ['Animation', 'camera + per-cell sweep']])

  const exportPng = () => {
    const d = dimsFor(aspect, Number(scale)) || sizeRef.current
    const off = document.createElement('canvas')
    off.width = d.w; off.height = d.h
    patternLoop.draw(off.getContext('2d'), uRef.current, d.w, d.h, resolveParams(valuesRef.current, uRef.current * (patternLoop.duration || 8)))
    if (fxChain.length) applyCanvasFx(off, fxChain)
    off.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `kol-pattern-${page?.id || 'untitled'}.png`; a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const footer = (
    <EditorFooter
      tab={bottomTab}
      onTab={setBottomTab}
      transport={{
        playing,
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onStop: () => { setPlaying(false); uRef.current = 0 },
        onRewind: () => { uRef.current = 0 },
        tempo, onTempo: setTempo, tempoMax: 300,
      }}
      exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
      exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
      settingsPage={`pattern-${page?.id || 'x'}`}
      getSettings={getSettings}
      applySettings={applySettings}
    />
  )

  const catLabel = page ? categoryById(page.cat).label : 'Pattern'

  return (
    <div className="flex min-h-dvh">
      <div className="flex-1 min-w-0 h-dvh bg-surface-secondary overflow-hidden">
        <div ref={wrapRef} className="relative h-full flex items-center justify-center">
          <canvas data-vcap="stage" ref={canvasRef} className="block" />
          <div className="pointer-events-none absolute left-5 top-5">
            <div className="kol-helper-12 text-emphasis">{page?.label || 'Pattern'}</div>
            <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{catLabel}</div>
          </div>
        </div>
      </div>
      <EditorRail
        header={
          <>
            <RailHeader>{page?.label || 'Pattern'}</RailHeader>
            <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'pattern', label: 'Pattern' }, { value: 'animation', label: 'Animation' }]} />
          </>
        }
        footerBare
        footer={footer}
      >
        <Section label="Preset">
          <Dropdown size="sm" options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={cat} onChange={onCat} variant="subtle" className="w-full" />
          <Dropdown size="sm" options={presetsInCat.map((s) => ({ value: s.id, label: s.label }))} value={page?.id} onChange={onPreset} variant="subtle" className="w-full" />
        </Section>
        {tab === 'generate' ? (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('pattern')}>Pattern</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('motion')}>Motion</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('frame')}>Frame</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('color')}>Colour</Button>
            </div>
          </Section>
        ) : (
          <PatternControls values={values} onChange={onChange} tab={tab} />
        )}
      </EditorRail>
    </div>
  )
}
