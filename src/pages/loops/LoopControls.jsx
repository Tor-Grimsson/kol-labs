import Slider from '../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../lib/exprParam.js'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'
import Section from '../../components/molecules/Section.jsx'

// The Edit tab — the loop's TRANSFORM params only (ranges + toggles). Colour and
// gradient live in the centralised Color tab (ColorControls), so anything tagged
// `type:'color'` or `tab:'color'` is filtered out here. `onChange(key, value)`;
// optional `onRandomize` adds a Randomise button that rerolls these params.
export default function LoopControls({ schema = [], values = {}, onChange, label = 'Parameters', onRandomize }) {
  const params = schema.filter((p) => p.type !== 'color' && p.tab !== 'color')

  const renderControl = (p) => {
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
    // 'range' (default)
    const isInt = (p.step ?? 1) >= 1
    return (
      <Slider labeled
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
  }

  if (!params.length && !onRandomize) return <div className="kol-helper-10 text-meta">No parameters.</div>

  return (
    <Section label={label}>
      {params.map(renderControl)}
      {onRandomize && (
        <Button variant="primary" size="sm" iconLeft="cycle" className="w-full" onClick={onRandomize}>Randomise</Button>
      )}
    </Section>
  )
}
