import { Fragment, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Input from '../../components/atoms/Input.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../lib/exprParam.js'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import RailNav from '../../components/framework/RailNav.jsx'
import TransportBar from '../../components/framework/TransportBar.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import './main.css'
import { mulberry32 } from './prng'
import { rasterizeGlyph, computeSDF } from './sdf'
import { PROTOTYPES } from './prototypes'
import { makeSDF, setLoopClock } from './prototypes/common'
import { Camera } from './camera'
import { CLOCK, SquishyClock } from './clock'
import { defaultValues, fmt } from './knobs'
import { FRAMES, FONTS, frameFor, setPalette } from './settings'
import { DEFAULT_THEME, resolveTheme } from '../../lib/themes.js'
import { randomSeed } from '../../lib/rng.js'
import SettingsPanel from '../../components/framework/SettingsPanel.jsx'
import { usePublishShortcuts } from '../../components/framework/pageShortcuts.jsx'
import { CATEGORY_ORDER, categoryOf, categoryLabel } from './prototypes/categories.js'

const LOGICAL = 640
const MASK_RES = LOGICAL
const TILE = 200
const dpr = Math.min(window.devicePixelRatio || 1, 3)
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const DEFAULT_SEED = 42

// Penrose key bindings — published to the global `s` shortcuts overlay.
const PENROSE_SHORTCUTS = [
  ['drag', 'pan'],
  ['wheel', 'zoom'],
  ['⇧ drag', 'rotate XY'],
  ['⌥ drag', 'rotate Z'],
  ['← / →', 'step prototype'],
  ['G', 'toggle browse'],
  ['R', 'reset prototype'],
  ['C', 'reset camera'],
  ['space', 'play / pause'],
]

const pad = (n) => String(n).padStart(2, '0')

// Shared themes give grid as a solid hex; penrose draws the grid overlay as a
// translucent fill, so convert #rrggbb → rgba(r,g,b,a). Passes non-hex through.
const hexToRGBA = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Baked once before first render. Rebakes mutate sdfData in place so the
// shared `sdf` closure sees fresh values; bumping sdfVersion remounts the
// mounted prototypes against the new field.
let sdfData = null
let sdf = null

// Per-prototype param values, keyed by proto.id. Persists across remounts +
// letter/weight changes. Prototypes snapshot what they need in init().
const paramStore = {}

const getParams = (protoId, declared) => {
  if (!paramStore[protoId]) paramStore[protoId] = declared
  else {
    // fill in any new/missing keys without clobbering user-set ones
    for (const k in declared) if (!(k in paramStore[protoId])) paramStore[protoId][k] = declared[k]
  }
  return paramStore[protoId]
}

// seedBase shifts every prototype's RNG seed in lockstep — one global
// "generation" control (randomise) re-rolls all 115 specimens at once.
const initProto = (i, canvas, ctx, W, H, label, seedBase, clock) => {
  const proto = PROTOTYPES[i]
  const values = getParams(proto.id, defaultValues(proto.params))
  const seed = seedBase + i
  const rng = mulberry32(seed)
  // Bind this proto's wrapLoop to the given clock — a per-tile clock in the
  // grid, the global CLOCK for the single view. Captured synchronously inside
  // proto.init, then reset so nothing leaks to the next call.
  const useClock = clock || CLOCK
  setLoopClock(useClock)
  try {
    return proto.init({ canvas, ctx, sdf, W, H, rng, seed, params: values, clock: useClock }) ?? null
  } catch (err) {
    console.error(`[${proto.id}] ${label} threw:`, err)
    return null
  } finally {
    setLoopClock(CLOCK)
  }
}

// ---- Routing ----
// View (full/browse) and the category filter both live in the URL:
//   /penrose · /penrose/<cat>                full, all / one category
//   /penrose/browse · /penrose/browse/<cat>  browse, all / one category
// The #protoId hash deep-links which specimen the full view opens on.
const pathFor = (view, cat) => {
  const seg = cat && cat !== 'all' ? `/${cat}` : ''
  return view === 'grid' ? `/penrose/browse${seg}` : `/penrose${seg}`
}
const initialHash = window.location.hash.replace('#', '')
const initialFound = PROTOTYPES.findIndex((p) => p.id === initialHash)
const INITIAL_IDX = initialFound >= 0 ? initialFound : 0

function KnobsPanel({ proto, onTweak }) {
  const [, force] = useReducer((x) => x + 1, 0)
  const params = proto.params
  const values = getParams(proto.id, defaultValues(params))
  if (!params || params.length === 0) return null
  // param changed: remount prototype with fresh state but same value-store
  const set = (key, v) => { values[key] = v; force(); onTweak() }
  return (
    <Section label="Knobs">
      <div className="flex flex-col gap-3">
        {params.map((p) => {
          const label = p.label ?? p.key
          if (p.type === 'range' || p.type === 'int') {
            return (
              <Slider
                key={p.key}
                label={label}
                min={p.min}
                max={p.max}
                step={p.step ?? (p.type === 'int' ? 1 : 0.01)}
                value={values[p.key]}
                onChange={(v) => set(p.key, p.type === 'int' ? roundIfNum(v) : v)}
                formatValue={(v) => fmt(v, p.type === 'int')}
                className="w-full"
              />
            )
          }
          if (p.type === 'boolean') {
            return <ToggleSwitch key={p.key} variant="plain" label={label} checked={!!values[p.key]} onChange={(v) => set(p.key, v)} />
          }
          if (p.type === 'select') {
            return (
              <LabeledControl key={p.key} inline label={label}>
                <Dropdown
                  size="sm"
                  variant="subtle"
                  className="w-full"
                  options={p.options.map((o) => ({ value: o, label: String(o) }))}
                  value={values[p.key]}
                  onChange={(v) => set(p.key, v)}
                />
              </LabeledControl>
            )
          }
          if (p.type === 'color') {
            return (
              <LabeledControl key={p.key} inline label={label}>
                <ColorField value={values[p.key]} onChange={(v) => set(p.key, v)} />
              </LabeledControl>
            )
          }
          return null
        })}
      </div>
    </Section>
  )
}

// Grid tiles don't autoplay forever: each gets its own clock that runs a short
// warm-up (so accumulative specimens develop a representative frame), then
// freezes. Hovering a tile resumes its clock; leaving freezes it again.
const TILE_WARMUP_MS = 2000

// Grid with lazy init via IntersectionObserver: fire init the first time a
// tile scrolls into view. Tiles never uninit while the grid is mounted; the
// parent remounts the whole grid (key bump) on rebake/reset/re-seed.
function Grid({ groups, onSelect, seedBase }) {
  const gridRef = useRef(null)
  const clocksRef = useRef(new Map()) // i → { clk, warmup }

  useEffect(() => {
    const tiles = Array.from(gridRef.current.querySelectorAll('.tile'))
    const cleanups = []
    const inited = new Set()
    const clocks = clocksRef.current
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const i = Number(entry.target.dataset.i)
          if (inited.has(i)) continue
          inited.add(i)
          const tc = entry.target.querySelector('canvas')
          const tctx = tc.getContext('2d')
          tctx.scale(dpr, dpr)
          // per-tile clock: runs the warm-up, then freezes (hover resumes it)
          const clk = new SquishyClock()
          const cleanup = initProto(i, tc, tctx, TILE, TILE, 'tile init', seedBase, clk)
          if (cleanup) cleanups.push(cleanup)
          const warmup = setTimeout(() => clk.pause(), TILE_WARMUP_MS)
          clocks.set(i, { clk, warmup })
        }
      },
      { rootMargin: '200px 0px' },
    )
    for (const t of tiles) io.observe(t)
    return () => {
      io.disconnect()
      for (const c of cleanups) { try { c() } catch (e) { console.error(e) } }
      for (const { warmup } of clocks.values()) clearTimeout(warmup)
      clocks.clear()
    }
  }, [seedBase])

  // hover-to-play: cancel the warm-up freeze + run while hovered, freeze on leave
  const hover = (i, on) => {
    const e = clocksRef.current.get(i)
    if (!e) return
    if (on) { clearTimeout(e.warmup); e.clk.setSpeed(CLOCK.speed); e.clk.resume() }
    else e.clk.pause()
  }

  return (
    <div className="grid" ref={gridRef}>
      {groups.map((g) => (
        <Fragment key={g.key}>
          <div
            style={{ gridColumn: '1 / -1' }}
            className="flex items-baseline gap-2 pt-6 pb-1 border-t border-fg-08 first:pt-0 first:border-0"
          >
            <span className="kol-helper-12 uppercase tracking-widest text-emphasis">{g.label}</span>
            <span className="kol-helper-10 text-meta">{g.items.length}</span>
          </div>
          {g.items.map(({ proto, i }) => (
            <div
              className="tile"
              data-i={i}
              key={proto.id}
              onClick={() => onSelect(i)}
              onMouseEnter={() => hover(i, true)}
              onMouseLeave={() => hover(i, false)}
              title={proto.summary}
            >
              <canvas width={TILE * dpr} height={TILE * dpr} style={{ width: `${TILE}px`, height: `${TILE}px` }} />
              <div className="tile-label"><span className="n">{pad(i + 1)}</span><span className="nm">{proto.name}</span></div>
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  // View + category are both route-derived. parts[0]==='browse' → grid; the
  // category is the segment after it (or the first segment in full view).
  const parts = (useParams()['*'] || '').split('/').filter(Boolean)
  const view = parts[0] === 'browse' ? 'grid' : 'single'
  const rawCat = parts[0] === 'browse' ? parts[1] : parts[0]
  const selectedCat = rawCat && CATEGORY_ORDER.includes(rawCat) ? rawCat : 'all'
  const setCategory = (cat) => navigate(pathFor(view, cat))
  usePublishShortcuts('Penrose', PENROSE_SHORTCUTS)
  const [idx, setIdx] = useState(INITIAL_IDX)
  const [letter, setLetter] = useState('A')
  const [weight, setWeight] = useState('700')
  const [font, setFont] = useState(FONTS[0].id)
  const [paused, setPaused] = useState(CLOCK.isPaused())
  const [speed, setSpeed] = useState(CLOCK.speed)
  const [bottomTab, setBottomTab] = useState('transport') // Transport | Output footer tabs
  const [camState, setCamState] = useState(null)
  const [sdfVersion, setSdfVersion] = useState(0)
  const [resetNonce, setResetNonce] = useState(0)
  // Artboard settings (global — apply across single + gallery)
  const [frameRatio, setFrameRatio] = useState('1:1')
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [seedBase, setSeedBase] = useState(DEFAULT_SEED)
  const [bodyTab, setBodyTab] = useState('settings') // Settings | Info rail tabs

  // Category filter (derived from prototype ids) scopes both the browse grid and
  // the full-view prev/next stepping.
  const filtered = useMemo(
    () => PROTOTYPES.map((_, i) => i).filter((i) => selectedCat === 'all' || categoryOf(PROTOTYPES[i].id) === selectedCat),
    [selectedCat],
  )
  const catOptions = useMemo(() => {
    const opts = [{ value: 'all', label: `All · ${PROTOTYPES.length}` }]
    for (const key of CATEGORY_ORDER) {
      const n = PROTOTYPES.filter((p) => categoryOf(p.id) === key).length
      if (n) opts.push({ value: key, label: `${categoryLabel(key)} · ${n}` })
    }
    return opts
  }, [])
  const groups = useMemo(() => {
    const keys = selectedCat === 'all' ? CATEGORY_ORDER : [selectedCat]
    return keys
      .map((key) => ({
        key,
        label: categoryLabel(key),
        items: PROTOTYPES.map((proto, i) => ({ proto, i })).filter(({ proto }) => categoryOf(proto.id) === key),
      }))
      .filter((g) => g.items.length)
  }, [selectedCat])

  const canvasRef = useRef(null)
  const cameraRef = useRef(null)

  // Camera lives as long as the app. The canvas element persists across view
  // switches (single-row is display:none'd in grid mode), so camera state
  // survives grid roundtrips — same as the imperative shell.
  useEffect(() => {
    const cam = new Camera(canvasRef.current)
    cameraRef.current = cam
    const unsub = cam.subscribe((s) => setCamState({ ...s }))
    setCamState(cam.snapshot)
    return () => { unsub(); cam.detach() }
  }, [])

  // Debounced glyph/weight/font rebake (220ms), skipped on first render.
  const booted = useRef(false)
  useEffect(() => {
    if (!booted.current) { booted.current = true; return }
    const id = setTimeout(() => {
      void rasterizeGlyph(letter || 'A', font, weight, LOGICAL * 0.9, MASK_RES, MASK_RES).then((m) => {
        sdfData.set(computeSDF(m, MASK_RES, MASK_RES))
        setSdfVersion((v) => v + 1)
      })
    }, 220)
    return () => clearTimeout(id)
  }, [letter, weight, font])

  // Single-view prototype lifecycle: init on mount/idx/rebake/reset/re-seed.
  useEffect(() => {
    if (view !== 'single') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cleanup = initProto(idx, canvas, ctx, LOGICAL, LOGICAL, 'init', seedBase)
    return () => { if (cleanup) cleanup() }
  }, [view, idx, sdfVersion, resetNonce, seedBase, themeId, invert])

  // Hash routing (write-only, like the imperative shell)
  useEffect(() => {
    window.location.hash = view === 'grid' ? '#grid' : `#${PROTOTYPES[idx].id}`
  }, [view, idx])

  // Category change: if the current specimen isn't in the new set, jump to its first.
  useEffect(() => {
    if (!filtered.includes(idx)) setIdx(filtered[0] ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCat])

  const go = (d) => {
    const cur = filtered.indexOf(idx)
    const base = cur < 0 ? 0 : cur
    setIdx(filtered[(base + d + filtered.length) % filtered.length])
    navigate(pathFor('single', selectedCat))
  }
  const reset = () => setResetNonce((n) => n + 1)
  const togglePause = () => { CLOCK.toggle(); setPaused(CLOCK.isPaused()) }
  const setClockSpeed = (v) => { CLOCK.setSpeed(v); setSpeed(v) }
  const camReset = () => cameraRef.current?.reset()
  const camZoom = (f) => cameraRef.current?.zoomAtCenter(f)
  const toggleView = () => navigate(pathFor(view === 'grid' ? 'single' : 'grid', selectedCat))
  // New generation: re-seed every prototype's RNG in lockstep.
  const randomise = () => setSeedBase(randomSeed())

  // Settings IO — JSON-safe snapshot of every authored control. paramStore is
  // the per-prototype params object (plain numbers/strings/bools), so it rides
  // along in the export and restores each specimen's knob state.
  const getSettings = () => ({
    themeId, invert, letter, weight, font,
    frameRatio, showGrid, seedBase, speed,
    paramStore,
  })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.themeId != null) setThemeId(s.themeId)
    if (typeof s.invert === 'boolean') setInvert(s.invert)
    if (s.letter != null) setLetter(s.letter)
    if (s.weight != null) setWeight(String(s.weight))
    if (s.font != null) setFont(s.font)
    if (s.frameRatio != null) setFrameRatio(s.frameRatio)
    if (typeof s.showGrid === 'boolean') setShowGrid(s.showGrid)
    if (s.speed != null) setClockSpeed(s.speed)
    if (s.paramStore && typeof s.paramStore === 'object') {
      for (const id in s.paramStore) paramStore[id] = { ...paramStore[id], ...s.paramStore[id] }
    }
    if (s.seedBase != null) setSeedBase(s.seedBase) // last → forces a redraw of restored params
    else setResetNonce((n) => n + 1)
  }
  const downloadPng = () => {
    if (view !== 'single') return
    const a = document.createElement('a')
    a.href = canvasRef.current.toDataURL('image/png')
    a.download = `penrose-${PROTOTYPES[idx].id}.png`
    a.click()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'r' || e.key === 'R') reset()
      else if (e.key === 'c' || e.key === 'C') camReset()
      else if (e.key === 'g' || e.key === 'G') toggleView()
      else if (e.key === 'Escape') navigate(pathFor('grid', selectedCat))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, selectedCat])

  const proto = PROTOTYPES[idx]
  const single = view === 'single'
  const fr = frameFor(frameRatio)
  // Size the frame off its limiting viewport axis so portrait + landscape both
  // fit without breaking the ratio; the square glyph canvas fills the short side.
  const aspect = fr.w / fr.h
  const wrapStyle = aspect >= 1
    ? { aspectRatio: `${fr.w} / ${fr.h}`, width: `min(86vw, ${Math.round(LOGICAL * aspect)}px)` }
    : { aspectRatio: `${fr.w} / ${fr.h}`, height: `min(86vh, ${Math.round(LOGICAL / aspect)}px)` }
  // Resolve the shared theme (+ invert) and map it into penrose's PALETTE
  // semantics. The shared theme has no dim/warm; derive them from accent so the
  // prototype helpers that read PALETTE.dim/.warm keep working. grid carries an
  // alpha here (penrose draws it as a translucent overlay), so re-tint resolved
  // grid with a fixed 0.07 opacity rather than using gridOpacity directly.
  const t = resolveTheme(themeId, invert)
  const gridRGBA = hexToRGBA(t.grid, 0.07)
  const vars = { bg: t.bg, fg: t.fg, accent: t.accent, grid: gridRGBA, dim: t.accent, warm: t.accent }
  // Push the active theme into the live palette BEFORE child init effects fire,
  // so prototype clear()/outline pick up the themed background (idempotent).
  setPalette(vars)
  const themeVars = {
    '--bg': vars.bg,
    '--fg': vars.fg,
    '--dim': vars.dim,
    '--accent': vars.accent,
    '--warm': vars.warm,
    '--grid': vars.grid,
  }

  return (
    <div className="flex min-h-dvh">
      {/* Stage: lofi scope — gallery content lives inside .penrose-page */}
      <div className="penrose-page flex-1 min-w-0 bg-surface-secondary" style={themeVars}>
      <div id="app">
        <div className="single-row my-auto" style={single ? undefined : { display: 'none' }}>
          {/* canvas-wrap = the fixed artboard frame: it owns the background +
              grid + ratio + clip; the camera transforms the canvas *inside* it,
              so zoom/pan/rotate move the letterform within a frame that stays put. */}
          <div className="canvas-wrap" style={wrapStyle}>
            <canvas
              id="stage"
              ref={canvasRef}
              className={fr.w >= fr.h ? 'fit-h' : 'fit-w'}
              width={LOGICAL * dpr}
              height={LOGICAL * dpr}
            />
            {showGrid && <div className="frame-grid" aria-hidden="true" />}
            <div className="cam-hud">
              <div className="cam-zoom">
                <button type="button" onClick={() => camZoom(1.25)} aria-label="zoom in">+</button>
                <button type="button" onClick={() => camZoom(1 / 1.25)} aria-label="zoom out">−</button>
                <button type="button" onClick={camReset} aria-label="reset view">⌂</button>
              </div>
              <div className="cam-xy">
                <span>{Math.round((camState?.scale ?? 1) * 100)}%</span>
                <span>x {Math.round(camState?.tx ?? 0)}</span>
                <span>y {Math.round(camState?.ty ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {view === 'grid' && (
          <Grid
            key={`${sdfVersion}:${resetNonce}:${seedBase}:${themeId}:${invert}:${selectedCat}`}
            groups={groups}
            seedBase={seedBase}
            onSelect={(i) => { setIdx(i); navigate(pathFor('single', selectedCat)) }}
          />
        )}
      </div>
      </div>

      {/* Chrome: KOL-tokened right rail, outside the lofi CSS scope */}
      <EditorRail
        header={<RailHeader>Penrose</RailHeader>}
        footer={
          /* Transport · Output tabbed footer (matches interfaces) */
          <div className="flex flex-col gap-3">
            <SegmentedToggle
              value={bottomTab}
              onChange={setBottomTab}
              options={[{ value: 'transport', label: 'Transport' }, { value: 'output', label: 'Output' }]}
            />
            {bottomTab === 'transport' && (
              /* Tempo = animation speed (120 = realtime); stop/rewind cue to the start */
              <TransportBar
                playing={!paused}
                onPlay={() => { CLOCK.resume(); setPaused(false) }}
                onPause={() => { CLOCK.pause(); setPaused(true) }}
                onStop={() => { CLOCK.reset(); CLOCK.pause(); setPaused(true); reset() }}
                onRewind={() => { CLOCK.reset(); reset() }}
                tempo={Math.round(speed * 120)}
                onTempo={(v) => setClockSpeed(v / 120)}
                tempoMax={300}
              />
            )}
            {bottomTab === 'output' && (
              <Button variant="primary" size="sm" className="w-full" onClick={downloadPng} disabled={!single}>↓ PNG</Button>
            )}
          </div>
        }
      >
        {/* nav + position — pager scopes to the active category */}
        <RailNav
          toggleLabel={view === 'grid' ? 'Full' : 'Browse'}
          onToggle={toggleView}
          index={Math.max(0, filtered.indexOf(idx))}
          total={filtered.length}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
        />

        <LabeledControl label="Category">
          <Dropdown
            size="sm"
            variant="subtle"
            className="w-full"
            options={catOptions}
            value={selectedCat}
            onChange={setCategory}
          />
        </LabeledControl>

        <Divider />

        <SegmentedToggle
          value={bodyTab}
          onChange={setBodyTab}
          options={[{ value: 'settings', label: 'Settings' }, { value: 'info', label: 'Info' }]}
        />

        {bodyTab === 'settings' && (
          <>
            <Section label="Glyph">
              <LabeledControl inline label="Letter">
                <Input
                  size="sm"
                  width="100%"
                  maxLength={8}
                  value={letter}
                  placeholder="A"
                  onChange={(e) => setLetter(e.target.value.slice(0, 8))}
                />
              </LabeledControl>
              <LabeledControl inline label="Weight">
                <Dropdown
                  size="sm"
                  variant="subtle"
                  className="w-full"
                  options={WEIGHTS.map((w) => ({ value: String(w), label: String(w) }))}
                  value={weight}
                  onChange={(v) => setWeight(v)}
                />
              </LabeledControl>
              <LabeledControl inline label="Font">
                <Dropdown
                  size="sm"
                  variant="subtle"
                  className="w-full"
                  options={FONTS.map((f) => ({ value: f.id, label: f.label }))}
                  value={font}
                  onChange={(v) => setFont(v)}
                />
              </LabeledControl>
            </Section>

            <Section label="Aspect">
              <Dropdown
                size="sm"
                variant="subtle"
                className="w-full"
                options={FRAMES.map((f) => ({ value: f.id, label: f.label }))}
                value={frameRatio}
                onChange={(v) => setFrameRatio(v)}
              />
              <ToggleSwitch variant="plain" label="Grid overlay" checked={showGrid} onChange={setShowGrid} />
            </Section>

            <SettingsPanel
              page="penrose"
              theme={themeId}
              onTheme={setThemeId}
              invert={invert}
              onInvert={setInvert}
              onRandomize={randomise}
              seed={seedBase}
              onSeed={setSeedBase}
              getSettings={getSettings}
              applySettings={applySettings}
            />

            {/* per-prototype controls — full (single) view only */}
            {single && (
              <>
                <Divider />
                <KnobsPanel key={proto.id} proto={proto} onTweak={() => setResetNonce((n) => n + 1)} />
                <div className="flex flex-wrap gap-1">
                  <Button variant="primary" size="sm" onClick={reset}>Reset</Button>
                  <Button variant="primary" size="sm" onClick={camReset}>Cam reset</Button>
                </div>
              </>
            )}
          </>
        )}

        {bodyTab === 'info' && (
          single ? (
            <div className="flex flex-col gap-1">
              <div className="kol-mono-14 text-emphasis">{proto.name}</div>
              <div className="kol-mono-12 text-body">ref: {proto.repo}</div>
              <div className="kol-mono-12 text-body">{proto.summary}</div>
              <div className="kol-mono-12 text-body">→ {proto.helps}</div>
            </div>
          ) : (
            <div className="kol-mono-12 text-meta">Open a specimen in Full to see its reference and notes.</div>
          )
        )}
      </EditorRail>
    </div>
  )
}

// Route-mount wrapper: the SDF must be baked before App renders (was boot() +
// createRoot in the standalone build).
export default function PenrosePage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void rasterizeGlyph('A', FONTS[0].id, '700', LOGICAL * 0.9, MASK_RES, MASK_RES).then((mask0) => {
      if (!alive) return
      sdfData = computeSDF(mask0, MASK_RES, MASK_RES)
      sdf = makeSDF(sdfData, MASK_RES, MASK_RES)
      setReady(true)
    })
    return () => { alive = false }
  }, [])
  if (!ready) return null
  return <App />
}
