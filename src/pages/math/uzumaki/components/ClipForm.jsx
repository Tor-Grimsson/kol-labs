import Slider from '../../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../../components/atoms/ToggleSwitch.jsx'
import Section from '../../../../components/molecules/Section.jsx'
import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'
import ColorField from '../../../../components/color/ColorField.jsx'

// Editable controls for a clip's modifiers + appearance. Pure-prop, no page
// coupling — reused by /math/animate. Only surfaces controls the renderer
// actually reads: Copies (repeat) + Spiral (modifiers), Arms/Dots (show),
// Color/Weight (style). `trace`/`axes` are vestigial in the data and unread by
// CurvePlayer, so they get no toggle.
export default function ClipForm({ modifiers, show, style, onMod, onShow, onStyle }) {
  const m = modifiers || {}
  const s = show || {}
  const st = style || {}
  return (
    <>
      <Section label="Modifiers">
        <Slider label="Copies" min={1} max={24} step={1} value={m.repeat || 1} onChange={(v) => onMod({ repeat: v })} variant="default" />
        <Slider label="Spiral" min={0} max={8} step={0.1} value={m.spiral || 0} onChange={(v) => onMod({ spiral: v })} variant="default" />
      </Section>

      <Section label="Show">
        <ToggleSwitch variant="plain" label="Arms" checked={!!s.arms} onChange={(v) => onShow({ arms: v })} />
        <ToggleSwitch variant="plain" label="Dots" checked={!!s.dots} onChange={(v) => onShow({ dots: v })} />
      </Section>

      <Section label="Style">
        <LabeledControl inline label="Color" labelWidth={64}>
          <ColorField value={st.color || '#ffffff'} onChange={(c) => onStyle({ color: c })} />
        </LabeledControl>
        <Slider label="Weight" min={0.5} max={4} step={0.1} value={st.weight || 1.5} onChange={(v) => onStyle({ weight: v })} variant="default" />
      </Section>
    </>
  )
}
