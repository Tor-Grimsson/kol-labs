import { useRef } from 'react'

// Draggable control-point handles for the custom path, overlaid on the stage.
// Points are normalized (0..1); the SVG is centred in the wrap, so a point maps
// to an offset of ((nx-0.5)·w, (ny-0.5)·h) from the wrap centre. Drag → onChange.
export default function CustomPathEditor({ points, stage, onChange }) {
  const drag = useRef(null)
  const w = stage?.w || 1
  const h = stage?.h || 1

  const onDown = (i) => (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { i, sx: e.clientX, sy: e.clientY, p: points[i] }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const nx = Math.max(0, Math.min(1, d.p[0] + (e.clientX - d.sx) / w))
    const ny = Math.max(0, Math.min(1, d.p[1] + (e.clientY - d.sy) / h))
    onChange(points.map((p, k) => (k === d.i ? [nx, ny] : p)))
  }
  const onUp = (e) => { drag.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ } }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {points.map((p, i) => (
        <div
          key={i}
          onPointerDown={onDown(i)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="absolute pointer-events-auto cursor-grab"
          style={{
            left: '50%',
            top: '50%',
            width: 14,
            height: 14,
            marginLeft: -7,
            marginTop: -7,
            transform: `translate(${(p[0] - 0.5) * w}px, ${(p[1] - 0.5) * h}px)`,
            borderRadius: '50%',
            background: '#7fd1ff',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
          }}
        />
      ))}
    </div>
  )
}
