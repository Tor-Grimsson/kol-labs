import { useState, useRef, useEffect } from 'react'
import FourierScope from './FourierScope'
import { VIEW_ASPECTS, DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { defaultTheme, defaultAutoplay } from '../../../lib/appSettings.js'
import StylePanel from '../components/StylePanel'
import { useMathStyle } from '../style/mathStyle'
import { resolveTheme } from '../../../lib/themes.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import { roundIfNum } from '../../../lib/exprParam.js'
import SettingsPanel from '../../../components/framework/SettingsPanel.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'

const WAVES = [{ value: 'square', label: 'Square' }, { value: 'sawtooth', label: 'Sawtooth' }, { value: 'triangle', label: 'Triangle' }]
// The StylePanel "axis" enum is repurposed here as the epicycle-scaffold toggle.
const SCAFFOLD_AXIS = [{ value: 'on', label: 'Circles' }, { value: 'none', label: 'Hidden' }]

// Math · Fourier — epicycle wave synthesis. Stage = the scope; rail = the wave
// controls + shared style / export. Loads paused (autoplay-off convention).
export default function FourierPage() {
  const [harmonics, setHarmonics] = useState(5)
  const [wave, setWave] = useState('square')
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [style, patchStyle, applyTheme] = useMathStyle({ bg: '#0b0907', stroke: '#e5dfcf', axis: 'on', gridColor: '#4a3e34', gridOpacity: 0.6, weight: 1.25 })
  const [themeId, setThemeId] = useState(() => defaultTheme())
  const [invert, setInvert] = useState(false)
  const [seed, setSeed] = useState(1)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [resetKey, setResetKey] = useState(0)
  const [footTab, setFootTab] = useState('transport')
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
    setWave(WAVES[Math.floor(rng() * WAVES.length)].value)
    setHarmonics(1 + Math.floor(rng() * 12))
  }

  const getSettings = () => ({ harmonics, wave, aspect, scale, themeId, invert, seed })
  const applySettings = (s) => {
    if (s.harmonics != null) setHarmonics(s.harmonics)
    if (s.wave != null) setWave(s.wave)
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
          harmonics={harmonics} wave={wave}
          playing={playing} tempo={tempo} resetKey={resetKey}
          aspect={ratioFor(aspect)}
          vstyle={style}
        />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Fourier</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab} onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); setResetKey((k) => k + 1) },
              onRewind: () => setResetKey((k) => k + 1),
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-fourier"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Wave">
          <LabeledControl inline label="Shape">
            <Dropdown size="sm" variant="subtle" className="w-full" options={WAVES} value={wave} onChange={setWave} />
          </LabeledControl>
          <Slider labeled label="Harmonics" min={1} max={12} step={1} value={harmonics} onChange={(v) => setHarmonics(roundIfNum(v))} variant="default" />
        </Section>
        <SettingsPanel
          page="math-fourier"
          theme={themeId}
          onTheme={setThemeId}
          invert={invert}
          onInvert={setInvert}
          onRandomize={onRandomize}
          seed={seed}
          onSeed={setSeed}
          showIO={false}
          showTheme={false}
          getSettings={getSettings}
          applySettings={applySettings}
        />
        <StylePanel style={style} onPatch={patchStyle} onTheme={applyTheme} axisOptions={SCAFFOLD_AXIS} strokeLabel="Trace" showTheme />
      </EditorRail>
    </div>
  )
}
