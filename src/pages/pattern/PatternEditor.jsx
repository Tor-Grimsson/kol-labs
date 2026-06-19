import { useCallback, useEffect, useRef, useState } from 'react'
import patternLoop from '../../loops/pattern/patternLoop.js'
import PatternControls from '../loops/PatternControls.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Button from '../../components/atoms/Button.jsx'
import Section from '../../components/molecules/Section.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import FxParamControl from '../radar/components/FxParamControl.jsx'
import { CANVAS_FX_DEFS, getDefaultCanvasFxParams, applyCanvasFx } from '../radar/hooks/useCanvasFx.js'
import { usePublishShortcuts } from '../../components/framework/pageShortcuts.jsx'
import { resolveParams } from '../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { categoryById } from './registry.js'

// Pattern studio — the kolkrabbi rule/tiling system (Image #4 from the brand
// editor) as a standalone vector-pattern generator. `page` (a registry sub-page)
// seeds the full engine config; everything stays editable in the rail. Reuses the
// ported `patternLoop` engine + the `PatternControls` rail UI (shape · grid ·
// colour · rules · camera · sweep) so nothing is duplicated — this is just the
// page shell + Canvas2D render loop. An Effect tab stacks the same pure
// `applyCanvasFx` post-chain the Radar pages use on top of the pattern.
// Loads paused (autoplay-off); the engine only moves when camera/spin/sweep run.
export default function PatternEditor({ page }) {
  const [values, setValues] = useState(() => ({ ...patternLoop.defaults, ...(page?.params || {}) }))
  const [tab, setTab] = useState('pattern')
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [bottomTab, setBottomTab] = useState('transport')
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [fxChain, setFxChain] = useState([])

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const valuesRef = useRef(values); valuesRef.current = values
  const playingRef = useRef(playing); playingRef.current = playing
  const tempoRef = useRef(tempo); tempoRef.current = tempo
  const fxChainRef = useRef(fxChain); fxChainRef.current = fxChain
  const uRef = useRef(0)
  const lastRef = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0 })

  const onChange = (k, v) => setValues((s) => ({ ...s, [k]: v }))
  const getSettings = () => ({ values, aspect, scale, tempo, fxChain })
  const applySettings = (s) => {
    if (s.values) setValues({ ...patternLoop.defaults, ...s.values })
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.tempo != null) setTempo(s.tempo)
    if (s.fxChain) setFxChain(s.fxChain)
  }

  // FX chain (post-processing stacked on the pattern).
  const addFx = (fxId) => { if (fxId) setFxChain((p) => [...p, { type: fxId, enabled: true, params: getDefaultCanvasFxParams(fxId) }]) }
  const removeFx = (i) => setFxChain((p) => p.filter((_, k) => k !== i))
  const toggleFx = (i) => setFxChain((p) => p.map((fx, k) => (k === i ? { ...fx, enabled: !fx.enabled } : fx)))
  const updateFxParam = (i, key, val) => setFxChain((p) => p.map((fx, k) => (k === i ? { ...fx, params: { ...fx.params, [key]: val } } : fx)))

  const sizeStage = useCallback(() => {
    const wrap = wrapRef.current, cv = canvasRef.current
    if (!wrap || !cv) return
    const aw = wrap.clientWidth, ah = wrap.clientHeight
    if (!aw || !ah) return
    const r = ratioFor(aspect) || aw / ah
    let w = aw, h = aw / r
    if (h > ah) { h = ah; w = h * r }
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const fw = Math.max(1, Math.floor(w)), fh = Math.max(1, Math.floor(h))
    cv.style.width = `${fw}px`; cv.style.height = `${fh}px`
    cv.width = Math.floor(fw * dpr); cv.height = Math.floor(fh * dpr)
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
    sizeRef.current = { w: fw, h: fh }
  }, [aspect])

  useEffect(() => {
    let raf
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const cv = canvasRef.current
      if (!cv) return
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0
      lastRef.current = now
      const dur = patternLoop.duration || 8
      if (playingRef.current) uRef.current = (uRef.current + dt * (tempoRef.current / 120) / dur) % 1
      const { w, h } = sizeRef.current
      if (w && h) {
        patternLoop.draw(cv.getContext('2d'), uRef.current, w, h, resolveParams(valuesRef.current, uRef.current * dur))
        if (fxChainRef.current.length) applyCanvasFx(cv, fxChainRef.current)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    sizeStage()
    const ro = new ResizeObserver(() => sizeStage())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [sizeStage])

  usePublishShortcuts('Pattern', [['space', 'play / pause'], ['Pattern', 'shape · grid · colour · rules'], ['Animation', 'camera + per-cell sweep'], ['Effect', 'stack post-processing on the pattern']])

  const exportPng = () => {
    const d = dimsFor(aspect, Number(scale)) || sizeRef.current
    const off = document.createElement('canvas')
    off.width = d.w; off.height = d.h
    patternLoop.draw(off.getContext('2d'), uRef.current, d.w, d.h, resolveParams(valuesRef.current, uRef.current * (patternLoop.duration || 8)))
    if (fxChain.length) applyCanvasFx(off, fxChain)
    off.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `kol-pattern-${page?.id || 'untitled'}.png`; a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const footer = (
    <EditorFooter
      tab={bottomTab}
      onTab={setBottomTab}
      transport={{
        playing,
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onStop: () => { setPlaying(false); uRef.current = 0 },
        onRewind: () => { uRef.current = 0 },
        tempo, onTempo: setTempo, tempoMax: 600,
      }}
      exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
      exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
      settingsPage={`pattern-${page?.id || 'x'}`}
      getSettings={getSettings}
      applySettings={applySettings}
    />
  )

  const catLabel = page ? categoryById(page.cat).label : 'Pattern'

  return (
    <div className="flex min-h-dvh">
      <div className="flex-1 min-w-0 h-dvh bg-surface-secondary overflow-hidden">
        <div ref={wrapRef} className="relative h-full flex items-center justify-center">
          <canvas data-vcap="stage" ref={canvasRef} className="block" />
          <div className="pointer-events-none absolute left-5 top-5">
            <div className="kol-helper-12 text-emphasis">{page?.label || 'Pattern'}</div>
            <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{catLabel}</div>
          </div>
        </div>
      </div>
      <EditorRail
        header={
          <>
            <RailHeader>{page?.label || 'Pattern'}</RailHeader>
            <SegmentedToggle value={tab} onChange={setTab} options={[{ value: 'pattern', label: 'Pattern' }, { value: 'animation', label: 'Animation' }, { value: 'effect', label: 'Effect' }]} />
          </>
        }
        footerBare
        footer={footer}
      >
        {tab === 'effect' ? (
          <Section label="Post-Processing">
            {fxChain.map((fx, i) => {
              const def = CANVAS_FX_DEFS.find((d) => d.id === fx.type)
              if (!def) return null
              return (
                <div key={i} className="flex flex-col gap-2 p-2 rounded bg-fg-04">
                  <div className="flex items-center gap-2">
                    <ToggleSwitch labeled variant="plain" label={def.label} checked={fx.enabled} onChange={() => toggleFx(i)} />
                    <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} className="ml-auto" aria-label="Remove effect" onClick={() => removeFx(i)} />
                  </div>
                  {fx.enabled && Object.entries(def.params).map(([key, spec]) => (
                    <FxParamControl key={key} name={key} spec={spec} value={fx.params[key]} onChange={(val) => updateFxParam(i, key, val)} />
                  ))}
                </div>
              )
            })}
            {fxChain.length === 0 && <div className="kol-helper-10 text-body">Stack an effect on the pattern to preview it.</div>}
            <Dropdown size="sm" options={[{ value: '', label: 'Add FX...' }, ...CANVAS_FX_DEFS.map((d) => ({ value: d.id, label: d.label }))]} value="" onChange={addFx} variant="subtle" className="w-full" />
          </Section>
        ) : (
          <PatternControls values={values} onChange={onChange} tab={tab} />
        )}
      </EditorRail>
    </div>
  )
}
