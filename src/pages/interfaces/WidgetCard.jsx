import { useEffect, useRef, useState } from 'react'
import ScaleToFit from './ScaleToFit.jsx'
import WidgetMount from './WidgetMount.jsx'

/** A catalog tile: one element variant (opts) at a fixed preview size, with
 *  label. Lazy-mounts when scrolled into view (the catalog is ~40 tiles). */
export default function WidgetCard({ widget, opts, label, playing, focused, onClick }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  // Library tiles don't auto-play — they animate only while hovered.
  const active = playing && hovered
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => { if (focused) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [focused])
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex flex-col gap-1 text-left"
    >
      <ScaleToFit className={`h-28 w-full rounded bg-black border transition-colors p-2 ${focused ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-fg-08 group-hover:border-fg-24'}`}>
        {visible && <WidgetMount factory={widget.factory} opts={opts ?? widget.defaults} playing={active} themed={widget.themed} />}
      </ScaleToFit>
      <span className="kol-helper-10 text-meta group-hover:text-emphasis transition-colors truncate">{label ?? widget.label}</span>
    </button>
  )
}
