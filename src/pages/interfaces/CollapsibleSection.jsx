import { useState } from 'react'
import Icon from '../../components/loaders/Icon.jsx'

/**
 * CollapsibleSection — a Section whose body folds away behind its label, so a
 * rail full of blocks stays scannable: you press the name to reveal the
 * controls. Collapsed by default (`defaultOpen` to flip). Matches the DS
 * Section label styling.
 */
export default function CollapsibleSection({ label, children, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-left hover:text-emphasis transition-colors"
      >
        <span className="kol-helper-10 uppercase tracking-widest text-meta">{label}</span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
      </button>
      {open && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  )
}
