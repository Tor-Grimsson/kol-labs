import Slider from '../../../components/atoms/Slider.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'

// Render one FX param from its spec: enum (spec.options) → a labeled Dropdown,
// numeric → a labeled Slider. Shared by Radar's Post-Processing section and the
// Effects stack (both `raised` — the controls sit on a bg-fg-04 card).
export default function FxParamControl({ name, spec, value, onChange, liveGet }) {
  if (spec.options) {
    return (
      <div className="flex flex-col gap-1">
        <span className="kol-helper-10 uppercase tracking-widest text-meta">{name}</span>
        <Dropdown size="sm" options={spec.options} value={value} onChange={onChange} variant="subtle" raised className="w-full" />
      </div>
    )
  }
  return (
    <Slider labeled label={name} min={spec.min} max={spec.max} step={spec.step} value={value} onChange={onChange} variant="default" raised liveGet={liveGet} />
  )
}
