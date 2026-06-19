import { useEffect, useRef, useState } from 'react'
import Input from '../atoms/Input'
import ColorSwatch from '../atoms/ColorSwatch'
import { usePopover, PopoverPanel } from '../molecules/Popover'
import ColorPicker from './ColorPicker'
import { clampHex } from './hsv'

/**
 * ColorField — the inline colour control. Modeled on the reference's
 * `compose/SwatchRow` (swatch chip + hex field), minus the brand-token column
 * (kol-labs has no brand ramps) and the palette-gen lock overlay. The swatch
 * opens the spectrum `ColorPicker` in a popover (the reference docks a modal;
 * we anchor to the swatch instead).
 *
 * Drop-in for the old `<input type="color">` pattern:
 *   <ColorField value={hex} onChange={(hex) => setX(hex)} />
 *
 * `onChange` receives a `#RRGGBB` string (NOT a DOM event). The hex field is
 * buffered locally so half-typed values never reach `onChange` — only a
 * complete 6-digit hex commits; blur reverts an incomplete entry.
 *
 * Props:
 *   value       — current colour (any hex form; normalised for display).
 *   onChange    — (hex) => void.
 *   presets     — override the picker's preset swatches.
 *   swatchSize  — chip size in px (default 24).
 *   className   — extra classes on the row wrapper.
 */
export default function ColorField({ value, onChange, label, labeled = false, presets, swatchSize = 24, className = '', raised = false }) {
  const hex = clampHex(value)
  const [open, setOpen] = useState(false)
  const popover = usePopover({ open, onOpenChange: setOpen, placement: 'bottom-start', offset: 6 })

  /* Buffered hex text: reflects keystrokes, but only a complete 6-digit value
   * commits up. Stays in sync with `value` while the field isn't focused. */
  const [text, setText] = useState(hex.replace(/^#/, ''))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(hex.replace(/^#/, ''))
  }, [hex])

  const onText = (e) => {
    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase()
    setText(v)
    if (v.length === 6) onChange('#' + v)
  }

  return (
    <div
      className={`${label ? 'grid' : 'flex'} items-center gap-2 ${className}`}
      style={label ? { gridTemplateColumns: `${swatchSize}px 1fr auto` } : undefined}
    >
      <button
        type="button"
        ref={popover.refs.setReference}
        {...popover.getReferenceProps()}
        className="inline-flex shrink-0 cursor-pointer rounded-[2px]"
        aria-label="Pick colour"
        title={hex}
      >
        <ColorSwatch hex={hex} size={swatchSize} radius="tight" />
      </button>

      {/* Optional in-row label — gives the SwatchRow layout [swatch] [label]
          [hex] (the reference compose Palette inspector). Omit it and the field
          is the plain [swatch] [hex] pair, label supplied by the call site. */}
      {label && (
        <span
          className={labeled ? 'kol-helper-10 truncate uppercase tracking-widest' : 'kol-helper-12 truncate text-emphasis'}
          style={labeled ? { color: 'var(--kol-fg-meta)' } : undefined}
        >{label}</span>
      )}

      <Input
        variant="filled"
        size="sm"
        prefix="#"
        chars={6}
        uppercase
        value={text}
        onChange={onText}
        onFocus={() => { focused.current = true }}
        onBlur={() => { focused.current = false; setText(hex.replace(/^#/, '')) }}
        maxLength={6}
        className={label ? '' : 'flex-1'}
        style={raised ? { backgroundColor: 'var(--kol-surface-primary)' } : undefined}
      />

      <PopoverPanel popover={popover}>
        <ColorPicker value={hex} onChange={onChange} presets={presets} />
      </PopoverPanel>
    </div>
  )
}
