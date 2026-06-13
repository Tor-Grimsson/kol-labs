/* TransformPanel — numeric controls for affine transform of every glyph:
 * rotate / scaleX / scaleY / skewX / skewY. */

import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'
import Slider from '../../../../components/atoms/Slider.jsx'

const ROW = ['rotate', 'scaleX', 'scaleY', 'skewX', 'skewY']
const RANGE = {
  rotate: { min: -180, max: 180, step: 1 },
  scaleX: { min: 0.2, max: 3,    step: 0.01 },
  scaleY: { min: 0.2, max: 3,    step: 0.01 },
  skewX:  { min: -60, max: 60,   step: 1 },
  skewY:  { min: -60, max: 60,   step: 1 },
}
const LABEL = {
  rotate: 'rotate',
  scaleX: 'scale x',
  scaleY: 'scale y',
  skewX:  'skew x',
  skewY:  'skew y',
}

export default function TransformPanel({ value, onChange, className = '' }) {
  const set = (k) => (v) => onChange?.({ ...value, [k]: v })
  return (
    <div className={`flex flex-col gap-3 p-3 ${className}`}>
      {ROW.map(k => (
        <LabeledControl key={k} label={LABEL[k]} hint={Number(value[k] ?? 0).toFixed(2)}>
          <Slider {...RANGE[k]} value={value[k] ?? (k.startsWith('scale') ? 1 : 0)} onChange={set(k)} />
        </LabeledControl>
      ))}
    </div>
  )
}
