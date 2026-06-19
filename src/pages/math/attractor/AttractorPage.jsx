import { useEffect, useMemo, useRef, useState } from 'react'
import Viewport3D from '../components/Viewport3D'
import StylePanel from '../components/StylePanel'
import { useMathStyle, AXIS_3D } from '../style/mathStyle'
import { ATTRACTORS, DEFAULT_ATTRACTOR, integrate } from './data/attractors'
import { resolveRate } from '../../../lib/exprParam.js'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { resolveTheme } from '../../../lib/themes.js'
import { defaultTheme } from '../../../lib/appSettings.js'
import { mulberry32, randomSeed, randomizeSchema } from '../../../lib/rng.js'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'

const DRAW_SECONDS = 14 // a full progressive trace takes this long at tempo 120

// Math · Attractor — strange-attractor trajectories integrated in 3D, orbited
// with the shared Viewport3D. Paused (default) shows the full figure; play
// animates the trace growing, then loops. Reuses the export-specs framing.
export default function AttractorPage() {
  const [id, setId] = useState(DEFAULT_ATTRACTOR.id)
  const [steps, setSteps] = useState(7000)
  const [spin, setSpin] = useState(8)
  const [gradient, setGradient] = useState(false)
  const [glow, setGlow] = useState(0)
  const [style, patchStyle, applyTheme] = useMathStyle({ stroke: DEFAULT_ATTRACTOR.color, weight: 1.1 })
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport') // Transport · Output · File
  const viewRef = useRef(null)

  const att = ATTRACTORS.find((a) => a.id === id) || DEFAULT_ATTRACTOR
  const { pts, ext } = useMemo(() => integrate(att, steps), [att, steps])

  const selectAttractor = (a) => { setId(a.id); patchStyle({ stroke: a.color }) }

  useEffect(() => {
    const t = resolveTheme(themeId, invert)
    patchStyle({ bg: t.bg, stroke: t.fg, gridColor: t.grid, gridOpacity: t.gridOpacity })
  }, [themeId, invert]) // eslint-disable-line react-hooks/exhaustive-deps

  // Randomise → random attractor + spin/glow (steps is structural).
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const a = ATTRACTORS[Math.floor(rng() * ATTRACTORS.length)]
    if (a) selectAttractor(a)
    const r = randomizeSchema([
      { key: 'spin', type: 'range', min: 0, max: 40, step: 1 },
      { key: 'glow', type: 'range', min: 0, max: 30, step: 1 },
    ], rng)
    if (r.spin != null) setSpin(r.spin)
    if (r.glow != null) setGlow(r.glow)
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }

  const getSettings = () => ({ id, steps, spin, gradient, glow, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.id != null) setId(s.id)
    if (s.steps != null) setSteps(s.steps)
    if (s.spin != null) setSpin(s.spin)
    if (s.gradient != null) setGradient(s.gradient)
    if (s.glow != null) setGlow(s.glow)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
  }

  // Drawn each frame by Viewport3D. Paused → full figure; playing → up to the
  // tempo-scaled progress (loops every DRAW_SECONDS).
  const render = ({ ctx, proj, d, t }) => {
    const N = pts.length
    const count = playing
      ? Math.max(1, Math.floor(Math.min(1, t / DRAW_SECONDS) * (N - 1)))
      : N - 1
    const gl = resolveRate(glow, t, 0)
    ctx.lineWidth = resolveRate(style.weight, t, 1.1) * d
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (gl > 0) { ctx.shadowBlur = gl * d; ctx.shadowColor = style.stroke }
    if (gradient) {
      // Colour by position along the trajectory (contiguous index buckets → one
      // stroke each, so it stays cheap).
      const NB = 24
      for (let b = 0; b < NB; b++) {
        const i0 = Math.floor((b / NB) * count)
        const i1 = Math.floor(((b + 1) / NB) * count)
        if (i1 <= i0) continue
        ctx.strokeStyle = `hsl(${200 + (b / NB) * 200}, 72%, 62%)`
        ctx.beginPath()
        for (let i = i0; i <= i1; i++) {
          const [x, y] = proj(pts[i])
          if (i === i0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    } else {
      ctx.strokeStyle = style.stroke
      ctx.beginPath()
      for (let i = 0; i <= count; i++) {
        const [x, y] = proj(pts[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    if (playing) {
      const [hx, hy] = proj(pts[count])
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(hx, hy, Math.max(2, d * 1.8), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale))
    const blob = dd ? await viewRef.current?.exportBlobAt(dd.w, dd.h) : await viewRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-attractor-${att.id}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="relative min-w-0 flex-1">
        <Viewport3D
          ref={viewRef}
          render={render}
          ext={ext}
          paused={!playing}
          speed={tempo / 240}
          spin={spin}
          dur={DRAW_SECONDS}
          aspect={ratioFor(aspect)}
          bg={style.bg}
          axis={style}
        />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">{att.label} attractor</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>drag to orbit · wheel to zoom</div>
        </div>
      </div>

      <LiveClock getT={() => viewRef.current?.now()}>
      <EditorRail
        footerBare
        header={<RailHeader>Attractor</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); viewRef.current?.resetTime() },
              onRewind: () => viewRef.current?.resetTime(),
              tempo,
              onTempo: setTempo,
              tempoMax: 600,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-attractor"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
          <Section label="Attractor">
            <div className="flex flex-col gap-1">
              {ATTRACTORS.map((a) => (
                <Button
                  key={a.id}
                  variant="secondary"
                  size="sm"
                  selected={a.id === id}
                  onClick={() => selectAttractor(a)}
                  className="w-full"
                  style={{ justifyContent: 'flex-start' }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </Section>

          <Section label="Trajectory">
            <Slider labeled label="Points" min={1000} max={20000} step={500} value={steps} onChange={setSteps} variant="default" noExpr />
          </Section>

          <StylePanel style={style} onPatch={patchStyle} onTheme={applyTheme} axisOptions={AXIS_3D} showTheme={false} />

          <SettingsPanel
            page="math-attractor"
            theme={themeId}
            onTheme={setThemeId}
            invert={invert}
            onInvert={setInvert}
            onRandomize={onRandomize}
            seed={seed}
            onSeed={(n) => { setSeed(n); rollFrom(n) }}
            getSettings={getSettings}
            applySettings={applySettings}
            showIO={false}
          />

          <Section label="Render">
            <ToggleSwitch variant="plain" label="Gradient" checked={gradient} onChange={setGradient} />
            <Slider labeled label="Glow" min={0} max={30} step={1} value={glow} onChange={setGlow} variant="default" />
          </Section>

          <Section label="Camera">
            <Slider labeled label="Auto-spin" min={0} max={40} step={1} value={spin} onChange={setSpin} variant="default" />
            <Button variant="primary" size="sm" onClick={() => viewRef.current?.resetCamera()}>Cam reset</Button>
          </Section>

          <div className="kol-helper-10 text-body">{ATTRACTORS.length} attractors · RK4 integrated · paused = full figure</div>
      </EditorRail>
      </LiveClock>
    </div>
  )
}
