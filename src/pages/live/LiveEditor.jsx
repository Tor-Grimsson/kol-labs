import { useEffect, useRef, useState } from 'react'
import { coverDraw, startWebcam, startVideoFile, stopStream } from '../scanlines/camera.js'
import { CANVAS_FX_DEFS, applyCanvasFx, getDefaultCanvasFxParams, MAX_CANVAS_FX } from '../radar/hooks/useCanvasFx.js'
import FxParamControl from '../radar/components/FxParamControl.jsx'
import { useGamepad, srcLabel, BUTTON_LABELS } from './useGamepad.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { usePublishReset, usePublishRetrigger, usePublishShortcuts } from '../../components/framework/pageShortcuts.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Button from '../../components/atoms/Button.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'

// Live working resolution (short side). The pixel-FX run per-frame in JS, so we
// keep the preview canvas modest for a smooth feed; export re-renders at the
// chosen aspect × @Nx scale.
const LIVE_BASE = 960

const SOURCE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'webcam', label: 'Webcam' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
]

const FX_BY_ID = Object.fromEntries(CANVAS_FX_DEFS.map((d) => [d.id, d]))
const ADD_OPTIONS = [
  { value: '', label: 'Add effect…' },
  ...CANVAS_FX_DEFS.map((d) => ({ value: d.id, label: d.label })),
]

// Wind is a stateful feedback smear (not a stateless useCanvasFx processor), so
// it lives as its own render stage — but its params are mappable like any effect
// via this virtual target key + spec.
const WIND_KEY = 'wind'
const WIND_DEF = {
  label: 'Wind',
  params: {
    force: { min: 0, max: 40, step: 0.5, default: 0 },  // gust strength (px drift / frame)
    angle: { min: 0, max: 360, step: 1, default: 0 },   // wind direction
    spin: { min: -180, max: 180, step: 1, default: 0 },  // hands-free circular drift (deg/sec)
    trail: { min: 0, max: 0.95, step: 0.01, default: 0.8 }, // how long the smear persists
  },
}
const WIND_DEFAULT = { on: false, force: 0, angle: 0, spin: 0, trail: 0.8 }

// Auto-map order: the two sticks, then the triggers — the controls you can hold
// and modulate. First numeric params across the chain bind to these in turn.
const AUTO_SRC = [
  { kind: 'axis', index: 2 }, { kind: 'axis', index: 3 }, // right stick X / Y
  { kind: 'axis', index: 0 }, { kind: 'axis', index: 1 }, // left stick X / Y
  { kind: 'button', index: 7 }, { kind: 'button', index: 6 }, // R2 / L2
]

// Discrete button actions — performance gestures, edge-triggered on press.
const ACTIONS = [
  { value: 'reroll', label: 'Reroll params' },
  { value: 'snapshot', label: 'Snapshot PNG' },
  { value: 'record', label: 'Toggle record' },
  { value: 'reset', label: 'Reset' },
  { value: 'bypass', label: 'Bypass all FX' },
]
const ACTION_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.value, a.label]))
const ADD_ACTION_OPTIONS = [{ value: '', label: 'Add action…' }, ...ACTIONS]

// A mapping binds a pad source (axis/button/stick) → a param, with response
// shaping: smoothing (lerp), a curve (expo toe), and a sub-range [lo,hi].
function defaultMapping(id, fxKey, paramName, src, spec) {
  return { id, fxKey, paramName, src, invert: false, smooth: 0.2, curve: 1, lo: spec.min, hi: spec.max }
}

function randomValue(spec) {
  if (spec.options) return spec.options[Math.floor(Math.random() * spec.options.length)].value
  const raw = spec.min + Math.random() * (spec.max - spec.min)
  const snapped = spec.step ? Math.round(raw / spec.step) * spec.step : raw
  return Math.max(spec.min, Math.min(spec.max, snapped))
}

