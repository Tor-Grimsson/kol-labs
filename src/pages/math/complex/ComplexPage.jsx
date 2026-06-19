import { useCallback, useEffect, useRef, useState } from 'react'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { defaultTheme } from '../../../lib/appSettings.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import { useViewportZoom } from '../../../components/framework/useViewportZoom.js'
import StylePanel from '../components/StylePanel'
import { drawAxes2D } from '../components/axes2d'
import { useMathStyle, AXIS_2D } from '../style/mathStyle'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'

// Minimal complex arithmetic (z = [re, im]).
const C = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1] || 1e-12; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d] },
  exp: (a) => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])] },
  sin: (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])],
  sq: (a) => C.mul(a, a),
  cube: (a) => C.mul(C.mul(a, a), a),
}

// Curated complex maps (free-text complex needs a complex-aware parser — later).
const FUNCS = [
  { id: 'z2-1', label: 'z² − 1', f: (z) => C.sub(C.sq(z), [1, 0]) },
  { id: 'z3-1', label: 'z³ − 1', f: (z) => C.sub(C.cube(z), [1, 0]) },
  { id: 'inv', label: '1 / z', f: (z) => C.div([1, 0], z) },
  { id: 'rat', label: '(z²−1)/(z²+1)', f: (z) => { const z2 = C.sq(z); return C.div(C.sub(z2, [1, 0]), C.add(z2, [1, 0])) } },
  { id: 'zinv', label: 'z + 1/z', f: (z) => C.add(z, C.div([1, 0], z)) },
  { id: 'sin', label: 'sin z', f: (z) => C.sin(z) },
  { id: 'exp', label: 'eᶻ', f: (z) => C.exp(z) },
  { id: 'poly5', label: 'z⁵ + z − 1', f: (z) => { const z2 = C.sq(z); const z5 = C.mul(C.sq(z2), z); return C.sub(C.add(z5, z), [1, 0]) } },
]
const DEFAULT_FUNC = FUNCS[0]

const COLORINGS = [
  { value: 'rings', label: 'Rings' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'contour', label: 'Contour' },
]
const RES = [
  { value: '1100', label: 'Standard' },
  { value: '1700', label: 'High' },
  { value: '2600', label: 'Ultra' },
]
const DRAG_CAP = 820 // lower compute res while dragging for smooth panning

function hsv(h, s, v) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: return [v, t, p]
    case 1: return [q, v, p]
    case 2: return [p, v, t]
    case 3: return [p, q, v]
    case 4: return [t, p, v]
    default: return [v, p, q]
  }
}

// Evaluate f(z) ONCE per pixel → cache arg + log2|f|. The animation then only
// re-maps this cache each frame (no f eval), so both hue (phase) and the modulus
// rings can move cheaply.
function computeField(w, h, { f, cx, cy, range }) {
  const n = w * h
  const arg = new Float32Array(n)
  const logmod = new Float32Array(n)
  const bad = new Uint8Array(n)
  const aspect = h / w
  for (let py = 0; py < h; py++) {
    const im = cy - (py / h - 0.5) * range * aspect
    const row = py * w
    for (let px = 0; px < w; px++) {
      const re = cx + (px / w - 0.5) * range
      const i = row + px
      let wr = 0
      let wi = 0
      try { const o = f([re, im]); wr = o[0]; wi = o[1] } catch { /* singular */ }
      if (!Number.isFinite(wr) || !Number.isFinite(wi)) { bad[i] = 1; continue }
      arg[i] = Math.atan2(wi, wr)
      logmod[i] = Math.log2(Math.hypot(wr, wi) + 1e-12)
    }
  }
  return { w, h, arg, logmod, bad }
}

