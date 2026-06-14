/* ══════════════════════════════════════════════════════════════════════
   PARAMETRIC TYPE LAB
   A focused parametric letterform generator: anatomy-driven parameters
   (metrics / weights / expressive) explored via sliders, an XY pad, and
   relationship/anatomy reference panels. Engines live under lab/engines;
   parameter definitions + presets under lab/data.
   (The old FX / warp / distort / raster / morph / per-param-expression +
   timeline layer was removed — this tool generates type, it isn't an
   effects box.)
   ════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react'

import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Section from '../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import { TabsRow } from './editor/color/PanelTabs'

import {
  PARAM_DEFS, RELATIONSHIPS, PRESETS, ANATOMY,
  GLYPH_ORDER, FILTER_SETS,
  resolveParams,
} from './lab/data.js'
import { renderGlyph, ENGINE_OPTIONS } from './lab/engines/index.js'
import XYPad from './lab/controls/XYPad.jsx'
import ChipsRow from './lab/controls/ChipsRow.jsx'
import AnatomyOverlay from './lab/controls/AnatomyOverlay.jsx'

/* ── PARAM ROW — a single labelled slider ─────────────────────────── */

function ParamRow({ name, def, config, onChange, currentValue, onHover, isHovered }) {
  const display = Number.isFinite(currentValue)
    ? currentValue.toFixed(currentValue < 2 ? 2 : 1)
    : '—'
  return (
    <div
      onMouseEnter={() => onHover(name)}
      onMouseLeave={() => onHover(null)}
      className={`px-3 py-2 border-b border-fg-08 transition-colors ${isHovered ? 'bg-fg-04' : ''}`}
    >
      <LabeledControl label={def.label} hint={display}>
        <Slider
          min={def.min}
          max={def.max}
          step={def.step || 1}
          value={Number.isFinite(config.value) ? config.value : def.def}
          onChange={(v) => onChange({ ...config, value: v, expr: String(v) })}
        />
      </LabeledControl>
    </div>
  )
}

/* ── PARAMS TAB ──────────────────────────────────────────────────── */

function ParamsTab({ paramNames, paramConfigs, params, updateParam, hoveredParam, setHoveredParam, paramsForGlyph }) {
  return (
    <div className="flex flex-col">
      {paramNames.map(name => (
        <ParamRow
          key={name}
          name={name}
          def={PARAM_DEFS[name]}
          config={paramConfigs[name]}
          onChange={(next) => updateParam(name, next)}
          currentValue={params[name]}
          onHover={setHoveredParam}
          isHovered={hoveredParam === name || paramsForGlyph.has(name)}
        />
      ))}
    </div>
  )
}

/* ── RELATIONS TAB ───────────────────────────────────────────────── */

