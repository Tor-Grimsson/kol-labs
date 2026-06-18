import { useEffect, useRef } from 'react'

const isTyping = (el) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

/**
 * useViewportZoom — the standard viewport-navigation bindings, matching the
 * Expression scope:
 *
 *   = / +  → zoom in        ( zoom(step) )
 *   -      → zoom out        ( zoom(1/step) )
 *   0      → reset framing   ( reset() )
 *   wheel / two-finger over targetRef → zoom (deltaY < 0 = in)
 *
 * Keys are global (window, ignored while a form field is focused). The wheel is
 * scoped to `targetRef` so scrolling the rail isn't hijacked — OMIT targetRef
 * when the engine already owns its own wheel-zoom (e.g. Viewport3D). Handlers
 * are read through a ref so the listeners subscribe once and never churn.
 *
 * `zoom(factor)` multiplies the current zoom; factor > 1 zooms in.
 */
export function useViewportZoom({ zoom, reset, targetRef = null, step = 1.15, wheelStep = 1.1 }) {
  const h = useRef({})
  h.current = { zoom, reset, step, wheelStep }

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(document.activeElement)) return
      const c = h.current
      if (e.key === '=' || e.key === '+') { e.preventDefault(); c.zoom?.(c.step) }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); c.zoom?.(1 / c.step) }
      else if (e.key === '0') { e.preventDefault(); c.reset?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const el = targetRef?.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const c = h.current
      c.zoom?.(e.deltaY < 0 ? c.wheelStep : 1 / c.wheelStep)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [targetRef])
}
