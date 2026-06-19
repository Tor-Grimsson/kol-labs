import { useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import PathControls from './PathControls.jsx'
import MotionControls from './MotionControls.jsx'

/**
 * Layout tab — the composition: how many text instances and what arrangement each
 * is (line / path / circle / array / …). Add, reorder, repeat (duplicate), delete;
 * select a row → its arrangement, position, and motion show below (double-click
 * jumps to Edit for its typography).
 */
export default function LayoutControls({
  instances, selId, onSelect, onEdit,
  onRemove, onDuplicate, onReorder, onPath, onMotion, set,
  showMotion = true,
}) {
  const dragFrom = useRef(null)
  const [dragOver, setDragOver] = useState(null)
  const selected = instances.find((i) => i.id === selId) || null

  return (
    <>
      <div className="flex flex-col gap-1">
        {instances.map((ins, i) => {
          const isSel = ins.id === selId
          return (
            <div
              key={ins.id}
              draggable
              onDragStart={() => { dragFrom.current = i }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(i) }}
              onDrop={() => { const from = dragFrom.current; dragFrom.current = null; setDragOver(null); if (from != null && from !== i) onReorder(from, i) }}
              onDragEnd={() => setDragOver(null)}
              onClick={() => onSelect(ins.id)}
              onDoubleClick={() => onEdit(ins.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-grab kol-helper-12 border-t-2 ${dragOver === i ? 'border-yellow-400' : 'border-transparent'} ${isSel ? 'bg-fg-08 text-emphasis' : 'bg-fg-04 text-body hover:text-emphasis'}`}
            >
              <span className="text-meta select-none">⠿</span>
              <span className="truncate flex-1 min-w-0">{ins.text || '—'}</span>
              <Button variant="ghost" size="sm" quiet iconOnly="copy" iconSize={13} aria-label="Repeat" onClick={(e) => { e.stopPropagation(); onDuplicate(ins.id) }} />
              <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Delete" onClick={(e) => { e.stopPropagation(); onRemove(ins.id) }} />
            </div>
          )
        })}
      </div>

      {selected && (
        <>
          <PathControls
            params={selected}
            set={(k, v) => set(selected.id, k, v)}
            setPath={(k, v) => onPath(selected.id, k, v)}
          />
          {showMotion && <MotionControls params={selected} setMotion={(k, v) => onMotion(selected.id, k, v)} />}
        </>
      )}
    </>
  )
}
