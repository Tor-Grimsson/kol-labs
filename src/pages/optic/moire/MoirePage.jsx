import { useEffect, useRef, useState } from 'react'
import { renderMoire, GRID_OPTIONS, COMBINE_OPTIONS, MOIRE_PALETTES } from './engine.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'

const BASE = 820 // per-pixel render — capped for the JS loop

const DEFAULT_GRIDS = [
  { enabled: true, type: 'lines', freq: 6, angle: 0, speed: 0.05 },
  { enabled: true, type: 'lines', freq: 6, angle: 8, speed: -0.05 },
  { enabled: false, type: 'concentric', freq: 4, angle: 0, speed: 0.03 },
]

// Optic · Moiré — overlapping grids → interference fringes.
export default function MoirePage() {
  const canvasRef = useRef(null)
  const timeRef = useRef(0)
  const [grids, setGrids] = useState(DEFAULT_GRIDS)
  const [combine, setCombine] = useState('xor')
  const [hardness, setHardness] = useState(0.3)
  const [palette, setPalette] = useState('bw')
  const [invert, setInvert] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const params = { grids, combine, hardness, palette, invert }
  const updateGrid = (i, key, value) => setGrids((prev) => prev.map((g, idx) => idx === i ? { ...g, [key]: value } : g))

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    cv.width = w
    cv.height = h
    if (!playing) { renderMoire(cv, params, timeRef.current); return }
    let alive = true
    let raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      timeRef.current += dt * (tempo / 120)
      renderMoire(cv, params, timeRef.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [grids, combine, hardness, palette, invert, playing, tempo, aspect]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportPng = () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: canvasRef.current.width, h: canvasRef.current.height }
    const out = document.createElement('canvas')
    out.width = dd.w
    out.height = dd.h
    renderMoire(out, params, timeRef.current)
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kol-moire-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const getSettings = () => ({ grids, combine, hardness, palette, invert, aspect, scale })
  const applySettings = (s) => {
    if (s.grids != null) setGrids(s.grids)
    if (s.combine != null) setCombine(s.combine)
    if (s.hardness != null) setHardness(s.hardness)
    if (s.palette != null) setPalette(s.palette)
    if (s.invert != null) setInvert(s.invert)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Moiré</RailHeader>}
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
            settingsPage="optic-moire"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        {grids.map((g, i) => (
          <Section key={i} label={`Grid ${String.fromCharCode(65 + i)}`}>
            <ToggleSwitch variant="plain" label="Enabled" checked={g.enabled} onChange={(v) => updateGrid(i, 'enabled', v)} />
            {g.enabled && (
              <>
                <Dropdown size="sm" options={GRID_OPTIONS} value={g.type} onChange={(v) => updateGrid(i, 'type', v)} variant="subtle" className="w-full" />
                <Slider labeled label="Freq" min={1} max={30} step={0.5} value={g.freq} onChange={(v) => updateGrid(i, 'freq', v)} variant="default" />
                <Slider labeled label="Angle" min={0} max={180} step={1} value={g.angle} onChange={(v) => updateGrid(i, 'angle', v)} variant="default" />
                <Slider labeled label="Drift" min={-0.5} max={0.5} step={0.01} value={g.speed} onChange={(v) => updateGrid(i, 'speed', v)} variant="default" />
              </>
            )}
          </Section>
        ))}

        <Section label="Combine">
          <Dropdown size="sm" options={COMBINE_OPTIONS} value={combine} onChange={setCombine} variant="subtle" className="w-full" />
          <Slider labeled label="Hardness" min={0} max={1} step={0.01} value={hardness} onChange={setHardness} variant="default" />
        </Section>

        <Section label="Color">
          <Dropdown size="sm" options={MOIRE_PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
          <ToggleSwitch variant="plain" label="Invert" checked={invert} onChange={setInvert} />
        </Section>
      </EditorRail>
    </div>
  )
}
