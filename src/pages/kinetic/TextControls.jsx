import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import { FONT_OPTIONS, AXIS_LABELS, fontByKey } from './lib/vfAxes.js'

const ALIGN = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
]

// Content · font · variable-font axis sliders · size/tracking/align · colours.
export default function TextControls({ params, set, setVf }) {
  const font = fontByKey(params.font)
  const colorCtl = (label, key) => (
    <LabeledControl inline label={label}>
      <ColorField value={params[key]} onChange={(c) => set(key, c)} />
    </LabeledControl>
  )

  return (
    <>
      <Section label="Text">
        <input
          type="text"
          value={params.text}
          onChange={(e) => set('text', e.target.value)}
          className="w-full p-2 rounded bg-surface-secondary border border-fg-08 kol-mono-12 text-body"
          placeholder="Type…"
        />
        <Dropdown variant="subtle" size="sm" className="w-full" options={FONT_OPTIONS} value={params.font} onChange={(v) => set('font', v)} />
        <Slider label="Size" min={24} max={420} step={1} value={params.fontSize} onChange={(v) => set('fontSize', Math.round(v))} variant="default" />
        <Slider label="Tracking" min={-20} max={120} step={1} value={params.letterSpacing} onChange={(v) => set('letterSpacing', Math.round(v))} variant="default" />
        <LabeledControl inline label="Align">
          <Dropdown variant="subtle" size="sm" className="w-full" options={ALIGN} value={params.align} onChange={(v) => set('align', v)} />
        </LabeledControl>
      </Section>

      <Section label="Axes">
        {font.axes.length === 0 && <div className="kol-helper-10 text-meta">Static font — no variable axes.</div>}
        {font.axes.map((a) => (
          <Slider
            key={a.tag}
            label={AXIS_LABELS[a.tag] || a.tag}
            min={a.min}
            max={a.max}
            step={1}
            value={params.vf[a.tag] ?? a.def}
            onChange={(v) => setVf(a.tag, Math.round(v))}
            variant="default"
          />
        ))}
      </Section>

      <Section label="Colour">
        {colorCtl('Fill', 'fill')}
        {colorCtl('Background', 'bg')}
      </Section>
    </>
  )
}