function RelationsTab({ hoveredParam, hoveredGlyph, setHoveredParam }) {
  return (
    <div className="p-3 flex flex-col gap-2">
      {RELATIONSHIPS.map((r, i) => {
        const hot = hoveredParam === r.param || (hoveredGlyph && r.glyphs.includes(hoveredGlyph))
        return (
          <div
            key={i}
            onMouseEnter={() => setHoveredParam(r.param)}
            onMouseLeave={() => setHoveredParam(null)}
            className={`px-3 py-2 border rounded cursor-pointer transition-colors ${hot ? 'border-fg-24 bg-fg-04' : 'border-fg-08 hover:border-fg-16'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`kol-mono-12 uppercase ${hot ? 'text-emphasis' : 'text-body'}`}>{r.param}</span>
              <span className="text-meta kol-mono-12">→</span>
              <span className="kol-mono-12 text-body">{r.glyphs.join(' ')}</span>
            </div>
            <div className="kol-mono-10 text-meta">{r.note}</div>
          </div>
        )
      })}
    </div>
  )
}

function AnatomyTab() {
  return (
    <div className="p-3 flex flex-col">
      {Object.entries(ANATOMY).map(([term, def]) => {
        const tone = def.type === 'metric' ? 'text-emphasis' : def.type === 'part' ? 'text-body' : 'text-meta'
        return (
          <div key={term} className="flex items-baseline gap-3 py-1.5 border-b border-fg-04">
            <span className={`kol-mono-12 uppercase w-24 shrink-0 ${tone}`}>{term}</span>
            <span className="kol-mono-10 text-meta">{def.desc}</span>
          </div>
        )
      })}
      <div className="mt-3 flex gap-4 kol-helper-10 uppercase">
        <span className="text-emphasis">metric</span>
        <span className="text-body">part</span>
        <span className="text-meta">property</span>
      </div>
    </div>
  )
}

/* ── XY PAD TAB ──────────────────────────────────────────────────── */

function XYTab({ paramNames, paramConfigs, updateParam, xKey, yKey, setXKey, setYKey }) {
  const xDef = PARAM_DEFS[xKey]
  const yDef = PARAM_DEFS[yKey]
  const xVal = paramConfigs[xKey]?.value ?? xDef?.def ?? 0
  const yVal = paramConfigs[yKey]?.value ?? yDef?.def ?? 0
  const onChange = (x, y) => {
    updateParam(xKey, { ...paramConfigs[xKey], mode: 'number', value: x, expr: String(x) })
    updateParam(yKey, { ...paramConfigs[yKey], mode: 'number', value: y, expr: String(y) })
  }
  const options = paramNames.map(n => ({ value: n, label: PARAM_DEFS[n].label }))
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="kol-helper-10 uppercase text-meta mb-1">x axis</div>
          <Dropdown size="sm" variant="subtle" className="w-full" options={options} value={xKey} onChange={setXKey} />
        </div>
        <div className="flex-1">
          <div className="kol-helper-10 uppercase text-meta mb-1">y axis</div>
          <Dropdown size="sm" variant="subtle" className="w-full" options={options} value={yKey} onChange={setYKey} />
        </div>
      </div>
      <XYPad
        xValue={xVal} yValue={yVal}
        xMin={xDef?.min ?? 0} xMax={xDef?.max ?? 1}
        yMin={yDef?.min ?? 0} yMax={yDef?.max ?? 1}
        onChange={onChange}
        xLabel={xDef?.label}
        yLabel={yDef?.label}
        size={220}
      />
    </div>
  )
}

/* ── GLYPH COMPONENT ─────────────────────────────────────────────── */

function Glyph({ name, params, engine, showGuides, showAnatomy, big = false }) {
  const g = renderGlyph(engine, name, params)
  if (!g) return null
  const padX = 12
  const totalW = g.width + padX * 2
  const totalH = params.ascender + params.descender + 40
  const baselineY = params.ascender + 20

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className={`block w-auto ${big ? 'h-full max-h-72' : 'h-full max-h-24'}`}>
      {showGuides && <Guides totalW={totalW} baselineY={baselineY} params={params} />}
      <g transform={`translate(${padX}, ${baselineY}) scale(1, -1)`}>
        {g.paths.map((pth, i) => (
          <path key={i} d={pth.d} fillRule={pth.fillRule || 'nonzero'} fill="currentColor" />
        ))}
      </g>
      {showAnatomy && big && <AnatomyOverlay params={params} totalW={totalW} baselineY={baselineY} visible />}
    </svg>
  )
}

function Guides({ totalW, baselineY, params }) {
  return (
    <g stroke="var(--kol-fg-16)" strokeWidth="0.5" strokeDasharray="2 3" fill="none">
      <line x1="0" y1={baselineY} x2={totalW} y2={baselineY} stroke="var(--kol-fg-40)" strokeDasharray="0" />
      <line x1="0" y1={baselineY - params.xHeight} x2={totalW} y2={baselineY - params.xHeight} />
      <line x1="0" y1={baselineY - params.capHeight} x2={totalW} y2={baselineY - params.capHeight} />
      <line x1="0" y1={baselineY - params.ascender} x2={totalW} y2={baselineY - params.ascender} />
      <line x1="0" y1={baselineY + params.descender} x2={totalW} y2={baselineY + params.descender} />
    </g>
  )
}

/* ── RAIL PANELS — one tab row over param groups + reference panels ── */

const PARAM_TABS = ['Metrics', 'Weights', 'Expressive']
const RAIL_TABS = [...PARAM_TABS, 'XY', 'Relations', 'Anatomy']

function RailPanels(props) {
  const [active, setActive] = useState('Metrics')
  const groupKey = active.toLowerCase()
  return (
    <div className="flex flex-col">
      <div className="border-b border-fg-08 shrink-0 overflow-x-auto">
        <TabsRow tabs={RAIL_TABS} active={active} onChange={setActive} />
      </div>
      <div>
        {PARAM_TABS.includes(active) && (
          <ParamsTab
            paramNames={props.groups[groupKey] || []}
            paramConfigs={props.paramConfigs}
            params={props.params}
            updateParam={props.updateParam}
            hoveredParam={props.hoveredParam}
            setHoveredParam={props.setHoveredParam}
            paramsForGlyph={props.paramsForGlyph}
          />
        )}
        {active === 'XY' && (
          <XYTab
            paramNames={props.allParamNames}
            paramConfigs={props.paramConfigs}
            updateParam={props.updateParam}
            xKey={props.xyX} yKey={props.xyY}
            setXKey={props.setXyX} setYKey={props.setXyY}
          />
        )}
        {active === 'Relations' && (
          <RelationsTab hoveredParam={props.hoveredParam} hoveredGlyph={props.hoveredGlyph} setHoveredParam={props.setHoveredParam} />
        )}
        {active === 'Anatomy' && <AnatomyTab />}
      </div>
    </div>
  )
}

/* ── EXPORT ──────────────────────────────────────────────────────── */

function buildSVGString(params, engine) {
  const spacing = params.spacing ?? 22
  const verticalRoom = params.ascender + params.descender + 40
  let x = spacing
  const glyphSVGs = GLYPH_ORDER.map((name) => {
    const g = renderGlyph(engine, name, params)
    if (!g) return ''
    const groupX = x
    x += g.width + spacing
    const paths = g.paths.map(pth =>
      `<path d="${pth.d.replace(/\s+/g, ' ').trim()}"${pth.fillRule ? ` fill-rule="${pth.fillRule}"` : ''} fill="#0a0a0a"/>`
    ).join('')
    return `<g transform="translate(${groupX}, ${params.ascender + 20}) scale(1, -1)">${paths}</g>`
  }).join('\n')
  const totalWidth = x
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${verticalRoom}" width="${totalWidth}" height="${verticalRoom}">
${glyphSVGs}
</svg>`
}

function downloadSVG(params, engine) {
  const svg = buildSVGString(params, engine)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'type-sketch.svg'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/* ── MAIN COMPONENT ──────────────────────────────────────────────── */

const PRESET_OPTIONS = Object.keys(PRESETS).map(n => ({ value: n, label: n }))
const FILTER_SET_OPTIONS = Object.keys(FILTER_SETS).map(n => ({ value: n, label: n }))

export default function ParametricTypeLab() {
  const [paramConfigs, setParamConfigs] = useState(() => {
    const init = {}
    Object.entries(PARAM_DEFS).forEach(([k, def]) => {
      init[k] = { mode: 'number', value: def.def, expr: String(def.def) }
    })
    return init
  })
  const [engine, setEngine] = useState('classic')
  const [hoveredParam, setHoveredParam] = useState(null)
  const [hoveredGlyph, setHoveredGlyph] = useState(null)
  const [showGuides, setShowGuides] = useState(false)
  const [showAnatomy, setShowAnatomy] = useState(false)
  const [focusGlyph, setFocusGlyph] = useState('n')
  const [visibleCount, setVisibleCount] = useState('all')
  const [filterSet, setFilterSet] = useState('All')

  const [xyX, setXyX] = useState('stemWidth')
  const [xyY, setXyY] = useState('oWidth')

  const params = useMemo(() => resolveParams(paramConfigs, 0), [paramConfigs])

  const updateParam = (name, next) => {
    setParamConfigs(prev => ({ ...prev, [name]: next }))
  }

  const applyPreset = (presetName) => {
    const preset = PRESETS[presetName] || {}
    setParamConfigs(() => {
      const next = {}
      Object.entries(PARAM_DEFS).forEach(([k, def]) => {
        const v = preset[k] !== undefined ? preset[k] : def.def
        next[k] = { mode: 'number', value: v, expr: String(v) }
      })
      return next
    })
  }

  const flop = () => {
    /* Metaflop "Flop it!" — randomize every slider in range. */
    setParamConfigs(() => {
      const next = {}
      Object.entries(PARAM_DEFS).forEach(([k, def]) => {
        const v = def.min + Math.random() * (def.max - def.min)
        const rounded = def.step && def.step < 1 ? Math.round(v * 100) / 100 : Math.round(v)
        next[k] = { mode: 'number', value: rounded, expr: String(rounded) }
      })
      return next
    })
  }

  const reset = () => applyPreset('Neutral')

  const groups = useMemo(() => {
    const g = { metrics: [], weights: [], expressive: [] }
    Object.entries(PARAM_DEFS).forEach(([k, def]) => {
      if (g[def.group]) g[def.group].push(k)
    })
    return g
  }, [])

  const allParamNames = useMemo(() => Object.keys(PARAM_DEFS), [])

  const relatedGlyphsByParam = useMemo(() => {
    const map = {}
    RELATIONSHIPS.forEach(r => { map[r.param] = r.glyphs })
    return map
  }, [])

  const paramsForGlyph = useMemo(() => {
    if (!hoveredGlyph) return new Set()
    const s = new Set()
    RELATIONSHIPS.forEach(r => { if (r.glyphs.includes(hoveredGlyph)) s.add(r.param) })
    return s
  }, [hoveredGlyph])

  const visibleGlyphs = useMemo(() => {
    const inSet = FILTER_SETS[filterSet] || GLYPH_ORDER
    const list = GLYPH_ORDER.filter(g => inSet.includes(g))
    return visibleCount === 'all' ? list : list.slice(0, Number(visibleCount))
  }, [filterSet, visibleCount])

  return (
    <div className="flex h-dvh">
      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="h-full w-full flex flex-col gap-4 p-6 bg-surface-tertiary text-fg-96">
          {/* Big specimen */}
          <div className="shrink-0 flex items-center justify-center" style={{ height: '40%' }}>
            <Glyph
              name={focusGlyph} params={params} engine={engine}
              showGuides={showGuides} showAnatomy={showAnatomy} big
            />
          </div>

          {/* Grid */}
          <div className="flex-1 min-h-0 grid gap-1" style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
            gridAutoRows: 'minmax(96px, 1fr)',
          }}>
            {visibleGlyphs.map((name) => {
              const isHighlighted =
                (hoveredParam && (relatedGlyphsByParam[hoveredParam] || []).includes(name)) ||
                hoveredGlyph === name
              const isFocus = focusGlyph === name
              return (
                <button
                  key={name} type="button"
                  onMouseEnter={() => setHoveredGlyph(name)}
                  onMouseLeave={() => setHoveredGlyph(null)}
                  onClick={() => setFocusGlyph(name)}
                  className={`border rounded flex flex-col items-center justify-center p-2 cursor-pointer transition-all min-h-0 ${
                    isFocus ? 'border-fg-40' : isHighlighted ? 'border-fg-24 bg-fg-04' : 'border-fg-08 hover:border-fg-16'
                  }`}
                >
                  <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                    <Glyph name={name} params={params} engine={engine} showGuides={false} showAnatomy={false} />
                  </div>
                  <div className="kol-helper-10 uppercase text-meta mt-1">{name}</div>
                </button>
              )
            })}
          </div>
        </div>
      </main>

      <EditorRail>
        <RailHeader>Para Type</RailHeader>

        <Section label="Engine">
          <LabeledControl inline label="engine">
            <Dropdown size="sm" variant="subtle" className="w-full" options={ENGINE_OPTIONS} value={engine} onChange={setEngine} />
          </LabeledControl>
          <LabeledControl inline label="preset">
            <Dropdown size="sm" variant="subtle" className="w-full" options={PRESET_OPTIONS} value="" onChange={(v) => applyPreset(v)} />
          </LabeledControl>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" iconOnly="shuffle" iconSize={14} title="Flop it" onClick={flop} quiet />
            <Button variant="ghost" size="sm" iconOnly="rotate-left" iconSize={14} title="Reset" onClick={reset} quiet />
          </div>
        </Section>

        <Section label="View">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" iconOnly={showGuides ? 'eye-on' : 'eye-off'} iconSize={14} title="Guides" onClick={() => setShowGuides(s => !s)} quiet />
            <Button variant="ghost" size="sm" iconOnly="grid-01" iconSize={14} title="Anatomy" onClick={() => setShowAnatomy(s => !s)} quiet />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="kol-helper-10 uppercase text-meta">set</span>
            <ChipsRow options={FILTER_SET_OPTIONS} value={filterSet} onChange={setFilterSet} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="kol-helper-10 uppercase text-meta">visible</span>
            <SegmentedToggle
              size="sm"
              value={String(visibleCount)}
              onChange={(v) => setVisibleCount(v === 'all' ? 'all' : Number(v))}
              options={[
                { value: '6',   label: '6'   }, { value: '8', label: '8' },
                { value: '10',  label: '10'  }, { value: 'all', label: 'all' },
              ]}
            />
          </div>
        </Section>

        <Divider />

        <RailPanels
          groups={groups} paramConfigs={paramConfigs} params={params} updateParam={updateParam}
          hoveredParam={hoveredParam} setHoveredParam={setHoveredParam}
          hoveredGlyph={hoveredGlyph} paramsForGlyph={paramsForGlyph}
          allParamNames={allParamNames}
          xyX={xyX} setXyX={setXyX} xyY={xyY} setXyY={setXyY}
        />

        <Divider />

        <Button variant="primary" size="sm" iconLeft="download" iconSize={14} className="w-full" onClick={() => downloadSVG(params, engine)}>
          SVG
        </Button>
      </EditorRail>
    </div>
  )
}