// Re-map a cached field to pixels. huePhase rotates the argument hue; ringPhase
// shifts log2|f| so the modulus rings flow (toward/away from the zeros & poles).
function paintField(ctx, field, { coloring = 'rings', huePhase = 0, ringPhase = 0 }) {
  const { w, h, arg, logmod, bad } = field
  const img = ctx.createImageData(w, h)
  const data = img.data
  const n = w * h
  for (let i = 0; i < n; i++) {
    const idx = i * 4
    if (bad[i]) { data[idx] = data[idx + 1] = data[idx + 2] = 0; data[idx + 3] = 255; continue }
    const H = (((arg[i] / (Math.PI * 2)) + 1 + huePhase) % 1 + 1) % 1
    let V = 1
    if (coloring === 'smooth') {
      const mod = Math.pow(2, logmod[i])
      V = 0.35 + 0.65 * (2 / Math.PI) * Math.atan(mod)
    } else {
      const k = logmod[i] + ringPhase
      V = 0.55 + 0.45 * (k - Math.floor(k))
      if (coloring === 'contour') {
        const a2 = (arg[i] + huePhase * Math.PI * 2) / (Math.PI / 6)
        V *= 0.4 + 0.6 * Math.min(1, Math.abs(a2 - Math.round(a2)) * 6)
      }
    }
    const [r, g, b] = hsv(H, 1, V)
    data[idx] = r * 255
    data[idx + 1] = g * 255
    data[idx + 2] = b * 255
    data[idx + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

// Math · Complex — domain coloring of f(z). Drag to pan, wheel to zoom, play to
// flow the phase + rings. Resolution sets the compute res (CSS scales to the box).
export default function ComplexPage() {
  const [funcId, setFuncId] = useState(DEFAULT_FUNC.id)
  const [range, setRange] = useState(6)
  const [center, setCenter] = useState({ x: 0, y: 0 })

  // = / − zoom · 0 reset framing (wheel + drag already wired on the canvas).
  useViewportZoom({
    zoom: (f) => setRange((r) => Math.max(0.2, Math.min(40, r / f))),
    reset: () => { setCenter({ x: 0, y: 0 }); setRange(6) },
  })
  const [coloring, setColoring] = useState('rings')
  const [quality, setQuality] = useState('1700')
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [footTab, setFootTab] = useState('transport') // Transport · Output · File
  const [style, patchStyle, applyTheme] = useMathStyle({ axis: 'none' })
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)

  // Randomise → random function + coloring (domain coloring owns its palette,
  // so there's no themeable chrome here).
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const f = FUNCS[Math.floor(rng() * FUNCS.length)]
    if (f) setFuncId(f.id)
    const c = COLORINGS[Math.floor(rng() * COLORINGS.length)]
    if (c) setColoring(c.value)
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }

  const getSettings = () => ({ funcId, range, center, coloring, quality, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.funcId != null) setFuncId(s.funcId)
    if (s.range != null) setRange(s.range)
    if (s.center != null) setCenter(s.center)
    if (s.coloring != null) setColoring(s.coloring)
    if (s.quality != null) setQuality(s.quality)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
  }

  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const fieldRef = useRef(null)
  const huePhaseRef = useRef(0)
  const ringPhaseRef = useRef(0)
  const stateRef = useRef({})
  const playingRef = useRef(playing)
  const tempoRef = useRef(tempo)
  playingRef.current = playing
  tempoRef.current = tempo
  const fn = (FUNCS.find((f) => f.id === funcId) || DEFAULT_FUNC).f
  stateRef.current = { f: fn, cx: center.x, cy: center.y, range, coloring, aspect, style, cap: Number(quality) }

  // Paint the cached field at the current phases + overlay axes.
  const paintNow = (ctx) => {
    const fld = fieldRef.current
    if (!fld) return
    paintField(ctx, fld, { coloring: stateRef.current.coloring, huePhase: huePhaseRef.current, ringPhase: ringPhaseRef.current })
    drawAxes2D(ctx, fld.w, fld.h, stateRef.current.style, { cx: stateRef.current.cx, cy: stateRef.current.cy, range: stateRef.current.range })
  }

  // Re-fit the box + recompute the field (heavy: f eval per pixel), then paint.
  const redraw = useCallback(() => {
    const stage = stageRef.current
    const box = boxRef.current
    const cv = canvasRef.current
    if (!stage || !box || !cv) return
    const aw = stage.clientWidth
    const ah = stage.clientHeight
    const r = ratioFor(stateRef.current.aspect)
    let bw = aw
    let bh = ah
    if (r) { bh = bw / r; if (bh > ah) { bh = ah; bw = bh * r } }
    bw = Math.max(1, Math.floor(bw))
    bh = Math.max(1, Math.floor(bh))
    box.style.width = `${bw}px`
    box.style.height = `${bh}px`
    // Target the box at device resolution, capped by the quality setting (lower
    // while dragging so panning stays smooth).
    const dpr = window.devicePixelRatio || 1
    const cap = dragRef.current ? Math.min(DRAG_CAP, stateRef.current.cap) : stateRef.current.cap
    const target = Math.min(Math.max(bw, bh) * dpr, cap)
    const k = target / Math.max(bw, bh)
    cv.width = Math.max(1, Math.round(bw * k))
    cv.height = Math.max(1, Math.round(bh * k))
    fieldRef.current = computeField(cv.width, cv.height, stateRef.current)
    paintNow(cv.getContext('2d'))
  }, [])

  useEffect(() => { redraw() }, [funcId, range, center, quality, aspect, redraw])
  // Coloring/axis change → just re-map (no recompute) when paused.
  useEffect(() => { if (!playingRef.current) paintNow(canvasRef.current?.getContext('2d')) }, [coloring, style])
  useEffect(() => {
    const ro = new ResizeObserver(() => redraw())
    ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [redraw])

  const onDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y } }
  const onMove = (e) => {
    if (!dragRef.current) return
    const box = boxRef.current
    const dx = (e.clientX - dragRef.current.x) / box.clientWidth
    const dy = (e.clientY - dragRef.current.y) / box.clientHeight
    const aspect = box.clientHeight / box.clientWidth
    setCenter({ x: dragRef.current.cx - dx * range, y: dragRef.current.cy + dy * range * aspect })
  }
  const onUp = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); redraw() }

  useEffect(() => {
    const cv = canvasRef.current
    const onWheel = (e) => { e.preventDefault(); setRange((r) => Math.max(0.2, Math.min(40, r * (e.deltaY > 0 ? 1.1 : 0.9)))) }
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => cv.removeEventListener('wheel', onWheel)
  }, [])

  // Animation: advance phase + ring offset and re-map the cached field each frame.
  useEffect(() => {
    const cv = canvasRef.current
    let raf = 0
    let last = 0
    const tick = (now) => {
      if (!last) last = now
      const dt = (now - last) / 1000
      last = now
      if (playingRef.current && fieldRef.current) {
        const s = tempoRef.current / 240
        huePhaseRef.current = (huePhaseRef.current + dt * 0.08 * s) % 1
        ringPhaseRef.current -= dt * 0.25 * s // rings flow inward toward the zeros
        paintNow(cv.getContext('2d'))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const w = d ? d.w : canvasRef.current.width
    const h = d ? d.h : canvasRef.current.height
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const octx = out.getContext('2d')
    const field = computeField(w, h, stateRef.current)
    paintField(octx, field, { coloring, huePhase: huePhaseRef.current, ringPhase: ringPhaseRef.current })
    drawAxes2D(octx, w, h, style, { cx: center.x, cy: center.y, range })
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kol-complex-${funcId}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const stopPhase = () => {
    setPlaying(false)
    huePhaseRef.current = 0
    ringPhaseRef.current = 0
    paintNow(canvasRef.current?.getContext('2d'))
  }

  const funcLabel = (FUNCS.find((f) => f.id === funcId) || DEFAULT_FUNC).label

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={stageRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <div ref={boxRef} className="relative overflow-hidden" style={{ width: '100%', height: '100%' }}>
          <canvas
            ref={canvasRef}
            className="block w-full h-full cursor-grab"
            style={{ touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          />
        </div>
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">f(z) = {funcLabel}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>domain coloring · drag to pan · wheel to zoom</div>
        </div>
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Complex</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: stopPhase,
              onRewind: stopPhase,
              tempo,
              onTempo: setTempo,
              tempoMax: 600,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-complex"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Function">
            <div className="flex flex-col gap-1">
              {FUNCS.map((f) => (
                <Button key={f.id} variant="secondary" size="sm" selected={f.id === funcId} onClick={() => setFuncId(f.id)} className="w-full" style={{ justifyContent: 'flex-start' }}>
                  {f.label}
                </Button>
              ))}
            </div>
          </Section>

          <Section label="View">
            <Slider labeled label="Range" min={0.5} max={20} step={0.1} value={range} onChange={setRange} variant="default" noExpr />
            <LabeledControl label="Coloring">
              <Dropdown size="sm" variant="subtle" className="w-full" options={COLORINGS} value={coloring} onChange={setColoring} />
            </LabeledControl>
            <LabeledControl label="Resolution">
              <Dropdown size="sm" variant="subtle" className="w-full" options={RES} value={quality} onChange={setQuality} />
            </LabeledControl>
            <Button variant="primary" size="sm" onClick={() => { setCenter({ x: 0, y: 0 }); setRange(6) }}>Reset view</Button>
          </Section>

          <StylePanel style={style} onPatch={patchStyle} onTheme={applyTheme} axisOptions={AXIS_2D} showBg={false} showStroke={false} showWeight={false} showTheme={false} />

          <SettingsPanel
            page="math-complex"
            showIO={false}
            showTheme={false}
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

          <div className="kol-helper-10 text-body">hue = arg f(z) · brightness = |f| rings · play = phase + ring flow</div>
      </EditorRail>
    </div>
  )
}
