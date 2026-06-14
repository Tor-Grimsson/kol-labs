/**
 * CropBox — a draggable / resizable rectangle overlaying the video preview.
 * Crop is normalised {x,y,w,h} in 0..1 of the source frame. Fills its parent
 * (which must be position:relative and sized exactly to the rendered video).
 *
 * `aspect` (pixel w:h, or null for free) locks the ratio while resizing —
 * computed against the source dimensions so a "1:1" box is square in *pixels*,
 * not in the displayed element.
 */
const clamp01 = (n) => Math.min(1, Math.max(0, n))

export default function CropBox({ crop, onChange, aspect, meta }) {
  // normalised height for a given normalised width under the pixel aspect lock
  const lockH = (w) => (aspect && meta ? clamp01((w * meta.width) / (aspect * meta.height)) : null)

  const start = (e, mode) => {
    e.preventDefault()
    e.stopPropagation()
    const parent = e.currentTarget.closest('[data-cropbox]')
    const r = parent.getBoundingClientRect()
    const base = { ...crop }
    const ox = (e.clientX - r.left) / r.width
    const oy = (e.clientY - r.top) / r.height

    const move = (ev) => {
      const nx = (ev.clientX - r.left) / r.width
      const ny = (ev.clientY - r.top) / r.height
      const dx = nx - ox
      const dy = ny - oy
      let next = { ...base }

      if (mode === 'move') {
        next.x = clamp01(base.x + dx)
        next.y = clamp01(base.y + dy)
        next.x = Math.min(next.x, 1 - base.w)
        next.y = Math.min(next.y, 1 - base.h)
      } else {
        // corner resize — keep the opposite corner pinned
        const right = base.x + base.w
        const bottom = base.y + base.h
        if (mode.includes('e')) next.w = clamp01(nx - base.x)
        if (mode.includes('s')) next.h = clamp01(ny - base.y)
        if (mode.includes('w')) { next.x = clamp01(nx); next.w = right - next.x }
        if (mode.includes('n')) { next.y = clamp01(ny); next.h = bottom - next.y }
        next.w = Math.max(0.03, next.w)
        next.h = Math.max(0.03, next.h)
        const lh = lockH(next.w)
        if (lh != null) {
          // grow/shrink height from the same anchored corner
          if (mode.includes('n')) next.y = bottom - lh
          next.h = lh
        }
      }
      onChange(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const box = {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.w * 100}%`,
    height: `${crop.h * 100}%`,
  }
  const handle = 'absolute w-3 h-3 bg-[var(--kol-accent-primary)] rounded-sm'

  return (
    <div data-cropbox className="absolute inset-0">
      {/* darkened outside via a ring shadow on the box */}
      <div
        className="absolute border border-[var(--kol-accent-primary)] cursor-move"
        style={{ ...box, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
        onPointerDown={(e) => start(e, 'move')}
      >
        <div className={`${handle} -left-1.5 -top-1.5 cursor-nwse-resize`} onPointerDown={(e) => start(e, 'nw')} />
        <div className={`${handle} -right-1.5 -top-1.5 cursor-nesw-resize`} onPointerDown={(e) => start(e, 'ne')} />
        <div className={`${handle} -left-1.5 -bottom-1.5 cursor-nesw-resize`} onPointerDown={(e) => start(e, 'sw')} />
        <div className={`${handle} -right-1.5 -bottom-1.5 cursor-nwse-resize`} onPointerDown={(e) => start(e, 'se')} />
      </div>
    </div>
  )
}
