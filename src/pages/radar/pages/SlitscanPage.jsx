import SynthShell from './SynthShell.jsx'
import SlitscanEngine from '../effects/synth/slitscanEngine.js'
import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'

// Synth · Slitscan — true time-displacement: each column/row shows the whole
// frame from a different moment, pulled from a rolling N-frame history. Best on
// video (a still has no temporal change). Pause freezes the capture.
const DEFAULTS = { axis: 'horizontal', span: 1, curve: 1, invert: false }

const AXES = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'radial', label: 'Radial' },
]

export default function SlitscanPage() {
  return (
    <SynthShell engineClass={SlitscanEngine} title="Slitscan" name="slitscan" defaults={DEFAULTS}>
      {(p, update) => (
        <Section label="Time displacement">
          <LabeledControl inline label="axis">
            <Dropdown size="sm" variant="subtle" className="w-full" options={AXES} value={p.axis} onChange={(v) => update('axis', v)} />
          </LabeledControl>
          <Slider label="Time span" min={0.05} max={1} step={0.01} value={p.span} onChange={(v) => update('span', v)} variant="default" />
          <Slider label="Ramp curve" min={0.2} max={4} step={0.05} value={p.curve} onChange={(v) => update('curve', v)} variant="default" />
          <ToggleSwitch variant="plain" label="Invert direction" checked={p.invert} onChange={(v) => update('invert', v)} />
        </Section>
      )}
    </SynthShell>
  )
}
