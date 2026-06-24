import Slider from '../../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../../components/atoms/ToggleSwitch.jsx'
import Section from '../../../../components/molecules/Section.jsx'

// Editable controls for a clip's modifiers + show flags + stroke weight. Pure-prop,
// no page coupling — reused by /math/animate. Colour lives in ClipEditor's Color
// section (palette + swatches only); Weight sits here so Color stays swatches-only.
export default function ClipForm({ modifiers, show, style, onMod, onShow, onStyle }) {
  const m = modifiers || {}
  const s = show || {}
  const st = style || {}
  return (
    <>
      <Section label="Modifiers">
        <Slider labeled label="Copies" min={1} max={24} step={1} value={m.repeat || 1} onChange={(v) => onMod({ repeat: v })} variant="default" />
        <Slider labeled label="Spiral" min={0} max={8} step={0.1} value={m.spiral || 0} onChange={(v) => onMod({ spiral: v })} variant="default" />
      </Section>

      <Section label="Show">
        <ToggleSwitch variant="plain" label="Arms" checked={!!s.arms} onChange={(v) => onShow({ arms: v })} />
        <ToggleSwitch variant="plain" label="Dots" checked={!!s.dots} onChange={(v) => onShow({ dots: v })} />
        <ToggleSwitch variant="plain" label="Fill" checked={!!s.fill} onChange={(v) => onShow({ fill: v })} />
        {s.fill && (
          <>
            <ToggleSwitch variant="plain" label="Outline" checked={!!s.outline} onChange={(v) => onShow({ outline: v })} />
            <Slider labeled label="Fill opacity" min={0} max={1} step={0.05} value={s.fillOpacity ?? 1} onChange={(v) => onShow({ fillOpacity: v })} variant="default" noExpr />
          </>
        )}
        <Slider labeled label="Weight" min={0.5} max={4} step={0.1} value={st.weight || 1.5} onChange={(v) => onStyle({ weight: v })} variant="default" />
      </Section>
    </>
  )
}
