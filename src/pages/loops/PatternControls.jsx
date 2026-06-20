import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Input from '../../components/atoms/Input.jsx'
import { roundIfNum } from '../../lib/exprParam.js'
import Button from '../../components/atoms/Button.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import RuleRow from './RuleRow.jsx'
import { SHAPE_OPTIONS } from '../../loops/pattern/shapes.js'
import { newRule, randomRule } from '../../loops/pattern/rules.js'
import { FONT_OPTIONS, fontByKey } from '../kinetic/lib/vfAxes.js'

const CURVE_PRESETS = [
  { label: 'Sine',  expr: '' },
  { label: 'In',    expr: 'k*k' },
  { label: 'Out',   expr: '1-(1-k)*(1-k)' },
  { label: 'S',     expr: 'k<0.5?2*k*k:1-2*(1-k)*(1-k)' },
  { label: 'Step',  expr: 'round(k)' },
  { label: 'Peak',  expr: 'pow(sin(PI*k),2)' },
]

const SWEEP_AXES = [
  { value: 'none', label: 'None' },
  { value: 'diag', label: 'Diagonal' },
  { value: 'col', label: 'Columns' },
  { value: 'row', label: 'Rows' },
  { value: 'radial', label: 'Radial' },
]

// Interleave the base fill across colours by cell index — the clean R/Y/B test
// grid. checker = 2-colour; cols/rows/diag round-robin Shape · Colour 2 · Colour 3.
const COLOR_RULES = [
  { value: 'none', label: 'None' },
  { value: 'checker', label: 'Checker' },
  { value: 'cols', label: 'Columns' },
  { value: 'rows', label: 'Rows' },
  { value: 'diag', label: 'Diagonal' },
]

