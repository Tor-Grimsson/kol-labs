import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compileVars } from '../lib/mathfn'
import { resolveRate } from '../../../lib/exprParam.js'
import StylePanel from '../components/StylePanel'
import { drawAxes2D } from '../components/axes2d'
import { useMathStyle, AXIS_2D, hexToRgb } from '../style/mathStyle'
import { VIEW_ASPECTS, DEFAULT_ASPECT, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import ExportPanel from '../../_shared/ExportPanel.jsx'
import { DEFAULT_THEME, resolveTheme } from '../../../lib/themes.js'
import { mulberry32, randomSeed, randomizeSchema } from '../../../lib/rng.js'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import TransportBar from '../../../components/framework/TransportBar.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Input from '../../../components/atoms/Input.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

const EXAMPLES = [
  'sin(x)*cos(y)',
  'sin(hypot(x,y)*2)',
  'x*x - y*y',
  'sin(x*1.5) + cos(y*1.5)',
  'atan2(y,x) + hypot(x,y)',
]
const CAP = 700 // heatmap compute side; blitted (scaled) to the canvas
const RAMPS = [
  ['#0b1530', '#ffce54'],
  ['#1a0b2e', '#ff5470'],
  ['#04140f', '#c9f29b'],
  ['#0a0a0a', '#ededed'],
  ['#0b1d3a', '#8fd3ff'],
]

const toRGB = (h) => { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] }

