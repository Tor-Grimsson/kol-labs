import { useRef, useState } from 'react'
import Icon from '../../../components/loaders/Icon.jsx'

// One draggable + resizable floating panel shell — used for BOTH the Layers and
// Camera windows so they share chrome exactly. Drag the title bar to reposition,
// drag the bottom-right corner to resize width + height.
export default function FloatingPanel({ title, icon, defaultPos = { x: 12, y: 12 }, width = 176, children }) {
  const [pos, setPos] = useState(defaultPos)
  const [size, setSize] = useState({ w: width, h: null }) // h null = auto
  const drag = useRef(null)
  const resize = useRef(null)

  const onDown = (e) => {
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e) => {
    if (!drag.current) return
    const d = drag.current
    setPos({ x: Math.max(0, d.x + (e.clientX - d.px)), y: Math.max(0, d.y + (e.clientY - d.py)) })
  }
  const onUp = (e) => { drag.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId) }

  const onResizeDown = (e) => {
    e.stopPropagation()
    const el = e.currentTarget.parentElement
    resize.current = { px: e.clientX, py: e.clientY, w: el.offsetWidth, h: el.offsetHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e) => {
    if (!resize.current) return
    const r = resize.current
    setSize({
      w: Math.max(140, r.w + (e.clientX - r.px)),
      h: Math.max(80, r.h + (e.clientY - r.py)),
    })
  }
  const onResizeUp = (e) => { resize.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId) }

  return (
    <div
      className="absolute z-10 rounded border border-fg-08 pointer-events-auto overflow-hidden flex flex-col"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h ?? undefined, background: 'color-mix(in srgb, var(--kol-surface-primary) 88%, transparent)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="px-3 py-2 kol-helper-10 uppercase tracking-widest text-fg-48 border-b border-fg-08 flex items-center gap-2 cursor-move select-none shrink-0"
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {icon && <Icon name={icon} size={12} />} {title}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      {/* invisible resize grip (bottom-right corner) — no glyph */}
      <div
        className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize"
        style={{ touchAction: 'none' }}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        title="Resize"
      />
    </div>
  )
}
