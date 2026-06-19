import { useEffect, useRef } from 'react'
import ColorField from '../../components/color/ColorField.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Button from '../../components/atoms/Button.jsx'
import { fontByKey } from './lib/vfAxes.js'

// On-canvas container for the selected instance: a dashed bounding frame tracking
// the live glyph bbox, with corner handles to scale (font size) and a floating
// toolbar (align · italic · weight · fill · delete). Frame/toolbar position is
// written straight to the DOM each frame (the bbox animates) — no React re-render.

const ALIGN = [
  { value: 'start', label: '◧' },
  { value: 'center', label: '▣' },
  { value: 'end', label: '◨' },
]
const CORNERS = [
  { key: 'nw', style: { left: -5, top: -5, cursor: 'nwse-resize' } },
  { key: 'ne', style: { right: -5, top: -5, cursor: 'nesw-resize' } },
  { key: 'sw', style: { left: -5, bottom: -5, cursor: 'nesw-resize' } },
  { key: 'se', style: { right: -5, bottom: -5, cursor: 'nwse-resize' } },
]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default function SelectionFrame({ engineRef, selId, stage, instance, rectIds, onAlign, onWeight, onItalic, onFill, onSize, onDelete }) {
  const frameRef = useRef(null)
  const barRef = useRef(null)
  const raf = useRef(0)
  const drag = useRef(null)
  const idsRef = useRef(rectIds)
  idsRef.current = rectIds && rectIds.length ? rectIds : [selId]

  useEffect(() => {
    const tick = () => {
      raf.current = requestAnimationFrame(tick)
      const eng = engineRef.current
      const frame = frameRef.current
      const bar = barRef.current
      // union bbox over the selected instance(s) — one box around a whole group
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
      for (const id of idsRef.current) {
        const ir = eng?.getInstanceRect?.(id)
        if (!ir) continue
        x1 = Math.min(x1, ir.x); y1 = Math.min(y1, ir.y)
        x2 = Math.max(x2, ir.x + ir.w); y2 = Math.max(y2, ir.y + ir.h)
      }
      const r = x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
      if (!r || !frame) { if (frame) frame.style.opacity = '0'; if (bar) bar.style.opacity = '0'; return }
      const pad = 10
      const w = r.w + pad * 2
      const h = r.h + pad * 2
      const dx = (r.x + r.w / 2) - stage.w / 2
      const dy = (r.y + r.h / 2) - stage.h / 2
      frame.style.opacity = '1'
      frame.style.width = `${w}px`
      frame.style.height = `${h}px`
      frame.style.transform = `translate(-50%, -50%) translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
      if (bar) {
        bar.style.opacity = '1'
        bar.style.transform = `translate(-50%, -100%) translate(${dx.toFixed(1)}px, ${(dy - h / 2 - 8).toFixed(1)}px)`
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [engineRef, selId, stage.w, stage.h])

  // Corner scale — drag any corner; distance from the frame centre scales the size.
  const onCornerDown = (e) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const startSize = typeof instance.fontSize === 'number' ? instance.fontSize : 100
    drag.current = { cx, cy, startSize, startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1 }
  }
  const onCornerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy)
    onSize?.(clamp(Math.round(d.startSize * (dist / d.startDist)), 4, 1200))
  }
  const onCornerUp = (e) => { drag.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ } }

  const font = fontByKey(instance.font)
  const wght = font.axes.find((a) => a.tag === 'wght')

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
      {/* bounding frame (border is non-interactive so clicks reach the glyphs) */}
      <div
        ref={frameRef}
        className="absolute rounded-sm border border-yellow-400"
        style={{ left: '50%', top: '50%', opacity: 0 }}
      >
        {onSize && CORNERS.map((c) => (
          <div
            key={c.key}
            onPointerDown={onCornerDown}
            onPointerMove={onCornerMove}
            onPointerUp={onCornerUp}
            className="absolute pointer-events-auto bg-yellow-400 rounded-sm"
            style={{ width: 10, height: 10, ...c.style }}
          />
        ))}
      </div>
      {/* floating toolbar — stopPropagation so a click here doesn't deselect */}
      <div
        ref={barRef}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute pointer-events-auto flex items-center gap-2 rounded px-2 py-1.5 whitespace-nowrap bg-surface-primary border border-fg-08 shadow-lg"
        style={{ left: '50%', top: '50%', opacity: 0 }}
      >
        <SegmentedToggle value={instance.align || 'center'} onChange={onAlign} options={ALIGN} />
        <Button variant="ghost" size="sm" quiet selected={!!instance.italic} onClick={() => onItalic(!instance.italic)} aria-label="Italic">
          <span style={{ fontStyle: 'italic', fontWeight: 600 }}>I</span>
        </Button>
        {wght && (
          <Dropdown
            variant="subtle" size="sm"
            options={[300, 400, 500, 600, 700, 900].filter((w) => w >= wght.min && w <= wght.max).map((w) => ({ value: String(w), label: String(w) }))}
            value={String(instance.vf?.wght ?? wght.def)}
            onChange={(v) => onWeight(Number(v))}
          />
        )}
        <div style={{ width: 120 }}>
          <ColorField value={instance.fill} onChange={onFill} />
        </div>
        <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Delete" onClick={onDelete} />
      </div>
    </div>
  )
}
