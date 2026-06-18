import Button from '../../../../components/atoms/Button.jsx'
import Dropdown from '../../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'
import { Field } from './Field'

// Editable controls for a clip's `curve` (the generative function). Pure-prop:
// `curve` in, `onChange(patch)` merges fields, `onKind(kind)` replaces the whole
// curve with that kind's defaults. No page coupling — reused by /math/animate.
//
// Param fields buffer their own draft and commit on blur/Enter (the DS Slider
// idiom) so a half-typed value / expression doesn't re-sample mid-keystroke.

const KINDS = [
  { value: 'epicycle', label: 'Epicycle' },
  { value: 'polar', label: 'Polar' },
  { value: 'param2d', label: 'Parametric 2D' },
  { value: 'param3d', label: 'Parametric 3D' },
  { value: 'points', label: 'Points' },
  { value: 'maurer', label: 'Maurer rose' },
]

// Start/end of a curve's parameter range as two number fields.
function RangeFields({ curve, onChange }) {
  const [a, b] = curve.range || [0, 1]
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Start" numeric value={a} onCommit={(v) => onChange({ range: [v, b] })} labelWidth={36} />
      <Field label="End" numeric value={b} onCommit={(v) => onChange({ range: [a, v] })} labelWidth={28} />
    </div>
  )
}

// Epicycle = a sum of rotating vectors. Each term {amp, freq, phase} is one
// vector; add/remove terms = the vector array.
function TermsEditor({ curve, onChange }) {
  const terms = curve.terms || []
  const setTerm = (i, key, v) =>
    onChange({ terms: terms.map((tm, j) => (j === i ? { ...tm, [key]: v } : tm)) })
  const addTerm = () => onChange({ terms: [...terms, { amp: 0.5, freq: 2, phase: 0 }] })
  const removeTerm = (i) => onChange({ terms: terms.filter((_, j) => j !== i) })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="kol-helper-10 uppercase tracking-widest text-meta">Vectors</span>
        <Button variant="secondary" size="sm" iconLeft="plus" onClick={addTerm}>Add</Button>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
        <span className="kol-helper-10 text-fg-48 text-center">amp</span>
        <span className="kol-helper-10 text-fg-48 text-center">freq</span>
        <span className="kol-helper-10 text-fg-48 text-center">phase</span>
        <span />
        {terms.map((tm, i) => (
          <TermRow key={i} term={tm} onSet={(k, v) => setTerm(i, k, v)} onRemove={() => removeTerm(i)} canRemove={terms.length > 1} />
        ))}
      </div>
    </div>
  )
}

function TermRow({ term, onSet, onRemove, canRemove }) {
  const cell = (key, fallback) => (
    <Field label="" value={term[key] ?? fallback} numeric onCommit={(v) => onSet(key, v)} />
  )
  return (
    <>
      {cell('amp', 1)}
      {cell('freq', 1)}
      {cell('phase', 0)}
      <Button variant="ghost" size="sm" iconOnly="cross" onClick={onRemove} disabled={!canRemove} aria-label="Remove vector" />
    </>
  )
}

export default function CurveControls({ curve, onChange, onKind }) {
  const kind = curve?.kind || 'polar'
  return (
    <div className="flex flex-col gap-3">
      <LabeledControl label="Type">
        <Dropdown options={KINDS} value={kind} onChange={onKind} variant="subtle" className="w-full" />
      </LabeledControl>

      {kind === 'epicycle' && (
        <>
          <Field label="Turns" numeric value={curve.turns ?? 1} onCommit={(v) => onChange({ turns: v })} />
          <TermsEditor curve={curve} onChange={onChange} />
        </>
      )}

      {kind === 'polar' && (
        <>
          <RangeFields curve={curve} onChange={onChange} />
          <Field label="r(θ)" value={curve.r ?? ''} onCommit={(v) => onChange({ r: v })} />
        </>
      )}

      {kind === 'param2d' && (
        <>
          <RangeFields curve={curve} onChange={onChange} />
          <Field label="x(t)" value={curve.x ?? ''} onCommit={(v) => onChange({ x: v })} />
          <Field label="y(t)" value={curve.y ?? ''} onCommit={(v) => onChange({ y: v })} />
        </>
      )}

      {kind === 'param3d' && (
        <>
          <RangeFields curve={curve} onChange={onChange} />
          <Field label="x(t)" value={curve.x ?? ''} onCommit={(v) => onChange({ x: v })} />
          <Field label="y(t)" value={curve.y ?? ''} onCommit={(v) => onChange({ y: v })} />
          <Field label="z(t)" value={curve.z ?? ''} onCommit={(v) => onChange({ z: v })} />
        </>
      )}

      {kind === 'points' && (
        <>
          <Field label="Count" numeric value={curve.count ?? 100} onCommit={(v) => onChange({ count: Math.max(1, Math.round(v)) })} />
          <Field label="a(k)" value={curve.a ?? ''} onCommit={(v) => onChange({ a: v })} />
          <Field label="r(k)" value={curve.r ?? ''} onCommit={(v) => onChange({ r: v })} />
        </>
      )}

      {kind === 'maurer' && (
        <>
          <Field label="n" numeric value={curve.n ?? 6} onCommit={(v) => onChange({ n: v })} />
          <Field label="d°" numeric value={curve.d ?? 71} onCommit={(v) => onChange({ d: v })} />
        </>
      )}
    </div>
  )
}
