import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { useParams } from 'react-router-dom'
import { usePublishReset, usePublishRetrigger } from '../../../components/framework/pageShortcuts.jsx'
import MSTPEngine from './engine/MSTPEngine.js'
import { MSTP_PRESETS, MSTP_COLORS, mstpPresetById } from './data/mstp.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { roundIfNum } from '../../../lib/exprParam.js'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'

const N = 220
const WARMUP = 160

// Abstract · Multi-Scale (Engine B) — Jonathan McCabe's multi-scale Turing
// patterns. One field, several scales; each step nudges every pixel by the scale
// whose neighbourhood is most uniform → nested, draped relief. Default paused but
// warmed to a developed still (the pattern only exists after many iterations).
export default function AbstractMSTPPage() {
  const { preset } = useParams()
  const startPreset = mstpPresetById(preset).id

  const [presetId, setPresetId] = useState(startPreset)
  const [colorId, setColorId] = useState('candy')
  const [colorMode, setColorMode] = useState('palette')
  const [relief, setRelief] = useState(3)
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

  useEffect(() => {
    sizeCanvas()
    const engine = new MSTPEngine(N, N)
    engine.setCanvas(canvasRef.current)
    engineRef.current = engine
    engine.setPreset(presetId)
    engine.setColors(colorId)
    engine.setColorMode(colorMode)
    engine.setRelief(relief)
    engine.setPaused(true)
    engine.start()
    // warmup is owned by the [presetId] effect (which also runs on mount) so the
    // pattern grows exactly once before the first paint.
    const ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(wrapRef.current)
    return () => {
      ro.disconnect()
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Full re-grow (new structure) — reset, rewind, retrigger, preset change.
  const regrow = useCallback(() => {
    const e = engineRef.current
    if (!e) return
    e.reseed()
    e.warmup(WARMUP)
  }, [])
  usePublishReset(regrow)
  usePublishRetrigger(regrow)

  // Preset change → new scale set → grow from scratch.
  useEffect(() => {
    const e = engineRef.current
    if (!e) return
    e.setPreset(presetId)
    regrow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId])

  // Follow sidebar nav between presets.
  useEffect(() => { if (preset && mstpPresetById(preset).id === preset) setPresetId(preset) }, [preset])

  // Colour / relief / mode are render-time → cheap, no re-grow (the loop re-renders).
  useEffect(() => { engineRef.current?.setColors(colorId) }, [colorId])
  useEffect(() => { engineRef.current?.setColorMode(colorMode) }, [colorMode])
  useEffect(() => { engineRef.current?.setRelief(relief) }, [relief])
  useEffect(() => { engineRef.current?.setSpeed(tempo / 120) }, [tempo])
  useEffect(() => { sizeCanvas() }, [aspect, sizeCanvas])

  const play = () => { setPaused(false); engineRef.current?.setPaused(false) }
  const pause = () => { setPaused(true); engineRef.current?.setPaused(true) }

  const exportPng = async () => {
    const e = engineRef.current
    if (!e) return
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await e.exportBlobAt(d.w, d.h) : await e.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-abstract-mstp-${presetId}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const presetOptions = useMemo(() => MSTP_PRESETS.map((p) => ({ value: p.id, label: p.label })), [])
  const colorOptions = useMemo(() => MSTP_COLORS.map((c) => ({ value: c.value, label: c.label })), [])

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} data-vcap="stage" className="block" />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">Multi-Scale</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>{mstpPresetById(presetId).label}</div>
        </div>
      </div>

      <LiveClock getT={() => engineRef.current?.time}>
      <EditorRail
        footerBare
        header={<RailHeader>Multi-Scale</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing: !paused,
              onPlay: play,
              onPause: pause,
              onStop: () => { pause(); regrow() },
              onRewind: regrow,
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
          />
        }
      >
          <Section label="Pattern">
            <LabeledControl inline label="scales">
              <Dropdown size="sm" variant="subtle" className="w-full" options={presetOptions} value={presetId} onChange={setPresetId} />
            </LabeledControl>
            <Button variant="primary" size="sm" className="w-full" onClick={regrow}>Re-grow</Button>
          </Section>

          <Section label="Colour">
            <Dropdown size="sm" variant="subtle" className="w-full" options={colorOptions} value={colorId} onChange={setColorId} />
            <SegmentedToggle
              value={colorMode}
              onChange={setColorMode}
              options={[{ value: 'palette', label: 'Palette' }, { value: 'scale', label: 'By scale' }]}
            />
          </Section>

          <Section label="Relief">
            <Slider labeled label="Depth" min={0} max={8} step={0.5} value={relief} onChange={(v) => setRelief(roundIfNum(v))} className="w-full" />
          </Section>
      </EditorRail>
      </LiveClock>
    </div>
  )
}
