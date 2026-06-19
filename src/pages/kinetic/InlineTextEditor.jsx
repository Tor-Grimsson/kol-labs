import { useEffect, useRef } from 'react'

// Double-click-to-edit overlay: a textarea positioned over the selected instance's
// live bbox, bound to its text. Commits on blur / Enter, cancels on Escape. Tracks
// the bbox each frame (DOM-written) so it follows the type as it animates.
export default function InlineTextEditor({ engineRef, selId, stage, value, onChange, onDone }) {
  const ref = useRef(null)
  const raf = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (el) { el.focus(); try { el.select() } catch { /* */ } }
  }, [])

  useEffect(() => {
    const tick = () => {
      raf.current = requestAnimationFrame(tick)
      const r = engineRef.current?.getInstanceRect?.(selId)
      const el = ref.current
      if (!r || !el) return
      const dx = (r.x + r.w / 2) - stage.w / 2
      const dy = (r.y + r.h / 2) - stage.h / 2
      el.style.width = `${Math.max(160, r.w)}px`
      el.style.transform = `translate(-50%, -50%) translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [engineRef, selId, stage.w, stage.h])

  return (
    <div className="absolute inset-0" style={{ zIndex: 6 }}>
      <textarea
        ref={ref}
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onDone}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onDone() }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onDone() }
        }}
        className="absolute left-1/2 top-1/2 resize-none outline-none text-center rounded px-2 py-1 kol-mono-12 bg-surface-primary text-emphasis border border-yellow-400 shadow-lg"
        style={{ minWidth: 160 }}
      />
    </div>
  )
}
