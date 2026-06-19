import { THEMES, AXIS_3D } from '../style/mathStyle'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Section from '../../../components/molecules/Section.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

// [swatch] [label] [hex] — the reference compose Palette / SwatchRow layout.
const ColorRow = ({ label, value, onChange }) => (
  <ColorField label={label} value={value} onChange={onChange} />
)

// Shared style rail section for the math pages: theme presets + bg/stroke/weight
// + the axis/grid system. Flags hide controls a page doesn't use (e.g. surface
// has a ramp not a single stroke; complex has no bg/stroke).
export default function StylePanel({
  style,
  onPatch,
  onTheme,
  axisOptions = AXIS_3D,
  showBg = true,
  showStroke = true,
  showWeight = true,
  showTheme = true,
  showAxis = true,
  strokeLabel = 'Stroke',
  weightLabel = 'Weight',
  weightMax = 4,
  invert = false,
  onInvert,
}) {
  return (
    <>
      {showTheme && (
        <Section label="Theme">
          <div className="flex flex-wrap gap-1">
            {THEMES.map((t) => (
              <Button key={t.id} variant="secondary" size="sm" selected={style.bg === t.bg} onClick={() => onTheme(t.id)}>{t.label}</Button>
            ))}
          </div>
        </Section>
      )}

      {(showBg || showStroke || showWeight || onInvert || style.axis !== 'none') && (
        <Section label="Style">
          {showBg && <ColorRow label="Background" value={style.bg} onChange={(v) => onPatch({ bg: v })} />}
          {showStroke && <ColorRow label={strokeLabel} value={style.stroke} onChange={(v) => onPatch({ stroke: v })} />}
          {style.axis !== 'none' && <ColorRow label="Grid color" value={style.gridColor} onChange={(v) => onPatch({ gridColor: v })} />}
          {showWeight && (
            <Slider labeled label={weightLabel} labelWidth={96} min={0.4} max={weightMax} step={0.1} value={style.weight} onChange={(v) => onPatch({ weight: v })} variant="default" />
          )}
          {onInvert && (
            <SegmentedToggle
              value={invert ? 'invert' : 'normal'}
              onChange={(v) => onInvert(v === 'invert')}
              options={[{ value: 'normal', label: 'Normal' }, { value: 'invert', label: 'Invert' }]}
            />
          )}
        </Section>
      )}

      {showAxis && (
        <Section label="Axis">
          <Dropdown size="sm" variant="subtle" className="w-full" options={axisOptions} value={style.axis} onChange={(v) => onPatch({ axis: v })} />
          {style.axis !== 'none' && (
            <Slider labeled label="Grid opacity" min={0} max={1} step={0.02} value={style.gridOpacity} onChange={(v) => onPatch({ gridOpacity: v })} variant="default" />
          )}
        </Section>
      )}
    </>
  )
}
