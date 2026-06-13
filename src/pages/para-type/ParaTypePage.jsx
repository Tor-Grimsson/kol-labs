/* ══════════════════════════════════════════════════════════════════════
   PARAMETRIC TYPE LAB — Phase 10 build
   Anatomy ontology + parameter ratios + math expressions + scrubber +
   FX / warps / distorts / transforms / per-glyph expressions /
   2D pad / morph / raster (halftone + ASCII) / engine picker.
   Modules live under src/lab/{data,math,engines,effects,controls}.
   ════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react'

import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Input from '../../components/atoms/Input.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Section from '../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import { TabsRow } from './editor/color/PanelTabs'

import {
  PARAM_DEFS, RELATIONSHIPS, PRESETS, ANATOMY,
  GLYPH_ORDER, FILTER_SETS, envelopes,
  resolveParams, resolveParamsForGlyph,
} from './lab/data.js'
import { renderGlyph, ENGINE_OPTIONS } from './lab/engines/index.js'
import { FilterDefs, FX_PRESETS } from './lab/effects/filters.jsx'
import { WARPS, WARP_OPTIONS, DISTORTS, affineTransform } from './lab/effects/transforms.js'
import { perlinDisplace, catmullResample, simplifyPath, jitter } from './lab/effects/procedural.js'
import { halftoneDots, asciiCells, shatterCells } from './lab/effects/raster.js'
import { morphAt } from './lab/effects/morph.js'
import ScrubInput from './lab/controls/ScrubInput.jsx'
import XYPad from './lab/controls/XYPad.jsx'
import AnimateAxis from './lab/controls/AnimateAxis.jsx'
import ChipsRow from './lab/controls/ChipsRow.jsx'
import EffectStack from './lab/controls/EffectStack.jsx'
import TransformPanel from './lab/controls/TransformPanel.jsx'
import AnatomyOverlay from './lab/controls/AnatomyOverlay.jsx'

/* ── PARAM ROW (using LabeledControl) ─────────────────────────────── */

