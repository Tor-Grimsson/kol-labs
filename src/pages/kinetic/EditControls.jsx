import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import OpenTypeMenu from './OpenTypeMenu.jsx'
import { FONT_OPTIONS, AXIS_LABELS, fontByKey } from './lib/vfAxes.js'

const ALIGN = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
]

/**
 * Edit tab — the SELECTED instance's typography: font · size · tracking · align ·
 * fill, variable-font axes, and OpenType features. (Motion lives in Layout; text
 * content in Design.)
 */
export default function EditControls({ instance, set, setVf, setOt }) {
  if (!instance) {
    return <div className="kol-mono-12 text-meta">Select an instance in Layout to edit it.</div>
  }
  const font = fontByKey(instance.font)
  return (
    <>
      <Section label="Type">
        <Dropdown variant="subtle" size="sm" className="w-full" options={FONT_OPTIONS} value={instance.font} onChange={(v) => set('font', v)} />
        <Slider labeled noExpr label="Size" min={16} max={420} step={1} value={instance.fontSize} onChange={(v) => set('fontSize', Math.round(v))} variant="default" />
        <Slider labeled noExpr label="Tracking" min={-20} max={120} step={1} value={instance.letterSpacing} onChange={(v) => set('letterSpacing', Math.round(v))} variant="default" />
        <LabeledControl inline label="Align">
          <Dropdown variant="subtle" size="sm" className="w-full" options={ALIGN} value={instance.align} onChange={(v) => set('align', v)} />
        </LabeledControl>
        <ColorField label="Fill" value={instance.fill} onChange={(c) => set('fill', c)} />
      </Section>

      <Section label="Axes">
        {font.axes.length === 0 && <div className="kol-helper-10 text-meta">Static font — no variable axes.</div>}
        {font.axes.map((a) => (
          <Slider labeled noExpr
            key={a.tag}
            label={AXIS_LABELS[a.tag] || a.tag}
            min={a.min}
            max={a.max}
            step={1}
            value={instance.vf?.[a.tag] ?? a.def}
            onChange={(v) => setVf(a.tag, Math.round(v))}
            variant="default"
          />
        ))}
      </Section>

      <Section label="OpenType">
        <OpenTypeMenu value={instance.opentype} onToggle={setOt} />
      </Section>
    </>
  )
}
