/**
 * Shared virtual clock for the Tempo control. Every interfaces p5 widget reads
 * time through this (its `millis()` is overridden at mount), so one slider
 * scales all animation at once. Advanced once per rAF — NOT per widget call —
 * so N widgets sampling the same frame don't over-integrate the elapsed time.
 *
 * scale 0 = frozen · 1 = realtime · 2 = double speed.
 */
let scale = 1
let virtual = 0
let last = 0
let raf = null

function tick() {
  const now = performance.now()
  virtual += (now - last) * scale
  last = now
  raf = requestAnimationFrame(tick)
}

export function startClock() {
  if (raf != null) return
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

export function tempoMillis() { return virtual }

/** Rewind the virtual clock to 0 (no time-jump). Drives the transport's rewind
 *  button — every clock-driven widget restarts from the start of its cycle. */
export function resetClock() { virtual = 0; last = performance.now() }

export function setTempoScale(s) { scale = Math.max(0, s) }

/** Current tempo scale (0 = frozen, 1 = realtime, 2 = 2×) — lets the
 *  setInterval-driven DOM widgets pace their repaint with the same slider. */
export function tempoScale() { return scale }
