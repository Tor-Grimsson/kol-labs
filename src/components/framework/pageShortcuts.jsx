import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Lets the active page publish its own keyboard shortcuts into the global `s`
 * overlay (ShortcutsOverlay). The provider wraps both the page <Outlet/> and the
 * overlay in AppShell, so a page can set its shortcuts while mounted and the
 * overlay renders them under a per-page heading.
 *
 *   usePublishShortcuts('Penrose', [['drag', 'pan'], ['← / →', 'step']])
 *
 * Shape: { title: string, items: [keys, description][] }
 */
const PageShortcutsContext = createContext(null)

export function PageShortcutsProvider({ children }) {
  const [shortcuts, setShortcuts] = useState(null)
  return (
    <PageShortcutsContext.Provider value={{ shortcuts, setShortcuts }}>
      {children}
    </PageShortcutsContext.Provider>
  )
}

// Page hook: publish on mount, clear on unmount.
export function usePublishShortcuts(title, items) {
  const ctx = useContext(PageShortcutsContext)
  const setShortcuts = ctx?.setShortcuts
  const key = JSON.stringify(items)
  useEffect(() => {
    if (!setShortcuts) return undefined
    setShortcuts({ title, items })
    return () => setShortcuts(null)
    // key stringifies items so an inline array doesn't re-fire every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setShortcuts, title, key])
}

// Overlay reader: the current page's shortcuts, or null.
export function usePageShortcuts() {
  return useContext(PageShortcutsContext)?.shortcuts ?? null
}