// Resolve a mapping's RAW target (pre-smoothing) from the current pad snapshot:
// normalise input to 0..1, shape by curve, spread across [lo,hi], snap + clamp.
// A "stick" source reads a PAIR of axes — angle (circle the stick) or force (push).
function resolveTarget(m, spec, state) {
  if (!spec) return undefined
  const pair = m.src.index ? [2, 3] : [0, 1]
  let t
  if (m.src.kind === 'axis') t = ((state.axes[m.src.index] ?? 0) + 1) / 2
  else if (m.src.kind === 'button') t = state.buttons[m.src.index]?.value ?? 0
  else if (m.src.kind === 'stick-angle') { const x = state.axes[pair[0]] ?? 0, y = state.axes[pair[1]] ?? 0; const a = Math.atan2(y, x) / (Math.PI * 2); t = a - Math.floor(a) }
  else if (m.src.kind === 'stick-force') { const x = state.axes[pair[0]] ?? 0, y = state.axes[pair[1]] ?? 0; t = Math.min(1, Math.hypot(x, y)) }
  else t = 0
  if (m.invert) t = 1 - t
  t = Math.max(0, Math.min(1, t))
  const curve = m.curve && m.curve > 0 ? m.curve : 1
  const tc = curve === 1 ? t : Math.pow(t, curve)
  const lo = m.lo ?? spec.min, hi = m.hi ?? spec.max
  let v = lo + tc * (hi - lo)
  if (spec.step) v = Math.round(v / spec.step) * spec.step
  return Math.max(spec.min, Math.min(spec.max, v))
}

// Live readout of the connected pad — sticks as dots, triggers as bars, buttons
// as pips. Reads the snapshot ref each frame and writes the DOM directly (no
// React re-render at 60fps).
function GamepadMonitor({ getState }) {
  const lsRef = useRef(null), rsRef = useRef(null), l2Ref = useRef(null), r2Ref = useRef(null)
  const btnRefs = useRef([])
  useEffect(() => {
    let raf
    const tick = () => {
      const s = getState()
      const place = (el, ax, ay) => { if (!el) return; el.style.left = `${(((s.axes[ax] ?? 0) + 1) / 2) * 100}%`; el.style.top = `${(((s.axes[ay] ?? 0) + 1) / 2) * 100}%` }
      place(lsRef.current, 0, 1); place(rsRef.current, 2, 3)
      if (l2Ref.current) l2Ref.current.style.width = `${(s.buttons[6]?.value ?? 0) * 100}%`
      if (r2Ref.current) r2Ref.current.style.width = `${(s.buttons[7]?.value ?? 0) * 100}%`
      for (let i = 0; i < btnRefs.current.length; i++) { const el = btnRefs.current[i]; if (el) el.style.opacity = s.buttons[i]?.pressed ? '1' : '0.25' }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getState])
  const ON = 'var(--kol-surface-on-primary)'
  const stick = (ref) => (
    <div className="relative w-12 h-12 rounded bg-fg-04 border border-fg-08 shrink-0">
      <span ref={ref} className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full" style={{ left: '50%', top: '50%', backgroundColor: ON }} />
    </div>
  )
  const bar = (ref) => (
    <div className="h-2 rounded bg-fg-08 overflow-hidden"><div ref={ref} className="h-full" style={{ width: '0%', backgroundColor: ON }} /></div>
  )
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 items-center">
        {stick(lsRef)}{stick(rsRef)}
        <div className="flex-1 flex flex-col gap-1">{bar(l2Ref)}{bar(r2Ref)}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {BUTTON_LABELS.map((_, i) => (
          <span key={i} ref={(el) => { btnRefs.current[i] = el }} className="w-1.5 h-1.5 rounded-full" style={{ opacity: 0.25, backgroundColor: ON }} />
        ))}
      </div>
    </div>
  )
}

