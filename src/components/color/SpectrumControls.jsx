import { useCallback, useEffect, useRef } from 'react'

/**
 * HueStrip + SBSquare — colour-picker spectrum widgets ported verbatim from
 * kol-client-kolkrabbi `src/editor/color/SpectrumControls.jsx` (the canonical
 * structural reference). Hand-tuned visuals (specific gradients, inset math,
 * handle sizes). DO NOT refactor pieces to atoms — the look and the math are
 * intentional and match the Ref design.
 *
 *   <HueStrip hue onChange />
 *     — 1D hue slider (12px tall) with a knob constrained inside the box.
 *   <SBSquare hue sat val onChange />
 *     — 2D saturation/value picker. Fills its container; gradient is
 *       white→hue horizontally with a black overlay fading up.
 *
 * Ranges: hue 0–360, sat/val 0–100 (see ./hsv.js).
 */

/* Handle radius (px) used to inset both the handle's positioning area AND the
 * drag hit-test math so the knob always renders inside the spectrum frame. */
const HANDLE_R = 7

const HUE_GRADIENT =
  'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))'

export function HueStrip({ hue, onChange }) {
  const ref = useRef(null)
  const dragging = useRef(false)

  const update = useCallback((clientX) => {
    const node = ref.current
    if (!node) return
    const rect  = node.getBoundingClientRect()
    const inner = rect.width - 2 * HANDLE_R
    if (inner <= 0) return
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left - HANDLE_R) / inner))
    onChange(ratio * 360)
  }, [onChange])

  const onDown = (e) => {
    dragging.current = true
    update(e.clientX)
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) update(e.clientX) }
    const onUp   = ()  => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [update])

  const pos = (hue / 360) * 100

  return (
    <div
      ref={ref}
      onMouseDown={onDown}
      className="relative rounded-[2px] cursor-pointer"
      style={{ height: 12, background: HUE_GRADIENT }}
    >
      <div className="absolute inset-y-0" style={{ left: HANDLE_R, right: HANDLE_R }}>
        <Handle left={`${pos}%`} top="50%" />
      </div>
    </div>
  )
}

export function SBSquare({ hue, sat, val, onChange }) {
  const ref = useRef(null)
  const dragging = useRef(false)

  const update = useCallback((clientX, clientY) => {
    const node = ref.current
    if (!node) return
    const rect   = node.getBoundingClientRect()
    const innerW = rect.width  - 2 * HANDLE_R
    const innerH = rect.height - 2 * HANDLE_R
    if (innerW <= 0 || innerH <= 0) return
    const sx = Math.max(0, Math.min(1, (clientX - rect.left - HANDLE_R) / innerW))
    const sy = Math.max(0, Math.min(1, (clientY - rect.top  - HANDLE_R) / innerH))
    onChange(sx * 100, (1 - sy) * 100)
  }, [onChange])

  const onDown = (e) => {
    dragging.current = true
    update(e.clientX, e.clientY)
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) update(e.clientX, e.clientY) }
    const onUp   = ()  => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [update])

  const sb = `linear-gradient(to bottom, transparent 0%, var(--kol-color-absolute-black) 100%), linear-gradient(to right, var(--kol-color-absolute-white) 0%, hsl(${hue},100%,50%) 100%)`
  /* Gradient field is rectangular — rounding is the consumer's job (apply
   * `rounded-[2px] overflow-hidden` on the wrapper). */
  return (
    <div
      ref={ref}
      onMouseDown={onDown}
      className="relative cursor-crosshair w-full h-full"
      style={{ background: sb }}
    >
      <div className="absolute" style={{ inset: HANDLE_R }}>
        <Handle left={`${sat}%`} top={`${100 - val}%`} />
      </div>
    </div>
  )
}

/* DOM handle for HueStrip / SBSquare. Solid white-stroked circle with thin
 * black halo (matching the macOS-port look). */
function Handle({ left, top }) {
  return (
    <span
      className="absolute pointer-events-none rounded-full bg-fg"
      style={{
        left, top,
        width: 14, height: 14,
        transform: 'translate(-50%, -50%)',
        boxShadow: 'var(--kol-shadow-halo)',
      }}
    />
  )
}
