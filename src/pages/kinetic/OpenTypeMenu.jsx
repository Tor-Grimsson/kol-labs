import { useState } from 'react'
import Icon from '../../components/loaders/Icon.jsx'
import { MenuDropdownItem } from '../../components/molecules/MenuItem.jsx'
import { PopoverPanel, usePopover } from '../../components/molecules/Popover.jsx'
import { OPENTYPE_FEATURES } from './engine/opentype.js'

// Multi-select dropdown for OpenType features — one row per feature with a check
// mark when on; clicking toggles it and keeps the menu open (no single-pick close).
export default function OpenTypeMenu({ value = {}, onToggle }) {
  const [open, setOpen] = useState(false)
  const popover = usePopover({
    open, onOpenChange: setOpen,
    placement: 'bottom-start', offset: -1, flip: false, matchReferenceWidth: true, role: 'listbox',
  })
  const count = OPENTYPE_FEATURES.filter((f) => value[f.tag]).length

  return (
    <div className="relative w-full">
      <button
        ref={popover.refs.setReference}
        {...popover.getReferenceProps()}
        type="button"
        className="w-full flex items-center justify-between kol-mono-12 rounded"
        style={{
          border: '1px solid transparent',
          borderRadius: open ? '4px 4px 0 0' : '4px',
          backgroundColor: 'var(--kol-surface-secondary)',
          color: 'var(--kol-surface-on-primary)',
          padding: '4px 12px',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{count ? `${count} feature${count > 1 ? 's' : ''}` : 'None'}</span>
        <Icon name="chevron-down" size={10} className="ml-auto" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 300ms' }} />
      </button>
      <PopoverPanel
        popover={popover}
        panel={false}
        focus={false}
        style={{ backgroundColor: 'var(--kol-surface-secondary)', color: 'var(--kol-surface-on-primary)', borderRadius: '0 0 4px 4px' }}
      >
        <div className="flex max-h-[300px] flex-col items-stretch overflow-y-auto" role="listbox">
          {OPENTYPE_FEATURES.map((f) => (
            <MenuDropdownItem
              key={f.tag}
              onClick={() => onToggle(f.tag, !value[f.tag])}
              shortcut={value[f.tag] ? <Icon name="check" size={11} /> : undefined}
            >
              {f.label}
            </MenuDropdownItem>
          ))}
        </div>
      </PopoverPanel>
    </div>
  )
}