// The Pattern loop's Edit controls, split across two rail tabs so it isn't one
// giant scroll:
//   tab="pattern"   — what the pattern IS: shape · grid · colour · rules
//   tab="animation" — how it MOVES: camera (zoom/flow/angle/spin) + the per-cell
//                     sweep (axis/cycles/waves · pulse/fade/swing/colour-mix)
// `onChange(key, value)` patches one param on the loop's params object.
export default function PatternControls({ values, onChange, tab = 'pattern', glyphBound = false }) {
  const v = values
  // Canonical [swatch][label][hex] row — ColorField owns the label (never wrapped
  // in a LabeledControl; see the ColorField rule).
  const colorCtl = (label, key) => (
    <ColorField label={label} value={v[key]} onChange={(c) => onChange(key, c)} />
  )

  if (tab === 'animation') {
    return (
      <>
        <Section label="Camera">
          <Slider labeled label="Zoom" min={0.3} max={3} step={0.05} value={v.camZoom} onChange={(x) => onChange('camZoom', x)} variant="default" />
          <Slider labeled label="Flow" min={0} max={4} step={1} value={v.camFlow} onChange={(x) => onChange('camFlow', roundIfNum(x))} variant="default" />
          <Slider labeled label="Angle" min={0} max={360} step={1} value={v.camAngle} onChange={(x) => onChange('camAngle', roundIfNum(x))} variant="default" />
          <Slider labeled label="Spin" min={0} max={3} step={1} value={v.spin} onChange={(x) => onChange('spin', roundIfNum(x))} variant="default" />
        </Section>

        <Section label="Sweep">
          <LabeledControl inline label="Axis">
            <Dropdown variant="subtle" size="sm" className="w-full" options={SWEEP_AXES} value={v.animAxis ?? 'none'} onChange={(val) => onChange('animAxis', val)} />
          </LabeledControl>
          <Slider labeled label="Cycles" min={1} max={4} step={1} value={v.animCycles ?? 1} onChange={(x) => onChange('animCycles', roundIfNum(x))} variant="default" />
          <Slider labeled label="Waves" min={0} max={8} step={0.5} value={v.animWaves ?? 2} onChange={(x) => onChange('animWaves', x)} variant="default" />
          <LabeledControl inline label="Curve">
            <Input
              value={v.animCurveExpr ?? ''}
              onChange={(e) => onChange('animCurveExpr', e.target.value)}
              placeholder="k · k*k · 1-(1-k)*(1-k)"
              style={{ background: 'var(--kol-surface-primary)' }}
            />
          </LabeledControl>
          <div className="flex flex-wrap gap-1">
            {CURVE_PRESETS.map(({ label, expr }) => (
              <Button key={label} variant="primary" size="sm"
                onClick={() => onChange('animCurveExpr', expr)}>{label}</Button>
            ))}
          </div>
          <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={v.pulse ?? 0} onChange={(x) => onChange('pulse', x)} variant="default" />
          <Slider labeled label="Fade" min={0} max={1} step={0.05} value={v.fade ?? 0} onChange={(x) => onChange('fade', x)} variant="default" />
          <Slider labeled label="Swing" min={0} max={180} step={5} value={v.swing ?? 0} onChange={(x) => onChange('swing', roundIfNum(x))} variant="default" />
          <Slider labeled label="Colour mix" min={0} max={1} step={0.05} value={v.colorMix ?? 0} onChange={(x) => onChange('colorMix', x)} variant="default" />
          {colorCtl('Colour 2', 'color2')}
        </Section>
      </>
    )
  }

  // tab === 'pattern' — structure
  const rules = v.rules || []
  const setRules = (r) => onChange('rules', r)
  const addRule = () => setRules([...rules, newRule()])
  const updateRule = (i, u) => setRules(rules.map((r, k) => (k === i ? u : r)))
  const removeRule = (i) => setRules(rules.filter((_, k) => k !== i))
  const rerollRule = (i) => setRules(rules.map((r, k) => (k === i ? { ...randomRule(), id: r.id } : r)))
  const randomizeRules = () => setRules(Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => randomRule()))

  return (
    <>
      <Section label="Shape">
        <Dropdown
          variant="subtle" size="sm" className="w-full" options={SHAPE_OPTIONS} value={v.shape}
          onChange={(val) => {
            onChange('shape', val)
            // Glyph mode tiles a TYPE outline — seed the font url on first pick.
            if (val === 'glyph' && !v.glyphFontUrl) {
              const key = v.glyphFontKey || 'rot'
              onChange('glyphFontKey', key)
              onChange('glyphFontUrl', fontByKey(key).url)
            }
          }}
        />
        {v.shape === 'glyph' && (glyphBound ? (
          <div className="kol-mono-10 text-meta">Tiling the text instance — change the word, font and axes in Content / Edit.</div>
        ) : (
          <>
            <Input value={v.glyphChar ?? 'A'} onChange={(e) => onChange('glyphChar', e.target.value)} placeholder="A" />
            <LabeledControl inline label="Font">
              <Dropdown variant="subtle" size="sm" className="w-full" options={FONT_OPTIONS} value={v.glyphFontKey || 'rot'} onChange={(key) => { onChange('glyphFontKey', key); onChange('glyphFontUrl', fontByKey(key).url) }} />
            </LabeledControl>
          </>
        ))}
        {v.shape === 'custom' && (
          <textarea
            className="w-full h-20 mt-1 p-2 rounded bg-surface-secondary border border-fg-08 kol-mono-12 text-body"
            value={v.customSvg}
            onChange={(e) => onChange('customSvg', e.target.value)}
            placeholder='<svg viewBox="0 0 24 24"><path d="…"/></svg>'
          />
        )}
      </Section>

      <Section label="Grid">
        <Slider labeled label="Columns" min={1} max={32} step={1} value={v.cols} onChange={(x) => onChange('cols', roundIfNum(x))} variant="default" />
        <Slider labeled label="Rows" min={1} max={32} step={1} value={v.rows} onChange={(x) => onChange('rows', roundIfNum(x))} variant="default" />
        <Slider labeled label="Cell size" min={40} max={280} step={1} value={v.cell} onChange={(x) => onChange('cell', roundIfNum(x))} variant="default" />
        <Slider labeled label="Gap" min={-40} max={80} step={1} value={v.gap} onChange={(x) => onChange('gap', roundIfNum(x))} variant="default" />
        <ToggleSwitch variant="plain" label="Stretch" checked={v.stretch} onChange={(c) => onChange('stretch', c)} />
        <ToggleSwitch variant="plain" label="Grid lines" checked={!!v.showGrid} onChange={(c) => onChange('showGrid', c)} />
      </Section>

      <Section label="Colour">
        {colorCtl('Shape', 'color')}
        <LabeledControl inline label="Interleave">
          <Dropdown variant="subtle" size="sm" className="w-full" options={COLOR_RULES} value={v.colorRule ?? 'none'} onChange={(val) => onChange('colorRule', val)} />
        </LabeledControl>
        {v.colorRule && v.colorRule !== 'none' && colorCtl('Colour 2', 'color2')}
        {(v.colorRule === 'cols' || v.colorRule === 'rows' || v.colorRule === 'diag') && colorCtl('Colour 3', 'color3')}
        {colorCtl('Background', 'bg')}
      </Section>

      <Section label={`Rules · ${rules.length}`}>
        <div className="flex flex-col gap-2">
          {rules.map((rule, i) => (
            <RuleRow key={rule.id} rule={rule} onChange={(u) => updateRule(i, u)} onRemove={() => removeRule(i)} onReroll={() => rerollRule(i)} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="sm" onClick={addRule}>Add rule</Button>
            <Button variant="primary" size="sm" onClick={randomizeRules}>Randomize</Button>
          </div>
        </div>
      </Section>
    </>
  )
}
