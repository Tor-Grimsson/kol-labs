import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePublishReset, usePublishRetrigger, usePublishShortcuts } from '../../../components/framework/pageShortcuts.jsx'
import { compileVars } from '../lib/mathfn'
import { resolveRate } from '../../../lib/exprParam.js'
import StylePanel from '../components/StylePanel'
import { drawAxes2D } from '../components/axes2d'
import { useMathStyle, AXIS_2D, THEMES, hexToRgb } from '../style/mathStyle'
import { paintHeat, computeField, paintField, complexFn, COMPLEX_FUNCS } from './render'
import { createGlField } from './glField'
import { CATEGORIES, categoryById, catRoute, presetsForCat } from '../registry'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Input from '../../../components/atoms/Input.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import ColorField from '../../../components/color/ColorField.jsx'
import { useViewportZoom } from '../../../components/framework/useViewportZoom.js'

// Math · Fields — one 2D pan/zoom shell over two render KINDS (scalar f(x,y)
// heatmap + flow · complex f(z) domain coloring), picked in the rail's Preset
// dropdown. Category dropdown navigates the math categories. Mirrors the Waveforms
// generator setup 1:1: Generate · Style · Animation, any edit flips the Preset to
// Custom, Frame/Form patch only their own axis, palette Dropdown seeds colour.
// Pan/zoom are view navigation — they never flip the Preset.

const SCALAR_EXPRS = ['sin(x)*cos(y)', 'sin(hypot(x,y)*2)', 'x*x - y*y', 'sin(x*1.5) + cos(y*1.5)', 'atan2(y,x) + hypot(x,y)']
const RAMPS = [
  { id: 'midnight', label: 'Midnight', low: '#0b1530', high: '#ffce54' },
  { id: 'neon',     label: 'Neon',     low: '#1a0b2e', high: '#ff5470' },
  { id: 'forest',   label: 'Forest',   low: '#04140f', high: '#c9f29b' },
  { id: 'mono',     label: 'Mono',     low: '#0a0a0a', high: '#ededed' },
  { id: 'arctic',   label: 'Arctic',   low: '#0b1d3a', high: '#8fd3ff' },
]
const COLORINGS = [{ value: 'rings', label: 'Rings' }, { value: 'smooth', label: 'Smooth' }, { value: 'contour', label: 'Contour' }]
const RES = [{ value: '1100', label: 'Standard' }, { value: '1700', label: 'High' }, { value: '2600', label: 'Ultra' }]
const CAP = 700        // scalar heatmap compute side
const DRAG_CAP = 820   // complex compute side while dragging

const FALLBACK = {
  kind: 'scalar',
  expr: 'sin(x)*cos(y)', funcId: 'z2-1',
  range: 8, cx: 0, cy: 0,
  low: '#0b1530', high: '#ffce54',
  flow: true, dots: false, count: 700,
  flowSpeed: 1, swirl: 0, drift: 0, driftDir: 'right', // scalar Frame (field motion)
  pulse: 0, jitter: 0,                                  // scalar Form (per-particle, in place)
  coloring: 'rings', quality: '1700', hueSpeed: 1, ringSpeed: 1, shade: 0, // complex
  cspin: 0, czoom: 0,  // complex Frame: whole-field rotation + zoom breathe (via offscreen buffer)
  formSpeed: 1, // shared Form master time-scale
} // every motion default is 0/identity → static render + existing presets unchanged

// Drift heading → unit wind vector added to the scalar flow field (Frame · Drift).
const DRIFT_DIRS = [
  { value: 'right', label: 'Right', vec: [1, 0] }, { value: 'left', label: 'Left', vec: [-1, 0] },
  { value: 'up', label: 'Up', vec: [0, 1] }, { value: 'down', label: 'Down', vec: [0, -1] },
  { value: 'diag', label: 'Diagonal', vec: [0.7071, 0.7071] }, { value: 'anti', label: 'Anti-Diag', vec: [-0.7071, 0.7071] },
]
const driftVec = (id) => (DRIFT_DIRS.find((d) => d.value === id) || DRIFT_DIRS[0]).vec

const rnd = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
// 'custom' shows in a list only while active, so it never reads as a second 'off'.
const motionOpts = (presets, val) => {
  const opts = presets.map((p) => ({ value: p.id, label: p.label }))
  return (val == null || val === 'custom') ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
}
const presetOpts = (PRESETS, val) => {
  const opts = PRESETS.map((p) => ({ value: p.id, label: p.label }))
  return val === 'custom' ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
}

