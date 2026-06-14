import { useEffect, useRef, useState } from 'react'
import ScaleToFit from './ScaleToFit.jsx'

/**
 * A gallery tile for one screen. Lazy-mounts the screen's build() only when
 * scrolled into view (50 screens × many p5 loops would melt the tab otherwise)
 * and pauses its instances when off-screen.
 */
export default function ScreenTile({ def, playing, onClick }) {
  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const instancesRef = useRef([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px' })
    if (wrapRef.current) io.observe(wrapRef.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const node = hostRef.current
    const instances = def.build(node)
    instancesRef.current = instances
    const cleanups = []
    node.querySelectorAll('*').forEach((n) => { if (n._cleanup) cleanups.push(n._cleanup) })
    for (const p of instances) playing ? p.loop() : p.noLoop()
    return () => {
      for (const p of instances) p.remove()
      for (const c of cleanups) c()
      instancesRef.current = []
      node.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  useEffect(() => {
    for (const p of instancesRef.current) playing ? p.loop() : p.noLoop()
  }, [playing, visible])

  return (
    <button ref={wrapRef} type="button" onClick={onClick} className="group flex flex-col gap-1 text-left">
      <ScaleToFit className="h-44 w-full rounded border border-fg-08 group-hover:border-fg-24 transition-colors">
        <div className="interfaces-page bare">
          <div className={`screen theme-${def.theme ?? 'default'}`} ref={hostRef} />
        </div>
      </ScaleToFit>
      <span className="kol-helper-10 text-meta group-hover:text-emphasis transition-colors truncate">
        {def.id} · {def.title}
      </span>
    </button>
  )
}
