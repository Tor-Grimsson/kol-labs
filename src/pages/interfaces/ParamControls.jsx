import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Input from '../../components/atoms/Input.jsx'
import ToggleCheckbox from '../../components/atoms/ToggleCheckbox.jsx'

/**
 * Renders a registry param schema as live controls. Shared by the Library
 * detail and the Generate inspector so both stay in lockstep (one place to
 * teach a new param type). `onChange(key, value)` reports edits; the caller
 * owns the opts object.
 *
 * Param shape (from widgets/registry.js):
 *   { key, label, min, max, step }            — numeric slider
 *   { key, label, type: 'select', options }   — enum dropdown
 *   { key, label, type: 'text' }              — free text
 */
export default function ParamControls({ params, opts, onChange }) {
  return params.map((p) => (
    p.type === 'select' ? (
      <div key={p.key}>
        <div className="kol-helper-10 text-meta mb-1">{p.label}</div>
        <Dropdown size="sm" variant="subtle" className="w-full" value={opts[p.key]} onChange={(v) => onChange(p.key, v)} options={p.options.map((o) => ({ value: o, label: o }))} />
      </div>
    ) : p.type === 'text' ? (
      <div key={p.key}>
        <div className="kol-helper-10 text-meta mb-1">{p.label}</div>
        <Input value={opts[p.key] ?? ''} onChange={(e) => onChange(p.key, e.target.value)} placeholder="text…" />
      </div>
    ) : p.type === 'boolean' ? (
      <ToggleCheckbox key={p.key} label={p.label} checked={!!opts[p.key]} onChange={(v) => onChange(p.key, v)} />
    ) : (
      <Slider key={p.key} label={p.label} min={p.min} max={p.max} step={p.step} value={opts[p.key]} onChange={(v) => onChange(p.key, v)} />
    )
  ))
}
