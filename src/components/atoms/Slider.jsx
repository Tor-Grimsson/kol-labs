import { useEffect, useMemo, useState } from 'react'
import Input from './Input.jsx'
import { isExpr, isValidExpr, evalExpr, referencesAudio } from '../../lib/exprParam.js'
import { useLiveClock } from '../../lib/liveClock.jsx'
import { isAudioEnabled, subscribeAudio } from '../../lib/audioSource.js'

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
 * @param {boolean} props.labeled - "Labeled slider": render the label as a fixed-width
 *   kol-helper-10 META column so it matches the DS row labels (THEME / AXIS / a Dropdown
 *   in a LabeledControl). Without it the label is the bare kol-helper-12 / fg-80 inline
 *   style. This is the label axis; it's independent of `variant` (the track/value chrome).
 * @param {number} props.labelWidth - Label column width in px for `labeled` (default 96).
 *   Passing labelWidth alone also turns on the labeled style.
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
 * @param {Function} props.liveGet - Stable () => number getter polled each frame to drive the thumb/readout from an external live source (e.g. a controller-mapped param). Ghosts the track like an expression.
 * @param {boolean} props.clamp - Hard-limit TYPED input to [min,max] too. Default false:
 *   the track (drag) is the soft range, but typing in the box accepts any number
 *   (push a param past the slider's max — e.g. a shape that overflows the frame).
 *   Set clamp when a value beyond the range genuinely breaks the engine.
 */
const Slider = ({
  label,
  labeled = false,
  labelWidth,
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
  liveValue,
  liveGet,
  clamp = false,
  raised = false // value box on a raised surface → use surface-primary so it reads as an input
}) => {
  const exprBound = !noExpr && isExpr(value)
  const exprBad   = exprBound && !isValidExpr(value)

  // Self-animate: when bound to a (valid) expression and the page provides a
  // playhead clock, evaluate this slider's own expression each frame so the
  // thumb + readout track the motion. An explicit `liveValue` prop still wins.
  const getClock = useLiveClock()
  const [autoLive, setAutoLive] = useState(undefined)
  // Track whether the mic is live so an audio-bound slider self-animates even on
  // a page with no playhead clock (or while the transport is paused) — t is
  // frozen then, but the audio bands keep moving.
  const [audioActive, setAudioActive] = useState(isAudioEnabled())
  useEffect(() => subscribeAudio(setAudioActive), [])
  const audioBound = exprBound && !exprBad && referencesAudio(value)
  useEffect(() => {
    // Self-animate sources, in priority: an injected `liveGet` (controller-mapped
    // value) wins; otherwise the expression evaluated against the page clock
    // and/or the live audio bands.
    const useGetter = typeof liveGet === 'function'
    const canExpr = exprBound && !exprBad && (!!getClock || (audioActive && audioBound))
    if (!useGetter && !canExpr) { setAutoLive(undefined); return }
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (useGetter) { const v = liveGet(); setAutoLive(Number.isFinite(v) ? v : undefined) }
      else {
        const t = getClock ? getClock() : null
        if (typeof t === 'number') setAutoLive(evalExpr(value, t))
        else if (audioBound) setAutoLive(evalExpr(value, 0)) // audio-only: t is irrelevant
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [exprBound, exprBad, getClock, value, liveGet, audioActive, audioBound])

  const effLive = Number.isFinite(liveValue) ? liveValue : autoLive
  const hasLive  = Number.isFinite(effLive)

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
  const rangeValue = hasLive
    ? Math.max(min, Math.min(max, effLive))
    : (exprBound ? min : value)

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
      // Track (drag) is the soft range; typing is free unless `clamp` is set.
      const next = clamp ? Math.max(min, Math.min(max, num)) : num
      onChange(next)
      setDraft(fmtNum(next))
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
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !exprBound) {
      e.preventDefault()
      const dir = e.key === 'ArrowUp' ? 1 : -1
      const raw = Number(value) + dir * step
      const next = clamp ? Math.max(min, Math.min(max, raw)) : raw
      if (onChange) onChange(next)
      setDraft(fmtNum(next))
      setEditing(false)
    }
  }

  // While expression-bound and not editing, show the live resolved number in the
  // box (so it visibly animates); the expression itself is shown on focus.
  const boxValue = (hasLive && !editing) ? fmtNum(effLive) : draft

  return (
    <div className={`${variantClass} gap-3 shadow-none ${className}`}>
      {label && (
        <label
          /* `labeled` = the DS meta text style; the label hugs (w-fit) unless an
             explicit `labelWidth` is passed to reserve a fixed alignment column.
             Inline colour beats `.control-slider label { color: fg-80 }`. */
          className={`uppercase tracking-widest whitespace-nowrap shrink-0 ${labeled || labelWidth != null ? 'kol-helper-10' : 'kol-helper-12'} ${labelWidth == null ? 'w-fit' : ''}`}
          style={{ ...(labeled || labelWidth != null ? { color: 'var(--kol-fg-meta)' } : null), ...(labelWidth != null ? { width: labelWidth } : null), ...(fontSize ? { fontSize } : null) }}
        >
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
        style={(exprBound || hasLive) ? { opacity: 0.4 } : undefined}
        title={exprBound ? `expression: ${value} — drag to override` : undefined}
      />
      <Input
        type="text"
        inputMode={exprBound ? 'text' : 'decimal'}
        variant="filled"
        size="sm"
        chars={exprBound ? Math.max(displayWidth, 10) : displayWidth}
        value={boxValue}
        style={raised ? { backgroundColor: 'var(--kol-surface-primary)' } : undefined}
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
