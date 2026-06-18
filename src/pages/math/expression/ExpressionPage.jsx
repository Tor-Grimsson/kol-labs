import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Oscilloscope from './Oscilloscope'
import { compile } from './lib/expr'
import { VIEW_ASPECTS, DEFAULT_ASPECT, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import ExportPanel from '../../_shared/ExportPanel.jsx'
import StylePanel from '../components/StylePanel'
import { useMathStyle, AXIS_2D } from '../style/mathStyle'
import { DEFAULT_THEME, resolveTheme } from '../../../lib/themes.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import { EXAMPLES, WAVES, FUNCTIONS, VARIABLES, CURVES, RANGES, SPEED } from './data/reference'
import Button from '../../../components/atoms/Button.jsx'
import Input from '../../../components/atoms/Input.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import TransportBar from '../../../components/framework/TransportBar.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import { usePublishShortcuts } from '../../../components/framework/pageShortcuts.jsx'

// A clickable expression token. Click → load into the input; Cmd/Ctrl+click →
// append to the current expression.
function Code({ text, onPick }) {
  return (
    <span
      onClick={(e) => onPick(text, e)}
      className="text-fg-96 bg-surface-tertiary px-2 py-1 kol-helper-10 cursor-pointer select-none"
      style={{ borderRadius: 2 }}
    >{text}</span>
  )
}

function Row({ item, onPick }) {
  const code = Array.isArray(item.code)
    ? <span className="flex items-center gap-1.5 shrink-0">{item.code.map((c) => <Code key={c} text={c} onPick={onPick} />)}</span>
    : <Code text={item.code} onPick={onPick} />
  return (
    <div className="flex justify-between items-center gap-2" style={{ height: 26 }}>
      {code}
      <span className="text-fg-48 kol-helper-10 text-right truncate">{item.desc}</span>
    </div>
  )
}

function NumField({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="kol-helper-10 text-fg-48">{label}</span>
      <Input
        size="sm"
        chars={5}
        value={String(value)}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n) }}
        inputClassName="text-right"
      />
    </label>
  )
}

