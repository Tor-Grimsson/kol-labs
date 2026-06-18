import Slider from '../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../lib/exprParam.js'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import ColorField from '../../components/color/ColorField.jsx'

// Renders a loop's declarative param schema into DS controls. Shared by every
// loop (shape + pattern) so loop modules stay pure-data — they declare params,
// this maps each type → the right control. `onChange(key, value)`.
export default function LoopControls({ schema = [], values = {}, onChange, label = 'Parameters' }) {
  if (!schema.length) return <div className="kol-helper-10 text-meta">No parameters.</div>

  return (
    <Section label={label}>
      {schema.map((p) => {
        if (p.type === 'toggle') {
          return (
            <ToggleSwitch
              key={p.key}
              variant="plain"
              label={p.label}
              checked={values[p.key] !== false}
              onChange={(c) => onChange(p.key, c)}
            />
          )
        }
        if (p.type === 'color') {
          return (
            <LabeledControl key={p.key} inline label={p.label}>
              <ColorField value={values[p.key]} onChange={(c) => onChange(p.key, c)} />
            </LabeledControl>
          )
        }
        // 'range' (default)
        const isInt = (p.step ?? 1) >= 1
        return (
          <Slider
            key={p.key}
            label={p.label}
            min={p.min}
            max={p.max}
            step={p.step}
            value={values[p.key]}
            onChange={(v) => onChange(p.key, isInt ? roundIfNum(v) : v)}
            variant="default"
          />
        )
      })}
    </Section>
  )
}
