import SynthShell from './SynthShell.jsx'
import SlitscanEngine from '../effects/synth/slitscanEngine.js'
import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'

// Synth · Slitscan — time-displacement. Chop keeps the picture recognizable
// (each column from a different moment); Photo-finish stacks one fixed slit over
// time. Tempo × Scroll = sweep speed. Original blends the live source on top.
const DEFAULTS = { mode: 'chop', axis: 'horizontal', slit: 0.5, scroll: 1, smooth: 0, orig: 0, invert: false }

const MODES = [
  { value: 'chop', label: 'Chop' },
  { value: 'finish', label: 'Photo-finish' },
]

const AXES = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
]

export default function SlitscanPage() {
  return (
    <SynthShell engineClass={SlitscanEngine} title="Slitscan" name="slitscan" defaults={DEFAULTS}>
      {(p, update) => (
        <>
          <Section label="Mode">
            <SegmentedToggle value={p.mode} onChange={(v) => update('mode', v)} options={MODES} />
          </Section>

          <Section label="Slit">
            <LabeledControl label="Orientation">
              <SegmentedToggle value={p.axis} onChange={(v) => update('axis', v)} options={AXES} />
            </LabeledControl>
            {p.mode === 'finish' && (
              <Slider labeled label="Slit position" min={0} max={1} step={0.01} value={p.slit} onChange={(v) => update('slit', v)} variant="default" />
            )}
            <ToggleSwitch variant="plain" label="Invert direction" checked={p.invert} onChange={(v) => update('invert', v)} />
          </Section>

          <Section label="Motion">
            <Slider labeled label="Scroll" min={0} max={4} step={0.05} value={p.scroll} onChange={(v) => update('scroll', v)} variant="default" />
            <Slider labeled label="Smooth" min={0} max={1} step={0.01} value={p.smooth} onChange={(v) => update('smooth', v)} variant="default" />
          </Section>

          <Section label="Output">
            <Slider labeled label="Original" min={0} max={1} step={0.01} value={p.orig} onChange={(v) => update('orig', v)} variant="default" />
          </Section>
        </>
      )}
    </SynthShell>
  )
}
