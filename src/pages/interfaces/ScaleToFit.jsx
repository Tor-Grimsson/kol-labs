import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Renders children at their natural size and CSS-scales them to fit the box,
 * preserving aspect — the responsive strategy for the fixed-pixel lofi screens
 * (keeps pixels crisp instead of reflowing). Used by the player, gallery tiles,
 * and library cards alike. Children mount imperatively (p5), so a ResizeObserver
 * on the inline-block content catches the canvas appearing after mount.
 */
export default function ScaleToFit({ children, className = '' }) {
  const boxRef = useRef(null)
  const contentRef = useRef(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const box = boxRef.current
    const content = contentRef.current
    if (!box || !content) return
    const fit = () => {
      const cw = content.offsetWidth
      const ch = content.offsetHeight
      if (!cw || !ch) return
      setScale(Math.min(box.clientWidth / cw, box.clientHeight / ch))
    }
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    ro.observe(content)
    fit()
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={boxRef} className={`flex items-center justify-center overflow-hidden ${className}`}>
      <div
        ref={contentRef}
        style={{ display: 'inline-block', transform: `scale(${scale})`, transformOrigin: 'center', visibility: scale ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </div>
  )
}
