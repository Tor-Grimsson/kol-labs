import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import { MOTION_OPTIONS } from './engine/animations.js'
import { fontByKey, AXIS_LABELS } from './lib/vfAxes.js'

// Animation mode + its parameters. (Transport play/tempo lives in the footer.)
export default function MotionControls({ params, setMotion }) {
  const font = fontByKey(params.font)
  const m = params.motion
  return (
    <Section label="Motion">
      <LabeledControl inline label="Mode">
        <Dropdown variant="subtle" size="sm" className="w-full" options={MOTION_OPTIONS} value={m.mode} onChange={(v) => setMotion('mode', v)} />
      </LabeledControl>
      <Slider label="Cycles" min={1} max={4} step={1} value={m.cycles} onChange={(v) => setMotion('cycles', Math.round(v))} variant="default" />
      <Slider label="Phase" min={0} max={2} step={0.05} value={m.phase} onChange={(v) => setMotion('phase', v)} variant="default" />
      {m.mode === 'glyphwave' && (
        <Slider label="Amount" min={0} max={1} step={0.02} value={m.amp} onChange={(v) => setMotion('amp', v)} variant="default" />
      )}
      {m.mode === 'vfwave' && font.axes.length > 0 && (
        <LabeledControl inline label="Axis">
          <Dropdown
            variant="subtle"
            size="sm"
            className="w-full"
            options={font.axes.map((a) => ({ value: a.tag, label: AXIS_LABELS[a.tag] || a.tag }))}
            value={m.axis || font.axes[0].tag}
            onChange={(v) => setMotion('axis', v)}
          />
        </LabeledControl>
      )}
    </Section>
  )
}
