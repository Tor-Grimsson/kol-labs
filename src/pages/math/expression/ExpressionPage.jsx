import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Oscilloscope from './Oscilloscope'
import { compile } from './lib/expr'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { defaultTheme, defaultAutoplay } from '../../../lib/appSettings.js'
import StylePanel from '../components/StylePanel'
import { useMathStyle, AXIS_2D } from '../style/mathStyle'
import { resolveTheme, THEME_OPTIONS } from '../../../lib/themes.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import { EXAMPLES, WAVES, FUNCTIONS, VARIABLES, CURVES, RANGES, SPEED } from './data/reference'
import Button from '../../../components/atoms/Button.jsx'
import Input from '../../../components/atoms/Input.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import DropdownPopup from '../../../components/molecules/DropdownPopup.jsx'
import Icon from '../../../components/loaders/Icon.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { usePublishShortcuts, usePublishInfo, usePublishReset } from '../../../components/framework/pageShortcuts.jsx'
import { useViewportZoom } from '../../../components/framework/useViewportZoom.js'

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

// The scope background is --kol-surface-primary. The token has a defined light
// counterpart, so Invert swaps to that exact light value (not a computed
// negative) for a clean, theme-correct flip.
const SCOPE_BG = '#121215'        // --kol-surface-primary (dark)
const SCOPE_BG_LIGHT = '#fafafa'  // --kol-surface-primary (light) — invert opposite

