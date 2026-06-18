import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import { SHAPES, DRIVERS, PALETTES, BG_STYLES, shiftHue } from './data/palettes.js'
import { mulberry32 } from './engine/prng.js'
import GradientEngine from './engine/GradientEngine.js'

const VARIATIONS = 9

/* Seed → variation. The rng is consumed in a fixed order so overrides don't
 * reshuffle the other rolls. */
function resolveSpec(seed, { shape, paletteId, hueShift, driver, distortMult }) {
  const rng = mulberry32(seed)
  const shapeRoll = SHAPES[Math.floor(rng() * SHAPES.length)]
  const paletteRoll = PALETTES[Math.floor(rng() * PALETTES.length)]
  const driverRoll = Math.floor(rng() * DRIVERS.length)
  const distortRoll = rng()
  const rotSpeed = 0.12 + rng() * 0.3
  const phase = rng() * Math.PI * 2

  const resolvedShape = shape === 'auto' ? shapeRoll : shape
  const palette = paletteId === 'auto' ? paletteRoll : PALETTES.find((p) => p.id === paletteId)
  const baseDistort = resolvedShape === 'blob' ? 0.25 + distortRoll * 0.3
    : resolvedShape === 'wave' ? 0.3 + distortRoll * 0.35
    : distortRoll * 0.12
  return {
    seed,
    shape: resolvedShape,
    colors: palette.colors.map((c) => shiftHue(c, hueShift)),
    driver: driver === 'auto' ? driverRoll : Number(driver),
    distort: baseDistort * distortMult,
    rotSpeed,
    phase,
  }
}

