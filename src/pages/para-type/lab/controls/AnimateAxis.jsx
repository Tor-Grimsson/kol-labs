/* AnimateAxis — small play/pause button that auto-loops a single param
 * between its min and max. Inspired by axis-praxis.org's per-axis animate
 * buttons.
 *
 * Caller owns the actual value; we just call `onChange` with sin-wave
 * values when active. */

import { useEffect, useRef, useState } from 'react'
import Button from '../../../../components/atoms/Button.jsx'

export default function AnimateAxis({ min, max, period = 3, onChange }) {
  const [active, setActive] = useState(false)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now) => {
      const t = ((now - start) / 1000 / period) % 1
      const sine = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2)
      onChange?.(min + sine * (max - min))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, min, max, period, onChange])

  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly={active ? 'control-pause' : 'control-play'}
      iconSize={12}
      onClick={() => setActive(a => !a)}
      quiet
    />
  )
}