// Math · Expression — a live oscilloscope for the animation-curve DSL. Stage =
// the scope; rail = the scope controls + the clickable reference library.
export default function ExpressionPage() {
  const [expr, setExpr] = useState('wave(t)')
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(100)
  const [duration, setDuration] = useState(5)
  const [zoomX, setZoomX] = useState(1)
  const [zoomY, setZoomY] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [tab, setTab] = useState('scope')
  const [libTab, setLibTab] = useState('presets')
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [style, patchStyle, applyTheme] = useMathStyle({ bg: '#0e0f13', stroke: '#2dd4bf', axis: 'grid', gridOpacity: 0.06 })
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const scopeRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [resetKey, setResetKey] = useState(0)

  usePublishShortcuts('Expression', [
    ['Click', 'load an example into the field'],
    ['⌘ / Ctrl + Click', 'append it to the current expression'],
    ['Alt + Click', 'clear the expression field'],
  ])

  // Theme drives the chrome (bg / stroke / grid); fine-controls in StylePanel
  // still patch the same fields afterwards.
  useEffect(() => {
    const t = resolveTheme(themeId, invert)
    patchStyle({ bg: t.bg, stroke: t.fg, gridColor: t.grid, gridOpacity: t.gridOpacity })
  }, [themeId, invert]) // eslint-disable-line react-hooks/exhaustive-deps

  // Randomise → pick a random example expression.
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const ex = EXAMPLES[Math.floor(rng() * EXAMPLES.length)]
    if (ex && typeof ex.code === 'string') setExpr(ex.code)
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }

  const getSettings = () => ({ expr, min, max, duration, zoomX, zoomY, panX, panY, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.expr != null) setExpr(s.expr)
    if (s.min != null) setMin(s.min)
    if (s.max != null) setMax(s.max)
    if (s.duration != null) setDuration(s.duration)
    if (s.zoomX != null) setZoomX(s.zoomX)
    if (s.zoomY != null) setZoomY(s.zoomY)
    if (s.panX != null) setPanX(s.panX)
    if (s.panY != null) setPanY(s.panY)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
  }

  const navigate = useNavigate()
  const fn = useMemo(() => compile(expr), [expr])

  // Forward the curve to the animation page as the graph x=t, y=f(t) — exactly
  // what the scope shows, so the handoff always matches the preview. Other
  // curve shapes (polar r(θ), parametric) are chosen in the Animate editor.
  const animate = () => {
    navigate(`/math/animate?map=param2d&x=t&y=${encodeURIComponent(expr)}`)
  }

  const pick = (text, e) => {
    if (e && (e.metaKey || e.ctrlKey)) setExpr((prev) => (prev ? prev + text : text))
    else setExpr(text)
  }

  // Auto-range Y to the curve's extent (10% margin), sampled over the window.
  const fit = () => {
    if (!fn) return
    let lo = Infinity, hi = -Infinity
    const dur = Number(duration) || 5
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * dur
      try {
        const v = fn(t, Math.round(t * 60), 0, 100)
        if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v }
      } catch { break }
    }
    if (lo !== Infinity) { const m = (hi - lo) * 0.1; setMin(Math.floor(lo - m)); setMax(Math.ceil(hi + m)) }
  }

  const reset = () => { setZoomX(1); setZoomY(1); setPanX(0); setPanY(0) }

  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await scopeRef.current?.exportBlobAt(d.w, d.h) : await scopeRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kol-expression.png'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="math-expression-page min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 min-w-0 p-5 flex flex-col">
        <Oscilloscope
          ref={scopeRef}
          expr={expr} setExpr={setExpr} fn={fn}
          min={min} max={max} duration={duration}
          zoomX={zoomX} zoomY={zoomY} panX={panX} panY={panY}
          setPanX={setPanX} setPanY={setPanY}
          playing={playing} tempo={tempo} resetKey={resetKey}
          aspect={ratioFor(aspect)}
          vstyle={style}
        />
      </div>

      <EditorRail>
        <RailHeader>oscilloscope</RailHeader>

        {/* Fixed: the tab toggle never scrolls away (you need it to switch tabs). */}
        <SegmentedToggle
          value={tab}
          onChange={setTab}
          options={[
            { value: 'scope', label: 'Scope' },
            { value: 'style', label: 'Style' },
            { value: 'library', label: 'Library' },
          ]}
        />

        {/* Scrolls: ONLY the per-tab content. Toggle (above) + transport (below) stay put. */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
          {tab === 'scope' && (
            <>
              <Section label="Bounds">
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="Min" value={min} onChange={setMin} />
                  <NumField label="Max" value={max} onChange={setMax} />
                  <NumField label="Sec" value={duration} onChange={setDuration} />
                  <NumField label="Ofs" value={panX} onChange={setPanX} />
                </div>
              </Section>

              <Section label="View">
                <Slider label="X" min={0.1} max={10} step={0.1} value={zoomX} onChange={setZoomX} variant="default" noExpr />
                <Slider label="Y" min={0.1} max={10} step={0.1} value={zoomY} onChange={setZoomY} variant="default" noExpr />
                <Slider label="Scale" min={0.1} max={10} step={0.1} value={(zoomX + zoomY) / 2} onChange={(v) => { setZoomX(v); setZoomY(v) }} variant="default" noExpr />
              </Section>

              <ExportPanel aspect={aspect} onAspect={setAspect} aspects={VIEW_ASPECTS} scale={scale} onScale={setScale}>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
              </ExportPanel>
            </>
          )}

          {tab === 'style' && (
            <>
              <StylePanel style={style} onPatch={patchStyle} onTheme={applyTheme} axisOptions={AXIS_2D} strokeLabel="Trace" showWeight={false} showTheme={false} />

              <SettingsPanel
                page="math-expression"
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
            </>
          )}

          {tab === 'library' && (
            <>
              <SegmentedToggle
                value={libTab}
                onChange={setLibTab}
                options={[
                  { value: 'presets', label: 'Presets' },
                  { value: 'reference', label: 'Reference' },
                ]}
              />

              {libTab === 'presets' && (
                <>
                  <Section label="Examples">
                    <div className="flex flex-col">{EXAMPLES.map((it, i) => <Row key={i} item={it} onPick={pick} />)}</div>
                  </Section>
                  <Section label="Range">
                    <div className="flex flex-col">{RANGES.map((it, i) => <Row key={i} item={it} onPick={pick} />)}</div>
                  </Section>
                  <Section label="Speed">
                    <div className="flex flex-col">{SPEED.map((it, i) => <Row key={i} item={it} onPick={pick} />)}</div>
                  </Section>
                </>
              )}

              {libTab === 'reference' && (
                <>
                  <Section label="Waves">
                    <div className="flex flex-col">{WAVES.map((it, i) => <Row key={i} item={it} onPick={pick} />)}</div>
                  </Section>
                  <Section label="Functions">
                    <div className="grid grid-cols-2 gap-x-3">{FUNCTIONS.map((it, i) => <Row key={i} item={it} onPick={pick} />)}</div>
                  </Section>
                  <Section label="Variables">
                    <div className="flex flex-col">{VARIABLES.map((it, i) => <Row key={i} item={it} onPick={pick} />)}</div>
                  </Section>
                  <Section label="Curves">
                    <div className="flex flex-col">{CURVES.map((it, i) => <Row key={i} item={it} onPick={pick} />)}</div>
                  </Section>
                </>
              )}
            </>
          )}
        </div>

        {/* Fixed: transport + Fit/Reset — identical in every tab. */}
        <div className="border-t border-fg-08 pt-3 flex flex-col gap-3">
          <TransportBar
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onStop={() => { setPlaying(false); setResetKey((k) => k + 1) }}
            onRewind={() => setResetKey((k) => k + 1)}
            tempo={tempo}
            onTempo={setTempo}
            tempoMax={300}
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" iconLeft="maximize" onClick={fit} className="flex-1">Fit</Button>
            <Button variant="primary" size="sm" iconLeft="refresh" onClick={reset} className="flex-1">Reset</Button>
          </div>
          <Button variant="primary" size="sm" onClick={animate} className="w-full">Animate ↗</Button>
        </div>
      </EditorRail>
    </div>
  )
}