export default function GradientPage() {
  const [view, setView] = useState('grid')
  const [idx, setIdx] = useState(0)
  const [seedBase, setSeedBase] = useState(7)

  const [shape, setShape] = useState('auto')
  const [paletteId, setPaletteId] = useState('auto')
  const [hueShift, setHueShift] = useState(0)
  const [driver, setDriver] = useState('auto')
  const [distortMult, setDistortMult] = useState(1)
  const [glow, setGlow] = useState(0.6)
  const [grain, setGrain] = useState(0.06)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [bg, setBg] = useState(0.85)
  const [bgStyle, setBgStyle] = useState(0)

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)

  const seeds = useMemo(() => Array.from({ length: VARIATIONS }, (_, i) => seedBase + i * 7919), [seedBase])
  const specs = useMemo(
    () => seeds.map((seed) => resolveSpec(seed, { shape, paletteId, hueShift, driver, distortMult })),
    [seeds, shape, paletteId, hueShift, driver, distortMult],
  )
  const globals = useMemo(() => ({ glow, grain, speed, paused, bg, bgStyle }), [glow, grain, speed, paused, bg, bgStyle])

  // Engine lifecycle — one renderer for the page's lifetime.
  useEffect(() => {
    const engine = new GradientEngine(canvasRef.current)
    engineRef.current = engine
    const el = wrapRef.current
    const ro = new ResizeObserver(() => engine.resize(el.clientWidth, el.clientHeight))
    engine.resize(el.clientWidth, el.clientHeight)
    ro.observe(el)
    return () => {
      ro.disconnect()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => { engineRef.current?.update({ specs }) }, [specs])
  useEffect(() => { engineRef.current?.update({ mode: view, idx }) }, [view, idx])
  useEffect(() => { engineRef.current?.update({ globals }) }, [globals])

  const go = (d) => {
    setIdx((i) => (i + d + VARIATIONS) % VARIATIONS)
    setView('single')
  }
  const toggleView = () => setView((v) => (v === 'grid' ? 'single' : 'grid'))
  const randomize = () => setSeedBase(Math.floor(Math.random() * 1_000_000))

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'g' || e.key === 'G') toggleView()
      else if (e.key === 'r' || e.key === 'R') randomize()
      else if (e.key === 'c' || e.key === 'C') engineRef.current?.resetCamera()
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) }
      else if (e.key === 'Escape') setView('grid')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const onCanvasClick = (e) => {
    if (view !== 'grid') return
    const i = engineRef.current?.tileAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    if (i >= 0) { setIdx(i); setView('single') }
  }

  const exportPng = async () => {
    const blob = await engineRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-3d-scene-${seeds[view === 'single' ? idx : 0]}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const spec = specs[idx]

  return (
    <div className="flex h-dvh">
      <div ref={wrapRef} className="relative flex-1 min-w-0 overflow-hidden bg-surface-secondary">
        <canvas ref={canvasRef} className={`block h-full w-full ${view === 'grid' ? 'cursor-pointer' : ''}`} onClick={onCanvasClick} />
        {view === 'single' && (
          <div className="absolute bottom-3 left-3 kol-helper-10 text-body pointer-events-none">
            {String(idx + 1).padStart(2, '0')} / {String(VARIATIONS).padStart(2, '0')} · {spec.shape} · {spec.driver === 0 ? 'normal' : spec.driver === 1 ? 'rim' : 'height'} · seed {spec.seed}
          </div>
        )}
      </div>

      <EditorRail>
        <RailHeader>3D Scene</RailHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={toggleView}>{view === 'grid' ? 'Single' : 'Grid'}</Button>
          <Button variant="primary" size="sm" onClick={() => go(-1)}>← prev</Button>
          <Button variant="primary" size="sm" onClick={() => go(1)}>next →</Button>
          <Button variant="primary" size="sm" onClick={randomize}>Randomize</Button>
          <Button variant="primary" size="sm" onClick={() => engineRef.current?.resetCamera()}>Cam reset</Button>
        </div>

        <Divider />

        <Section label="Shape">
          <Dropdown
            size="sm"
            variant="subtle"
            className="w-full"
            options={[{ value: 'auto', label: 'by seed' }, ...SHAPES.map((s) => ({ value: s, label: s }))]}
            value={shape}
            onChange={setShape}
          />
        </Section>

        <Section label="Palette">
          <Dropdown
            size="sm"
            variant="subtle"
            className="w-full"
            options={[{ value: 'auto', label: 'by seed' }, ...PALETTES.map((p) => ({ value: p.id, label: p.label }))]}
            value={paletteId}
            onChange={setPaletteId}
          />
          <Slider label="Hue Shift" min={-180} max={180} step={5} value={hueShift} onChange={(v) => setHueShift(Math.round(v))} className="w-full" />
        </Section>

        <Section label="Background">
          <LabeledControl inline label="style">
            <Dropdown
              size="sm"
              variant="subtle"
              className="w-full"
              options={BG_STYLES.map((s) => ({ value: String(s.id), label: s.label }))}
              value={String(bgStyle)}
              onChange={(v) => setBgStyle(Number(v))}
            />
          </LabeledControl>
          <Slider label="Intensity" min={0} max={1} step={0.05} value={bg} onChange={setBg} className="w-full" />
        </Section>

        <Section label="Surface">
          <LabeledControl inline label="gradient">
            <Dropdown
              size="sm"
              variant="subtle"
              className="w-full"
              options={[{ value: 'auto', label: 'by seed' }, ...DRIVERS.map((d) => ({ value: String(d.id), label: d.label }))]}
              value={driver}
              onChange={setDriver}
            />
          </LabeledControl>
          <Slider label="Distortion" min={0} max={2} step={0.05} value={distortMult} onChange={setDistortMult} className="w-full" />
          <Slider label="Glow" min={0} max={1.5} step={0.05} value={glow} onChange={setGlow} className="w-full" />
          <Slider label="Grain" min={0} max={0.3} step={0.01} value={grain} onChange={setGrain} className="w-full" />
        </Section>

        <Section label="Motion">
          <Slider label="Speed" min={0} max={2} step={0.05} value={speed} onChange={setSpeed} className="w-full" />
          <Button variant="primary" size="sm" onClick={() => setPaused((p) => !p)}>{paused ? 'Play' : 'Pause'}</Button>
        </Section>

        <Divider />

        <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>

        <div className="kol-helper-10 text-body flex flex-col gap-1">
          <div>← / →</div>
          <div>G grid</div>
          <div>R randomize</div>
          <div>space pause</div>
          <div>drag = orbit</div>
          <div>wheel = zoom</div>
          <div>C = reset cam</div>
        </div>
      </EditorRail>
    </div>
  )
}
