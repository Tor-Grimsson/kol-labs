// liveClock — a React context carrying the current engine playhead `t` (seconds)
// so an expression-bound Slider can self-animate: it reads `t` each frame and
// evaluates its own expression (the SAME t/exprParam the engine resolves with),
// moving the thumb + readout in lockstep with the canvas. No per-slider wiring —
// a page wraps its rail in <LiveClock getT={…}> once, every expr Slider inside
// follows. Pages with no playhead simply don't provide it (Slider falls back to
// the parked, expression-text behaviour).
//
//   <LiveClock getT={() => progressRef.current.t}> …rail with Sliders… </LiveClock>

import { createContext, useContext, useRef } from 'react'

// Value is a STABLE function () => number|null returning the live playhead.
export const LiveClockContext = createContext(null)

export function useLiveClock() { return useContext(LiveClockContext) }

export function LiveClock({ getT, children }) {
  // Keep the latest getT in a ref and expose ONE stable accessor, so providing a
  // fresh inline getT each render never re-renders the consuming Sliders.
  const ref = useRef(getT)
  ref.current = getT
  const stable = useRef(() => {
    const fn = ref.current
    if (typeof fn !== 'function') return null
    const t = fn()
    return typeof t === 'number' ? t : null
  }).current
  return <LiveClockContext.Provider value={stable}>{children}</LiveClockContext.Provider>
}
