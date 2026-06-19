import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { useParams } from 'react-router-dom'
import { usePublishReset, usePublishRetrigger } from '../../../components/framework/pageShortcuts.jsx'
import RDEngine from './engine/RDEngine.js'
import { RD_MODELS, RD_VARIATIONS, RD_SEEDS, RD_PALETTES, MODEL_DEFAULTS, variationById } from './data/models.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { roundIfNum } from '../../../lib/exprParam.js'
import Button from '../../../components/atoms/Button.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'

// Abstract · Reaction-Diffusion — Engine A of the Turing studio. One generalised
// CPU solver (RDEngine) runs every model; the rail picks a variation (model +
// params) and live-tweaks it. Default paused (no autoplay) — but the sim is
// warmed to a developed still on seed so the first frame is a real pattern.
export default function AbstractRDPage() {
  const { variant } = useParams()
  const startVar = variationById(variant) || RD_VARIATIONS[0]

  const [variantId, setVariantId] = useState(startVar.id)
  const variation = variationById(variantId) || RD_VARIATIONS[0]
  const model = RD_MODELS[variation.model]

  const [params, setParams] = useState({ ...MODEL_DEFAULTS[variation.model], ...variation.params })
  const [seedStyle, setSeedStyle] = useState(variation.seed || 'scatter')
  const [palette, setPalette] = useState(variation.palette || 'lava')
  const [paused, setPaused] = useState(() => !defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect

  // Letterbox the square sim canvas into the stage at the chosen aspect.
  const sizeCanvas = useCallback(() => {
    const el = wrapRef.current
    const cv = canvasRef.current
    if (!el || !cv) return
    const aw = el.clientWidth
    const ah = el.clientHeight
    const r = ratioFor(aspectRef.current) || 1
    let w = aw
    let h = w / r
    if (h > ah) { h = ah; w = h * r }
    w = Math.max(1, Math.floor(w))
    h = Math.max(1, Math.floor(h))
    cv.style.width = `${w}px`
    cv.style.height = `${h}px`
    cv.width = w
    cv.height = h
  }, [])

  // Engine lifecycle — one solver for the page's life.
  useEffect(() => {
    sizeCanvas()
    const engine = new RDEngine(canvasRef.current, 180)
    engineRef.current = engine
    engine.setVariation(variation)
    engine.setPaused(true)
    engine.warmup()
    engine.start()
    const ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(wrapRef.current)
    return () => {
      ro.disconnect()
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reseed = useCallback(() => {
    const e = engineRef.current
    if (!e) return
    e.reseed()
    e.warmup()
  }, [])
  usePublishReset(reseed)
  usePublishRetrigger(reseed)

  // Follow sidebar nav / variation picker → reload the whole variation.
  useEffect(() => {
    const e = engineRef.current
    if (!e) return
    e.setVariation(variation)
    setParams({ ...MODEL_DEFAULTS[variation.model], ...variation.params })
    setSeedStyle(variation.seed || 'scatter')
    setPalette(variation.palette || 'lava')
    e.setPaused(paused)
    e.warmup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId])

  // Follow the URL param when the sidebar navigates between variations.
  useEffect(() => { if (variant && variationById(variant)) setVariantId(variant) }, [variant])

  useEffect(() => { engineRef.current?.setParams(params) }, [params])
  useEffect(() => { engineRef.current?.setPalette(palette) }, [palette])
  useEffect(() => { engineRef.current?.setSpeed(tempo / 120) }, [tempo])
  useEffect(() => { sizeCanvas() }, [aspect, sizeCanvas])

  const setParam = (key, val) => setParams((p) => ({ ...p, [key]: val }))
  const onSeed = (s) => { setSeedStyle(s); const e = engineRef.current; if (e) { e.setSeed(s); e.warmup() } }
  const play = () => { setPaused(false); engineRef.current?.setPaused(false) }
  const pause = () => { setPaused(true); engineRef.current?.setPaused(true) }
  const stop = () => { pause(); reseed() }

  const exportPng = async () => {
    const e = engineRef.current
    if (!e) return
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await e.exportBlobAt(d.w, d.h) : await e.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-abstract-${variantId}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const variationOptions = useMemo(() => RD_VARIATIONS.map((v) => ({ value: v.id, label: `${v.label} · ${RD_MODELS[v.model].label}` })), [])

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} data-vcap="stage" className="block" />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{variation.label}</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{model.label}</div>
        </div>
      </div>

      <LiveClock getT={() => engineRef.current?.time}>
      <EditorRail
        footerBare
        header={<RailHeader>Abstract</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing: !paused,
              onPlay: play,
              onPause: pause,
              onStop: stop,
              onRewind: reseed,
              tempo,
              onTempo: setTempo,
              tempoMax: 600,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
          />
        }
      >
          <Section label="Variation">
            <Dropdown size="sm" variant="subtle" className="w-full" options={variationOptions} value={variantId} onChange={setVariantId} />
          </Section>

          <Section label="Reaction">
            {model.controls.map((c) => (
              <Slider
                key={c.key}
                labeled
                label={c.label}
                min={c.min}
                max={c.max}
                step={c.step}
                value={params[c.key]}
                onChange={(v) => setParam(c.key, roundIfNum(v))}
                className="w-full"
              />
            ))}
          </Section>

          <Section label="Seed">
            <LabeledControl inline label="pattern">
              <Dropdown size="sm" variant="subtle" className="w-full" options={RD_SEEDS} value={seedStyle} onChange={onSeed} />
            </LabeledControl>
            <Button variant="primary" size="sm" className="w-full" onClick={reseed}>Reseed</Button>
          </Section>

          <Section label="Palette">
            <Dropdown size="sm" variant="subtle" className="w-full" options={RD_PALETTES} value={palette} onChange={setPalette} />
          </Section>

          <Divider />

          <div className="kol-helper-10 text-body flex flex-col gap-1">
            <div>space = play / pause</div>
            <div>R = reseed</div>
            <div>tempo = sim speed</div>
          </div>
      </EditorRail>
      </LiveClock>
    </div>
  )
}
