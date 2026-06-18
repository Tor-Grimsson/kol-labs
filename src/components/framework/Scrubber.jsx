import { useEffect, useRef } from 'react'

// Timeline scrubber overlay for a stage. The playhead is driven by a player's
// own rAF clock (reported into `progressRef` each frame as { t, dur }), NOT React
// state — this component runs its OWN rAF and writes the fill width / thumb
// position straight to the DOM, so a 60fps playhead never re-renders the page.
// Dragging calls `playerRef.current.seek(frac)`; the player is the single writer
// of time, so its next frame reports the seeked position back here (works while
// paused too). Consumers: uzumaki's CurvePlayer + the primitive-scene engine.
// `marks` (optional, fractions 0..1) draws static ticks on the track — e.g.
// camera keyframe positions.
export default function Scrubber({ progressRef, playerRef, marks = [] }) {
  const trackRef = useRef(null)
  const fillRef = useRef(null)
  const thumbRef = useRef(null)
  const endRef = useRef(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    let raf = 0
    let lastDur = -1
    const tick = () => {
      const { t = 0, dur = 1 } = progressRef.current || {}
      const frac = dur > 0 ? Math.max(0, Math.min(1, t / dur)) : 0
      const pct = `${frac * 100}%`
      if (fillRef.current) fillRef.current.style.width = pct
      if (thumbRef.current) thumbRef.current.style.left = pct
      if (dur !== lastDur && endRef.current) {
        endRef.current.textContent = `${dur.toFixed(1)}s`
        lastDur = dur
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [progressRef])

  const fracFromEvent = (e) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return 0
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    playerRef.current?.seek(fracFromEvent(e))
  }
  const onMove = (e) => {
    if (!draggingRef.current) return
    playerRef.current?.seek(fracFromEvent(e))
  }
  const onUp = (e) => {
    draggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-5 pb-4">
      <span className="kol-helper-10 text-meta shrink-0 tabular-nums">0.0s</span>
      <div
        ref={trackRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="relative flex-1 cursor-pointer touch-none py-2"
      >
        <div className="relative h-1.5 rounded-full bg-fg-16">
          {marks.map((m, i) => (
            <div
              key={i}
              className="absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-fg-48"
              style={{ left: `${Math.max(0, Math.min(1, m)) * 100}%` }}
            />
          ))}
          <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-full bg-fg-48" style={{ width: 0 }} />
          <div
            ref={thumbRef}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-96 shadow"
            style={{ left: 0 }}
          />
        </div>
      </div>
      <span ref={endRef} className="kol-helper-10 text-meta shrink-0 tabular-nums">0.0s</span>
    </div>
  )
}
