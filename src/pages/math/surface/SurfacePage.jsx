import { useEffect, useMemo, useRef, useState } from 'react'
import Viewport3D from '../components/Viewport3D'
import StylePanel from '../components/StylePanel'
import { useMathStyle, AXIS_3D, hexToRgb } from '../style/mathStyle'
import { compileVars } from '../lib/mathfn'
import { resolveRate } from '../../../lib/exprParam.js'
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
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'

const EXAMPLES = [
  'sin(x*1.6)*cos(y*1.6)',
  'sin(hypot(x,y)*3 - t*3)',
  'cos(x)*cos(y)*exp(-(x*x+y*y)*0.08)',
  '(x*x - y*y)*0.25',
  'sin(x*y*0.6)',
]

const toRGB = (h) => { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] }
const lerpHex = (a, b, u) => {
  const A = toRGB(a)
  const B = toRGB(b)
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * u)},${Math.round(A[1] + (B[1] - A[1]) * u)},${Math.round(A[2] + (B[2] - A[2]) * u)})`
}

// Math · Surface — z = f(x,y,t) drawn as an orbitable wireframe, height-coloured.
// Reuses Viewport3D (camera/framing/export). Segments are bucketed by height into
// ~18 colour passes so the whole mesh strokes in a handful of draw calls.
export default function SurfacePage() {
  const [expr, setExpr] = useState(EXAMPLES[0])
  const [draft, setDraft] = useState(EXAMPLES[0])
  const [domain, setDomain] = useState(3.2)
  const [res, setRes] = useState(46)
  const [height, setHeight] = useState(1)
  const [mode, setMode] = useState('wire')
  const [contours, setContours] = useState(false)
  const [spin, setSpin] = useState(6)
  const [low, setLow] = useState('#1b2b4a')
  const [high, setHigh] = useState('#ffd23f')
  const [style, patchStyle, applyTheme] = useMathStyle({ weight: 1 })
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const viewRef = useRef(null)

  useEffect(() => {
    const t = resolveTheme(themeId, invert)
    patchStyle({ bg: t.bg, stroke: t.fg, gridColor: t.grid, gridOpacity: t.gridOpacity })
  }, [themeId, invert]) // eslint-disable-line react-hooks/exhaustive-deps

  // Randomise → new expression + non-structural shape params (domain/height/spin).
  const RAND_SCHEMA = [
    { key: 'domain', type: 'range', min: 1, max: 8, step: 0.2 },
    { key: 'height', type: 'range', min: 0.1, max: 4, step: 0.1 },
    { key: 'spin', type: 'range', min: 0, max: 40, step: 1 },
  ]
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const ex = EXAMPLES[Math.floor(rng() * EXAMPLES.length)]
    if (ex) { setDraft(ex); setExpr(ex) }
    const r = randomizeSchema(RAND_SCHEMA, rng)
    if (r.domain != null) setDomain(r.domain)
    if (r.height != null) setHeight(r.height)
    if (r.spin != null) setSpin(r.spin)
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }

  const getSettings = () => ({ expr, domain, res, height, mode, contours, spin, low, high, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.expr != null) { setExpr(s.expr); setDraft(s.expr) }
    if (s.domain != null) setDomain(s.domain)
    if (s.res != null) setRes(s.res)
    if (s.height != null) setHeight(s.height)
    if (s.mode != null) setMode(s.mode)
    if (s.contours != null) setContours(s.contours)
    if (s.spin != null) setSpin(s.spin)
    if (s.low != null) setLow(s.low)
    if (s.high != null) setHigh(s.high)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
  }

  const fn = useMemo(() => compileVars(expr, ['x', 'y', 't']), [expr])

  // Camera-fit extent — coarse-sample |f| at t=0 so the surface frames nicely.
  const ext = useMemo(() => {
    // Coerce domain/height to their value at t=0 so the camera fit stays finite
    // even when they're expressions (the surface itself animates live in render).
    const D0 = resolveRate(domain, 0, 3.2)
    const h0 = resolveRate(height, 0, 1)
    if (!fn) return D0
    let m = 0
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      const xx = -D0 + (2 * D0 * i) / 11
      const yy = -D0 + (2 * D0 * j) / 11
      const z = fn(xx, yy, 0)
      if (Number.isFinite(z)) m = Math.max(m, Math.abs(z))
    }
    return Math.max(D0, m * h0 || D0)
  }, [fn, domain, height])

  const NB = 18
  const render = ({ ctx, proj, d, t, eye }) => {
    if (!fn) return
    const R = res
    const D = resolveRate(domain, t, 3.2)
    const hs = resolveRate(height, t, 1)
    const xs = new Float64Array(R)
    for (let i = 0; i < R; i++) xs[i] = -D + (2 * D * i) / (R - 1)
    const SX = new Float64Array(R * R)
    const SY = new Float64Array(R * R)
    const Z = new Float64Array(R * R)
    let zmin = Infinity
    let zmax = -Infinity
    for (let j = 0; j < R; j++) {
      const yy = xs[j]
      for (let i = 0; i < R; i++) {
        let z = fn(xs[i], yy, t)
        if (!Number.isFinite(z)) z = 0
        z *= hs
        const idx = j * R + i
        Z[idx] = z
        // height = world up (Y); the (x,y) grid lies on the X/Z plane
        const [sx, sy] = proj({ x: xs[i], y: z, z: yy })
        SX[idx] = sx
        SY[idx] = sy
        if (z < zmin) zmin = z
        if (z > zmax) zmax = z
      }
    }
    const span = (zmax - zmin) || 1
    const norm = (z) => (z - zmin) / span

    if (mode === 'fill') {
      // Painter's algorithm: sort quads far→near by distance from the eye, fill
      // each with its height colour (no z-buffer, but correct for a heightfield).
      const quads = []
      for (let j = 0; j < R - 1; j++) {
        for (let i = 0; i < R - 1; i++) {
          const a = j * R + i, b = j * R + i + 1, c = (j + 1) * R + i + 1, e = (j + 1) * R + i
          const h = (Z[a] + Z[b] + Z[c] + Z[e]) / 4
          const dx = (xs[i] + xs[i + 1]) / 2 - eye[0]
          const dy = h - eye[1]
          const dz = (xs[j] + xs[j + 1]) / 2 - eye[2]
          quads.push({ a, b, c, e, h, depth: dx * dx + dy * dy + dz * dz })
        }
      }
      quads.sort((p, q) => q.depth - p.depth)
      ctx.lineWidth = 1
      for (const q of quads) {
        ctx.fillStyle = lerpHex(low, high, norm(q.h))
        ctx.strokeStyle = ctx.fillStyle
        ctx.beginPath()
        ctx.moveTo(SX[q.a], SY[q.a]); ctx.lineTo(SX[q.b], SY[q.b]); ctx.lineTo(SX[q.c], SY[q.c]); ctx.lineTo(SX[q.e], SY[q.e]); ctx.closePath()
        ctx.fill()
        ctx.stroke() // seam-fill the hairline gaps between quads
      }
    } else {
      // Wireframe — segments bucketed by height into a few colour passes.
      const buckets = Array.from({ length: NB }, () => [])
      const addSeg = (a, b) => {
        const bk = Math.max(0, Math.min(NB - 1, Math.floor(norm((Z[a] + Z[b]) / 2) * NB)))
        buckets[bk].push(a, b)
      }
      for (let j = 0; j < R; j++) for (let i = 0; i < R - 1; i++) addSeg(j * R + i, j * R + i + 1)
      for (let i = 0; i < R; i++) for (let j = 0; j < R - 1; j++) addSeg(j * R + i, (j + 1) * R + i)
      ctx.lineWidth = resolveRate(style.weight, t, 1) * d
      ctx.lineJoin = 'round'
      for (let b = 0; b < NB; b++) {
        const seg = buckets[b]
        if (!seg.length) continue
        ctx.strokeStyle = lerpHex(low, high, b / (NB - 1))
        ctx.beginPath()
        for (let s = 0; s < seg.length; s += 2) { ctx.moveTo(SX[seg[s]], SY[seg[s]]); ctx.lineTo(SX[seg[s + 1]], SY[seg[s + 1]]) }
        ctx.stroke()
      }
    }

    if (contours) {
      // Iso-height lines via marching squares (screen-space interp per cell).
      const NL = 10
      ctx.lineWidth = Math.max(1, d)
      ctx.strokeStyle = `rgba(${hexToRgb(style.gridColor)},${Math.min(1, style.gridOpacity * 3 + 0.2)})`
      ctx.beginPath()
      for (let l = 1; l < NL; l++) {
        const level = zmin + (span * l) / NL
        for (let j = 0; j < R - 1; j++) {
          for (let i = 0; i < R - 1; i++) {
            const idx = [j * R + i, j * R + i + 1, (j + 1) * R + i + 1, (j + 1) * R + i]
            const hh = idx.map((k) => Z[k])
            const cr = []
            for (let e = 0; e < 4; e++) {
              const ha = hh[e]
              const hb = hh[(e + 1) % 4]
              if ((ha - level) * (hb - level) < 0) {
                const tt = (level - ha) / (hb - ha)
                const ka = idx[e]
                const kb = idx[(e + 1) % 4]
                cr.push([SX[ka] + (SX[kb] - SX[ka]) * tt, SY[ka] + (SY[kb] - SY[ka]) * tt])
              }
            }
            if (cr.length >= 2) { ctx.moveTo(cr[0][0], cr[0][1]); ctx.lineTo(cr[1][0], cr[1][1]) }
          }
        }
      }
      ctx.stroke()
    }
  }

  const commitExpr = () => setExpr(draft)
  const loadExample = (ex) => { setDraft(ex); setExpr(ex) }

  const exportPng = async () => {
    const dd = dimsFor(aspect, Number(scale))
    const blob = dd ? await viewRef.current?.exportBlobAt(dd.w, dd.h) : await viewRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kol-surface.png'
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
          speed={tempo / 120}
          spin={spin}
          aspect={ratioFor(aspect)}
          bg={style.bg}
          axis={style}
        />
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="kol-helper-12 text-emphasis">z = f(x, y)</div>
          <div className="kol-helper-10 text-meta" style={{ marginTop: 2 }}>drag to orbit · t animates</div>
        </div>
      </div>

      <EditorRail>
        <RailHeader>surface</RailHeader>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
          <Section label="z = f(x, y, t)">
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

          <Section label="Mesh">
            <Slider label="Domain" min={1} max={8} step={0.2} value={domain} onChange={setDomain} variant="default" />
            <Slider label="Resolution" min={12} max={80} step={2} value={res} onChange={setRes} variant="default" noExpr />
            <Slider label="Height" min={0.1} max={4} step={0.1} value={height} onChange={setHeight} variant="default" />
          </Section>

          <Section label="Render">
            <SegmentedToggle value={mode} onChange={setMode} options={[{ value: 'wire', label: 'Wire' }, { value: 'fill', label: 'Filled' }]} />
            <ToggleSwitch variant="plain" label="Contours" checked={contours} onChange={setContours} />
          </Section>

          <Section label="Color">
            <LabeledControl inline label="Low">
              <ColorField value={low} onChange={setLow} />
            </LabeledControl>
            <LabeledControl inline label="High">
              <ColorField value={high} onChange={setHigh} />
            </LabeledControl>
          </Section>

          <StylePanel style={style} onPatch={patchStyle} onTheme={applyTheme} axisOptions={AXIS_3D} showStroke={false} showTheme={false} />

          <SettingsPanel
            page="math-surface"
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

          <Section label="Camera">
            <Slider label="Auto-spin" min={0} max={40} step={1} value={spin} onChange={setSpin} variant="default" />
            <Button variant="primary" size="sm" onClick={() => viewRef.current?.resetCamera()}>Cam reset</Button>
          </Section>

          <ExportPanel aspect={aspect} onAspect={setAspect} aspects={VIEW_ASPECTS} scale={scale} onScale={setScale}>
            <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
          </ExportPanel>
        </div>

        <div className="border-t border-fg-08 pt-3">
          <TransportBar
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onStop={() => { setPlaying(false); viewRef.current?.resetTime() }}
            onRewind={() => viewRef.current?.resetTime()}
            tempo={tempo}
            onTempo={setTempo}
            tempoMax={300}
          />
        </div>
      </EditorRail>
    </div>
  )
}
