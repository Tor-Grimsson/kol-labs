import { useEffect, useRef, useState } from 'react'
import Icon from '../loaders/Icon.jsx'
import { usePageInfo } from './pageShortcuts.jsx'

/**
 * App-wide extra-info overlay, toggled by pressing `i` (ignored while typing in
 * a field). Shows the active page's published metadata — seed, current
 * expression, etc. — as label/value rows, so that kind of reference info lives
 * here instead of taking up rail space.
 *
 * The `i` key is only intercepted when the current page has published info, so
 * pages that bind `i` for their own purpose (e.g. video's in-point) are
 * unaffected on pages without info.
 */
const isTyping = (el) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export default function InfoOverlay() {
  const [open, setOpen] = useState(false)
  const page = usePageInfo()
  const pageRef = useRef(page)
  pageRef.current = page

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (isTyping(document.activeElement)) return
      if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!pageRef.current) return // no info published → don't intercept this page's own `i`
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open || !page) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Page info"
    >
      <div
        className="relative w-full max-w-md max-h-[80dvh] overflow-y-auto rounded-lg border border-fg-08 bg-surface-primary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-meta hover:text-emphasis"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          <Icon name="x" size={16} />
        </button>

        <div className="kol-helper-12 uppercase tracking-widest text-meta">Info</div>
        <div className="kol-helper-12 uppercase tracking-widest text-meta mt-4 mb-2">{page.title}</div>

        <div className="flex flex-col gap-1.5">
          {page.items?.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-3">
              <span className="kol-mono-12 text-meta shrink-0 w-28">{label}</span>
              <span className="kol-mono-12 text-emphasis break-all">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-4 border-t border-fg-08 pt-3">
          <span className="kol-helper-10 text-meta"><kbd className="text-emphasis">I</kbd> toggle this</span>
          <span className="kol-helper-10 text-meta"><kbd className="text-emphasis">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
