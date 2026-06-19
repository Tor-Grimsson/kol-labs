import { useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import ToggleCheckbox from '../../components/atoms/ToggleCheckbox.jsx'
import ButtonGroup from '../../components/molecules/ButtonGroup.jsx'
import PathControls from './PathControls.jsx'
import MotionControls from './MotionControls.jsx'

// short group tag (a·b·c…) so grouped rows read as a set without a colour system
const groupTag = (gid, groups) => (gid ? String.fromCharCode(97 + (groups.indexOf(gid) % 26)) : null)

/**
 * Layout tab — the composition: how many text instances and what arrangement each
 * is (line / path / circle / array / …). Add, reorder, repeat (duplicate), delete;
 * select a row → its arrangement, position, and motion show below (double-click
 * jumps to Edit for its typography).
 */
export default function LayoutControls({
  instances, selId, onSelect, onEdit,
  onRemove, onDuplicate, onReorder, onPath, onMotion, onMotions, set,
  showMotion = true,
  marked, onMark, onGroup, onUngroup,
}) {
  const dragFrom = useRef(null)
  const [dragOver, setDragOver] = useState(null)
  const selected = instances.find((i) => i.id === selId) || null
  const grouping = typeof onMark === 'function'
  const groupIds = [...new Set(instances.map((i) => i.group).filter(Boolean))]
  const markedIds = marked || []

  return (
    <>
      <div className="flex flex-col gap-1">
        {instances.map((ins, i) => {
          const isSel = ins.id === selId
          const tag = groupTag(ins.group, groupIds)
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
              {grouping && (
                <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <ToggleCheckbox checked={markedIds.includes(ins.id)} onChange={() => onMark(ins.id)} />
                </span>
              )}
              <span className="text-meta select-none">⠿</span>
              <span className="truncate flex-1 min-w-0">{ins.text || '—'}</span>
              {tag && <span className="shrink-0 kol-helper-10 text-meta uppercase">grp {tag}</span>}
              <Button variant="ghost" size="sm" quiet iconOnly="copy" iconSize={13} aria-label="Repeat" onClick={(e) => { e.stopPropagation(); onDuplicate(ins.id) }} />
              <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Delete" onClick={(e) => { e.stopPropagation(); onRemove(ins.id) }} />
            </div>
          )
        })}
      </div>

      {grouping && (
        <ButtonGroup className="w-full">
          <Button variant="primary" size="sm" className="flex-1" disabled={markedIds.length < 2} onClick={onGroup}>Group</Button>
          <Button variant="primary" size="sm" className="flex-1" disabled={!markedIds.length} onClick={onUngroup}>Ungroup</Button>
        </ButtonGroup>
      )}

      {selected && (
        <>
          <PathControls
            params={selected}
            set={(k, v) => set(selected.id, k, v)}
            setPath={(k, v) => onPath(selected.id, k, v)}
          />
          {showMotion && <MotionControls params={selected} setMotion={(k, v) => onMotion(selected.id, k, v)} setMotions={onMotions ? (next) => onMotions(selected.id, next) : undefined} />}
        </>
      )}
    </>
  )
}
