import { useEffect, useRef, useState } from 'react'
import { renderHalftone, FIELD_OPTIONS, LAYOUT_OPTIONS, SHAPE_OPTIONS, PALETTES } from './engine.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'

const BASE = 1200

// Optic · Halftone — gradient-mapped dot/bead field. The board's #1 signature.
export default function HalftonePage() {
  const canvasRef = useRef(null)
  const timeRef = useRef(0)
  const [field, setField] = useState('radial')
  const [layout, setLayout] = useState('hex')
  const [shape, setShape] = useState('dot')
  const [density, setDensity] = useState(34)
  const [dotScale, setDotScale] = useState(1)
  const [palette, setPalette] = useState('drekker')
  const [invert, setInvert] = useState(false)
  const [light, setLight] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const bg = light ? '#f4f1ea' : '#06070b'
  const params = { field, layout, shape, density, dotScale, palette, bg, invert }

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    cv.width = w
    cv.height = h
    if (!playing) { renderHalftone(cv, params, timeRef.current); return }
    let alive = true
    let raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      timeRef.current += dt * (tempo / 120)
      renderHalftone(cv, params, timeRef.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [field, layout, shape, density, dotScale, palette, bg, invert, playing, tempo, aspect]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportPng = () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: canvasRef.current.width, h: canvasRef.current.height }
    const out = document.createElement('canvas')
    out.width = dd.w
    out.height = dd.h
    renderHalftone(out, params, timeRef.current)
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kol-halftone-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const getSettings = () => ({ field, layout, shape, density, dotScale, palette, invert, light, aspect, scale })
  const applySettings = (s) => {
    for (const [k, v] of Object.entries(s)) {
      ({ field: setField, layout: setLayout, shape: setShape, density: setDensity, dotScale: setDotScale, palette: setPalette, invert: setInvert, light: setLight, aspect: setAspect, scale: setScale }[k]?.(v))
    }
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Halftone</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); timeRef.current = 0 },
              onRewind: () => { timeRef.current = 0 },
              tempo,
              onTempo: setTempo,
              tempoMax: 400,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="optic-halftone"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Field">
          <Dropdown size="sm" options={FIELD_OPTIONS} value={field} onChange={setField} variant="subtle" className="w-full" />
          <Dropdown size="sm" options={LAYOUT_OPTIONS} value={layout} onChange={setLayout} variant="subtle" className="w-full" />
          <Dropdown size="sm" options={SHAPE_OPTIONS} value={shape} onChange={setShape} variant="subtle" className="w-full" />
        </Section>

        <Section label="Pattern">
          <Slider labeled label="Density" min={4} max={80} step={1} value={density} onChange={setDensity} variant="default" noExpr />
          <Slider labeled label="Dot Scale" min={0.2} max={2} step={0.05} value={dotScale} onChange={setDotScale} variant="default" />
          <ToggleSwitch variant="plain" label="Invert" checked={invert} onChange={setInvert} />
        </Section>

        <Section label="Color">
          <Dropdown size="sm" options={PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
          <ToggleSwitch variant="plain" label="Light bg" checked={light} onChange={setLight} />
        </Section>
      </EditorRail>
    </div>
  )
}
