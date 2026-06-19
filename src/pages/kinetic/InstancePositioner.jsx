import { useRef } from 'react'

// Drag handle to position the selected instance in the frame. The SVG is centred
// in the wrap, so the instance's normalized offset maps to (x·w, y·h) px from the
// wrap centre. Drag → onChange({x,y}); no clamp, so you can drag the text off the
// frame edge (flow / bleed). Mirrors CustomPathEditor's coordinate model.
export default function InstancePositioner({ offset, stage, onChange }) {
  const drag = useRef(null)
  const w = stage?.w || 1
  const h = stage?.h || 1
  const x = offset?.x || 0
  const y = offset?.y || 0

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, x, y }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    onChange({ x: d.x + (e.clientX - d.sx) / w, y: d.y + (e.clientY - d.sy) / h })
  }
  const onUp = (e) => { drag.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ } }

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        title="Drag to move"
        className="absolute pointer-events-auto cursor-move flex items-center justify-center"
        style={{
          left: '50%',
          top: '50%',
          width: 22,
          height: 22,
          marginLeft: -11,
          marginTop: -11,
          transform: `translate(${x * w}px, ${y * h}px)`,
          borderRadius: '50%',
          background: 'rgba(127,209,255,0.18)',
          border: '1.5px solid #7fd1ff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#7fd1ff' }} />
      </div>
    </div>
  )
}
