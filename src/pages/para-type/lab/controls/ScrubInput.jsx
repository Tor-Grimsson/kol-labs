/* ScrubInput — drag the label horizontally to nudge the value, type to
 * enter directly. Built around the KOL Input. Used in tight rows where a
 * full Slider is too tall. */

import { useCallback, useEffect, useRef, useState } from 'react'
import Input from '../../../../components/atoms/Input.jsx'

export default function ScrubInput({
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onChange,
  label,
  width = 56,
  className = '',
  formatValue,
}) {
  const [draft, setDraft] = useState(formatValue ? formatValue(value) : String(value))
  const [editing, setEditing] = useState(false)
  const dragRef = useRef({ active: false, startX: 0, startVal: 0 })

  useEffect(() => {
    if (!editing) setDraft(formatValue ? formatValue(value) : String(value))
  }, [value, editing, formatValue])

  const commit = useCallback(() => {
    setEditing(false)
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(formatValue ? formatValue(value) : String(value))
      return
    }
    const clamped = Math.max(min, Math.min(max, parsed))
    onChange?.(clamped)
  }, [draft, max, min, onChange, value, formatValue])

  const onPointerDown = (e) => {
    dragRef.current = { active: true, startX: e.clientX, startVal: value, modifier: e.shiftKey ? 10 : (e.altKey ? 0.1 : 1) }
    e.target.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const stride = step * dragRef.current.modifier
    const next = dragRef.current.startVal + dx * stride * 0.5
    const clamped = Math.max(min, Math.min(max, next))
    onChange?.(Math.round(clamped / step) * step)
  }
  const onPointerUp = () => { dragRef.current.active = false }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {label && (
        <span
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="kol-helper-10 uppercase tracking-widest text-meta cursor-ew-resize select-none px-1"
          style={{ touchAction: 'none' }}
        >
          {label}
        </span>
      )}
      <Input
        type="text"
        inputMode="decimal"
        variant="filled"
        size="sm"
        width={width}
        value={draft}
        onFocus={(e) => { setEditing(true); e.target.select() }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  e.currentTarget.blur()
          if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); e.currentTarget.blur() }
        }}
        inputClassName="text-center"
      />
    </div>
  )
}
