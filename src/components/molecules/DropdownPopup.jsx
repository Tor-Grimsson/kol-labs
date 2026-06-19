import { useState } from 'react'
import { usePopover, PopoverPanel } from './Popover.jsx'

/**
 * DropdownPopup — a trigger button that opens a popover list of ACTIONS.
 *
 * Distinct from `Dropdown`: that is a value-select (shows the current selection
 * as its label, persists a chosen value via onChange). DropdownPopup's trigger
 * is fixed (an icon or label), and each row fires `onSelect` then closes — for
 * "load this preset" / "insert this snippet" pickers (e.g. the Expression Ex
 * menu, mirroring kol-monitor's Scope+ EX dropdown).
 *
 * Borderless by design (the bordered `.kol-popover` reads wrong for an inline
 * pop-up menu); keeps the surface + shadow + 4px radius chrome.
 *
 *   <DropdownPopup
 *     trigger={<Icon name="list-unordered" size={16} />}
 *     ariaLabel="Examples"
 *     items={EXAMPLES}                       // [{ ... }] — any shape
 *     getLabel={(it) => it.code}             // left text   (default: it.label)
 *     getHint={(it) => it.desc}              // right text  (default: it.hint)
 *     onSelect={(it, e) => pick(it.code, e)} // fires, then closes
 *   />
 *
 * Props:
 *   trigger          — node rendered inside the trigger button (icon or text).
 *   items            — array of arbitrary item objects.
 *   onSelect         — (item, event) => void. Closes the menu after.
 *   getLabel/getHint — accessors for the row's left / right text.
 *   placement        — floating-ui placement (default 'bottom-end').
 *   ariaLabel/title  — accessibility + tooltip for the trigger.
 *   triggerClassName — override the trigger chrome.
 *   minWidth/maxHeight — panel sizing (px).
 */
const DEFAULT_TRIGGER_CLS =
  'shrink-0 inline-flex items-center justify-center text-body hover:text-emphasis bg-surface-secondary px-2.5 rounded'

export default function DropdownPopup({
  trigger,
  items = [],
  onSelect,
  getLabel = (it) => it.label,
  getHint = (it) => it.hint,
  placement = 'bottom-end',
  ariaLabel,
  title,
  triggerClassName = DEFAULT_TRIGGER_CLS,
  minWidth = 240,
  maxHeight = 320,
}) {
  const [open, setOpen] = useState(false)
  const popover = usePopover({ open, onOpenChange: setOpen, placement, offset: 4 })

  return (
    <>
      <button
        ref={popover.refs.setReference}
        {...popover.getReferenceProps()}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
      >{trigger}</button>

      <PopoverPanel popover={popover} focus={false} style={{ border: 'none' }}>
        <div className="flex flex-col overflow-y-auto" style={{ minWidth, maxHeight }} role="menu">
          {items.map((it, i) => {
            const hint = getHint(it)
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={(e) => { onSelect?.(it, e); setOpen(false) }}
                className="flex justify-between items-center gap-4 px-2 py-1 text-left hover:bg-surface-secondary"
                style={{ borderRadius: 2 }}
              >
                <span className="kol-mono-12 text-emphasis whitespace-nowrap">{getLabel(it)}</span>
                {hint != null && <span className="kol-mono-12 text-meta whitespace-nowrap">{hint}</span>}
              </button>
            )
          })}
        </div>
      </PopoverPanel>
    </>
  )
}
