import { useEffect, useRef, useState } from 'react'
import { usePublishReset, usePublishRetrigger } from '../../../components/framework/pageShortcuts.jsx'
import ThreadsEngine from './engine.js'
import { THREADS_PRESETS, THREADS_DEFAULTS, presetById } from './data/presets.js'
import { FORM_OPTIONS } from './data/threads.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor } from '../../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { randomSeed } from '../../../lib/rng.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

const BASE = 1100
// Per-frame time step at tempo 120. The balls spread within a few seconds; the
// loops precess slowly (their own lineSpeed).
const RATE = 1 / 40
const STILL_T = 9 // tile thumbnail time — balls nicely spread

function dimsFor(aspect) {
  const r = ratioFor(aspect) || 1
  const w = r >= 1 ? BASE : Math.round(BASE * r)
  const h = r >= 1 ? Math.round(BASE / r) : BASE
  return { w, h }
}

// Showcase thumbnail — its own engine drawn once at a representative time (no
// accumulation, so a single draw at STILL_T shows the wound state). Play-all
// animates it from there.
function ThreadsTile({ preset, playing, active, onOpen }) {
  const ref = useRef(null)
  const engRef = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const W = 240
    const H = 300
    cv.width = W
    cv.height = H
    const eng = new ThreadsEngine(W, H, preset.params)
    eng.t = STILL_T
    eng.draw(cv.getContext('2d'))
    engRef.current = eng
    return () => { engRef.current = null }
  }, [preset])

  useEffect(() => {
    if (!playing) return
    const cv = ref.current
    const eng = engRef.current
    if (!cv || !eng) return
    const ctx = cv.getContext('2d')
    let alive = true
    let raf
    const loop = () => { if (!alive) return; eng.step(RATE); eng.draw(ctx); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [playing])

  return (
    <button
      onClick={onOpen}
      className={`group flex flex-col gap-2 rounded-lg p-2 text-left transition-colors ${active ? 'bg-fg-08' : 'bg-fg-02 hover:bg-fg-04'}`}
    >
      <canvas ref={ref} className="block w-full rounded" style={{ aspectRatio: '4 / 5' }} />
      <span className="kol-mono-12 text-body px-1">{preset.label}</span>
    </button>
  )
}

// Math · Threads — the faithful polyhop "Thread Spinner": a central cluster of
// drifting white balls + a few separate elastic colour loops that bend around the
// balls and wind inward over time. Redrawn live (no trail accumulation). Paused on
// load.
export default function ThreadsPage() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)

  const [presetId, setPresetId] = useState(THREADS_PRESETS[0].id)
  const [params, setParams] = useState(() => ({ ...presetById(THREADS_PRESETS[0].id).params }))
  const [view, setView] = useState('editor') // editor | showcase
  const [showAll, setShowAll] = useState(false)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  // Size canvas + (re)build the engine on aspect change.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const { w, h } = dimsFor(aspect)
    cv.width = w
    cv.height = h
    if (!engineRef.current) engineRef.current = new ThreadsEngine(w, h, params)
    else { engineRef.current.resize(w, h); engineRef.current.setParams(params) }
    engineRef.current.draw(cv.getContext('2d'))
  }, [aspect, view])

  // Push params live; redraw a still frame while paused.
  useEffect(() => {
    const eng = engineRef.current
    if (!eng) return
    eng.setParams(params)
    if (!playing) { const cv = canvasRef.current; if (cv) eng.draw(cv.getContext('2d')) }
  }, [params, playing])

  // Animation loop.
  useEffect(() => {
    if (!playing || view !== 'editor') return
    const cv = canvasRef.current
    const eng = engineRef.current
    if (!cv || !eng) return
    const ctx = cv.getContext('2d')
    let alive = true
    let raf
    const loop = () => { if (!alive) return; eng.step(RATE * (tempo / 120)); eng.draw(ctx); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [playing, tempo, view])

  const reset = () => {
    const eng = engineRef.current
    if (!eng) return
    eng.reset()
    const cv = canvasRef.current
    if (cv) eng.draw(cv.getContext('2d'))
  }
  usePublishReset(reset)
  usePublishRetrigger(() => set('seed', randomSeed()))

  const pickPreset = (id) => {
    setPresetId(id)
    setParams({ ...presetById(id).params })
    setView('editor')
  }

  const exportPng = () => {
    const cv = canvasRef.current
    if (!cv) return
    cv.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kol-threads-${presetId}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const getSettings = () => ({ presetId, params, tempo, aspect, scale })
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return
    if (s.presetId) setPresetId(s.presetId)
    if (s.params) setParams({ ...THREADS_DEFAULTS, ...s.params })
    if (Number.isFinite(s.tempo)) setTempo(s.tempo)
    if (s.aspect) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {view === 'editor' ? (
          <canvas
            data-vcap="stage"
            ref={canvasRef}
            className="max-w-full max-h-[90vh] object-contain rounded"
            style={{ background: params.bg }}
          />
        ) : (
          <div className="w-full max-w-[920px]">
            <div className="mb-3 flex items-center justify-between">
              <div className="kol-helper-12 text-emphasis">Threads · variations</div>
              <Button variant="primary" size="sm" iconLeft={showAll ? 'pause' : 'play'} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Pause all' : 'Play all'}
              </Button>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {THREADS_PRESETS.map((p) => (
                <ThreadsTile key={p.id} preset={p} playing={showAll} active={p.id === presetId} onOpen={() => pickPreset(p.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Threads</RailHeader>
            <SegmentedToggle
              value={view}
              onChange={setView}
              options={[{ value: 'editor', label: 'Editor' }, { value: 'showcase', label: 'Showcase' }]}
            />
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
              onStop: () => { setPlaying(false); reset() },
              onRewind: reset,
              tempo,
              onTempo: setTempo,
              tempoMax: 400,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-threads"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Looks">
          {THREADS_PRESETS.map((p) => (
            <Button
              key={p.id}
              variant="primary"
              size="sm"
              selected={p.id === presetId}
              onClick={() => pickPreset(p.id)}
              className="w-full"
              style={{ justifyContent: 'flex-start' }}
            >
              {p.label}
            </Button>
          ))}
        </Section>

        <Section label="Form">
          <Dropdown variant="subtle" size="sm" className="w-full" openUp options={FORM_OPTIONS} value={params.form || 'loops'} onChange={(v) => set('form', v)} />
        </Section>

        <Section label="Mill">
          <Slider labeled label="Wings" min={2} max={6} step={1} value={params.wings} onChange={(v) => set('wings', v)} variant="default" noExpr />
          <Slider labeled label="Balls / wing" min={1} max={8} step={1} value={params.perWing} onChange={(v) => set('perWing', v)} variant="default" noExpr />
          <Slider labeled label="Ball size" min={10} max={70} step={1} value={params.ballR} onChange={(v) => set('ballR', v)} variant="default" noExpr />
        </Section>

        <Section label="Influence">
          <Slider labeled label="Drag" min={0} max={0.5} step={0.01} value={params.pull} onChange={(v) => set('pull', v)} variant="default" noExpr />
          <Slider labeled label="Reach" min={0.1} max={0.5} step={0.01} value={params.infR} onChange={(v) => set('infR', v)} variant="default" noExpr />
        </Section>

        <Section label="Lines">
          <Slider labeled label="Density" min={1} max={24} step={1} value={params.lines} onChange={(v) => set('lines', v)} variant="default" noExpr />
          <Slider labeled label="Thread" min={0.5} max={5} step={0.1} value={params.weight} onChange={(v) => set('weight', v)} variant="default" noExpr />
          <Slider labeled label="Glow" min={0} max={28} step={1} value={params.glow} onChange={(v) => set('glow', v)} variant="default" noExpr />
        </Section>

        <Section label="Motion">
          <Slider labeled label="Ball speed" min={0.2} max={2.5} step={0.05} value={params.ballSpeed} onChange={(v) => set('ballSpeed', v)} variant="default" noExpr />
          <Slider labeled label="Line speed" min={0} max={1} step={0.01} value={params.lineSpeed} onChange={(v) => set('lineSpeed', v)} variant="default" noExpr />
          <Slider labeled label="Field" min={0.3} max={0.5} step={0.01} value={params.reach} onChange={(v) => set('reach', v)} variant="default" noExpr />
        </Section>

        <Section label="Render">
          <ToggleSwitch variant="plain" label="Balls" checked={params.heads !== false} onChange={(v) => set('heads', v)} />
          <ToggleSwitch variant="plain" label="Mono" checked={!!params.mono} onChange={(v) => set('mono', v)} />
        </Section>

        <Section label="Colour">
          <ColorField label="Background" value={params.bg} onChange={(hex) => set('bg', hex)} />
          {params.mono && <ColorField label="Thread" value={params.thread} onChange={(hex) => set('thread', hex)} />}
        </Section>
      </EditorRail>
    </div>
  )
}