export default function FieldsEditor() {
  const navigate = useNavigate()
  const category = categoryById('fields')
  const PRESETS = presetsForCat('fields')

  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [params, setParams] = useState(() => ({ ...FALLBACK, ...PRESETS[0].defaults }))
  const [draft, setDraft] = useState(FALLBACK.expr)
  const [style, patchStyle, applyTheme] = useMathStyle({ stroke: '#ffffff', axis: 'none' })
  const [tab, setTab] = useState('style')
  const [animTab, setAnimTab] = useState('frame')
  const [framePreset, setFramePreset] = useState('custom')
  const [formPreset, setFormPreset] = useState('custom')
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const isComplex = params.kind === 'complex'
  const applyPatch = (patch) => setParams((p) => ({ ...p, ...patch }))
  // A deliberate edit diverges from the curated preset → flip the Preset to Custom.
  // (Pan/zoom go through applyPatch directly, so navigation never flips it.)
  const editParam = (k, v) => { applyPatch({ [k]: v }); setPresetId('custom') }
  const editStyle = (p) => { patchStyle(p); setPresetId('custom') }

  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const heatRef = useRef(null)        // scalar offscreen heatmap
  const partsRef = useRef([])         // scalar particles
  const fieldRef = useRef(null)       // complex cached field
  const huePhaseRef = useRef(0)
  const ringPhaseRef = useRef(0)
  const shadeRef = useRef(0)          // complex Form · Shade pulse (instantaneous)
  const spinPhaseRef = useRef(0)      // complex Frame · accumulated rotation (radians)
  const complexBufRef = useRef(null)  // offscreen field buffer (spun/zoomed onto the canvas)
  const glRef = useRef(undefined)     // WebGL2 colormap (undefined=untried · null=unsupported · obj=ok)
  const dragRef = useRef(null)
  const stateRef = useRef({})
  const clockRef = useRef(0)

  const fn = useMemo(() => (params.kind === 'scalar' ? compileVars(params.expr, ['x', 'y', 't']) : complexFn(params.funcId)), [params.kind, params.expr, params.funcId])
  stateRef.current = { ...params, kind: params.kind, f: fn, style, playing, tempo, aspect, cap: Number(params.quality) }

  usePublishShortcuts('Math', [['drag', 'pan'], ['wheel', 'zoom'], ['= / −', 'zoom'], ['0', 'reset view'], ['space', 'play / pause']])

  // = / − zoom · 0 reset framing (view navigation — no Preset flip).
  useViewportZoom({
    zoom: (f) => applyPatch({ range: Math.max(0.2, Math.min(60, params.range / f)) }),
    reset: () => applyPatch({ cx: 0, cy: 0, range: isComplex ? 6 : 8 }),
  })
  usePublishReset(() => applyPatch({ cx: 0, cy: 0, range: isComplex ? 6 : 8 }))

  // ── Preset / category ──────────────────────────────────────────────────────
  const applyPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0]
    const next = { ...FALLBACK, ...p.defaults }
    setPresetId(id)
    setParams(next)
    setDraft(next.expr)
    setFramePreset('custom'); setFormPreset('custom')
    huePhaseRef.current = 0; ringPhaseRef.current = 0
  }
  const pickCat = (id) => navigate(catRoute(id))
  // Palette quick-pick (mirrors Waveforms) — seeds bg/stroke/grid via the theme.
  const pickPalette = (id) => { applyTheme(id); setPresetId('custom') }
  const paletteId = THEMES.find((t) => t.bg === style.bg)?.id

  // ── Compute (scalar heatmap / complex field) ────────────────────────────────
  const renderHeat = useCallback(() => {
    const st = stateRef.current
    if (st.kind !== 'scalar' || !st.f) return
    if (!heatRef.current) heatRef.current = document.createElement('canvas')
    const box = boxRef.current
    if (!box) return
    const k = Math.min(1, CAP / Math.max(box.clientWidth, box.clientHeight))
    const w = Math.max(1, Math.round(box.clientWidth * k))
    const h = Math.max(1, Math.round(box.clientHeight * k))
    heatRef.current.width = w
    heatRef.current.height = h
    paintHeat(heatRef.current.getContext('2d'), w, h, st)
  }, [])

  const paintComplex = useCallback((ctx) => {
    const fld = fieldRef.current
    if (!fld || !ctx) return
    const st = stateRef.current
    // Colour the domain into an offscreen buffer (GPU shader, or CPU fallback), then
    // blit it onto the canvas with the Frame rotation (cspin) + zoom breathe (czoom).
    // With both 0 (and paused) this is an identity drawImage = the old pixels.
    const phases = { coloring: st.coloring, huePhase: huePhaseRef.current, ringPhase: ringPhaseRef.current, shade: st.playing ? shadeRef.current : 0 }
    let buf
    if (glRef.current) {
      glRef.current.draw(phases)
      buf = glRef.current.canvas
    } else {
      if (!complexBufRef.current) complexBufRef.current = document.createElement('canvas')
      buf = complexBufRef.current
      if (buf.width !== fld.w || buf.height !== fld.h) { buf.width = fld.w; buf.height = fld.h }
      paintField(buf.getContext('2d'), fld, phases)
    }
    const W = fld.w
    const H = fld.h
    const spin = st.playing ? spinPhaseRef.current : 0
    const z = 1 + (st.playing && st.czoom ? st.czoom * 0.18 * Math.sin(clockRef.current * 1.2) : 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    if (spin || z !== 1) {
      // overscan ×√2 so a rotated square still covers the frame (no bg corners)
      const cover = (spin ? Math.SQRT2 : 1) * z
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(spin); ctx.scale(cover, cover)
      ctx.drawImage(buf, -W / 2, -H / 2, W, H); ctx.restore()
    } else {
      ctx.drawImage(buf, 0, 0)
    }
    drawAxes2D(ctx, W, H, st.style, { cx: st.cx, cy: st.cy, range: st.range })
  }, [])

  const spawn = useCallback(() => {
    const st = stateRef.current
    const aspect = (boxRef.current?.clientHeight || 1) / (boxRef.current?.clientWidth || 1)
    const arr = []
    for (let i = 0; i < st.count; i++) {
      arr.push({ x: st.cx + (Math.random() - 0.5) * st.range, y: st.cy + (Math.random() - 0.5) * st.range * aspect, px: 0, py: 0, life: 40 + Math.random() * 120 })
    }
    arr.forEach((p) => { p.px = p.x; p.py = p.y })
    partsRef.current = arr
  }, [])

  // Size box + canvas (cap differs per kind), then recompute + paint.
  const fit = useCallback(() => {
    const stage = stageRef.current
    const box = boxRef.current
    const cv = canvasRef.current
    if (!stage || !box || !cv) return
    const st = stateRef.current
    const r = ratioFor(st.aspect)
    let bw = stage.clientWidth
    let bh = stage.clientHeight
    if (r) { bh = bw / r; if (bh > stage.clientHeight) { bh = stage.clientHeight; bw = bh * r } }
    bw = Math.max(1, Math.floor(bw)); bh = Math.max(1, Math.floor(bh))
    box.style.width = `${bw}px`; box.style.height = `${bh}px`
    if (st.kind === 'complex') {
      const dpr = window.devicePixelRatio || 1
      const cap = dragRef.current ? Math.min(DRAG_CAP, st.cap) : st.cap
      const target = Math.min(Math.max(bw, bh) * dpr, cap)
      const k = target / Math.max(bw, bh)
      cv.width = Math.max(1, Math.round(bw * k)); cv.height = Math.max(1, Math.round(bh * k))
      fieldRef.current = computeField(cv.width, cv.height, st)
      if (glRef.current === undefined) glRef.current = createGlField() // null if WebGL2 unsupported → CPU path
      glRef.current?.upload(fieldRef.current)
      paintComplex(cv.getContext('2d'))
    } else {
      const k = Math.min(1, CAP / Math.max(bw, bh))
      cv.width = Math.max(1, Math.round(bw * k)); cv.height = Math.max(1, Math.round(bh * k))
      renderHeat()
    }
  }, [paintComplex, renderHeat])

  // Recompute the active field whenever the function/view changes.
  useEffect(() => { fit() }, [aspect, fit])
  useEffect(() => { fit() }, [params.kind, params.expr, params.funcId, params.range, params.cx, params.cy, params.quality]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { renderHeat() }, [params.low, params.high, renderHeat])
  useEffect(() => { if (!playing && isComplex) paintComplex(canvasRef.current?.getContext('2d')) }, [params.coloring, style, playing, isComplex, paintComplex])
  useEffect(() => { spawn() }, [params.count, params.kind, spawn])
  useEffect(() => {
    const ro = new ResizeObserver(() => fit())
    ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [fit])
  useEffect(() => () => { glRef.current?.dispose?.() }, []) // release the WebGL2 context on unmount

  // ── Draw loop (branches on kind) ────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let raf = 0
    let last = 0
    let accum = 0
    const frame = (now) => {
      const st = stateRef.current
      if (!last) last = now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (st.playing) accum += dt * (st.tempo / 120)
      clockRef.current = accum
      const W = cv.width
      const H = cv.height

      if (st.kind === 'complex') {
        if (st.playing && fieldRef.current) {
          const s = st.tempo / 120
          const fs = st.formSpeed ?? 1 // Form master scales ring + shade, not hue (Frame)
          huePhaseRef.current = (huePhaseRef.current + dt * 0.08 * s * resolveRate(st.hueSpeed, accum, 1)) % 1
          ringPhaseRef.current -= dt * 0.25 * s * fs * resolveRate(st.ringSpeed, accum, 1)
          shadeRef.current = st.shade ? st.shade * 0.5 * (1 - Math.cos(accum * fs * 2)) : 0
          if (st.cspin) spinPhaseRef.current += dt * 0.4 * s * st.cspin // Frame · whole-field rotation
          paintComplex(ctx)
        }
        raf = requestAnimationFrame(frame)
        return
      }

      // scalar: blit heatmap, then advect + streak particles
      if (heatRef.current) ctx.drawImage(heatRef.current, 0, 0, W, H)
      else { ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, W, H) }
      if (st.playing && st.f && st.flow) {
        const f = st.f
        const ppwX = W / st.range
        const sx = (x) => W / 2 + (x - st.cx) * ppwX
        const sy = (y) => H / 2 - (y - st.cy) * ppwX
        const eps = st.range * 0.003
        const step = resolveRate(st.flowSpeed, accum, 1) * st.range * 0.06 * (st.tempo / 120) * dt
        const halfH = (st.range * (H / W)) / 2
        // Frame · Swirl (vortex about centre) + Drift (constant wind) bias the field.
        const swirl = st.swirl || 0
        const drift = st.drift || 0
        const [dvx, dvy] = driftVec(st.driftDir)
        // Form · Pulse breathes the stroke/dot width · Jitter shimmers each particle.
        const tf = accum * (st.formSpeed ?? 1)
        const widthPulse = 1 + (st.pulse || 0) * Math.sin(tf * 2)
        const jit = (st.jitter || 0) * st.range * 0.01
        const dotR = Math.max(1, W * 0.0016 * widthPulse)
        ctx.lineWidth = Math.max(1, W * 0.0012 * widthPulse)
        ctx.strokeStyle = `rgba(${hexToRgb(st.style.stroke)},0.55)`
        ctx.fillStyle = `rgba(${hexToRgb(st.style.stroke)},0.7)`
        ctx.beginPath()
        for (const p of partsRef.current) {
          const fx = (f(p.x + eps, p.y, 0) - f(p.x - eps, p.y, 0)) / (2 * eps)
          const fy = (f(p.x, p.y + eps, 0) - f(p.x, p.y - eps, 0)) / (2 * eps)
          let u = fy
          let v = -fx
          if (swirl) { u += -swirl * (p.y - st.cy); v += swirl * (p.x - st.cx) }
          if (drift) { u += drift * dvx; v += drift * dvy }
          const m = Math.hypot(u, v) || 1
          u /= m; v /= m
          p.px = p.x; p.py = p.y
          p.x += u * step; p.y += v * step
          if (jit) { p.x += (Math.random() - 0.5) * jit; p.y += (Math.random() - 0.5) * jit }
          p.life -= 1
          const out = Math.abs(p.x - st.cx) > st.range / 2 || Math.abs(p.y - st.cy) > halfH
          if (p.life <= 0 || out || !Number.isFinite(p.x)) {
            p.x = st.cx + (Math.random() - 0.5) * st.range
            p.y = st.cy + (Math.random() - 0.5) * halfH * 2
            p.px = p.x; p.py = p.y; p.life = 40 + Math.random() * 120
            continue
          }
          if (st.dots) { const X = sx(p.x); const Y = sy(p.y); ctx.moveTo(X + dotR, Y); ctx.arc(X, Y, dotR, 0, Math.PI * 2) }
          else { ctx.moveTo(sx(p.px), sy(p.py)); ctx.lineTo(sx(p.x), sy(p.y)) }
        }
        if (st.dots) ctx.fill()
        else ctx.stroke()
      }
      drawAxes2D(ctx, W, H, st.style, { cx: st.cx, cy: st.cy, range: st.range })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [paintComplex])

  // ── Pan / zoom (view navigation — no Preset flip) ───────────────────────────
  const onDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY, cx: params.cx, cy: params.cy } }
  const onMove = (e) => {
    if (!dragRef.current) return
    const box = boxRef.current
    const dx = (e.clientX - dragRef.current.x) / box.clientWidth
    const dy = (e.clientY - dragRef.current.y) / box.clientHeight
    const ar = box.clientHeight / box.clientWidth
    applyPatch({ cx: dragRef.current.cx - dx * params.range, cy: dragRef.current.cy + dy * params.range * ar })
  }
  const onUp = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); if (isComplex) fit() }
  useEffect(() => {
    const cv = canvasRef.current
    const onWheel = (e) => { e.preventDefault(); applyPatch({ range: Math.max(0.2, Math.min(60, params.range * (e.deltaY > 0 ? 1.1 : 0.9))) }) }
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => cv.removeEventListener('wheel', onWheel)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate ────────────────────────────────────────────────────────────────
  const rollShape = () => {
    if (isComplex) applyPatch({ funcId: pick(COMPLEX_FUNCS).id, coloring: pick(COLORINGS).value })
    else { const ex = pick(SCALAR_EXPRS); setDraft(ex); applyPatch({ expr: ex }) }
  }
  const rollColor = () => { if (!isComplex) { const r = pick(RAMPS); applyPatch({ low: r.low, high: r.high }) } }
  const rollFrame = () => {
    setFramePreset('custom')
    if (isComplex) applyPatch({ hueSpeed: +rnd(0.4, 2.4).toFixed(1), cspin: Math.random() < 0.4 ? +rnd(0.3, 1).toFixed(2) : 0, czoom: Math.random() < 0.3 ? +rnd(0.3, 0.7).toFixed(2) : 0 })
    else applyPatch({ flowSpeed: +rnd(0.4, 3).toFixed(1), swirl: Math.random() < 0.4 ? +rnd(0.2, 0.6).toFixed(2) : 0, drift: Math.random() < 0.4 ? +rnd(0.3, 0.8).toFixed(2) : 0, driftDir: pick(DRIFT_DIRS).value })
  }
  const rollForm = () => {
    setFormPreset('custom')
    if (isComplex) applyPatch({ ringSpeed: +rnd(0.4, 2.4).toFixed(1), shade: Math.random() < 0.4 ? +rnd(0.2, 0.5).toFixed(2) : 0 })
    else applyPatch({ flow: true, dots: Math.random() < 0.5, pulse: Math.random() < 0.4 ? +rnd(0.2, 0.6).toFixed(2) : 0, jitter: Math.random() < 0.3 ? +rnd(0.2, 0.6).toFixed(2) : 0 })
  }
  const onRandomize = () => { setPresetId('custom'); rollShape(); rollColor(); rollFrame(); rollForm() }
  usePublishRetrigger(onRandomize)
  const randomize = (section) => {
    setPresetId('custom')
    if (section === 'all') { setTempo(120); onRandomize(); return }
    if (section === 'shape') return rollShape()
    if (section === 'color') return rollColor()
    if (section === 'frame') return rollFrame()
    if (section === 'form') return rollForm()
  }

  // ── Animation — Frame (primary motion) / Form (secondary) presets ───────────
  const FRAME_PRESETS = isComplex
    ? [
        { id: 'static',  label: 'Static',  params: { hueSpeed: 0,   cspin: 0,   czoom: 0 } },
        { id: 'cycle',   label: 'Cycle',   params: { hueSpeed: 1,   cspin: 0,   czoom: 0 } },
        { id: 'turn',    label: 'Turn',    params: { hueSpeed: 0.4, cspin: 0.6, czoom: 0 } },
        { id: 'breathe', label: 'Breathe', params: { hueSpeed: 0.4, cspin: 0,   czoom: 0.6 } },
        { id: 'rush',    label: 'Rush',    params: { hueSpeed: 2,   cspin: 1,   czoom: 0 } },
      ]
    : [
        { id: 'static', label: 'Static', params: { flowSpeed: 0,   swirl: 0,   drift: 0 } },
        { id: 'drift',  label: 'Drift',  params: { flowSpeed: 1,   swirl: 0,   drift: 0 } },
        { id: 'wind',   label: 'Wind',   params: { flowSpeed: 1,   swirl: 0,   drift: 0.6, driftDir: 'right' } },
        { id: 'vortex', label: 'Vortex', params: { flowSpeed: 1,   swirl: 0.5, drift: 0 } },
        { id: 'rush',   label: 'Rush',   params: { flowSpeed: 2.4, swirl: 0,   drift: 0 } },
      ]
  const FORM_PRESETS = isComplex
    ? [
        { id: 'static', label: 'Static', params: { ringSpeed: 0,   shade: 0,   formSpeed: 1 } },
        { id: 'rings',  label: 'Rings',  params: { ringSpeed: 1,   shade: 0,   formSpeed: 1 } },
        { id: 'pulse',  label: 'Pulse',  params: { ringSpeed: 1,   shade: 0.4, formSpeed: 1 } },
        { id: 'fast',   label: 'Fast',   params: { ringSpeed: 2.4, shade: 0,   formSpeed: 1.6 } },
      ]
    : [
        { id: 'lines',   label: 'Lines',   params: { dots: false, pulse: 0,   jitter: 0,   formSpeed: 1 } },
        { id: 'dots',    label: 'Dots',    params: { dots: true,  pulse: 0,   jitter: 0,   formSpeed: 1 } },
        { id: 'pulse',   label: 'Pulse',   params: { dots: false, pulse: 0.6, jitter: 0,   formSpeed: 1 } },
        { id: 'shimmer', label: 'Shimmer', params: { dots: true,  pulse: 0.3, jitter: 0.5, formSpeed: 1.4 } },
      ]
  const applyFramePreset = (id) => { setFramePreset(id); const p = FRAME_PRESETS.find((x) => x.id === id); if (p) { applyPatch(p.params); setPresetId('custom') } }
  const applyFormPreset = (id) => { setFormPreset(id); const p = FORM_PRESETS.find((x) => x.id === id); if (p) { applyPatch(p.params); setPresetId('custom') } }
  const onFrameEdit = (k, v) => { applyPatch({ [k]: v }); setFramePreset('custom'); setPresetId('custom') }
  const onFormEdit = (k, v) => { applyPatch({ [k]: v }); setFormPreset('custom'); setPresetId('custom') }

  // ── Settings / export ───────────────────────────────────────────────────────
  const getSettings = () => ({ presetId, params, style, tempo, aspect, scale, framePreset, formPreset })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.presetId) setPresetId(s.presetId)
    if (s.style) patchStyle(s.style)
    if (Number.isFinite(s.tempo)) setTempo(s.tempo)
    if (s.aspect) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.framePreset) setFramePreset(s.framePreset)
    if (s.formPreset) setFormPreset(s.formPreset)
    if (s.params) { setParams(s.params); if (s.params.expr) setDraft(s.params.expr) }
  }

  const commitExpr = () => { if (draft !== params.expr) editParam('expr', draft) }
  const loadExpr = (ex) => { setDraft(ex); editParam('expr', ex) }
  const resetView = () => applyPatch({ cx: 0, cy: 0, range: isComplex ? 6 : 8 })

  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const w = d ? d.w : canvasRef.current.width
    const h = d ? d.h : canvasRef.current.height
    const out = document.createElement('canvas')
    out.width = w; out.height = h
    const octx = out.getContext('2d')
    const st = stateRef.current
    if (isComplex) {
      const field = computeField(w, h, st)
      paintField(octx, field, { coloring: st.coloring, huePhase: huePhaseRef.current, ringPhase: ringPhaseRef.current })
      drawAxes2D(octx, w, h, st.style, { cx: st.cx, cy: st.cy, range: st.range })
    } else {
      paintHeat(octx, w, h, st)
    }
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `kol-math-${presetId}.png`; a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const stopAnim = () => { setPlaying(false); if (isComplex) { huePhaseRef.current = 0; ringPhaseRef.current = 0; spinPhaseRef.current = 0; paintComplex(canvasRef.current?.getContext('2d')) } else spawn() }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={stageRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <div ref={boxRef} className="relative overflow-hidden" style={{ width: '100%', height: '100%' }}>
          <canvas ref={canvasRef} data-vcap="stage" className="block w-full h-full cursor-grab" style={{ touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
        </div>
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{PRESETS.find((p) => p.id === presetId)?.label || 'Custom'}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>drag to pan · wheel to zoom · play to flow</div>
        </div>
      </div>

      <LiveClock getT={() => clockRef.current}>
      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Math</RailHeader>
            <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'animation', label: 'Animation' }]} />
          </>
        }
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: stopAnim,
              onRewind: stopAnim,
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-fields"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} value={category.id} onChange={pickCat} />
          <Dropdown size="sm" variant="subtle" className="w-full" options={presetOpts(PRESETS, presetId)} value={presetId} onChange={applyPreset} />
        </Section>

        {tab === 'generate' && (
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('shape')}>{isComplex ? 'Function' : 'Field'}</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('color')} disabled={isComplex}>Colour</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('frame')}>Motion Frame</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('form')}>Motion Form</Button>
            </div>
          </Section>
        )}

        {tab === 'style' && (<>
          {!isComplex && (<>
            <Section label="f(x, y)">
              <Input size="sm" width="100%" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commitExpr} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
              <Dropdown size="sm" variant="subtle" className="w-full" options={SCALAR_EXPRS.map((ex) => ({ value: ex, label: ex }))} value={params.expr} onChange={loadExpr} placeholder="Examples…" />
            </Section>
            <Section label="Flow">
              <ToggleSwitch variant="plain" label="Particles" checked={params.flow} onChange={(v) => editParam('flow', v)} />
              <ToggleSwitch variant="plain" label="Dots" checked={params.dots} onChange={(v) => editParam('dots', v)} />
              <ToggleSwitch variant="plain" label="Grid" checked={style.axis === 'grid'} onChange={(v) => editStyle({ axis: v ? 'grid' : 'none' })} />
              <Slider labeled label="Count" min={100} max={3000} step={100} value={params.count} onChange={(v) => editParam('count', v)} variant="default" noExpr />
              <Slider labeled label="Range" min={1} max={40} step={0.5} value={params.range} onChange={(v) => editParam('range', v)} variant="default" noExpr />
            </Section>
          </>)}

          {isComplex && (<>
            <Section label="Function">
              <Dropdown size="sm" variant="subtle" className="w-full" options={COMPLEX_FUNCS.map((f) => ({ value: f.id, label: f.label }))} value={params.funcId} onChange={(v) => editParam('funcId', v)} />
            </Section>
            <Section label="View">
              <Slider labeled label="Range" min={0.5} max={20} step={0.1} value={params.range} onChange={(v) => editParam('range', v)} variant="default" noExpr />
              <LabeledControl label="Coloring">
                <Dropdown size="sm" variant="subtle" className="w-full" options={COLORINGS} value={params.coloring} onChange={(v) => editParam('coloring', v)} />
              </LabeledControl>
              <LabeledControl label="Resolution">
                <Dropdown size="sm" variant="subtle" className="w-full" options={RES} value={params.quality} onChange={(v) => editParam('quality', v)} />
              </LabeledControl>
            </Section>
          </>)}

          <StylePanel style={style} onPatch={editStyle} axisOptions={AXIS_2D} showBg={false} showWeight={false} showGridColor={false} showStroke={false} showTheme={false} showAxis={false} />

          {!isComplex && (
            <Section label="Color">
              <div className="flex gap-2">
                <Dropdown size="sm" variant="subtle" className="flex-1 min-w-0" options={THEMES.map((t) => ({ value: t.id, label: t.label }))} value={paletteId} onChange={pickPalette} placeholder="Palette…" />
                <Dropdown size="sm" variant="subtle" className="flex-1 min-w-0" options={RAMPS.map((r) => ({ value: r.id, label: r.label }))} value={RAMPS.find((r) => r.low === params.low && r.high === params.high)?.id ?? null} placeholder="Gradient…" onChange={(id) => { const r = RAMPS.find((x) => x.id === id); if (r) { applyPatch({ low: r.low, high: r.high }); setPresetId('custom') } }} />
              </div>
              <ColorField label="Particles" value={style.stroke} onChange={(v) => editStyle({ stroke: v })} />
              <ColorField label="Low" value={params.low} onChange={(v) => editParam('low', v)} />
              <ColorField label="High" value={params.high} onChange={(v) => editParam('high', v)} />
              {style.axis !== 'none' && <ColorField label="Grid color" value={style.gridColor} onChange={(v) => editStyle({ gridColor: v })} />}
            </Section>
          )}
          {isComplex && (
            <Section label="Color">
              <Dropdown size="sm" variant="subtle" className="w-full" options={THEMES.map((t) => ({ value: t.id, label: t.label }))} value={paletteId} onChange={pickPalette} placeholder="Palette…" />
              {style.axis !== 'none' && <ColorField label="Grid color" value={style.gridColor} onChange={(v) => editStyle({ gridColor: v })} />}
            </Section>
          )}
        </>)}

        {tab === 'animation' && (<>
          <Section label="Motion">
            <LabeledControl inline label="Frame">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FRAME_PRESETS, framePreset)} value={framePreset} onChange={applyFramePreset} />
            </LabeledControl>
            <LabeledControl inline label="Form">
              <Dropdown variant="subtle" size="sm" className="w-full" options={motionOpts(FORM_PRESETS, formPreset)} value={formPreset} onChange={applyFormPreset} />
            </LabeledControl>
          </Section>
          {/* Frame = the whole field moves · Form = each particle/cell modulates in place. */}
          <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
          {animTab === 'frame' && (
            <Section label="Frame">
              {isComplex
                ? (<>
                    {/* Hue speed cycles the colour (expr-capable) · Spin rotates the whole
                        field · Zoom breathes its scale. */}
                    <Slider labeled label="Hue speed" min={0} max={3} step={0.1} value={params.hueSpeed} onChange={(v) => onFrameEdit('hueSpeed', v)} variant="default" />
                    <Slider labeled label="Spin" min={0} max={2} step={0.05} value={params.cspin} onChange={(v) => onFrameEdit('cspin', v)} variant="default" noExpr />
                    <Slider labeled label="Zoom" min={0} max={1} step={0.05} value={params.czoom} onChange={(v) => onFrameEdit('czoom', v)} variant="default" noExpr />
                  </>)
                : (<>
                    {/* Flow = advection rate (expr-capable) · Swirl bends the field into a
                        vortex · Drift adds a constant wind in Direction. */}
                    <Slider labeled label="Flow speed" min={0} max={4} step={0.1} value={params.flowSpeed} onChange={(v) => onFrameEdit('flowSpeed', v)} variant="default" />
                    <Slider labeled label="Swirl" min={0} max={1} step={0.05} value={params.swirl} onChange={(v) => onFrameEdit('swirl', v)} variant="default" noExpr />
                    <Slider labeled label="Drift" min={0} max={1} step={0.05} value={params.drift} onChange={(v) => onFrameEdit('drift', v)} variant="default" noExpr />
                    <LabeledControl inline label="Direction">
                      <Dropdown variant="subtle" size="sm" className="w-full" options={DRIFT_DIRS.map((dd) => ({ value: dd.value, label: dd.label }))} value={params.driftDir} onChange={(v) => onFrameEdit('driftDir', v)} />
                    </LabeledControl>
                  </>)}
            </Section>
          )}
          {animTab === 'form' && (
            <Section label="Form">
              <Slider labeled label="Speed" min={0} max={3} step={0.05} value={params.formSpeed} onChange={(v) => onFormEdit('formSpeed', v)} variant="default" noExpr />
              {isComplex
                ? (<>
                    <Slider labeled label="Ring speed" min={0} max={3} step={0.1} value={params.ringSpeed} onChange={(v) => onFormEdit('ringSpeed', v)} variant="default" />
                    <Slider labeled label="Shade" min={0} max={1} step={0.05} value={params.shade} onChange={(v) => onFormEdit('shade', v)} variant="default" noExpr />
                  </>)
                : (<>
                    {/* Pulse breathes the line/dot width · Jitter shimmers each particle. */}
                    <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={params.pulse} onChange={(v) => onFormEdit('pulse', v)} variant="default" noExpr />
                    <Slider labeled label="Jitter" min={0} max={1} step={0.05} value={params.jitter} onChange={(v) => onFormEdit('jitter', v)} variant="default" noExpr />
                    <ToggleSwitch variant="plain" label="Dots" checked={params.dots} onChange={(v) => onFormEdit('dots', v)} />
                  </>)}
            </Section>
          )}
        </>)}
      </EditorRail>
      </LiveClock>
    </div>
  )
}
