import { useEffect, useState } from 'react'
import Input from '../../../../components/atoms/Input.jsx'
import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'

// Short number formatter for buffered fields + value labels.
export const fmt = (n) => (Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '')

// One buffered field. numeric → parses to a finite number on commit; otherwise
// commits the raw string (expressions). Reverts on Escape / bad number. Buffers
// its own draft and commits on blur/Enter (the DS Slider idiom) so a half-typed
// value doesn't fire downstream (re-sample) mid-keystroke. Shared by the curve
// and camera-timeline editors.
export function Field({ label, value, onCommit, numeric = false, labelWidth = 64, inline = numeric }) {
  const norm = numeric ? fmt(value) : (value ?? '')
  const [draft, setDraft] = useState(norm)
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setDraft(norm) }, [norm, editing])
  const commit = () => {
    setEditing(false)
    if (numeric) {
      const n = Number(draft)
      if (Number.isFinite(n)) onCommit(n)
      else setDraft(norm)
    } else {
      onCommit(draft)
    }
  }
  return (
    <LabeledControl inline={inline} label={label} labelWidth={labelWidth}>
      <Input
        size="sm"
        width="100%"
        value={draft}
        onFocus={(e) => { setEditing(true); e.target.select() }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setDraft(norm); setEditing(false); e.currentTarget.blur() }
        }}
        inputClassName={numeric ? 'text-right' : undefined}
      />
    </LabeledControl>
  )
}
