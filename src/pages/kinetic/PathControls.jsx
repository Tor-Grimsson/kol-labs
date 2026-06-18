import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Button from '../../components/atoms/Button.jsx'
import { PATH_OPTIONS, DEFAULT_POINTS } from './engine/paths.js'

// Path shape + its parameters + a guide-line toggle.
export default function PathControls({ params, set, setPath }) {
  const path = params.path
  return (
    <>
      <Section label="Path">
        <LabeledControl inline label="Shape">
          <Dropdown variant="subtle" size="sm" className="w-full" options={PATH_OPTIONS} value={path.type} onChange={(v) => setPath('type', v)} />
        </LabeledControl>
        <ToggleSwitch variant="plain" label="Show path" checked={!!params.showPath} onChange={(c) => set('showPath', c)} />
      </Section>

      {path.type !== 'custom' && (
        <Section label="Shape">
          <Slider label="Amplitude" min={0} max={1} step={0.02} value={path.amp} onChange={(v) => setPath('amp', v)} variant="default" />
          <Slider label="Frequency" min={1} max={8} step={1} value={path.freq} onChange={(v) => setPath('freq', Math.round(v))} variant="default" />
          <Slider label="Turns" min={1} max={8} step={1} value={path.turns} onChange={(v) => setPath('turns', Math.round(v))} variant="default" />
          <Slider label="Radius" min={0.3} max={1} step={0.02} value={path.radius} onChange={(v) => setPath('radius', v)} variant="default" />
        </Section>
      )}

      {path.type === 'custom' && (
        <Section label="Points">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="sm" onClick={() => setPath('points', [...(path.points || DEFAULT_POINTS), [0.5, 0.5]])}>Add point</Button>
            <Button variant="primary" size="sm" onClick={() => { const pts = path.points || DEFAULT_POINTS; if (pts.length > 2) setPath('points', pts.slice(0, -1)) }}>Remove</Button>
          </div>
          <div className="kol-helper-10 text-meta">drag the dots on the stage</div>
        </Section>
      )}
    </>
  )
}
