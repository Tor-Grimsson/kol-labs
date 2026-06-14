import { useEffect, useRef, useState } from 'react'
import ScaleToFit from './ScaleToFit.jsx'
import WidgetMount from './WidgetMount.jsx'

/** A catalog tile: one element variant (opts) at a fixed preview size, with
 *  label. Lazy-mounts when scrolled into view (the catalog is ~40 tiles). */
export default function WidgetCard({ widget, opts, label, playing, onClick }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return (
    <button ref={ref} type="button" onClick={onClick} className="group flex flex-col gap-1 text-left">
      <ScaleToFit className="h-28 w-full rounded bg-black border border-fg-08 group-hover:border-fg-24 transition-colors p-2">
        {visible && <WidgetMount factory={widget.factory} opts={opts ?? widget.defaults} playing={playing} themed={widget.themed} />}
      </ScaleToFit>
      <span className="kol-helper-10 text-meta group-hover:text-emphasis transition-colors truncate">{label ?? widget.label}</span>
    </button>
  )
}
