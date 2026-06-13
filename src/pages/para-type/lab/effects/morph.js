/* Letter-to-letter morphing via flubber. */

import { interpolate } from 'flubber'

/* Build an interpolator d(t) ∈ [0,1] that morphs path A to path B. */
export function morphInterpolator(dA, dB) {
  try {
    return interpolate(dA, dB, { maxSegmentLength: 4 })
  } catch {
    return () => dA
  }
}

/* Convenience: get the morphed path-d at time t. */
export function morphAt(dA, dB, t) {
  const fn = morphInterpolator(dA, dB)
  return fn(Math.max(0, Math.min(1, t)))
}
