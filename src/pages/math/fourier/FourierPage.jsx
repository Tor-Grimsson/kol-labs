import { useState, useRef, useEffect } from 'react'
import FourierScope from './FourierScope'
import { VIEW_ASPECTS, DEFAULT_ASPECT, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import ExportPanel from '../../_shared/ExportPanel.jsx'
import StylePanel from '../components/StylePanel'
import { useMathStyle } from '../style/mathStyle'
import { DEFAULT_THEME, resolveTheme } from '../../../lib/themes.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import { roundIfNum } from '../../../lib/exprParam.js'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import TransportBar from '../../../components/framework/TransportBar.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'

const WAVES = ['square', 'sawtooth', 'triangle']
// The StylePanel "axis" enum is repurposed here as the epicycle-scaffold toggle.
const SCAFFOLD_AXIS = [{ value: 'on', label: 'Circles' }, { value: 'none', label: 'Hidden' }]

// Math · Fourier — epicycle wave synthesis. Stage = the scope; rail = the wave
// controls + shared style / export. Loads paused (autoplay-off convention).
export default function FourierPage() {
  const [harmonics, setHarmonics] = useState(5)
  const [wave, setWave] = useState('square')
  const [speed, setSpeed] = useState(0.6)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [style, patchStyle, applyTheme] = useMathStyle({ bg: '#0b0907', stroke: '#e5dfcf', axis: 'on', gridColor: '#4a3e34', gridOpacity: 0.6, weight: 1.25 })
  const [themeId, setThemeId] = useState(DEFAULT_THEME)
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(120)
  const [resetKey, setResetKey] = useState(0)
  const scopeRef = useRef(null)

  // Theme drives the chrome: bg, trace (fg), epicycle scaffold (grid — which
  // resolveTheme inverts for contrast, so the scaffold stays visible inverted).
  useEffect(() => {
    const t = resolveTheme(themeId, invert)
    patchStyle({ bg: t.bg, stroke: t.fg, gridColor: t.grid })
  }, [themeId, invert]) // eslint-disable-line react-hooks/exhaustive-deps

  const onRandomize = () => {
    const s = randomSeed(); setSeed(s)
    const rng = mulberry32(s)
    setWave(WAVES[Math.floor(rng() * WAVES.length)])
    setHarmonics(1 + Math.floor(rng() * 12))
    setSpeed(0.1 + rng() * 1.4)
  }

  const getSettings = () => ({ harmonics, wave, speed, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.harmonics != null) setHarmonics(s.harmonics)
    if (s.wave != null) setWave(s.wave)
    if (s.speed != null) setSpeed(s.speed)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
    if (s.themeId != null) setThemeId(s.themeId)
    if (s.invert != null) setInvert(s.invert)
    if (s.seed != null) setSeed(s.seed)
  }

  const exportPng = async () => {
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await scopeRef.current?.exportBlobAt(d.w, d.h) : await scopeRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kol-fourier.png'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="math-fourier-page min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 min-w-0 p-5 flex flex-col">
        <FourierScope
          ref={scopeRef}
          harmonics={harmonics} wave={wave} speed={speed}
          playing={playing} tempo={tempo} resetKey={resetKey}
          aspect={ratioFor(aspect)}
          vstyle={style}
        />
      </div>

      <EditorRail>
        <RailHeader>fourier</RailHeader>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
          <Section label="Wave">
            <LabeledControl inline label="Shape">
              <Dropdown size="sm" variant="subtle" className="w-full" options={WAVES.map((w) => ({ value: w, label: w }))} value={wave} onChange={setWave} />
            </LabeledControl>
            <Slider label="Harmonics" min={1} max={12} step={1} value={harmonics} onChange={(v) => setHarmonics(roundIfNum(v))} variant="default" />
            <Slider label="Speed" min={0.1} max={1.5} step={0.05} value={speed} onChange={setSpeed} variant="default" />
          </Section>

          <StylePanel style={style} onPatch={patchStyle} onTheme={applyTheme} axisOptions={SCAFFOLD_AXIS} strokeLabel="Trace" showTheme={false} />

          <SettingsPanel
            page="math-fourier"
            theme={themeId}
            onTheme={setThemeId}
            invert={invert}
            onInvert={setInvert}
            onRandomize={onRandomize}
            seed={seed}
            onSeed={setSeed}
            getSettings={getSettings}
            applySettings={applySettings}
          />

          <ExportPanel aspect={aspect} onAspect={setAspect} aspects={VIEW_ASPECTS} scale={scale} onScale={setScale}>
            <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>
          </ExportPanel>
        </div>

        <div className="border-t border-fg-08 pt-3">
          <TransportBar
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onStop={() => { setPlaying(false); setResetKey((k) => k + 1) }}
            onRewind={() => setResetKey((k) => k + 1)}
            tempo={tempo}
            onTempo={setTempo}
            tempoMax={300}
          />
        </div>
      </EditorRail>
    </div>
  )
}
