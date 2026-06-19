import { useEffect, useRef } from 'react'
import { startClock, tempoMillis } from './lib/clock.js'

/**
 * Mounts a single widget p5 factory into a host div, managing its lifecycle.
 * Remounts when factory/opts change (widgets take opts at construction, so a
 * param edit = recreate). Surfaces the canvas via onCanvas for download.
 */
export default function WidgetMount({ factory, opts, playing = true, onCanvas, themed = false }) {
  const hostRef = useRef(null)
  const instRef = useRef(null)

  useEffect(() => {
    const node = hostRef.current
    // factories are p5 instances OR DOM widgets (codeScroll) that return nothing
    // and append directly + hang _cleanup on their element. Tolerate both.
    const inst = factory({ host: node, ...opts })
    instRef.current = inst
    // route the widget's clock through the shared tempo clock so the footer
    // Transport tempo scales its animation (widgets read time via p.millis()).
    startClock()
    if (inst && typeof inst.millis === 'function') inst.millis = () => tempoMillis()
    const cv = node.querySelector('canvas')
    if (cv) { cv.style.imageRendering = 'pixelated'; cv.style.display = 'block' }
    onCanvas?.(cv || null)
    if (playing) inst?.loop?.(); else inst?.noLoop?.()
    node.querySelectorAll('*').forEach((n) => n._setPlaying?.(playing)) // DOM widgets (codeScroll)
    return () => {
      inst?.remove?.()
      node.querySelectorAll('*').forEach((n) => n._cleanup?.())
      node.innerHTML = ''
      instRef.current = null
      onCanvas?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factory, JSON.stringify(opts)])

  useEffect(() => {
    const inst = instRef.current
    if (playing) inst?.loop?.(); else inst?.noLoop?.()
    // DOM widgets (e.g. codeScroll) expose _setPlaying instead of loop/noLoop.
    hostRef.current?.querySelectorAll('*').forEach((n) => n._setPlaying?.(playing))
  }, [playing])

  // .interfaces-page scope brings the canvas under the visibility-fix rule (p5
  // anti-FOUC hide); .bare keeps it inline-block (no page flex/padding). Chrome
  // elements need a themed .screen ancestor for their --fg/--dim vars.
  if (themed) {
    return (
      <div className="interfaces-page bare">
        <div className="screen theme-mono" style={{ width: 200 }} ref={hostRef} />
      </div>
    )
  }
  return <div ref={hostRef} className="interfaces-page bare" />
}
