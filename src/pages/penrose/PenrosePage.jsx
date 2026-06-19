import { Fragment, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/atoms/Button.jsx'
import Input from '../../components/atoms/Input.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import { roundIfNum, isExpr, evalExpr } from '../../lib/exprParam.js'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import RailNav from '../../components/framework/RailNav.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../components/molecules/ButtonGroup.jsx'
import './main.css'
import { mulberry32 } from './prng'
import { rasterizeGlyph, computeSDF } from './sdf'
import { PROTOTYPES } from './prototypes'
import { makeSDF, setLoopClock } from './prototypes/common'
import { Camera } from './camera'
import { CLOCK, SquishyClock } from './clock'
import { defaultValues, fmt } from './knobs'
import { FRAMES, FONTS, frameFor, setPalette, setOpacity, PALETTE } from './settings'
import { makeMapper, tintedContext } from './tint'
import { resolveTheme, THEME_OPTIONS } from '../../lib/themes.js'
import { randomSeed } from '../../lib/rng.js'
import { defaultAspectFor, defaultTheme, defaultAutoplay, defaultClipToFrame } from '../../lib/appSettings.js'
import { usePublishShortcuts, usePublishInfo, usePublishReset, usePublishRetrigger } from '../../components/framework/pageShortcuts.jsx'
import { CATEGORY_ORDER, categoryOf, categoryLabel, FOUNDATION_KEYS, TERRITORY_KEYS } from './prototypes/categories.js'

const LOGICAL = 960 // logical artboard resolution (higher = crisper + finer detail)
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
  ['G', 'Generate / Player'],
  ['esc', 'browse'],
  ['R', 'retrigger (fresh run)'],
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
  // Tint the context so the prototype's authored stroke/fill colours are remapped
  // onto the active palette (vector prototypes only — pixel-field ones use their
  // own context and bypass this).
  const wctx = tintedContext(ctx, makeMapper(PALETTE))
  // Live params: any knob whose value is a time-expression (e.g. "wave(t)") is
  // evaluated against the clock playhead ON READ — so per-frame reads in the
  // draw loop animate, while one-shot reads at init snapshot. Plain numbers pass
  // straight through. Wires expression input into every prototype's sliders.
  const liveParams = new Proxy(values, {
    get(t, k) { const v = t[k]; return isExpr(v) ? evalExpr(v, useClock.nowSeconds()) : v },
  })
  try {
    return proto.init({ canvas, ctx: wctx, sdf, W, H, rng, seed, params: liveParams, clock: useClock }) ?? null
  } catch (err) {
    console.error(`[${proto.id}] ${label} threw:`, err)
    return null
  } finally {
    setLoopClock(CLOCK)
  }
}

