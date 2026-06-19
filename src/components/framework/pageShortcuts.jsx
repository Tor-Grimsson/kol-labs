import { createContext, useContext, useEffect, useRef, useState } from 'react'

/**
 * Lets the active page publish its own keyboard shortcuts into the global `s`
 * overlay (ShortcutsOverlay). The provider wraps both the page <Outlet/> and the
 * overlay in AppShell, so a page can set its shortcuts while mounted and the
 * overlay renders them under a per-page heading.
 *
 *   usePublishShortcuts('Penrose', [['drag', 'pan'], ['← / →', 'step']])
 *
 * Shape: { title: string, items: [keys, description][] }
 *
 * Pages also register a reset callback via usePublishReset(fn) — fired globally
 * when the user presses `r` (outside an input). The handler runs the latest fn
 * through a ref so pages don't need useCallback.
 */
const PageShortcutsContext = createContext(null)

export function PageShortcutsProvider({ children }) {
  const [shortcuts, setShortcuts] = useState(null)
  // Parallel channel for the `i` extra-info overlay (page metadata: seed, etc.).
  const [info, setInfo] = useState(null)
  // Reset callback: pages publish via usePublishReset; cleared on unmount.
  const resetRef = useRef(null)
  // Retrigger callback: pages publish via usePublishRetrigger (Shift+R).
  const retriggerRef = useRef(null)
  return (
    <PageShortcutsContext.Provider value={{ shortcuts, setShortcuts, info, setInfo, resetRef, retriggerRef }}>
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

// Same mechanism as usePublishShortcuts, for the `i` info overlay. Items are
// [label, value] rows of page metadata (e.g. ['Seed', '1234']).
export function usePublishInfo(title, items) {
  const ctx = useContext(PageShortcutsContext)
  const setInfo = ctx?.setInfo
  const key = JSON.stringify(items)
  useEffect(() => {
    if (!setInfo) return undefined
    setInfo({ title, items })
    return () => setInfo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setInfo, title, key])
}

// Overlay reader: the current page's info, or null.
export function usePageInfo() {
  return useContext(PageShortcutsContext)?.info ?? null
}

// Page hook: register a reset-to-defaults handler fired by the global `r` key.
// The fn is stored through a ref so callers don't need useCallback.
export function usePublishReset(fn) {
  const ctx = useContext(PageShortcutsContext)
  const resetRef = ctx?.resetRef
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!resetRef) return undefined
    resetRef.current = () => fnRef.current?.()
    return () => { resetRef.current = null }
  }, [resetRef])
}

// Overlay hook: returns the resetRef so the key handler can fire it without
// triggering a re-render when it changes.
export function usePageReset() {
  return useContext(PageShortcutsContext)?.resetRef ?? null
}

// Page hook: register a retrigger handler fired by the global Shift+R key.
// "Retrigger" = generate something new (fresh seed / reroll), distinct from
// reset which restores defaults. Pages that don't have a reroll concept skip this.
export function usePublishRetrigger(fn) {
  const ctx = useContext(PageShortcutsContext)
  const retriggerRef = ctx?.retriggerRef
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!retriggerRef) return undefined
    retriggerRef.current = () => fnRef.current?.()
    return () => { retriggerRef.current = null }
  }, [retriggerRef])
}

export function usePageRetrigger() {
  return useContext(PageShortcutsContext)?.retriggerRef ?? null
}