// Scalar heatmap of f(x,y): normalise over the view, lerp low→high.
function paintHeat(ctx, w, h, st) {
  const { f, cx, cy, range, low, high } = st
  const vals = new Float64Array(w * h)
  let mn = Infinity
  let mx = -Infinity
  const aspect = h / w
  for (let py = 0; py < h; py++) {
    const y = cy - (py / h - 0.5) * range * aspect
    for (let px = 0; px < w; px++) {
      const x = cx + (px / w - 0.5) * range
      let v = f(x, y, 0)
      if (!Number.isFinite(v)) v = 0
      vals[py * w + px] = v
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
  }
  const span = (mx - mn) || 1
  const A = toRGB(low)
  const B = toRGB(high)
  const img = ctx.createImageData(w, h)
  const data = img.data
  for (let i = 0; i < w * h; i++) {
    const u = (vals[i] - mn) / span
    const idx = i * 4
    data[idx] = A[0] + (B[0] - A[0]) * u
    data[idx + 1] = A[1] + (B[1] - A[1]) * u
    data[idx + 2] = A[2] + (B[2] - A[2]) * u
    data[idx + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

// Math · Field — f(x,y) as a heatmap; play to overlay flow (particles advected
// along the level sets, i.e. the perpendicular gradient ⟂∇f). Drag pans.
export default function FieldPage() {
  const [expr, setExpr] = useState(EXAMPLES[0])
  const [draft, setDraft] = useState(EXAMPLES[0])
  const [range, setRange] = useState(8)
  const [center, setCenter] = useState({ x: 0, y: 0 })
  const [low, setLow] = useState('#0b1530')
  const [high, setHigh] = useState('#ffce54')
  const [style, patchStyle, applyTheme] = useMathStyle({ stroke: '#ffffff' })
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [flow, setFlow] = useState(true)
  const [dots, setDots] = useState(false)
  const [count, setCount] = useState(700)
  const [flowSpeed, setFlowSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [scale, setScale] = useState(DEFAULT_SCALE)

  useEffect(() => {
    const t = resolveTheme(themeId, invert)
    patchStyle({ bg: t.bg, stroke: t.fg, gridColor: t.grid, gridOpacity: t.gridOpacity })
  }, [themeId, invert]) // eslint-disable-line react-hooks/exhaustive-deps

  // Randomise → new expression + flow speed (count/range are structural).
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const ex = EXAMPLES[Math.floor(rng() * EXAMPLES.length)]
    if (ex) { setDraft(ex); setExpr(ex) }
    const r = randomizeSchema([{ key: 'flowSpeed', type: 'range', min: 0.1, max: 4, step: 0.1 }], rng)
    if (r.flowSpeed != null) setFlowSpeed(r.flowSpeed)
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }

  const getSettings = () => ({ expr, range, center, low, high, flow, dots, count, flowSpeed, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.expr != null) { setExpr(s.expr); setDraft(s.expr) }
    if (s.range != null) setRange(s.range)
    if (s.center != null) setCenter(s.center)
    if (s.low != null) setLow(s.low)
    if (s.high != null) setHigh(s.high)
    if (s.flow != null) setFlow(s.flow)
    if (s.dots != null) setDots(s.dots)
    if (s.count != null) setCount(s.count)
    if (s.flowSpeed != null) setFlowSpeed(s.flowSpeed)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
  }

  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const heatRef = useRef(null) // offscreen heatmap canvas
  const partsRef = useRef([])
  const dragRef = useRef(null)
  const stateRef = useRef({})

  const fn = useMemo(() => compileVars(expr, ['x', 'y', 't']), [expr])
  stateRef.current = { f: fn, cx: center.x, cy: center.y, range, low, high, playing, flow, dots, count, flowSpeed, tempo, aspect, style }

  // Recompute the heatmap offscreen on any field/view change.
  const renderHeat = useCallback(() => {
    const st = stateRef.current
    if (!st.f) return
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

  const fit = useCallback(() => {
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
    const k = Math.min(1, CAP / Math.max(bw, bh))
    cv.width = Math.max(1, Math.round(bw * k))
    cv.height = Math.max(1, Math.round(bh * k))
    renderHeat()
  }, [renderHeat])

  const spawn = useCallback(() => {
    const st = stateRef.current
    const aspect = (boxRef.current?.clientHeight || 1) / (boxRef.current?.clientWidth || 1)
    const arr = []
    for (let i = 0; i < st.count; i++) {
      arr.push({
        x: st.cx + (Math.random() - 0.5) * st.range,
        y: st.cy + (Math.random() - 0.5) * st.range * aspect,
        px: 0, py: 0, life: 40 + Math.random() * 120,
      })
    }
    arr.forEach((p) => { p.px = p.x; p.py = p.y })
    partsRef.current = arr
  }, [])

  useEffect(() => { fit() }, [aspect, fit])
  useEffect(() => { renderHeat() }, [fn, range, center, low, high, renderHeat])
  useEffect(() => { spawn() }, [count, spawn])
  useEffect(() => {
    const ro = new ResizeObserver(() => fit())
    ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [fit])

  // Draw loop: blit heatmap, then (if playing) advect + streak particles.
  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let raf = 0
    let last = 0
    let accum = 0 // playhead seconds — for resolving expression params (flow speed)
    const frame = (now) => {
      const st = stateRef.current
      if (!last) last = now
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (st.playing) accum += dt * (st.tempo / 120)
      const W = cv.width
      const H = cv.height
      if (heatRef.current) ctx.drawImage(heatRef.current, 0, 0, W, H)
      else { ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, W, H) }

      if (st.playing && st.f && st.flow) {
        const f = st.f
        const ppwX = W / st.range
        const ppwY = ppwX // isotropic
        const sx = (x) => W / 2 + (x - st.cx) * ppwX
        const sy = (y) => H / 2 - (y - st.cy) * ppwY
        const eps = st.range * 0.003
        const step = resolveRate(st.flowSpeed, accum, 1) * st.range * 0.06 * (st.tempo / 120) * dt
        const halfH = (st.range * (H / W)) / 2
        const dotR = Math.max(1, W * 0.0016)
        ctx.lineWidth = Math.max(1, W * 0.0012)
        ctx.strokeStyle = `rgba(${hexToRgb(st.style.stroke)},0.55)`
        ctx.fillStyle = `rgba(${hexToRgb(st.style.stroke)},0.7)`
        ctx.beginPath()
        const parts = partsRef.current
        for (const p of parts) {
          const fx = (f(p.x + eps, p.y, 0) - f(p.x - eps, p.y, 0)) / (2 * eps)
          const fy = (f(p.x, p.y + eps, 0) - f(p.x, p.y - eps, 0)) / (2 * eps)
          let u = fy
          let v = -fx
          const m = Math.hypot(u, v) || 1
          u /= m; v /= m
          p.px = p.x; p.py = p.y
          p.x += u * step; p.y += v * step
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
  }, [])

  const onDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y } }
  const onMove = (e) => {
    if (!dragRef.current) return
    const box = boxRef.current
    const dx = (e.clientX - dragRef.current.x) / box.clientWidth
    const dy = (e.clientY - dragRef.current.y) / box.clientHeight
    const aspect = box.clientHeight / box.clientWidth
    setCenter({ x: dragRef.current.cx - dx * range, y: dragRef.current.cy + dy * range * aspect })
  }
  const onUp = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId) }

  useEffect(() => {
    const cv = canvasRef.current
    const onWheel = (e) => { e.preventDefault(); setRange((r) => Math.max(0.5, Math.min(60, r * (e.deltaY > 0 ? 1.1 : 0.9)))) }
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => cv.removeEventListener('wheel', onWheel)
  }, [])

  const commitExpr = () => setExpr(draft)
  const loadExample = (ex) => { setDraft(ex); setExpr(ex) }

  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const off = document.createElement('canvas')
    off.width = d ? d.w : canvasRef.current.width
    off.height = d ? d.h : canvasRef.current.height
    paintHeat(off.getContext('2d'), off.width, off.height, stateRef.current)
    off.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'kol-field.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

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
          <div className="kol-helper-12 text-emphasis">f(x, y)</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>heatmap · play for flow · drag to pan</div>
        </div>
      </div>

      <EditorRail>
        <RailHeader>field</RailHeader>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
          <Section label="f(x, y)">
            <Input
              size="sm"
              width="100%"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitExpr}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
            <div className="flex flex-col gap-1">
              {EXAMPLES.map((ex) => (
                <Button key={ex} variant="secondary" size="sm" selected={ex === expr} onClick={() => loadExample(ex)} className="w-full" style={{ justifyContent: 'flex-start' }}>
                  <span className="kol-helper-10 truncate">{ex}</span>
                </Button>
              ))}
            </div>
          </Section>

          <Section label="Flow">
            <ToggleSwitch variant="plain" label="Particles" checked={flow} onChange={setFlow} />
            <ToggleSwitch variant="plain" label="Dots" checked={dots} onChange={setDots} />
            <Slider label="Count" min={100} max={3000} step={100} value={count} onChange={setCount} variant="default" noExpr />
            <Slider label="Speed" min={0.1} max={4} step={0.1} value={flowSpeed} onChange={setFlowSpeed} variant="default" />
          </Section>

          <Section label="Color">
            <LabeledControl inline label="Low">
              <ColorField value={low} onChange={setLow} />
            </LabeledControl>
            <LabeledControl inline label="High">
              <ColorField value={high} onChange={setHigh} />
            </LabeledControl>
            <div className="flex flex-wrap gap-1">
              {RAMPS.map(([lo, hi], i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setLow(lo); setHigh(hi) }}
                  aria-label="ramp preset"
                  className="h-6 w-10 cursor-pointer"
                  style={{ background: `linear-gradient(90deg, ${lo}, ${hi})`, borderRadius: 3, border: '1px solid var(--kol-border-default)' }}
                />
              ))}
            </div>
          </Section>

          <StylePanel style={style} onPatch={patchStyle} onTheme={applyTheme} axisOptions={AXIS_2D} showBg={false} showWeight={false} strokeLabel="Particles" showTheme={false} />

          <SettingsPanel
            page="math-field"
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

          <Section label="View">
            <Slider label="Range" min={1} max={40} step={0.5} value={range} onChange={setRange} variant="default" noExpr />
            <Button variant="primary" size="sm" onClick={() => { setCenter({ x: 0, y: 0 }); setRange(8) }}>Reset view</Button>
          </Section>

          <ExportPanel aspect={aspect} onAspect={setAspect} aspects={VIEW_ASPECTS} scale={scale} onScale={setScale}>
            <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
          </ExportPanel>

          <div className="kol-helper-10 text-body">flow ⟂∇f · export is the heatmap</div>
        </div>

        <div className="border-t border-fg-08 pt-3">
          <TransportBar
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onStop={() => { setPlaying(false); spawn() }}
            onRewind={() => spawn()}
            tempo={tempo}
            onTempo={setTempo}
            tempoMax={300}
          />
        </div>
      </EditorRail>
    </div>
  )
}
