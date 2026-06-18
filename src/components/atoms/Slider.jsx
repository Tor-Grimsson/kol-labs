import { useEffect, useMemo, useState } from 'react'
import Input from './Input.jsx'
import { isExpr, isValidExpr } from '../../lib/exprParam.js'

/**
 * Slider — range slider with label and an editable value readout.
 *
 * Variants (track/shell styling):
 *   default — bordered track + boxed value.
 *   minimal — bare track + boxed value. 99% of real usage (foundry previews,
 *             inline controls). PRESERVED from web.
 *   subtle  — filled rounded chip; for inspector-style controls.
 *
 * The value readout is an editable <Input>. Type a NUMBER (commit on blur /
 * Enter) or a time-EXPRESSION like `t*0.1`, `sin(t)`, `wave(t)*0.5` — the value
 * becomes the expression string, the track ghosts, and the param animates
 * wherever an engine resolves it per frame (see src/lib/exprParam.js). Drag the
 * track to override an expression back to a plain number. Pass `noExpr` to
 * forbid expressions (e.g. keyframe poses, which ARE the animation).
 *
 * `liveValue` (optional) — the engine's current resolved number; when the value
 * is an expression it drives the track thumb + readout so they animate too.
 *
 * Track color is exposed as the `--kol-slider-track` CSS variable on
 * `.slider-black`; override per-instance via style={{ '--kol-slider-track': '...' }}.
 *
 * @param {Object} props
 * @param {string} props.label - Slider label text
 * @param {number} props.min - Minimum value
 * @param {number} props.max - Maximum value
 * @param {number|string} props.value - Current value (number, or expression string)
 * @param {Function} props.onChange - Change handler; receives a number or an expression string
 * @param {'default'|'minimal'|'subtle'} props.variant - Visual variant (default: 'default')
 * @param {string} props.className - Additional wrapper classes
 * @param {number} props.displayWidth - Width of the value readout, in characters (default: 6)
 * @param {string} props.fontSize - Font size for label/value (e.g., '11px')
 * @param {number} props.step - Slider step increment (default: 1)
 * @param {Function} props.formatValue - Optional formatter for displayed value
 * @param {boolean} props.noExpr - Disallow expression input (numbers only)
 * @param {number} props.liveValue - Engine's current resolved value (for the readout/thumb while expression-bound)
 */
const Slider = ({
  label,
  min = 0,
  max = 100,
  value = 0,
  onChange,
  variant = 'default',
  className = '',
  displayWidth = 6,
  fontSize,
  step = 1,
  formatValue,
  noExpr = false,
  liveValue
}) => {
  const exprBound = !noExpr && isExpr(value)
  const exprBad   = exprBound && !isValidExpr(value)
  const hasLive   = Number.isFinite(liveValue)

  const handleChange = (e) => {
    // Dragging the track always commits a plain number — overriding any expression.
    if (onChange) onChange(Number(e.target.value))
  }

  const variantClass = variant === 'minimal'
    ? 'control-slider-minimal'
    : variant === 'subtle'
    ? 'control-slider-subtle'
    : 'control-slider'

  const decimals = useMemo(() => {
    if (formatValue) return null
    if (!Number.isFinite(step)) return 0
    if (step >= 1) return 0
    const decimalPart = step.toString().split('.')[1]
    return decimalPart ? decimalPart.length : 2
  }, [formatValue, step])

  const fmtNum = (n) => {
    if (formatValue) return String(formatValue(n))
    if (decimals && decimals > 0) return Number(n).toFixed(decimals)
    return String(Math.round(n))
  }

  // When expression-bound the readout shows the expression text (or the live
  // resolved number while not editing, if the engine feeds one back).
  const displayValue = useMemo(() => {
    if (exprBound) return String(value)
    return fmtNum(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exprBound, value, decimals, formatValue])

  // The native range input needs a finite number. While expression-bound, track
  // the live resolved value if present, else park at min (the ghosted track).
  const rangeValue = exprBound
    ? (hasLive ? Math.max(min, Math.min(max, liveValue)) : min)
    : value

  /* Editable readout — local string state lets the user type intermediate
   * values (e.g. "-" while entering a negative, or a half-typed expression)
   * without committing mid-keystroke. Commits on blur / Enter; reverts on Escape. */
  const [draft, setDraft]     = useState(displayValue)
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setDraft(displayValue) }, [displayValue, editing])

  const commit = () => {
    setEditing(false)
    if (onChange == null) { setDraft(displayValue); return }
    const raw = draft.trim()
    if (raw === '') { setDraft(displayValue); return } // empty reverts

    const num = Number(raw)
    if (Number.isFinite(num)) {
      const clamped = Math.max(min, Math.min(max, num))
      onChange(clamped)
      setDraft(fmtNum(clamped))
      return
    }
    // Non-numeric input.
    if (noExpr) { setDraft(displayValue); return } // expressions forbidden — revert
    onChange(raw) // store as an expression (even if invalid, so it can be fixed)
    setDraft(raw)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter')  { e.currentTarget.blur() }
    if (e.key === 'Escape') { setDraft(displayValue); setEditing(false); e.currentTarget.blur() }
  }

  // While expression-bound and not editing, show the live resolved number in the
  // box (so it visibly animates); the expression itself is shown on focus.
  const boxValue = (exprBound && hasLive && !editing) ? fmtNum(liveValue) : draft

  return (
    <div className={`${variantClass} gap-3 shadow-none ${className}`}>
      {label && (
        <label className="kol-helper-12 uppercase tracking-widest whitespace-nowrap shrink-0 w-fit" style={fontSize ? { fontSize } : undefined}>
          {label}
        </label>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rangeValue}
        onChange={handleChange}
        className="slider-black flex-1 w-full cursor-pointer"
        style={exprBound ? { opacity: 0.4 } : undefined}
        title={exprBound ? `expression: ${value} — drag to override` : undefined}
      />
      <Input
        type="text"
        inputMode={exprBound ? 'text' : 'decimal'}
        variant="filled"
        size="sm"
        chars={exprBound ? Math.max(displayWidth, 10) : displayWidth}
        value={boxValue}
        onFocus={(e) => { setEditing(true); setDraft(displayValue); e.target.select() }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        inputClassName={`text-center${exprBad ? ' text-red-500' : ''}`}
        title={exprBad ? 'invalid expression' : undefined}
      />
    </div>
  )
}

export default Slider
