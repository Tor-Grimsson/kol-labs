import { useRef } from 'react'

/**
 * Trim timeline — a track with draggable in/out handles, the kept region
 * highlighted, and a playhead. Click the track to seek. All values in seconds.
 */
const fmt = (s) => {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return `${m}:${sec}`
}

export default function Timeline({ duration, inPoint, outPoint, current, onChangeIn, onChangeOut, onSeek }) {
  const trackRef = useRef(null)
  const dur = duration || 1
  const pct = (t) => `${(t / dur) * 100}%`

  const timeAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect()
    return Math.min(dur, Math.max(0, ((clientX - r.left) / r.width) * dur))
  }

  const drag = (e, kind) => {
    e.stopPropagation()
    const move = (ev) => {
      const t = timeAt(ev.clientX)
      if (kind === 'in') onChangeIn(Math.min(t, outPoint - 0.05))
      else if (kind === 'out') onChangeOut(Math.max(t, inPoint + 0.05))
      else onSeek(t)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    move(e)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        className="relative h-10 rounded bg-fg-08 cursor-pointer"
        onPointerDown={(e) => drag(e, 'seek')}
      >
        {/* trimmed-away regions dimmed */}
        <div className="absolute inset-y-0 left-0 bg-surface-primary/60 rounded-l" style={{ width: pct(inPoint) }} />
        <div className="absolute inset-y-0 right-0 bg-surface-primary/60 rounded-r" style={{ left: pct(outPoint) }} />
        {/* kept region */}
        <div className="absolute inset-y-0 border-y-2 border-[var(--kol-accent-primary)]" style={{ left: pct(inPoint), width: pct(outPoint - inPoint) }} />
        {/* playhead — line + knob, sits above the trim handles */}
        <div className="absolute inset-y-0 w-0.5 -ml-px bg-[var(--kol-accent-primary)] pointer-events-none z-10 shadow-[0_0_2px_rgba(0,0,0,0.8)]" style={{ left: pct(current) }} />
        <div className="absolute -top-1 w-2.5 h-2.5 -ml-[5px] rounded-full bg-[var(--kol-accent-primary)] pointer-events-none z-10 shadow-[0_0_2px_rgba(0,0,0,0.8)]" style={{ left: pct(current) }} />
        {/* in handle */}
        <div
          className="absolute inset-y-0 w-2 -ml-1 bg-[var(--kol-accent-primary)] rounded cursor-ew-resize"
          style={{ left: pct(inPoint) }}
          onPointerDown={(e) => drag(e, 'in')}
        />
        {/* out handle */}
        <div
          className="absolute inset-y-0 w-2 -ml-1 bg-[var(--kol-accent-primary)] rounded cursor-ew-resize"
          style={{ left: pct(outPoint) }}
          onPointerDown={(e) => drag(e, 'out')}
        />
      </div>
      <div className="flex justify-between kol-helper-10 text-meta mt-1 tabular-nums">
        <span>in {fmt(inPoint)}</span>
        <span>{fmt(current)} / {fmt(dur)}</span>
        <span>out {fmt(outPoint)}</span>
      </div>
    </div>
  )
}
