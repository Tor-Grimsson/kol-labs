import Icon from '../../../components/loaders/Icon.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import FloatingPanel from './FloatingPanel.jsx'

// The layer types the "+" can add to the scene (Camera + Scene are always-present
// singletons, not addable).
const ADDABLE = [
  { type: 'object', label: 'Object', icon: 'ball' },
  { type: 'image', label: 'Image', icon: 'image' },
  { type: 'light', label: 'Light', icon: 'sun' },
]

// Floating layer stack. Glass + Image have eye toggles; every row has an X to
// delete it. Clicking a row selects it (scopes the rail). "+" adds a layer.
// Draggable via the shared FloatingPanel shell.
export default function LayersPanel({ layers, selected, onSelect, onToggle, onAdd, onRemove }) {
  return (
    <FloatingPanel title="Layers" icon="layers" defaultPos={{ x: 12, y: 12 }}>
      <ul className="flex flex-col py-1">
        {layers.map((l) => (
          <li
            key={l.id}
            className={`flex items-center gap-2 mx-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${selected === l.id ? 'bg-fg-08' : 'hover:bg-fg-04'}`}
            onClick={() => onSelect(l.id)}
          >
            {/* Fixed-width eye slot — keeps every layer's icon column aligned,
                whether the row has an eye (Glass/Image) or not (Master). */}
            <span className="shrink-0 w-4 h-4 inline-flex items-center justify-center">
              {!l.noToggle && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent text-fg-48 hover:text-fg-default transition-colors cursor-pointer"
                  title={l.visible ? 'Hide' : 'Show'}
                  onClick={(e) => { e.stopPropagation(); onToggle(l.id) }}
                >
                  <Icon name={l.visible ? 'eye-on' : 'eye-off'} size={14} />
                </button>
              )}
            </span>
            <Icon name={l.icon} size={14} className="text-fg-48 shrink-0" />
            <span className={`kol-mono-12 flex-1 truncate ${l.visible ? 'text-fg-default' : 'text-fg-32'}`}>{l.label}</span>
            {onRemove && !l.fixed && (
              <button
                type="button"
                className="shrink-0 inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent text-fg-32 hover:text-fg-default transition-colors cursor-pointer"
                title="Delete layer"
                onClick={(e) => { e.stopPropagation(); onRemove(l.id) }}
              >
                <Icon name="cross" size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Add-layer dropdown — opens as an overlay (not clipped by the panel). */}
      {onAdd && (
        <div className="border-t border-fg-08 mt-1 pt-2 px-2 pb-1 shrink-0">
          <Dropdown
            size="sm" variant="subtle" raised openUp className="w-full"
            options={[{ value: '', label: '+ Add layer' }, ...ADDABLE.map((a) => ({ value: a.type, label: a.label }))]}
            value=""
            onChange={(v) => v && onAdd(v)}
          />
        </div>
      )}
    </FloatingPanel>
  )
}
