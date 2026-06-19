import Slider from '../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../lib/exprParam.js'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import { FILL_OPTIONS } from '../../loops/lib/fill.js'

// The rail's Color tab — every colour for the loop in ONE place: the swatches
// (Background + colour stops) and, when the loop supports it, the gradient fill
// (linear · radial · conic · polar). Centralises colour so it isn't scattered
// through the Edit/transform params.
export default function ColorControls({ schema = [], values = {}, onChange }) {
  const colors = schema.filter((p) => p.type === 'color')
  const hasFill = schema.some((p) => p.key === 'fill' && p.tab === 'color')
  const fillType = values.fill || 'solid'

  if (!colors.length && !hasFill) return <div className="kol-helper-10 text-meta">No colours.</div>

  return (
    <>
      {colors.length > 0 && (
        <Section label="Colour">
          {colors.map((p) => (
            <ColorField key={p.key} label={p.label} value={values[p.key]} onChange={(c) => onChange(p.key, c)} />
          ))}
        </Section>
      )}

      {hasFill && (
        <Section label="Gradient">
          <LabeledControl inline label="Fill">
            <Dropdown variant="subtle" size="sm" className="w-full" options={FILL_OPTIONS} value={fillType} onChange={(v) => onChange('fill', v)} />
          </LabeledControl>
          {fillType !== 'solid' && fillType !== 'radial' && (
            <Slider labeled label="Angle" min={0} max={360} step={1} value={values.fillAngle ?? 0} onChange={(v) => onChange('fillAngle', roundIfNum(v))} variant="default" />
          )}
          {fillType === 'polar' && (
            <Slider labeled label="Polar stops" min={2} max={16} step={1} value={values.fillStops ?? 6} onChange={(v) => onChange('fillStops', roundIfNum(v))} variant="default" />
          )}
        </Section>
      )}
    </>
  )
}
