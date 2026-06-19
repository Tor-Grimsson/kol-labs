import Dropdown from '../../components/molecules/Dropdown.jsx'
import Input from '../../components/atoms/Input.jsx'
import Button from '../../components/atoms/Button.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import { isExpr } from '../../lib/exprParam.js'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import { SELECT_OPTIONS, ROTATE_OPTIONS } from '../../loops/pattern/rules.js'

// One pattern rule — selector + transforms. DS-styled port of kol-client's
// RuleRow (the rule shape + semantics are identical; see loops/pattern/rules.js).
function Num({ label, value, onChange, min = 0, max = 99 }) {
  return (
    <LabeledControl inline label={label}>
      <Input
        size="sm"
        chars={4}
        value={String(value)}
        inputClassName="text-right"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min)
        }}
      />
    </LabeledControl>
  )
}

export default function RuleRow({ rule, onChange, onRemove, onReroll }) {
  const set = (patch) => onChange({ ...rule, ...patch })
  const showN = ['every-col', 'every-row', 'every-nth', 'both'].includes(rule.selectKind)
  const showN2 = rule.selectKind === 'both'
  const showExpr = rule.selectKind === 'expression'

  return (
    <div className="flex flex-col gap-2 p-2 border border-fg-08 rounded">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Dropdown variant="subtle" size="sm" className="w-full" options={SELECT_OPTIONS} value={rule.selectKind} onChange={(v) => set({ selectKind: v })} />
        </div>
        <Button variant="ghost" size="sm" iconOnly="refresh" onClick={onReroll} title="Re-randomize rule" className="shrink-0" />
        <Button variant="ghost" size="sm" iconOnly="cross" onClick={onRemove} title="Remove rule" className="shrink-0" />
      </div>

      {showN && (
        <div className="grid grid-cols-2 gap-2">
          <Num label="N" value={rule.n} min={1} onChange={(v) => set({ n: v })} />
          <Num label="Offset" value={rule.offset} onChange={(v) => set({ offset: v })} />
        </div>
      )}

      {showN2 && (
        <div className="grid grid-cols-2 gap-2">
          <Num label="Row N" value={rule.n2} min={1} onChange={(v) => set({ n2: v })} />
          <Num label="Row offset" value={rule.offset2} onChange={(v) => set({ offset2: v })} />
        </div>
      )}

      {showExpr && (
        <LabeledControl label="Expression">
          <Input size="sm" value={rule.expression} onChange={(e) => set({ expression: e.target.value })} placeholder="sin(col*0.6)+cos(row*0.6)" />
        </LabeledControl>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Num label="Group W" value={rule.groupW} min={1} onChange={(v) => set({ groupW: Math.max(1, v) })} />
        <Num label="Group H" value={rule.groupH} min={1} onChange={(v) => set({ groupH: Math.max(1, v) })} />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Dropdown variant="subtle" size="sm" options={ROTATE_OPTIONS} value={rule.rotate} onChange={(v) => set({ rotate: Number(v) })} />
        <Button variant="secondary" size="sm" selected={rule.flipH} onClick={() => set({ flipH: !rule.flipH })} title="Flip horizontal">⇋</Button>
        <Button variant="secondary" size="sm" selected={rule.flipV} onClick={() => set({ flipV: !rule.flipV })} title="Flip vertical">⇵</Button>
        <Button variant="secondary" size="sm" selected={rule.hide} onClick={() => set({ hide: !rule.hide })} title="Hide cell">hide</Button>
      </div>

      <Slider labeled label="Opacity" min={0} max={100} step={1} value={Math.round(rule.opacity * 100)} onChange={(v) => set({ opacity: isExpr(v) ? v : v / 100 })} variant="default" />
    </div>
  )
}
