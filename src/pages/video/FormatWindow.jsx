import { useEffect, useRef } from 'react'
import { windowRect } from './data/projects.js'

/**
 * The output window for a format — an aspect-locked rectangle laid OVER the
 * (unchanged) source. Drag to move it, scroll to zoom it. Everything outside
 * the window is dimmed; what's inside is the export, scaled to the format dims.
 * The source itself is never transformed.
 */
const clamp = (n, a, b) => Math.min(b, Math.max(a, n))

export default function FormatWindow({ ratio, meta, params, onParams }) {
  const ref = useRef(null)
  const rect = windowRect(meta.width, meta.height, ratio, params)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      onParams({ ...params, zoom: clamp(params.zoom * (1 - e.deltaY * 0.0015), 1, 5) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [params, onParams])

  const startDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const r = ref.current.getBoundingClientRect()
    const base = { ...params }
    const ox = e.clientX, oy = e.clientY
    const move = (ev) => {
      onParams({
        ...base,
        ox: clamp(base.ox + (ev.clientX - ox) / r.width, 0, 1),
        oy: clamp(base.oy + (ev.clientY - oy) / r.height, 0, 1),
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const box = { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }

  return (
    <div ref={ref} className="absolute inset-0">
      <div
        className="absolute border border-[var(--kol-accent-primary)] cursor-move"
        style={{ ...box, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
        onPointerDown={startDrag}
      >
        <div className="absolute inset-y-0 left-1/3 w-px bg-[var(--kol-accent-primary)]/30" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-[var(--kol-accent-primary)]/30" />
        <div className="absolute inset-x-0 top-1/3 h-px bg-[var(--kol-accent-primary)]/30" />
        <div className="absolute inset-x-0 top-2/3 h-px bg-[var(--kol-accent-primary)]/30" />
      </div>
    </div>
  )
}