// Per-channel photographic negative — a true colour inversion (bg/trace/grid all
// flip to their opposite) that toggles cleanly: applying it twice restores the
// original. Beats swapping bg<->fg, which just paints the background the trace's
// hue.
function negate(hex) {
  const c = String(hex || '').replace('#', '')
  if (c.length !== 6) return hex
  const n = (i) => (255 - parseInt(c.slice(i, i + 2), 16)).toString(16).padStart(2, '0')
  return '#' + n(0) + n(2) + n(4)
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
  const [margin, setMargin] = useState(0)
  const [zoomX, setZoomX] = useState(1)
  const [zoomY, setZoomY] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [tab, setTab] = useState('scope')
  const [libTab, setLibTab] = useState('presets')
  const [bottomTab, setBottomTab] = useState('transport') // pinned bottom panel: transport | output
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  // bg defaults to --kol-surface-primary (#121215); Background / Invert override it.
  const [style, patchStyle] = useMathStyle({ bg: SCOPE_BG, stroke: '#2dd4bf', weight: 2, uiWeight: 1, axis: 'grid', gridOpacity: 0.10 })
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const scopeRef = useRef(null)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [resetKey, setResetKey] = useState(0)

  usePublishShortcuts('Expression', [
    ['= / −', 'zoom in / out'],
    ['0 / r', 'reset framing'],
    ['f', 'fit Y to the curve'],
    ['Scroll / two-finger', 'zoom the scope'],
    ['Drag', 'pan the scope'],
    ['Click', 'load an example into the field'],
    ['⌘ / Ctrl + Click', 'append it to the current expression'],
    ['Alt + Click', 'clear the expression field'],
    ['i', 'extra info (seed)'],
  ])

  // The reproducibility metadata lives in the `i` overlay, not the rail.
  usePublishInfo('Expression', [
    ['Seed', String(seed)],
    ['Expression', expr || '—'],
  ])

  // Theme drives only the COLOURS (trace + grid + bg). Slider settings — grid
  // opacity, grid weight, trace weight — are user-controlled and deliberately
  // NOT touched here, so they carry through a theme change. Invert flips bg to
  // the token's light counterpart and trace / grid to their photographic
  // negative — a true colour inversion, not a bg<->fg swap.
  useEffect(() => {
    const t = resolveTheme(themeId)
    patchStyle(
      invert
        ? { bg: SCOPE_BG_LIGHT, stroke: negate(t.fg), gridColor: negate(t.grid) }
        : { bg: SCOPE_BG, stroke: t.fg, gridColor: t.grid }
    )
  }, [themeId, invert]) // eslint-disable-line react-hooks/exhaustive-deps

  // Randomise → pick a random example expression.
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const ex = EXAMPLES[Math.floor(rng() * EXAMPLES.length)]
    if (ex && typeof ex.code === 'string') setExpr(ex.code)
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }

  const getSettings = () => ({ expr, min, max, duration, margin, zoomX, zoomY, panX, panY, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.expr != null) setExpr(s.expr)
    if (s.min != null) setMin(s.min)
    if (s.max != null) setMax(s.max)
    if (s.duration != null) setDuration(s.duration)
    if (s.margin != null) setMargin(s.margin)
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
  usePublishReset(reset)

  // Zoom the scope, clamped to the slider range. Functional updates so the key
  // handler below stays mounted once without going stale.
  const zoomBy = (f) => {
    setZoomX((z) => Math.max(0.1, Math.min(10, z * f)))
    setZoomY((z) => Math.max(0.1, Math.min(10, z * f)))
  }

  // = / − zoom · 0 / r reset · f fit (two-finger zoom is on the scope canvas).
  useViewportZoom({ zoom: zoomBy, reset, fit })

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
          fn={fn}
          min={min} max={max} duration={duration} margin={margin}
          zoomX={zoomX} zoomY={zoomY} panX={panX} panY={panY}
          setPanX={setPanX} setPanY={setPanY}
          onZoom={zoomBy}
          playing={playing} tempo={tempo} resetKey={resetKey}
          aspect={ratioFor(aspect)}
          vstyle={style}
        />
      </div>

      <EditorRail
        footerBare
        header={(
          <>
            <RailHeader>Oscilloscope</RailHeader>
            {/* The tab toggle lives in the fixed header — never scrolls away. */}
            <SegmentedToggle
              value={tab}
              onChange={setTab}
              options={[
                { value: 'scope', label: 'Scope' },
                { value: 'style', label: 'Style' },
                { value: 'library', label: 'Library' },
              ]}
            />
          </>
        )}
        footer={(
          <EditorFooter
            tab={bottomTab}
            onTab={setBottomTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); setResetKey((k) => k + 1) },
              onRewind: () => setResetKey((k) => k + 1),
              tempo,
              onTempo: setTempo,
              tempoMax: 600,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={(
              <>
                <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
                <Button variant="primary" size="sm" onClick={animate} className="w-full">Animate ↗</Button>
              </>
            )}
            settingsPage="math-expression"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        )}
      >
          {tab === 'scope' && (
            <>
              <Section label="Expression">
                <div className="flex items-stretch gap-2">
                  <Input
                    size="sm"
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                    onClick={(e) => { if (e.altKey) setExpr('') }}
                    placeholder="wave(t)"
                    className="flex-1"
                  />
                  {/* Examples picker — load an example into the field
                      (⌘/Ctrl+click appends). References live in the Library tab. */}
                  <DropdownPopup
                    trigger={<Icon name="list-unordered" size={16} />}
                    ariaLabel="Examples"
                    title="Load an example"
                    items={EXAMPLES}
                    getLabel={(it) => it.code}
                    getHint={(it) => it.desc}
                    onSelect={(it, e) => pick(it.code, e)}
                  />
                </div>
                {/* Randomise → load a random example expression. */}
                <Button variant="primary" size="sm" iconLeft="cycle" onClick={onRandomize} className="w-full">Randomise</Button>
              </Section>

              <Section label="Bounds">
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="Min" value={min} onChange={setMin} />
                  <NumField label="Max" value={max} onChange={setMax} />
                  <NumField label="Sec" value={duration} onChange={setDuration} />
                  <NumField label="Ofs" value={panX} onChange={setPanX} />
                </div>
              </Section>

              <Section label="View">
                <Slider labeled label="Margin" labelWidth={96} min={0} max={120} step={1} value={margin} onChange={setMargin} variant="default" noExpr />
                <Slider labeled label="X" labelWidth={96} min={0.1} max={10} step={0.1} value={zoomX} onChange={setZoomX} variant="default" noExpr />
                <Slider labeled label="Y" labelWidth={96} min={0.1} max={10} step={0.1} value={zoomY} onChange={setZoomY} variant="default" noExpr />
                <Slider labeled label="Scale" labelWidth={96} min={0.1} max={10} step={0.1} value={(zoomX + zoomY) / 2} onChange={(v) => { setZoomX(v); setZoomY(v) }} variant="default" noExpr />
              </Section>

              {/* Fit (f) auto-ranges Y to the curve; Reset (r / 0) restores framing.
                  Keyboard shortcuts mirror these — see the s overlay. */}
              <ButtonGroup className="w-full">
                <Button variant="primary" size="sm" iconLeft="maximize" onClick={fit} className="flex-1">Fit</Button>
                <Button variant="primary" size="sm" iconLeft="refresh" onClick={reset} className="flex-1">Reset</Button>
              </ButtonGroup>
            </>
          )}

          {tab === 'style' && (
            <>
              {/* Settings — above Style. Theme → Axis → Randomise → Export/Import. */}
              <Section label="Settings">
                {/* Theme / Axis / Grid opacity share one LabeledControl label
                    (style + width) so the labels match and the column aligns. */}
                <LabeledControl inline label="Theme" labelWidth={96}>
                  <Dropdown size="sm" variant="subtle" className="w-full" options={THEME_OPTIONS} value={themeId} onChange={setThemeId} />
                </LabeledControl>
                <LabeledControl inline label="Axis" labelWidth={96}>
                  <Dropdown size="sm" variant="subtle" className="w-full" options={AXIS_2D} value={style.axis} onChange={(v) => patchStyle({ axis: v })} />
                </LabeledControl>
                {style.axis !== 'none' && (
                  <Slider labeled label="Grid opacity" labelWidth={96} min={0} max={1} step={0.02} value={style.gridOpacity} onChange={(v) => patchStyle({ gridOpacity: v })} variant="default" />
                )}
                {/* All weights grouped: Grid weight = the rest of the scope
                    (grid / reference / playhead); Trace weight = the curve. */}
                <Slider labeled label="Grid weight" labelWidth={96} min={0.5} max={10} step={0.1} value={style.uiWeight ?? 1} onChange={(v) => patchStyle({ uiWeight: v })} variant="default" />
                <Slider labeled label="Trace weight" labelWidth={96} min={0.4} max={10} step={0.1} value={style.weight} onChange={(v) => patchStyle({ weight: v })} variant="default" />
              </Section>

              {/* Style — Background · Trace · Grid colour + Invert. Axis lives in Settings. */}
              <StylePanel
                style={style}
                onPatch={patchStyle}
                axisOptions={AXIS_2D}
                strokeLabel="Trace"
                showWeight={false}
                showTheme={false}
                showAxis={false}
                invert={invert}
                onInvert={setInvert}
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
      </EditorRail>
    </div>
  )
}
