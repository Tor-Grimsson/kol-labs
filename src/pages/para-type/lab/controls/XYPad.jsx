/* 2D control pad — pick two axes and drag a single puck to vary both.
 * Inspired by Font Playground (play.typedetail.com). */

import { useCallback, useRef } from 'react'

export default function XYPad({
  xValue, yValue,
  xMin = 0, xMax = 1,
  yMin = 0, yMax = 1,
  onChange,
  xLabel,
  yLabel,
  size = 160,
  className = '',
}) {
  const ref = useRef(null)

  const handlePos = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const x = xMin + px * (xMax - xMin)
    const y = yMax - py * (yMax - yMin) /* invert: top = high */
    onChange?.(x, y)
  }

  const onPointerDown = useCallback((e) => {
    e.target.setPointerCapture?.(e.pointerId)
    handlePos(e)
  }, [])
  const onPointerMove = useCallback((e) => {
    if (e.buttons === 0) return
    handlePos(e)
  }, [])

  const puckX = ((xValue - xMin) / (xMax - xMin)) * size
  const puckY = (1 - (yValue - yMin) / (yMax - yMin)) * size

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex justify-between kol-helper-10 tracking-widest text-meta">
        <span>{xLabel}</span>
        <span>{yLabel}</span>
      </div>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        className="relative border border-fg-16 bg-fg-04 rounded cursor-crosshair touch-none"
        style={{ width: size, height: size }}
      >
        {/* crosshair guides */}
        <div className="absolute inset-x-0 top-1/2 border-t border-fg-08" />
        <div className="absolute inset-y-0 left-1/2 border-l border-fg-08" />
        {/* puck */}
        <div
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-fg-96 border border-fg-04 pointer-events-none"
          style={{ left: puckX, top: puckY }}
        />
      </div>
    </div>
  )
}