// ---- Routing ----
// Mirrors interfaces: a View pair (Generate = editor, Player = clean playback)
// plus a Browse grid scoped by category. Bare /penrose redirects to /generate.
//   /penrose/generate                editor (the in-depth build view)
//   /penrose/player                  clean playback of the current specimen
//   /penrose/browse · /browse/<cat>  browse grid, all / one category
// The #protoId hash deep-links which specimen the single views open on.
const pathFor = (view, cat) => {
  if (view === 'browse') { const seg = cat && cat !== 'all' ? `/${cat}` : ''; return `/penrose/browse${seg}` }
  return view === 'player' ? '/penrose/player' : '/penrose/generate'
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
    <Section label="Generation">
      <div className="flex flex-col gap-3">
        {params.map((p) => {
          const label = p.label ?? p.key
          if (p.type === 'range' || p.type === 'int') {
            return (
              <Slider labeled
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
              <ColorField key={p.key} label={label} value={values[p.key]} onChange={(v) => set(p.key, v)} />
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
function Grid({ groups, onSelect, onOpen, seedBase, frame, focusedIdx }) {
  const fitClass = frame.w >= frame.h ? 'h-full w-auto' : 'w-full h-auto'
  const gridRef = useRef(null)
  const focusedRef = useRef(null)
  const clocksRef = useRef(new Map()) // i → { clk, warmup }

  // pager focus → scroll the highlighted tile into view
  useEffect(() => { focusedRef.current?.scrollIntoView({ block: 'nearest' }) }, [focusedIdx])

  useEffect(() => {
    const tiles = Array.from(gridRef.current.querySelectorAll('[data-i]'))
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
              className={`group flex flex-col rounded overflow-hidden cursor-pointer transition-colors ${i === focusedIdx ? 'bg-fg-08' : 'bg-fg-02'}`}
              data-i={i}
              ref={i === focusedIdx ? focusedRef : undefined}
              key={proto.id}
              onClick={() => onSelect(i)}
              onDoubleClick={() => onOpen(i)}
              onMouseEnter={() => hover(i, true)}
              onMouseLeave={() => hover(i, false)}
              title={`${proto.summary} · double-click to open`}
            >
              {/* Media frames to the Home aspect; the square specimen fits its short side. */}
              <div className="flex items-center justify-center overflow-hidden" style={{ aspectRatio: `${frame.w} / ${frame.h}`, background: 'var(--bg)' }}>
                <canvas width={TILE * dpr} height={TILE * dpr} className={`block ${fitClass}`} />
              </div>
              <div className="p-2 flex flex-col gap-0.5">
                <p className="kol-mono-12 text-fg-default truncate group-hover:text-emphasis">{proto.name}</p>
                <p className="kol-mono-12 text-meta">{pad(i + 1)}</p>
              </div>
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  // View is route-derived: browse | player | generate (default). The browse
  // category is the segment after /browse; the single views step over all 115.
  const parts = (useParams()['*'] || '').split('/').filter(Boolean)
  const view = parts[0] === 'browse' ? 'browse' : parts[0] === 'player' ? 'player' : 'generate'
  const rawCat = view === 'browse' ? parts[1] : null
  // selectedCat is a big category ('foundations' / 'territories'), a single
  // subgroup key, or 'all'. browseCat is which of the two big toggles is active.
  const BIG = ['foundations', 'territories']
  const selectedCat = rawCat && (CATEGORY_ORDER.includes(rawCat) || BIG.includes(rawCat)) ? rawCat : 'foundations'
  const browseCat = (selectedCat === 'territories' || TERRITORY_KEYS.includes(selectedCat)) ? 'territories' : 'foundations'
  // canonical slug: the editor lives at /penrose/generate; bare /penrose redirects.
  useEffect(() => { if (!parts.length) navigate('/penrose/generate', { replace: true }) }, [parts.length, navigate])
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
  // Artboard settings (global — apply across single + gallery). Frame seeds from
  // the app-wide default aspect (Home › Settings) so penrose syncs with the rest
  // of the labs instead of being hard-pinned to 1:1.
  const [frameRatio, setFrameRatio] = useState(() => { const a = defaultAspectFor('view'); return FRAMES.some((f) => f.id === a) ? a : '1:1' })
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [ov, setOv] = useState({}) // per-channel colour overrides on top of the theme
  const setOvKey = (k, v) => setOv((o) => ({ ...o, [k]: v }))
  const [opacity, setOpacityState] = useState({ fg: 1, accent: 1, dim: 5, warm: 1 }) // per-role alpha multipliers (Edit); dim defaults full (its elements are authored faint)
  const setOpacityKey = (k, v) => setOpacityState((o) => ({ ...o, [k]: v }))
  const [showGrid, setShowGrid] = useState(false)
  const [showCross, setShowCross] = useState(false) // 2D centre crosshair
  const [showAxes, setShowAxes] = useState(false)   // 3D XYZ axis gizmo (tracks camera rotation)
  const [seedBase, setSeedBase] = useState(DEFAULT_SEED)
  const [res, setRes] = useState(LOGICAL) // logical artboard resolution (Design slider)
  const [clipFrame] = useState(() => defaultClipToFrame())
  const [genTab, setGenTab] = useState('design') // Design | Layout | Edit rail tabs

  // Honor the global autoplay setting at mount: penrose's generation runs off the
  // shared CLOCK, so resume/pause it (and mirror into `paused`) per Home › Settings.
  useEffect(() => { if (defaultAutoplay()) CLOCK.resume(); else CLOCK.pause(); setPaused(CLOCK.isPaused()) }, [])

  // The subgroup keys in scope: a big category expands to its 4 subgroups, a
  // single subgroup is itself, 'all' is everything.
  const catKeys = useMemo(() => (
    selectedCat === 'foundations' ? FOUNDATION_KEYS
      : selectedCat === 'territories' ? TERRITORY_KEYS
        : selectedCat === 'all' ? CATEGORY_ORDER
          : [selectedCat]
  ), [selectedCat])
  // Category filter (derived from prototype ids) scopes both the browse grid and
  // the full-view prev/next stepping.
  const filtered = useMemo(
    () => PROTOTYPES.map((_, i) => i).filter((i) => catKeys.includes(categoryOf(PROTOTYPES[i].id))),
    [catKeys],
  )
  const groups = useMemo(() => {
    const keys = catKeys
    return keys
      .map((key) => ({
        key,
        label: categoryLabel(key),
        items: PROTOTYPES.map((proto, i) => ({ proto, i })).filter(({ proto }) => categoryOf(proto.id) === key),
      }))
      .filter((g) => g.items.length)
  }, [catKeys])

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

  // Debounced glyph/weight/font/resolution rebake (220ms), skipped on first render.
  // A resolution change re-allocates the SDF (different length); same-size rebakes
  // mutate in place so the shared `sdf` closure keeps pointing at fresh values.
  const booted = useRef(false)
  useEffect(() => {
    if (!booted.current) { booted.current = true; return }
    const id = setTimeout(() => {
      void rasterizeGlyph(letter || 'A', font, weight, res * 0.9, res, res).then((m) => {
        const next = computeSDF(m, res, res)
        if (sdfData.length === next.length) { sdfData.set(next) }
        else { sdfData = next; sdf = makeSDF(sdfData, res, res) }
        setSdfVersion((v) => v + 1)
      })
    }, 220)
    return () => clearTimeout(id)
  }, [letter, weight, font, res])

  // Single-view prototype lifecycle: init on mount/idx/rebake/reset/re-seed.
  // `ov` is in deps so a colour override re-inits static specimens (animated ones
  // pick up the live PALETTE on their next frame).
  useEffect(() => {
    if (view === 'browse') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cleanup = initProto(idx, canvas, ctx, res, res, 'init', seedBase)
    return () => { if (cleanup) cleanup() }
  }, [view, idx, sdfVersion, resetNonce, seedBase, themeId, invert, ov, opacity, res])

  // Hash routing (write-only, like the imperative shell)
  useEffect(() => {
    window.location.hash = view === 'browse' ? '#grid' : `#${PROTOTYPES[idx].id}`
  }, [view, idx])

  // Category change: if the current specimen isn't in the new set, jump to its first.
  useEffect(() => {
    if (!filtered.includes(idx)) setIdx(filtered[0] ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCat])

  const singleView = view === 'player' ? 'player' : 'generate'
  // Pager steps the current specimen; the single views own the pager (browse
  // navigates by clicking tiles), so always land back in the active single view.
  const go = (d) => {
    const cur = filtered.indexOf(idx)
    const base = cur < 0 ? 0 : cur
    setIdx(filtered[(base + d + filtered.length) % filtered.length])
    // In browse the pager just moves the focused tile; the single views step + stay.
    if (view !== 'browse') navigate(pathFor(singleView, selectedCat))
  }
  // Reset: re-init the CURRENT generation from frame 0 (same seed) + restart the
  // clock playing — the "Generation Reset" button.
  const reset = () => { CLOCK.reset(); CLOCK.resume(); setPaused(false); setResetNonce((n) => n + 1) }
  // Retrigger (the `r` key): roll a FRESH generation + restart the clock, so every
  // press gives a visibly new run (same-seed re-init looks identical on static specimens).
  const retrigger = () => { CLOCK.reset(); CLOCK.resume(); setPaused(false); setSeedBase(randomSeed()) }
  usePublishReset(reset)
  usePublishRetrigger(retrigger)
  const togglePause = () => { CLOCK.toggle(); setPaused(CLOCK.isPaused()) }
  const setClockSpeed = (v) => { CLOCK.setSpeed(v); setSpeed(v) }
  const camReset = () => cameraRef.current?.reset()
  const camZoom = (f) => cameraRef.current?.zoomAtCenter(f)
  // G flips between the two single views (Generate ⇄ Player).
  const toggleView = () => navigate(pathFor(view === 'player' ? 'generate' : 'player', selectedCat))
  // New generation: re-seed every prototype's RNG in lockstep.
  const randomise = () => setSeedBase(randomSeed())

  // Settings IO — JSON-safe snapshot of every authored control. paramStore is
  // the per-prototype params object (plain numbers/strings/bools), so it rides
  // along in the export and restores each specimen's knob state.
  const getSettings = () => ({
    themeId, invert, ov, opacity, letter, weight, font,
    frameRatio, showGrid, showCross, showAxes, seedBase, speed, res,
    paramStore,
  })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.themeId != null) setThemeId(s.themeId)
    if (typeof s.invert === 'boolean') setInvert(s.invert)
    if (s.ov && typeof s.ov === 'object') setOv(s.ov)
    if (s.opacity && typeof s.opacity === 'object') setOpacityState({ fg: 1, accent: 1, dim: 1, warm: 1, ...s.opacity })
    if (s.letter != null) setLetter(s.letter)
    if (s.weight != null) setWeight(String(s.weight))
    if (s.font != null) setFont(s.font)
    if (s.frameRatio != null) setFrameRatio(s.frameRatio)
    if (typeof s.showGrid === 'boolean') setShowGrid(s.showGrid)
    if (typeof s.showCross === 'boolean') setShowCross(s.showCross)
    if (typeof s.showAxes === 'boolean') setShowAxes(s.showAxes)
    if (Number.isFinite(s.res)) setRes(s.res)

    if (s.speed != null) setClockSpeed(s.speed)
    if (s.paramStore && typeof s.paramStore === 'object') {
      for (const id in s.paramStore) paramStore[id] = { ...paramStore[id], ...s.paramStore[id] }
    }
    if (s.seedBase != null) setSeedBase(s.seedBase) // last → forces a redraw of restored params
    else setResetNonce((n) => n + 1)
  }
  const downloadPng = () => {
    if (view === 'browse') return
    const src = canvasRef.current
    let out = src
    // Clip to frame: crop the square canvas into the chosen aspect (bg-filled
    // surround on the long axis), matching what the artboard frame shows.
    if (clipFrame) {
      const f = frameFor(frameRatio)
      const a = f.w / f.h
      const S = src.width // square (res * dpr)
      const fw = a >= 1 ? Math.round(S * a) : S
      const fh = a >= 1 ? S : Math.round(S / a)
      const tmp = document.createElement('canvas')
      tmp.width = fw
      tmp.height = fh
      const tctx = tmp.getContext('2d')
      tctx.fillStyle = ov.bg ?? resolveTheme(themeId, invert).bg
      tctx.fillRect(0, 0, fw, fh)
      tctx.drawImage(src, Math.round((fw - S) / 2), Math.round((fh - S) / 2))
      out = tmp
    }
    const link = document.createElement('a')
    link.href = out.toDataURL('image/png')
    link.download = `penrose-${PROTOTYPES[idx].id}.png`
    link.click()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'c' || e.key === 'C') camReset()
      else if (e.key === 'g' || e.key === 'G') toggleView()
      else if (e.key === 'Escape') navigate(pathFor('browse', selectedCat))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, selectedCat])

  const proto = PROTOTYPES[idx]
  // Specimen reference + seed → the `i` info overlay (keeps the rail panels clean).
  usePublishInfo('Penrose', [
    ['Specimen', proto.name],
    ['Ref', proto.repo],
    ['About', proto.summary],
    ['Use', proto.helps],
    ['Seed', String(seedBase)],
  ])
  const single = view !== 'browse'
  const fr = frameFor(frameRatio)
  // Size the frame off its limiting viewport axis so portrait + landscape both
  // fit without breaking the ratio; the square glyph canvas fills the short side.
  const aspect = fr.w / fr.h
  const wrapStyle = aspect >= 1
    ? { aspectRatio: `${fr.w} / ${fr.h}`, width: `min(86vw, ${Math.round(res * aspect)}px)` }
    : { aspectRatio: `${fr.w} / ${fr.h}`, height: `min(86vh, ${Math.round(res / aspect)}px)` }
  // Resolve the shared theme (+ invert) and map it into penrose's PALETTE
  // semantics. The shared theme has no dim/warm; derive them from accent so the
  // prototype helpers that read PALETTE.dim/.warm keep working. grid carries an
  // alpha here (penrose draws it as a translucent overlay), so re-tint resolved
  // grid with a fixed 0.07 opacity rather than using gridOpacity directly.
  const t = resolveTheme(themeId, invert)
  // Per-channel overrides (Design tab) sit on top of the resolved theme; dim/warm
  // (the "generation colours" the prototypes stroke with) default to accent.
  const eff = {
    bg: ov.bg ?? t.bg,
    fg: ov.fg ?? t.fg,
    accent: ov.accent ?? t.accent,
    grid: ov.grid ?? t.grid, // hex; converted to a translucent overlay below
    dim: ov.dim ?? t.dim ?? t.accent,
    warm: ov.warm ?? t.warm ?? t.accent,
  }
  const gridRGBA = hexToRGBA(eff.grid, 0.07)
  const vars = { bg: eff.bg, fg: eff.fg, accent: eff.accent, grid: gridRGBA, dim: eff.dim, warm: eff.warm }
  // Push the active theme into the live palette BEFORE child init effects fire,
  // so prototype clear()/outline pick up the themed background (idempotent).
  setPalette(vars)
  setOpacity(opacity)
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
      {/* Stage: lofi scope — gallery content lives inside .penrose-page. Stage
          surround = bg-surface-secondary; the artboard frame uses the theme bg
          (set on .canvas-wrap), so the aspect frame reads as a distinct artboard. */}
      <div className="penrose-page flex-1 min-w-0 bg-surface-secondary" style={themeVars}>
      <div id="app">
        <div className="single-row my-auto" style={single ? undefined : { display: 'none' }}>
          {/* canvas-wrap = the fixed artboard frame: it owns the background +
              grid + ratio + clip; the camera transforms the canvas *inside* it,
              so zoom/pan/rotate move the letterform within a frame that stays put. */}
          <div className="canvas-wrap" data-vcap="stage" style={wrapStyle}>
            <canvas
              id="stage"
              ref={canvasRef}
              className={fr.w >= fr.h ? 'fit-h' : 'fit-w'}
              width={res * dpr}
              height={res * dpr}
            />
            {showGrid && <div className="frame-grid" aria-hidden="true" />}
            {showCross && <div className="frame-cross" aria-hidden="true" />}
            {showAxes && (
              <div
                className="frame-axes"
                aria-hidden="true"
                style={{ transform: `rotateX(${camState?.rx ?? 0}deg) rotateY(${camState?.ry ?? 0}deg) rotateZ(${camState?.rz ?? 0}deg)` }}
              >
                <span className="ax ax-x" />
                <span className="ax ax-y" />
                <span className="ax ax-z" />
              </div>
            )}
          </div>
        </div>

        {view === 'browse' && (
          <Grid
            key={`${sdfVersion}:${resetNonce}:${seedBase}:${themeId}:${invert}:${selectedCat}`}
            groups={groups}
            seedBase={seedBase}
            frame={fr}
            focusedIdx={idx}
            onSelect={(i) => setIdx(i)}
            onOpen={(i) => { setIdx(i); navigate(pathFor('generate', selectedCat)) }}
          />
        )}
      </div>
      </div>

      {/* Chrome: KOL-tokened right rail, outside the lofi CSS scope */}
      <EditorRail
        footerBare
        footer={
          <EditorFooter
            tab={bottomTab}
            onTab={setBottomTab}
            transport={{
              // Tempo = animation speed (120 = realtime); stop/rewind cue to the start
              playing: !paused,
              onPlay: () => { CLOCK.resume(); setPaused(false) },
              onPause: () => { CLOCK.pause(); setPaused(true) },
              onStop: () => { CLOCK.reset(); CLOCK.pause(); setPaused(true); reset() },
              onRewind: () => { CLOCK.reset(); reset() },
              tempo: Math.round(speed * 240),
              onTempo: (v) => setClockSpeed(v / 240),
              tempoMax: 600,
            }}
            exportProps={{ aspect: frameRatio, onAspect: setFrameRatio, aspects: FRAMES.map((f) => ({ value: f.id, label: f.label })), hideScale: true }}
            exportActions={
              <Button variant="primary" size="sm" className="w-full" onClick={downloadPng} disabled={!single}>↓ PNG</Button>
            }
            settingsPage="penrose"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        {/* Browse rail: the two big categories as a SegmentedToggle + Single + Pager
            (same pattern as interfaces' Screens/Elements browse). */}
        {view === 'browse' && (
          <>
            <div className="kol-helper-12 text-emphasis">{browseCat === 'territories' ? 'Territories' : 'Foundations'}</div>
            <SegmentedToggle
              value={browseCat}
              onChange={(v) => navigate(pathFor('browse', v))}
              options={[{ value: 'foundations', label: 'Foundations' }, { value: 'territories', label: 'Territories' }]}
            />
            <RailNav
              toggleLabel="Single"
              onToggle={() => navigate(pathFor('generate', selectedCat))}
              index={Math.max(0, filtered.indexOf(idx))}
              total={filtered.length}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
            />
          </>
        )}

        {/* Player rail: clean playback — name + pager, transport lives in the footer. */}
        {view === 'player' && (
          <RailNav
            title={proto.name}
            toggleLabel="Edit"
            onToggle={() => navigate(pathFor('generate', selectedCat))}
            index={Math.max(0, filtered.indexOf(idx))}
            total={filtered.length}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
          />
        )}

        {/* Generate rail: the in-depth editor — Design · Layout · Edit (mirrors interfaces). */}
        {view === 'generate' && (
          <>
            <RailNav
              title="Penrose"
              toggleLabel="Player"
              onToggle={() => navigate(pathFor('player', selectedCat))}
              index={Math.max(0, filtered.indexOf(idx))}
              total={filtered.length}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
            />

            <SegmentedToggle
              value={genTab}
              onChange={setGenTab}
              options={[{ value: 'design', label: 'Design' }, { value: 'layout', label: 'Layout' }, { value: 'edit', label: 'Edit' }]}
            />

            {/* Design — theme first, then the colour channels + generation colours + invert. */}
            {genTab === 'design' && (
              <>
                <LabeledControl inline label="Theme">
                  <Dropdown size="sm" variant="subtle" className="w-full" options={THEME_OPTIONS} value={themeId} onChange={setThemeId} />
                </LabeledControl>
                <ToggleSwitch labeled variant="plain" label="Invert" checked={invert} onChange={setInvert} />
                <Slider labeled label="Resolution" min={480} max={1920} step={80} value={res} onChange={(v) => setRes(roundIfNum(v))} className="w-full" />
                {/* These drive the live tint (tint.js): the prototype's authored
                    hues are remapped onto these stops by role. bg = canvas fill;
                    fg/accent/dim = the cool tonal structure; warm = highlights;
                    grid = the overlay. (Pixel-field prototypes recolour separately.) */}
                <Section label="Colors">
                  <ColorField label="Background" value={eff.bg} onChange={(v) => setOvKey('bg', v)} />
                  <ColorField label="Foreground" value={eff.fg} onChange={(v) => setOvKey('fg', v)} />
                  <ColorField label="Accent" value={eff.accent} onChange={(v) => setOvKey('accent', v)} />
                  {/* Grid colour drives both the grid + crosshair; only relevant when one is on. */}
                  {(showGrid || showCross) && <ColorField label="Grid" value={eff.grid} onChange={(v) => setOvKey('grid', v)} />}
                </Section>
                <Section label="Generation colors">
                  <ColorField label="Dim" value={eff.dim} onChange={(v) => setOvKey('dim', v)} />
                  <ColorField label="Warm" value={eff.warm} onChange={(v) => setOvKey('warm', v)} />
                </Section>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" iconLeft="cycle" onClick={randomise} className="flex-1">Reroll</Button>
                  {Object.keys(ov).length > 0 && <Button variant="primary" size="sm" onClick={() => setOv({})}>Reset colors</Button>}
                </div>
                <ButtonGroup orientation="vertical" className="w-full">
                  <Button variant="primary" size="sm" onClick={reset}>Generation Reset</Button>
                  <Button variant="primary" size="sm" onClick={camReset}>Camera Reset</Button>
                </ButtonGroup>
              </>
            )}

            {/* Layout — the generation model: live sliders for the specimen's own parameters. */}
            {genTab === 'layout' && (
              <KnobsPanel key={proto.id} proto={proto} onTweak={() => setResetNonce((n) => n + 1)} />
            )}

            {/* Edit — glyph, display overlays, camera, and per-element opacity. */}
            {genTab === 'edit' && (
              <>
                <Section label="Glyph">
                  <LabeledControl inline label="Letter">
                    <Input size="sm" width="100%" maxLength={8} value={letter} placeholder="A" onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setLetter(e.target.value.slice(0, 8))} />
                  </LabeledControl>
                  <LabeledControl inline label="Weight">
                    <Dropdown size="sm" variant="subtle" className="w-full" options={WEIGHTS.map((w) => ({ value: String(w), label: String(w) }))} value={weight} onChange={(v) => setWeight(v)} />
                  </LabeledControl>
                  <LabeledControl inline label="Font">
                    <Dropdown size="sm" variant="subtle" className="w-full" options={FONTS.map((f) => ({ value: f.id, label: f.label }))} value={font} onChange={(v) => setFont(v)} />
                  </LabeledControl>
                </Section>

                <Section label="Grid">
                  <ToggleSwitch labeled variant="plain" label="Grid overlay" checked={showGrid} onChange={setShowGrid} />
                  <ToggleSwitch labeled variant="plain" label="Crosshair" checked={showCross} onChange={setShowCross} />
                  <ToggleSwitch labeled variant="plain" label="XYZ cross" checked={showAxes} onChange={setShowAxes} />
                </Section>

                <Section label="Opacity">
                  <Slider labeled label="Foreground" min={0} max={5} step={0.1} value={opacity.fg} onChange={(v) => setOpacityKey('fg', v)} className="w-full" />
                  <Slider labeled label="Accent" min={0} max={5} step={0.1} value={opacity.accent} onChange={(v) => setOpacityKey('accent', v)} className="w-full" />
                  <Slider labeled label="Dim" min={0} max={5} step={0.1} value={opacity.dim} onChange={(v) => setOpacityKey('dim', v)} className="w-full" />
                  <Slider labeled label="Warm" min={0} max={5} step={0.1} value={opacity.warm} onChange={(v) => setOpacityKey('warm', v)} className="w-full" />
                </Section>
              </>
            )}
          </>
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