// Live Filter — a live webcam/video/image source run through a chain of canvas
// FX in real time, with a game controller playing the effect params + a Wind
// motion stage you can steer by circling the stick.
export default function LiveEditor() {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const imgRef = useRef(null)
  const streamRef = useRef(null)
  const mediaUrlRef = useRef(null)
  const imgInputRef = useRef(null)
  const vidInputRef = useRef(null)
  const recorderRef = useRef(null)
  const keyRef = useRef(1)
  const makeFx = (type) => ({ key: keyRef.current++, type, enabled: true, params: getDefaultCanvasFxParams(type) })

  const [fxChain, setFxChain] = useState(() => [makeFx('chromatic')])
  const [source, setSource] = useState('none')
  const [mediaReady, setMediaReady] = useState(false)
  const [mirror, setMirror] = useState(true)
  const [wind, setWind] = useState(WIND_DEFAULT)

  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const [recording, setRecording] = useState(false)

  // Controller mapping + discrete actions.
  const gamepad = useGamepad()
  const [mappings, setMappings] = useState([])
  const [learning, setLearning] = useState(null) // { fxKey, paramName } while listening
  const [tuneId, setTuneId] = useState(null)      // mapping whose response controls are open
  const [actions, setActions] = useState([])      // [{ id, button, action }]
  const [learningAction, setLearningAction] = useState(null) // action awaiting a button

  const mappingsRef = useRef(mappings); mappingsRef.current = mappings
  const learningRef = useRef(learning); learningRef.current = learning
  const actionsRef = useRef(actions); actionsRef.current = actions
  const learningActionRef = useRef(learningAction); learningActionRef.current = learningAction
  const learnBaseRef = useRef({ axes: [] })
  const smoothedRef = useRef({})       // mapping id → current eased value
  const prevButtonsRef = useRef([])    // last-frame pressed snapshot (edge detection)
  const windBufsRef = useRef(null)     // ping-pong feedback canvases for the smear
  const windAngleRef = useRef(0)       // accumulated spin angle (deg)
  const runActionRef = useRef(null)
  const commitActionLearnRef = useRef(null)

  const camLive = (source === 'webcam' || source === 'video') && mediaReady
  const fxKey = JSON.stringify(fxChain.map((f) => [f.type, f.enabled, f.params]))
  const mappingsKey = JSON.stringify(mappings.map((m) => [m.fxKey, m.paramName, m.src.kind, m.src.index]))
  const actionsKey = JSON.stringify(actions.map((a) => [a.button, a.action]))
  const windKey = JSON.stringify(wind)

  usePublishShortcuts('Live Filter', [
    ['Space', 'Play / pause the feed'],
    ['r', 'Reset effects'],
    ['Shift+R', 'Randomise params'],
  ])

  // Resolve the spec for any mapping target — a canvas FX param or the Wind stage.
  const specFor = (m) => {
    if (m.fxKey === WIND_KEY) return WIND_DEF.params[m.paramName]
    const fx = fxChain.find((f) => f.key === m.fxKey)
    return fx ? FX_BY_ID[fx.type]?.params[m.paramName] : null
  }

  // ── effect stack ops ───────────────────────────────────────────────────────
  const addFx = (id) => { if (id && fxChain.length < MAX_CANVAS_FX) setFxChain((c) => [...c, makeFx(id)]) }
  const removeFx = (key) => {
    setFxChain((c) => c.filter((f) => f.key !== key))
    setMappings((m) => { m.forEach((x) => { if (x.fxKey === key) delete smoothedRef.current[x.id] }); return m.filter((x) => x.fxKey !== key) })
  }
  const toggleFx = (key, on) => setFxChain((c) => c.map((f) => (f.key === key ? { ...f, enabled: on } : f)))
  const setParam = (key, name, value) =>
    setFxChain((c) => c.map((f) => (f.key === key ? { ...f, params: { ...f.params, [name]: value } } : f)))
  const randomiseParams = () =>
    setFxChain((c) => c.map((f) => {
      const def = FX_BY_ID[f.type]
      if (!def) return f
      const params = { ...f.params }
      for (const [name, spec] of Object.entries(def.params)) params[name] = randomValue(spec)
      return { ...f, params }
    }))

  // ── controller mapping ops ─────────────────────────────────────────────────
  const startLearn = (fxKey, paramName) => { learnBaseRef.current = { axes: [...(gamepad.getState().axes || [])] }; setLearning({ fxKey, paramName }) }
  const commitLearn = (src) => {
    const L = learningRef.current; if (!L) return
    learningRef.current = null // stop further detection before the re-render lands
    const spec = specFor(L)
    if (!spec) { setLearning(null); return }
    setMappings((prev) => [
      ...prev.filter((m) => !(m.fxKey === L.fxKey && m.paramName === L.paramName)),
      defaultMapping(keyRef.current++, L.fxKey, L.paramName, src, spec),
    ])
    setLearning(null)
  }
  const updateMapping = (id, patch) => setMappings((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const toggleInvert = (id) => updateMapping(id, { invert: !mappings.find((m) => m.id === id)?.invert })
  const clearMapping = (id) => { delete smoothedRef.current[id]; setMappings((m) => m.filter((x) => x.id !== id)) }
  const clearAllMappings = () => { smoothedRef.current = {}; setMappings([]); setLearning(null) }
  const autoMap = () => {
    const next = []; let s = 0
    for (const fx of fxChain) {
      const def = FX_BY_ID[fx.type]; if (!def) continue
      for (const [name, spec] of Object.entries(def.params)) {
        if (spec.options || s >= AUTO_SRC.length) continue
        next.push(defaultMapping(keyRef.current++, fx.key, name, AUTO_SRC[s++], spec))
      }
      if (s >= AUTO_SRC.length) break
    }
    smoothedRef.current = {}
    setMappings(next)
  }
  // One-click "circle the stick → wind": bind Wind angle←stick angle, force←stick push.
  const steerWind = (stickPair) => {
    setMappings((prev) => {
      const cleaned = prev.filter((m) => !(m.fxKey === WIND_KEY && (m.paramName === 'angle' || m.paramName === 'force')))
      const am = defaultMapping(keyRef.current++, WIND_KEY, 'angle', { kind: 'stick-angle', index: stickPair }, WIND_DEF.params.angle); am.smooth = 0
      const fm = defaultMapping(keyRef.current++, WIND_KEY, 'force', { kind: 'stick-force', index: stickPair }, WIND_DEF.params.force); fm.smooth = 0.15
      return [...cleaned, am, fm]
    })
    setWind((w) => ({ ...w, on: true }))
  }

  // ── button-action ops ───────────────────────────────────────────────────────
  const startActionLearn = (action) => { if (action) setLearningAction(action) }
  const clearAction = (id) => setActions((a) => a.filter((x) => x.id !== id))

  const reset = () => {
    setFxChain([makeFx('chromatic')]); clearAllMappings(); setActions([]); setLearningAction(null)
    setWind(WIND_DEFAULT); windBufsRef.current = null; windAngleRef.current = 0
    setAspect(defaultAspectFor('view')); setScale(DEFAULT_SCALE)
  }
  usePublishReset(reset)
  usePublishRetrigger(randomiseParams)

  // ── media teardown / switch ────────────────────────────────────────────────
  const teardownMedia = () => {
    stopStream(streamRef.current); streamRef.current = null
    if (mediaUrlRef.current) { URL.revokeObjectURL(mediaUrlRef.current); mediaUrlRef.current = null }
    const v = videoRef.current
    if (v) { try { v.pause() } catch { /* */ } v.removeAttribute('src'); v.srcObject = null }
    imgRef.current = null
    setMediaReady(false)
  }
  const switchSource = async (next) => {
    teardownMedia()
    setSource(next)
    if (next === 'webcam') {
      try { streamRef.current = await startWebcam(videoRef.current); setMediaReady(true); setPlaying(true) }
      catch { setSource('none') }
    }
  }
  const onUploadImage = (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { imgRef.current = img; setMediaReady(true); URL.revokeObjectURL(url) }
    img.src = url
  }
  const onUploadVideo = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current)
    const url = URL.createObjectURL(file)
    mediaUrlRef.current = url
    try { await startVideoFile(videoRef.current, url); setMediaReady(true); setPlaying(true) }
    catch { teardownMedia() }
  }

  // Overlay the (smoothed) controller values onto a chain's params (mapped wins).
  const applyMappings = (chain, state) => chain.map((fx) => {
    const def = FX_BY_ID[fx.type]; if (!def) return fx
    let params = fx.params
    for (const m of mappingsRef.current) {
      if (m.fxKey !== fx.key) continue
      const v = smoothedRef.current[m.id] ?? resolveTarget(m, def.params[m.paramName], state)
      if (v != null) params = { ...params, [m.paramName]: v }
    }
    return params === fx.params ? fx : { ...fx, params }
  })
  // Wind params with any controller mappings overlaid.
  const effectiveWind = (state) => {
    const p = { ...wind }
    for (const m of mappingsRef.current) {
      if (m.fxKey !== WIND_KEY) continue
      const v = smoothedRef.current[m.id] ?? resolveTarget(m, WIND_DEF.params[m.paramName], state)
      if (v != null) p[m.paramName] = v
    }
    return p
  }

  // Wind = a temporal feedback smear: each frame the accumulated buffer is nudged
  // by force·[cos,sin](angle) and faded by trail, then the live frame blends on
  // top — so motion leaves drifting streaks. Spin (+ a circling stick) rotates
  // the angle, so the streaks sweep around: wind going in circles.
  const windPass = (dt, ew) => {
    const cv = canvasRef.current; if (!cv) return
    const w = cv.width, h = cv.height
    let B = windBufsRef.current
    if (!B || B.w !== w || B.h !== h) {
      const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
      B = { a: mk(), b: mk(), idx: 0, w, h }
      B.a.getContext('2d').drawImage(cv, 0, 0); B.b.getContext('2d').drawImage(cv, 0, 0)
      windBufsRef.current = B
    }
    windAngleRef.current += (ew.spin || 0) * dt
    const ang = ((ew.angle || 0) + windAngleRef.current) * Math.PI / 180
    const dx = Math.cos(ang) * ew.force, dy = Math.sin(ang) * ew.force
    const src = B.idx ? B.b : B.a
    const dst = B.idx ? B.a : B.b
    const dctx = dst.getContext('2d')
    dctx.globalCompositeOperation = 'source-over'
    dctx.clearRect(0, 0, w, h)
    dctx.globalAlpha = Math.max(0, Math.min(0.95, ew.trail))
    dctx.drawImage(src, dx, dy)   // faded, shifted history = the smear
    dctx.globalAlpha = 0.55       // live frame blended on top so it stays readable
    dctx.drawImage(cv, 0, 0)
    dctx.globalAlpha = 1
    const mctx = cv.getContext('2d')
    mctx.clearRect(0, 0, w, h)
    mctx.drawImage(dst, 0, 0)
    B.idx = 1 - B.idx
  }

  // ── render / animation loop ────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? LIVE_BASE : Math.round(LIVE_BASE * r)
    const h = r >= 1 ? Math.round(LIVE_BASE / r) : LIVE_BASE
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; windBufsRef.current = null }
    const ctx = cv.getContext('2d')

    const drawSource = () => {
      const v = videoRef.current
      if (camLive && v && v.readyState >= 2) return coverDraw(ctx, v, w, h, mirror)
      if (source === 'image' && imgRef.current) return coverDraw(ctx, imgRef.current, w, h, false)
      ctx.fillStyle = '#0a0a0b'; ctx.fillRect(0, 0, w, h)
      return false
    }
    const renderFrame = (st) => { drawSource(); applyCanvasFx(cv, applyMappings(fxChain, st)) }

    const stepMappings = (st) => {
      for (const m of mappingsRef.current) {
        const spec = specFor(m); if (!spec) continue
        const target = resolveTarget(m, spec, st); if (target == null) continue
        const prev = smoothedRef.current[m.id]
        const alpha = m.smooth ? Math.max(0.04, 1 - m.smooth) : 1
        smoothedRef.current[m.id] = prev == null ? target : prev + (target - prev) * alpha
      }
    }
    const detectLearn = (st) => {
      if (!learningRef.current) return
      const base = learnBaseRef.current
      let found = null
      for (let i = 0; i < st.axes.length; i++) { if (Math.abs((st.axes[i] ?? 0) - (base.axes?.[i] ?? 0)) > 0.4) { found = { kind: 'axis', index: i }; break } }
      if (!found) for (let i = 0; i < st.buttons.length; i++) { if ((st.buttons[i]?.value ?? 0) > 0.5) { found = { kind: 'button', index: i }; break } }
      if (found) commitLearn(found)
    }
    const detectActions = (st) => {
      const prev = prevButtonsRef.current || []
      const down = (i) => (st.buttons[i]?.value ?? 0) > 0.5
      if (learningActionRef.current) {
        for (let i = 0; i < st.buttons.length; i++) { if (down(i) && !prev[i]) { commitActionLearnRef.current?.(i); break } }
      } else if (!learningRef.current) {
        for (const b of actionsRef.current) { if (down(b.button) && !prev[b.button]) runActionRef.current?.(b.action) }
      }
      prevButtonsRef.current = st.buttons.map((_, i) => down(i))
    }

    prevButtonsRef.current = (gamepad.getState().buttons || []).map((b) => (b?.value ?? 0) > 0.5)

    // The loop runs whenever something live is happening: a playing feed, Wind,
    // an active controller with mappings/actions, or a pending learn. Else once.
    const animated = (camLive && playing) || wind.on || (gamepad.connected && (mappings.length > 0 || actions.length > 0)) || !!learning || !!learningAction
    if (!animated) { renderFrame(gamepad.getState()); return }
    let alive = true, raf, last = performance.now()
    const loop = () => {
      if (!alive) return
      const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now
      const st = gamepad.getState()
      detectLearn(st); detectActions(st); stepMappings(st); renderFrame(st)
      if (wind.on) windPass(dt, effectiveWind(st))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [source, mediaReady, mirror, aspect, playing, camLive, fxKey, mappingsKey, actionsKey, windKey, gamepad.connected, learning, learningAction]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    teardownMedia()
    try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() } catch { /* */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── transport ──────────────────────────────────────────────────────────────
  const onPlay = () => { setPlaying(true); videoRef.current?.play?.().catch(() => {}) }
  const onPause = () => { setPlaying(false); try { videoRef.current?.pause?.() } catch { /* */ } }
  const onStop = () => { onPause(); if (source === 'video' && videoRef.current) videoRef.current.currentTime = 0 }
  const onRewind = () => { if (source === 'video' && videoRef.current) videoRef.current.currentTime = 0 }

  useEffect(() => {
    if (source === 'video' && videoRef.current) videoRef.current.playbackRate = tempo / 120
  }, [tempo, source])

  // ── export ───────────────────────────────────────────────────────────────
  const exportPng = () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: canvasRef.current.width, h: canvasRef.current.height }
    const out = document.createElement('canvas'); out.width = dd.w; out.height = dd.h
    const octx = out.getContext('2d')
    const v = videoRef.current
    if (camLive && v && v.readyState >= 2) coverDraw(octx, v, dd.w, dd.h, mirror)
    else if (source === 'image' && imgRef.current) coverDraw(octx, imgRef.current, dd.w, dd.h, false)
    else { octx.fillStyle = '#0a0a0b'; octx.fillRect(0, 0, dd.w, dd.h) }
    applyCanvasFx(out, applyMappings(fxChain, gamepad.getState()))
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `kol-live-${Date.now()}.png`; a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  // ── WebM record — MediaRecorder on the live canvas (WYSIWYG at preview res) ──
  const startRecord = () => {
    const cv = canvasRef.current
    if (!cv || recording) return
    let stream
    try { stream = cv.captureStream(30) } catch { return }
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    const mimeType = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || 'video/webm'
    let rec
    try { rec = new MediaRecorder(stream, { mimeType }) } catch { return }
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `kol-live-${Date.now()}.webm`; a.click()
      URL.revokeObjectURL(url)
    }
    rec.start()
    recorderRef.current = rec
    setRecording(true)
    if (camLive && !playing) onPlay() // keep the feed running while we capture
  }
  const stopRecord = () => { try { recorderRef.current?.stop() } catch { /* */ } recorderRef.current = null; setRecording(false) }

  // Run a discrete action (fired by a mapped button). Refs keep the loop calling
  // the freshest closures without re-subscribing on every state change.
  runActionRef.current = (action) => {
    if (action === 'reroll') randomiseParams()
    else if (action === 'snapshot') exportPng()
    else if (action === 'record') (recording ? stopRecord() : startRecord())
    else if (action === 'reset') reset()
    else if (action === 'bypass') setFxChain((c) => { const anyOn = c.some((f) => f.enabled); return c.map((f) => ({ ...f, enabled: !anyOn })) })
  }
  commitActionLearnRef.current = (button) => {
    const act = learningActionRef.current
    learningActionRef.current = null
    if (!act) { setLearningAction(null); return }
    setActions((prev) => [...prev.filter((a) => a.action !== act), { id: keyRef.current++, button, action: act }])
    setLearningAction(null)
  }

  // ── settings (mappings persist by fx index / wind sentinel) ──────────────────
  const getSettings = () => {
    const idx = new Map(fxChain.map((f, i) => [f.key, i]))
    return {
      fxChain: fxChain.map(({ type, enabled, params }) => ({ type, enabled, params })),
      mappings: mappings
        .map((m) => ({ fxIndex: m.fxKey === WIND_KEY ? 'wind' : idx.get(m.fxKey), paramName: m.paramName, src: m.src, invert: m.invert, smooth: m.smooth, curve: m.curve, lo: m.lo, hi: m.hi }))
        .filter((m) => m.fxIndex != null),
      actions: actions.map((a) => ({ button: a.button, action: a.action })),
      wind, mirror, aspect, scale,
    }
  }
  const applySettings = (s) => {
    smoothedRef.current = {}
    let newChain = null
    if (Array.isArray(s.fxChain)) {
      newChain = s.fxChain.map((f) => ({ key: keyRef.current++, type: f.type, enabled: f.enabled !== false, params: { ...getDefaultCanvasFxParams(f.type), ...f.params } }))
      setFxChain(newChain)
    }
    if (Array.isArray(s.mappings)) {
      setMappings(s.mappings
        .map((m) => ({ id: keyRef.current++, fxKey: m.fxIndex === 'wind' ? WIND_KEY : newChain?.[m.fxIndex]?.key, paramName: m.paramName, src: m.src, invert: !!m.invert, smooth: m.smooth ?? 0.2, curve: m.curve ?? 1, lo: m.lo, hi: m.hi }))
        .filter((m) => m.fxKey != null))
    }
    if (Array.isArray(s.actions)) setActions(s.actions.map((a) => ({ id: keyRef.current++, button: a.button, action: a.action })))
    if (s.wind) { setWind({ ...WIND_DEFAULT, ...s.wind }); windBufsRef.current = null; windAngleRef.current = 0 }
    if (typeof s.mirror === 'boolean') setMirror(s.mirror)
    if (s.aspect) setAspect(s.aspect)
    if (s.scale) setScale(s.scale)
  }

  // One param row — the FxParamControl + a ⊙ learn button + the mapping tag/tune.
  // Shared by the canvas-FX sections and the Wind stage (same target model).
  const renderParamRow = (targetKey, name, spec, value, onChange) => {
    const mapped = mappings.find((m) => m.fxKey === targetKey && m.paramName === name)
    const isLearning = learning && learning.fxKey === targetKey && learning.paramName === name
    const live = mapped && gamepad.connected
      ? () => (smoothedRef.current[mapped.id] ?? resolveTarget(mapped, spec, gamepad.getState()))
      : undefined
    return (
      <div key={`${targetKey}:${name}`} className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0"><FxParamControl name={name} spec={spec} value={value} onChange={onChange} liveGet={live} /></div>
          {!spec.options && (
            <Button
              variant={isLearning ? 'primary' : 'ghost'}
              size="sm"
              iconLeft="bullseye"
              aria-label={isLearning ? 'Listening — move a control' : 'Map to controller'}
              onClick={() => (isLearning ? setLearning(null) : startLearn(targetKey, name))}
            />
          )}
        </div>
        {mapped && (
          <div className="kol-helper-10 text-meta flex items-center gap-2">
            <span className="truncate">← {srcLabel(mapped.src)}{mapped.invert ? ' (inv)' : ''}</span>
            <button type="button" className="underline shrink-0" onClick={() => setTuneId(tuneId === mapped.id ? null : mapped.id)}>tune</button>
            <button type="button" className="underline shrink-0" onClick={() => toggleInvert(mapped.id)}>invert</button>
            <button type="button" className="underline shrink-0" onClick={() => clearMapping(mapped.id)}>clear</button>
          </div>
        )}
        {mapped && tuneId === mapped.id && (
          <div className="flex flex-col gap-1 pl-2 border-l border-fg-08">
            <Slider labeled label="Smooth" min={0} max={0.95} step={0.05} value={mapped.smooth ?? 0.2} onChange={(v) => updateMapping(mapped.id, { smooth: v })} variant="default" noExpr raised />
            <Slider labeled label="Curve" min={0.25} max={4} step={0.05} value={mapped.curve ?? 1} onChange={(v) => updateMapping(mapped.id, { curve: v })} variant="default" noExpr raised />
            <Slider labeled label="Low" min={spec.min} max={spec.max} step={spec.step} value={mapped.lo ?? spec.min} onChange={(v) => updateMapping(mapped.id, { lo: v })} variant="default" noExpr raised />
            <Slider labeled label="High" min={spec.min} max={spec.max} step={spec.step} value={mapped.hi ?? spec.max} onChange={(v) => updateMapping(mapped.id, { hi: v })} variant="default" noExpr raised />
          </div>
        )}
        {isLearning && !mapped && <span className="kol-helper-10 text-meta">Move a stick or press a button…</span>}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
        <canvas data-vcap="stage" ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" />
        <video ref={videoRef} className="hidden" playsInline muted />
        {!mediaReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <span className="kol-mono-12 text-meta">Pick a source to begin</span>
            <Button variant="primary" size="sm" iconLeft="camera" className="pointer-events-auto" onClick={() => switchSource('webcam')}>Start camera</Button>
          </div>
        )}
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Live Filter</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{ playing, onPlay, onPause, onStop, onRewind, tempo, onTempo: setTempo, tempoMax: 300 }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
                <Button variant={recording ? 'accent' : 'primary'} size="sm" className="w-full" iconLeft={recording ? 'stop' : 'video'} onClick={recording ? stopRecord : startRecord}>{recording ? 'Stop recording' : 'Record WebM'}</Button>
              </div>
            }
            settingsPage="live"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Source">
          <SegmentedToggle options={SOURCE_OPTIONS} value={source} onChange={switchSource} className="w-full" />
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onUploadImage} />
          <input ref={vidInputRef} type="file" accept="video/*" className="hidden" onChange={onUploadVideo} />
          {source === 'webcam' && (
            mediaReady
              ? <Button variant="secondary" size="sm" className="w-full" iconLeft="camera-off" onClick={() => switchSource('none')}>Stop camera</Button>
              : <Button variant="primary" size="sm" className="w-full" iconLeft="camera" onClick={() => switchSource('webcam')}>Start camera</Button>
          )}
          {source === 'video' && (
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="sm" className="w-full" iconLeft="upload" onClick={() => vidInputRef.current?.click()}>{mediaReady ? 'Replace video' : 'Upload video'}</Button>
              {mediaReady && <Button variant="secondary" size="sm" className="w-full" onClick={teardownMedia}>Clear</Button>}
            </div>
          )}
          {source === 'image' && (
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="sm" className="w-full" iconLeft="upload" onClick={() => imgInputRef.current?.click()}>{mediaReady ? 'Replace image' : 'Upload image'}</Button>
              {mediaReady && <Button variant="secondary" size="sm" className="w-full" onClick={teardownMedia}>Clear</Button>}
            </div>
          )}
          {(source === 'webcam' || source === 'video') && (
            <ToggleSwitch variant="plain" label="Mirror" checked={mirror} onChange={setMirror} />
          )}
        </Section>

        <Section label="Controller">
          {gamepad.connected ? (
            <>
              <span className="kol-helper-10 text-meta truncate">{gamepad.padId}</span>
              <GamepadMonitor getState={gamepad.getState} />
              <Button variant="secondary" size="sm" className="w-full" iconLeft="bullseye" onClick={autoMap}>Auto-map to effects</Button>
              {mappings.length > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={clearAllMappings}>Clear all mappings</Button>}

              <span className="kol-helper-10 text-meta">Button actions</span>
              {actions.map((a) => (
                <div key={a.id} className="kol-helper-10 text-meta flex items-center gap-2">
                  <span className="truncate">{BUTTON_LABELS[a.button] ?? `Button ${a.button}`} → {ACTION_LABEL[a.action]}</span>
                  <button type="button" className="underline shrink-0" onClick={() => clearAction(a.id)}>clear</button>
                </div>
              ))}
              <Dropdown options={ADD_ACTION_OPTIONS} value="" onChange={startActionLearn} variant="subtle" raised openUp className="w-full" />
              {learningAction && <span className="kol-helper-10 text-meta">Press a button to bind “{ACTION_LABEL[learningAction]}”…</span>}
            </>
          ) : (
            <span className="kol-mono-12 text-meta">Connect a controller and press any button.</span>
          )}
        </Section>

        <Section label="Wind">
          <ToggleSwitch variant="plain" label="Enabled" checked={wind.on} onChange={(v) => setWind((w) => ({ ...w, on: v }))} />
          {renderParamRow(WIND_KEY, 'force', WIND_DEF.params.force, wind.force, (v) => setWind((w) => ({ ...w, force: v })))}
          {renderParamRow(WIND_KEY, 'angle', WIND_DEF.params.angle, wind.angle, (v) => setWind((w) => ({ ...w, angle: v })))}
          {renderParamRow(WIND_KEY, 'spin', WIND_DEF.params.spin, wind.spin, (v) => setWind((w) => ({ ...w, spin: v })))}
          {renderParamRow(WIND_KEY, 'trail', WIND_DEF.params.trail, wind.trail, (v) => setWind((w) => ({ ...w, trail: v })))}
          {gamepad.connected && <Button variant="secondary" size="sm" className="w-full" iconLeft="cycle" onClick={() => steerWind(1)}>Steer with right stick</Button>}
        </Section>

        <Section label="Effects">
          <Dropdown options={ADD_OPTIONS} value="" onChange={addFx} variant="subtle" raised openUp className="w-full" />
          <Button variant="secondary" size="sm" className="w-full" iconLeft="shuffle" onClick={randomiseParams}>Randomise params</Button>
        </Section>

        {fxChain.map((fx) => {
          const def = FX_BY_ID[fx.type]
          if (!def) return null
          return (
            <Section key={fx.key} label={def.label}>
              <div className="flex items-center justify-between gap-2">
                <ToggleSwitch variant="plain" label="Enabled" checked={fx.enabled} onChange={(v) => toggleFx(fx.key, v)} />
                <Button variant="ghost" size="sm" iconLeft="trash" aria-label="Remove effect" onClick={() => removeFx(fx.key)} />
              </div>
              {Object.entries(def.params).map(([name, spec]) => renderParamRow(fx.key, name, spec, fx.params[name], (v) => setParam(fx.key, name, v)))}
            </Section>
          )
        })}
      </EditorRail>
    </div>
  )
}
