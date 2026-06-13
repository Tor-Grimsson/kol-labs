import { useEffect, useReducer, useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Input from '../../components/atoms/Input.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleCheckbox from '../../components/atoms/ToggleCheckbox.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import './main.css'
import { mulberry32 } from './prng'
import { rasterizeGlyph, computeSDF } from './sdf'
import { PROTOTYPES } from './prototypes'
import { makeSDF } from './prototypes/common'
import { Camera } from './camera'
import { CLOCK } from './clock'
import { defaultValues, fmt } from './knobs'

const LOGICAL = 640
const MASK_RES = LOGICAL
const TILE = 200
const dpr = Math.min(window.devicePixelRatio || 1, 3)

const pad = (n) => String(n).padStart(2, '0')

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

const initProto = (i, canvas, ctx, W, H, label) => {
  const proto = PROTOTYPES[i]
  const values = getParams(proto.id, defaultValues(proto.params))
  const rng = mulberry32(42 + i)
  try {
    return proto.init({ canvas, ctx, sdf, W, H, rng, seed: 42 + i, params: values, clock: CLOCK }) ?? null
  } catch (err) {
    console.error(`[${proto.id}] ${label} threw:`, err)
    return null
  }
}

// ---- Initial routing ----
const initialHash = window.location.hash.replace('#', '')
const INITIAL_VIEW = initialHash && initialHash !== 'grid' ? 'single' : 'grid'
const initialFound = INITIAL_VIEW === 'single' ? PROTOTYPES.findIndex((p) => p.id === initialHash) : -1
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
                onChange={(v) => set(p.key, p.type === 'int' ? Math.round(v) : v)}
                formatValue={(v) => fmt(v, p.type === 'int')}
                className="w-full"
              />
            )
          }
          if (p.type === 'boolean') {
            return <ToggleCheckbox key={p.key} label={label} checked={!!values[p.key]} onChange={(v) => set(p.key, v)} />
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
                <input type="color" value={values[p.key]} onChange={(e) => set(p.key, e.target.value)} />
              </LabeledControl>
            )
          }
          return null
        })}
      </div>
    </Section>
  )
}