function ParamRow({ name, def, config, onChange, currentValue, onHover, isHovered }) {
  const isExpr = config.mode === 'expr'
  const display = Number.isFinite(currentValue)
    ? currentValue.toFixed(currentValue < 2 ? 2 : 1)
    : '—'
  return (
    <div
      onMouseEnter={() => onHover(name)}
      onMouseLeave={() => onHover(null)}
      className={`px-3 py-2 border-b border-fg-08 transition-colors ${isHovered ? 'bg-fg-04' : ''}`}
    >
      <LabeledControl
        label={def.label}
        hint={display}
        className=""
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {isExpr ? (
              <Input
                variant="filled"
                size="sm"
                value={config.expr}
                onChange={(e) => onChange({ ...config, expr: e.target.value })}
                placeholder="sin(t*pi*2)*30+100"
                className="w-full"
              />
            ) : (
              <Slider
                min={def.min}
                max={def.max}
                step={def.step || 1}
                value={Number.isFinite(config.value) ? config.value : def.def}
                onChange={(v) => onChange({ ...config, value: v })}
              />
            )}
          </div>
          <AnimateAxis
            min={def.min}
            max={def.max}
            period={3}
            onChange={(v) => onChange({ ...config, mode: 'number', value: v })}
          />
          <SegmentedToggle
            size="sm"
            value={isExpr ? 'expr' : 'num'}
            onChange={(v) => onChange({ ...config, mode: v === 'expr' ? 'expr' : 'number' })}
            options={[{ value: 'num', label: '#' }, { value: 'expr', label: 'fx' }]}
            className="w-12 shrink-0"
          />
        </div>
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
            <div className="kol-helper-10 text-meta leading-relaxed">{r.note}</div>
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
            <span className="kol-helper-10 text-meta leading-tight">{def.desc}</span>
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

/* ── FX TAB — warps + distorts + filter preset stack ─────────────── */

function FxTab({ activeFx, setActiveFx, activeWarp, setActiveWarp, warpParams, setWarpParams, distort, setDistort }) {
  return (
    <div className="p-3 flex flex-col gap-4">
      <div>
        <div className="kol-helper-10 uppercase text-meta tracking-widest mb-2">filter</div>
        <EffectStack value={activeFx} onChange={setActiveFx} />
      </div>
      <div>
        <div className="kol-helper-10 uppercase text-meta tracking-widest mb-2">warp</div>
        <Dropdown
          size="sm"
          variant="subtle"
          className="w-full"
          options={WARP_OPTIONS}
          value={activeWarp}
          onChange={setActiveWarp}
        />
        <div className="mt-2 flex flex-col gap-2">
          <LabeledControl label="bend" hint={warpParams.bend.toFixed(2)}>
            <Slider min={-1} max={1} step={0.01} value={warpParams.bend} onChange={(v) => setWarpParams({ ...warpParams, bend: v })} />
          </LabeledControl>
          <LabeledControl label="dh" hint={warpParams.dh.toFixed(2)}>
            <Slider min={-1} max={1} step={0.01} value={warpParams.dh} onChange={(v) => setWarpParams({ ...warpParams, dh: v })} />
          </LabeledControl>
          <LabeledControl label="dv" hint={warpParams.dv.toFixed(2)}>
            <Slider min={-1} max={1} step={0.01} value={warpParams.dv} onChange={(v) => setWarpParams({ ...warpParams, dv: v })} />
          </LabeledControl>
        </div>
      </div>
      <div>
        <div className="kol-helper-10 uppercase text-meta tracking-widest mb-2">distort</div>
        <div className="flex flex-col gap-2">
          <LabeledControl label="roughen" hint={distort.roughen.toFixed(2)}>
            <Slider min={0} max={1} step={0.01} value={distort.roughen} onChange={(v) => setDistort({ ...distort, roughen: v })} />
          </LabeledControl>
          <LabeledControl label="tweak" hint={distort.tweak.toFixed(2)}>
            <Slider min={0} max={1} step={0.01} value={distort.tweak} onChange={(v) => setDistort({ ...distort, tweak: v })} />
          </LabeledControl>
          <LabeledControl label="puff" hint={distort.puff.toFixed(2)}>
            <Slider min={-1} max={1} step={0.01} value={distort.puff} onChange={(v) => setDistort({ ...distort, puff: v })} />
          </LabeledControl>
          <LabeledControl label="zigzag" hint={distort.zigzag.toFixed(2)}>
            <Slider min={0} max={0.5} step={0.01} value={distort.zigzag} onChange={(v) => setDistort({ ...distort, zigzag: v })} />
          </LabeledControl>
        </div>
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

/* ── TRANSFORM TAB ───────────────────────────────────────────────── */

function TransformTab({ transform, setTransform, morph, setMorph, raster, setRaster, rasterDensity, setRasterDensity, jitterAmount, setJitterAmount, jitterSeed, setJitterSeed, perspective, setPerspective }) {
  return (
    <div className="flex flex-col">
      <TransformPanel value={transform} onChange={setTransform} />
      <div className="border-t border-fg-08 p-3 flex flex-col gap-2">
        <div className="kol-helper-10 uppercase text-meta tracking-widest">morph target</div>
        <Dropdown
          size="sm"
          variant="subtle"
          className="w-full"
          options={[{ value: 'none', label: 'none' }, ...GLYPH_ORDER.map(g => ({ value: g, label: g }))]}
          value={morph.target}
          onChange={(v) => setMorph({ ...morph, target: v })}
        />
        <LabeledControl label="morph t" hint={morph.t.toFixed(2)}>
          <Slider min={0} max={1} step={0.01} value={morph.t} onChange={(v) => setMorph({ ...morph, t: v })} />
        </LabeledControl>
      </div>
      <div className="border-t border-fg-08 p-3 flex flex-col gap-2">
        <div className="kol-helper-10 uppercase text-meta tracking-widest">raster mode</div>
        <SegmentedToggle
          size="sm"
          value={raster}
          onChange={setRaster}
          options={[
            { value: 'none',     label: 'vector'  },
            { value: 'halftone', label: 'halftone'},
            { value: 'ascii',    label: 'ascii'   },
            { value: 'shatter',  label: 'shatter' },
          ]}
        />
        <LabeledControl label="density" hint={String(rasterDensity)}>
          <Slider min={3} max={20} step={1} value={rasterDensity} onChange={setRasterDensity} />
        </LabeledControl>
      </div>
      <div className="border-t border-fg-08 p-3 flex flex-col gap-2">
        <div className="kol-helper-10 uppercase text-meta tracking-widest">per-glyph jitter</div>
        <LabeledControl label="amount" hint={jitterAmount.toFixed(2)}>
          <Slider min={0} max={1} step={0.01} value={jitterAmount} onChange={setJitterAmount} />
        </LabeledControl>
        <LabeledControl label="seed" hint={String(jitterSeed)}>
          <Slider min={0} max={99} step={1} value={jitterSeed} onChange={setJitterSeed} />
        </LabeledControl>
      </div>
      <div className="border-t border-fg-08 p-3 flex flex-col gap-2">
        <div className="kol-helper-10 uppercase text-meta tracking-widest">3d perspective</div>
        <LabeledControl label="tilt x" hint={String(perspective.rotX)}>
          <Slider min={-80} max={80} step={1} value={perspective.rotX} onChange={(v) => setPerspective({ ...perspective, rotX: v })} />
        </LabeledControl>
        <LabeledControl label="tilt y" hint={String(perspective.rotY)}>
          <Slider min={-80} max={80} step={1} value={perspective.rotY} onChange={(v) => setPerspective({ ...perspective, rotY: v })} />
        </LabeledControl>
        <LabeledControl label="depth" hint={String(perspective.depth)}>
          <Slider min={0} max={20} step={1} value={perspective.depth} onChange={(v) => setPerspective({ ...perspective, depth: v })} />
        </LabeledControl>
      </div>
    </div>
  )
}

/* ── PATH TRANSFORM CHAIN ────────────────────────────────────────── */

function applyPathChain(d, { warpName, warpParams, distort, resolution }) {
  let out = d
  if (resolution?.simplify > 0)  out = simplifyPath(out, { tolerance: resolution.simplify })
  if (resolution?.flatness > 0)  out = catmullResample(out, { flatness: resolution.flatness })
  if (resolution?.perlinAmt > 0) out = perlinDisplace(out, { amount: resolution.perlinAmt, freq: resolution.perlinFreq, seed: resolution.perlinSeed })
  if (warpName && warpName !== 'none' && WARPS[warpName]) {
    out = WARPS[warpName](out, warpParams)
  }
  if (distort.roughen > 0)  out = DISTORTS.roughen(out, { size: 0.04, amount: distort.roughen, seed: 1 })
  if (distort.tweak > 0)    out = DISTORTS.tweak(out, { anchor: distort.tweak, handle: distort.tweak, seed: 2 })
  if (distort.puff !== 0)   out = DISTORTS.puckerBloat(out, { amount: distort.puff })
  if (distort.zigzag > 0)   out = DISTORTS.zigZag(out, { size: distort.zigzag, ridges: 4 })
  return out
}

/* ── GLYPH COMPONENT ─────────────────────────────────────────────── */

function Glyph({
  name, params, engine, showGuides, showAnatomy, big = false,
  fxId, warpName, warpParams, distort, resolution,
  transform, morph, raster, rasterDensity,
}) {
  const g = renderGlyph(engine, name, params)
  if (!g) return null
  const padX = 12
  const totalW = g.width + padX * 2
  const totalH = params.ascender + params.descender + 40
  const baselineY = params.ascender + 20

  /* Morph: only the focus glyph morphs to a chosen target. */
  let paths = g.paths
  if (morph?.target && morph.target !== 'none' && morph.target !== name) {
    const target = renderGlyph(engine, morph.target, params)
    if (target) {
      try {
        const morphed = paths.map((p, i) => {
          const tgt = target.paths[i] || target.paths[0]
          return tgt ? { ...p, d: morphAt(p.d, tgt.d, morph.t || 0) } : p
        })
        paths = morphed
      } catch { /* keep paths */ }
    }
  }

  /* Apply path chain (simplify → flatten → perlin → warp → distort). */
  paths = paths.map(p => ({ ...p, d: applyPathChain(p.d, { warpName, warpParams, distort, resolution }) }))

  const filterRef = fxId && fxId !== 'none' ? FX_PRESETS.find(p => p.id === fxId)?.filterId : null
  const transformAttr = affineTransform(transform)

  /* Raster modes: rasterize each path then emit primitives. */
  if (raster === 'halftone' || raster === 'ascii' || raster === 'shatter') {
    const sw = big ? 320 : 96
    const sh = sw
    const cellSize = Math.max(3, Math.round(sw / rasterDensity / 2))
    const combinedD = paths.map(p => p.d).join(' ')
    const dots = raster === 'halftone'
      ? halftoneDots(combinedD, { gridSize: cellSize, totalW: sw, totalH: sh })
      : null
    const cells = raster === 'ascii'
      ? asciiCells(combinedD, { gridSize: cellSize * 1.2, totalW: sw, totalH: sh })
      : null
    const shards = raster === 'shatter'
      ? shatterCells(combinedD, { density: rasterDensity * 4, inset: 0.15 })
      : null
    return (
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className={`block w-auto ${big ? 'h-full max-h-72' : 'h-full max-h-24'}`}>
        {showGuides && <Guides totalW={totalW} baselineY={baselineY} params={params} />}
        <g transform={`translate(${padX}, ${baselineY}) scale(1, -1)`} filter={filterRef ? `url(#${filterRef})` : undefined}>
          <g transform={transformAttr}>
            {dots && dots.map((d, i) => (
              <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="currentColor" />
            ))}
            {cells && cells.map((c, i) => (
              <text key={i} x={c.cx} y={c.cy} fill="currentColor" textAnchor="middle"
                style={{ font: `${cellSize * 1.4}px ui-monospace, monospace` }}>
                {c.char}
              </text>
            ))}
            {shards && shards.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1" />
            ))}
          </g>
        </g>
        {showAnatomy && big && <AnatomyOverlay params={params} totalW={totalW} baselineY={baselineY} visible />}
      </svg>
    )
  }

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className={`block w-auto ${big ? 'h-full max-h-72' : 'h-full max-h-24'}`}>
      {showGuides && <Guides totalW={totalW} baselineY={baselineY} params={params} />}
      <g transform={`translate(${padX}, ${baselineY}) scale(1, -1)`} filter={filterRef ? `url(#${filterRef})` : undefined}>
        <g transform={transformAttr}>
          {paths.map((pth, i) => (
            <path key={i} d={pth.d} fillRule={pth.fillRule || 'nonzero'} fill="currentColor" />
          ))}
        </g>
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

/* ── RAIL PANELS — one tab row over param groups + meta panels ────── */

const PARAM_TABS = ['Metrics', 'Weights', 'Expressive', 'Effects', 'Resolution']
const RAIL_TABS = [...PARAM_TABS, 'Relations', 'Anatomy', 'FX', 'XY', 'Transform']

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
        {active === 'Relations' && (
          <RelationsTab hoveredParam={props.hoveredParam} hoveredGlyph={props.hoveredGlyph} setHoveredParam={props.setHoveredParam} />
        )}
        {active === 'Anatomy' && <AnatomyTab />}
        {active === 'FX' && (
          <FxTab
            activeFx={props.activeFx} setActiveFx={props.setActiveFx}
            activeWarp={props.activeWarp} setActiveWarp={props.setActiveWarp}
            warpParams={props.warpParams} setWarpParams={props.setWarpParams}
            distort={props.distort} setDistort={props.setDistort}
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
        {active === 'Transform' && (
          <TransformTab
            transform={props.transform} setTransform={props.setTransform}
            morph={props.morph} setMorph={props.setMorph}
            raster={props.raster} setRaster={props.setRaster}
            rasterDensity={props.rasterDensity} setRasterDensity={props.setRasterDensity}
            jitterAmount={props.jitterAmount} setJitterAmount={props.setJitterAmount}
            jitterSeed={props.jitterSeed} setJitterSeed={props.setJitterSeed}
            perspective={props.perspective} setPerspective={props.setPerspective}
          />
        )}
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
  a.download = `type-sketch-${Date.now()}.svg`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/* ── MAIN COMPONENT ──────────────────────────────────────────────── */

const SPEED_OPTIONS = [
  { value: '1', label: '1s' }, { value: '2', label: '2s' }, { value: '4', label: '4s' },
  { value: '8', label: '8s' }, { value: '16', label: '16s' },
]
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
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(4)
  const [hoveredParam, setHoveredParam] = useState(null)
  const [hoveredGlyph, setHoveredGlyph] = useState(null)
  const [showGuides, setShowGuides] = useState(false)
  const [showAnatomy, setShowAnatomy] = useState(false)
  const [focusGlyph, setFocusGlyph] = useState('n')
  const [visibleCount, setVisibleCount] = useState('all')
  const [filterSet, setFilterSet] = useState('All')

  const [activeFx, setActiveFx] = useState('none')
  const [activeWarp, setActiveWarp] = useState('none')
  const [warpParams, setWarpParams] = useState({ bend: 0, dh: 0, dv: 0 })
  const [distort, setDistort] = useState({ roughen: 0, tweak: 0, puff: 0, zigzag: 0 })

  const [transform, setTransform] = useState({ rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 })
  const [morph, setMorph] = useState({ target: 'none', t: 0 })
  const [raster, setRaster] = useState('none')
  const [rasterDensity, setRasterDensity] = useState(8)
  const [jitterAmount, setJitterAmount] = useState(0)
  const [jitterSeed, setJitterSeed] = useState(1)
  const [perspective, setPerspective] = useState({ rotX: 0, rotY: 0, depth: 0 })

  const [xyX, setXyX] = useState('stemWidth')
  const [xyY, setXyY] = useState('oWidth')

  const rafRef = useRef()

  useEffect(() => {
    if (!playing) return
    const start = performance.now()
    const tick = (now) => {
      const elapsed = (now - start) / 1000
      setT(((elapsed / playSpeed) % 1))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, playSpeed])

  const params = useMemo(() => resolveParams(paramConfigs, t), [paramConfigs, t])

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

  const reset = () => {
    applyPreset('Neutral')
    setActiveFx('none')
    setActiveWarp('none')
    setWarpParams({ bend: 0, dh: 0, dv: 0 })
    setDistort({ roughen: 0, tweak: 0, puff: 0, zigzag: 0 })
    setTransform({ rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 })
    setMorph({ target: 'none', t: 0 })
    setRaster('none')
    setJitterAmount(0)
  }

  const groups = useMemo(() => {
    const g = { metrics: [], weights: [], expressive: [], effects: [], resolution: [] }
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

  /* Per-glyph parameter resolution — handles `i`/`count` for FX expressions
   * and applies jitter when non-zero. */
  const paramsForIndex = (i, total) => {
    const base = resolveParamsForGlyph(paramConfigs, t, i, total)
    if (jitterAmount === 0) return base
    const jittered = { ...base }
    Object.entries(PARAM_DEFS).forEach(([k, def]) => {
      if (def.group === 'metrics' || def.group === 'weights' || def.group === 'expressive') {
        const range = (def.max - def.min) * jitterAmount * 0.3
        jittered[k] = jitter(base[k], range, jitterSeed, i + k.charCodeAt(0))
      }
    })
    return jittered
  }

  return (
    <div className="flex h-dvh">
      <main className="flex-1 min-w-0 overflow-hidden">
            <div
              className="h-full w-full flex flex-col gap-4 p-6 bg-surface-tertiary text-fg-96"
              style={{
                perspective: perspective.rotX || perspective.rotY ? '900px' : undefined,
                transformStyle: perspective.rotX || perspective.rotY ? 'preserve-3d' : undefined,
              }}
            >
              {/* SVG filter defs — once, top-level */}
              <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
                <FilterDefs
                  weightFx={params.weightFx || 0}
                  roughenAmount={params.roughen || 0}
                  roughenFreq={params.noiseFreq || 0.05}
                  roughenSeed={Math.round(params.noiseSeed || 1)}
                />
              </svg>

              {/* Big specimen */}
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  height: '40%',
                  transform: `rotateX(${perspective.rotX}deg) rotateY(${perspective.rotY}deg)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Optional depth: stack reduced-opacity copies offset in z. */}
                {perspective.depth > 0 && Array.from({ length: perspective.depth }, (_, i) => (
                  <div
                    key={`d${i}`}
                    style={{
                      position: 'absolute',
                      transform: `translateZ(${-(i + 1) * 4}px)`,
                      opacity: Math.max(0.05, 1 - (i + 1) / (perspective.depth + 1)),
                    }}
                  >
                    <Glyph
                      name={focusGlyph} params={params} engine={engine}
                      showGuides={false} showAnatomy={false} big
                      fxId={activeFx} warpName={activeWarp} warpParams={warpParams} distort={distort}
                      resolution={{ flatness: params.flatness, simplify: params.simplify, perlinAmt: params.perlinAmt, perlinFreq: params.perlinFreq, perlinSeed: Math.round(params.noiseSeed || 1) }}
                      transform={transform} morph={morph}
                      raster={raster} rasterDensity={rasterDensity}
                    />
                  </div>
                ))}
                <Glyph
                  name={focusGlyph} params={params} engine={engine}
                  showGuides={showGuides} showAnatomy={showAnatomy} big
                  fxId={activeFx} warpName={activeWarp} warpParams={warpParams} distort={distort}
                  resolution={{ flatness: params.flatness, simplify: params.simplify, perlinAmt: params.perlinAmt, perlinFreq: params.perlinFreq, perlinSeed: Math.round(params.noiseSeed || 1) }}
                  transform={transform} morph={morph}
                  raster={raster} rasterDensity={rasterDensity}
                />
              </div>

              {/* Grid */}
              <div className="flex-1 min-h-0 grid gap-1" style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                gridAutoRows: 'minmax(96px, 1fr)',
              }}>
                {visibleGlyphs.map((name, i) => {
                  const cellParams = paramsForIndex(i, visibleGlyphs.length)
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
                        <Glyph
                          name={name} params={cellParams} engine={engine}
                          showGuides={false} showAnatomy={false}
                          fxId={activeFx} warpName={activeWarp} warpParams={warpParams} distort={distort}
                          transform={transform} morph={morph}
                          raster={raster} rasterDensity={rasterDensity}
                        />
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

        <Section label="Time">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              iconOnly={playing ? 'control-pause' : 'control-play'} iconSize={14}
              onClick={() => setPlaying(p => !p)} quiet
            />
            <div className="flex-1">
              <Slider min={0} max={1} step={0.001} value={t} onChange={(v) => { setPlaying(false); setT(v) }} />
            </div>
            <span className="kol-mono-12 text-emphasis tabular-nums w-10 text-right">{t.toFixed(3)}</span>
          </div>
          <LabeledControl inline label="speed">
            <Dropdown size="sm" variant="subtle" className="w-full" options={SPEED_OPTIONS} value={String(playSpeed)} onChange={(v) => setPlaySpeed(Number(v))} />
          </LabeledControl>
        </Section>

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
          activeFx={activeFx} setActiveFx={setActiveFx}
          activeWarp={activeWarp} setActiveWarp={setActiveWarp}
          warpParams={warpParams} setWarpParams={setWarpParams}
          distort={distort} setDistort={setDistort}
          allParamNames={allParamNames}
          xyX={xyX} setXyX={setXyX} xyY={xyY} setXyY={setXyY}
          transform={transform} setTransform={setTransform}
          morph={morph} setMorph={setMorph}
          raster={raster} setRaster={setRaster}
          rasterDensity={rasterDensity} setRasterDensity={setRasterDensity}
          jitterAmount={jitterAmount} setJitterAmount={setJitterAmount}
          jitterSeed={jitterSeed} setJitterSeed={setJitterSeed}
          perspective={perspective} setPerspective={setPerspective}
        />

        <Divider />

        <Button variant="primary" size="sm" iconLeft="download" iconSize={14} className="w-full" onClick={() => downloadSVG(params, engine)}>
          SVG
        </Button>
      </EditorRail>
    </div>
  )
}