// Grid with lazy init via IntersectionObserver: fire init the first time a
// tile scrolls into view. Tiles never uninit while the grid is mounted; the
// parent remounts the whole grid (key bump) on rebake/reset.
function Grid({ onSelect }) {
  const gridRef = useRef(null)

  useEffect(() => {
    const tiles = Array.from(gridRef.current.querySelectorAll('.tile'))
    const cleanups = []
    const inited = new Set()
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
          const cleanup = initProto(i, tc, tctx, TILE, TILE, 'tile init')
          if (cleanup) cleanups.push(cleanup)
        }
      },
      { rootMargin: '200px 0px' },
    )
    for (const t of tiles) io.observe(t)
    return () => {
      io.disconnect()
      for (const c of cleanups) { try { c() } catch (e) { console.error(e) } }
    }
  }, [])

  return (
    <div className="grid" ref={gridRef}>
      {PROTOTYPES.map((proto, i) => (
        <div className="tile" data-i={i} key={proto.id} onClick={() => onSelect(i)}>
          <canvas width={TILE * dpr} height={TILE * dpr} style={{ width: `${TILE}px`, height: `${TILE}px` }} />
          <div className="tile-tip">
            <div className="n">{pad(i + 1)} · {proto.name}</div>
            <div className="repo">ref: {proto.repo}</div>
            <div>{proto.summary}</div>
            <div className="helps">→ {proto.helps}</div>
          </div>
          <div className="tile-label"><b>{pad(i + 1)}</b> {proto.name}</div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [view, setView] = useState(INITIAL_VIEW)
  const [idx, setIdx] = useState(INITIAL_IDX)
  const [letter, setLetter] = useState('a')
  const [weight, setWeight] = useState('700')
  const [paused, setPaused] = useState(CLOCK.isPaused())
  const [sdfVersion, setSdfVersion] = useState(0)
  const [resetNonce, setResetNonce] = useState(0)

  const canvasRef = useRef(null)
  const cameraRef = useRef(null)

  // Camera lives as long as the app. The canvas element persists across view
  // switches (single-row is display:none'd in grid mode), so camera state
  // survives grid roundtrips — same as the imperative shell.
  useEffect(() => {
    const cam = new Camera(canvasRef.current)
    cameraRef.current = cam
    return () => cam.detach()
  }, [])

  // Debounced glyph/weight rebake (220ms), skipped on first render.
  const booted = useRef(false)
  useEffect(() => {
    if (!booted.current) { booted.current = true; return }
    const id = setTimeout(() => {
      void rasterizeGlyph(letter || 'a', 'TG Gullhamrar', weight, LOGICAL * 0.9, MASK_RES, MASK_RES).then((m) => {
        sdfData.set(computeSDF(m, MASK_RES, MASK_RES))
        setSdfVersion((v) => v + 1)
      })
    }, 220)
    return () => clearTimeout(id)
  }, [letter, weight])

  // Single-view prototype lifecycle: init on mount/idx/rebake/reset, cleanup on the way out.
  useEffect(() => {
    if (view !== 'single') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cleanup = initProto(idx, canvas, ctx, LOGICAL, LOGICAL, 'init')
    return () => { if (cleanup) cleanup() }
  }, [view, idx, sdfVersion, resetNonce])

  // Hash routing (write-only, like the imperative shell)
  useEffect(() => {
    window.location.hash = view === 'grid' ? '#grid' : `#${PROTOTYPES[idx].id}`
  }, [view, idx])

  const go = (d) => {
    setIdx((i) => (i + d + PROTOTYPES.length) % PROTOTYPES.length)
    setView('single')
  }
  const reset = () => setResetNonce((n) => n + 1)
  const togglePause = () => { CLOCK.toggle(); setPaused(CLOCK.isPaused()) }
  const camReset = () => cameraRef.current?.reset()
  const toggleView = () => setView((v) => (v === 'grid' ? 'single' : 'grid'))
  const downloadPng = () => {
    if (view !== 'single') return
    const a = document.createElement('a')
    a.href = canvasRef.current.toDataURL('image/png')
    a.download = `squishy-${PROTOTYPES[idx].id}.png`
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
      else if (e.key === 'Escape') setView('grid')
      else if (e.key === ' ') { e.preventDefault(); togglePause() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const proto = PROTOTYPES[idx]
  const single = view === 'single'

  return (
    <div className="flex min-h-dvh">
      {/* Stage: lofi scope — gallery content lives inside .glyph-lab-page */}
      <div className="glyph-lab-page flex-1 min-w-0 bg-surface-primary">
      <div id="app">
        <div className="single-row my-auto" style={single ? undefined : { display: 'none' }}>
          <div className="canvas-wrap">
            <canvas
              id="stage"
              ref={canvasRef}
              width={LOGICAL * dpr}
              height={LOGICAL * dpr}
              style={{ width: `${LOGICAL}px`, height: `${LOGICAL}px` }}
            />
          </div>
        </div>

        {view === 'grid' && (
          <Grid
            key={`${sdfVersion}:${resetNonce}`}
            onSelect={(i) => { setIdx(i); setView('single') }}
          />
        )}
      </div>
      </div>

      {/* Chrome: KOL-tokened right rail, outside the lofi CSS scope */}
      <EditorRail>
        <RailHeader>{pad(idx + 1)}/{pad(PROTOTYPES.length)}</RailHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={toggleView}>{view === 'grid' ? 'single' : 'grid'}</Button>
          <Button variant="outline" size="sm" onClick={() => go(-1)}>← prev</Button>
          <Button variant="outline" size="sm" onClick={() => go(1)}>next →</Button>
        </div>

        <Divider />

        <Section label="Glyph">
          <LabeledControl inline label="letter">
            <Input
              size="sm"
              width="100%"
              maxLength={1}
              value={letter}
              onChange={(e) => setLetter(e.target.value.slice(-1) || 'a')}
            />
          </LabeledControl>
          <LabeledControl inline label="weight">
            <Dropdown
              size="sm"
              variant="subtle"
              className="w-full"
              options={[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }))}
              value={weight}
              onChange={(v) => setWeight(v)}
            />
          </LabeledControl>
        </Section>

        {single && <KnobsPanel key={proto.id} proto={proto} onTweak={() => setResetNonce((n) => n + 1)} />}

        <Divider />

        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={reset}>reset</Button>
          <Button variant="ghost" size="sm" onClick={camReset}>cam reset</Button>
          <Button variant="ghost" size="sm" onClick={togglePause}>{paused ? 'play' : 'pause'}</Button>
          <Button variant="ghost" size="sm" onClick={downloadPng}>↓ png</Button>
        </div>

        <Divider />

        {/* per-prototype info (single view only; position lives in the rail header) */}
        <div className="flex flex-col gap-1" style={single ? undefined : { display: 'none' }}>
          <div className="kol-mono-14 text-emphasis">{proto.name}</div>
          <div className="kol-helper-10 text-body">ref: {proto.repo}</div>
          <div className="kol-mono-12 text-body">{proto.summary}</div>
          <div className="kol-mono-12 text-body">→ {proto.helps}</div>
        </div>

        {single && <Divider />}

        <div className="kol-helper-10 text-body flex flex-col gap-1">
          <div>← / →</div>
          <div>G grid</div>
          <div>R reset</div>
          <div>C cam</div>
          <div>space pause</div>
        </div>

        {/* camera hints (single view only — the camera drives the single canvas) */}
        <div className="kol-helper-10 text-body flex flex-col gap-1" style={single ? undefined : { display: 'none' }}>
          <div>drag = pan</div>
          <div>wheel = zoom</div>
          <div>shift+drag = rotate XY</div>
          <div>alt+drag = rotate Z</div>
          <div>C = reset cam</div>
        </div>
      </EditorRail>
    </div>
  )
}

// Route-mount wrapper: the SDF must be baked before App renders (was boot() +
// createRoot in the standalone build).
export default function GlyphLabPage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void rasterizeGlyph('a', 'TG Gullhamrar', '700', LOGICAL * 0.9, MASK_RES, MASK_RES).then((mask0) => {
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
