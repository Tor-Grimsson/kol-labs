import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Button from '../../components/atoms/Button.jsx'
import { MOTION_OPTIONS, FIELD_OPTIONS, isSweep } from './engine/animations.js'
import { fontByKey, AXIS_LABELS } from './lib/vfAxes.js'
import { roundIfNum } from '../../lib/exprParam.js'

const NEW_LAYER = { mode: 'glyphwave', cycles: 1, phase: 0.5, amp: 0.3, axis: 'wght', field: 'x' }

// One motion layer's controls (mode + its params). `set(k,v)` patches that layer.
function MotionLayer({ m, font, set, onRemove, title }) {
  const sweep = isSweep(m.mode)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="kol-helper-10 text-meta">{title}</span>
        {onRemove && <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Remove motion" onClick={onRemove} />}
      </div>
      <LabeledControl inline label="Mode">
        <Dropdown variant="subtle" size="sm" openUp className="w-full" options={MOTION_OPTIONS} value={m.mode} onChange={(v) => set('mode', v)} />
      </LabeledControl>
      {sweep && (
        <LabeledControl inline label="Field">
          <Dropdown variant="subtle" size="sm" openUp className="w-full" options={FIELD_OPTIONS} value={m.field || 'x'} onChange={(v) => set('field', v)} />
        </LabeledControl>
      )}
      {m.mode !== 'none' && <Slider labeled label="Cycles" min={1} max={4} step={1} value={m.cycles ?? 1} onChange={(v) => set('cycles', roundIfNum(v))} variant="default" />}
      {m.mode !== 'none' && !sweep && <Slider labeled label="Phase" min={0} max={2} step={0.05} value={m.phase ?? 0.5} onChange={(v) => set('phase', v)} variant="default" />}
      {sweep && <Slider labeled label="Band" min={0.05} max={1} step={0.02} value={m.amp ?? 0.35} onChange={(v) => set('amp', v)} variant="default" />}
      {m.mode === 'glyphwave' && <Slider labeled label="Amount" min={0} max={1} step={0.02} value={m.amp ?? 0.3} onChange={(v) => set('amp', v)} variant="default" />}
      {m.mode === 'vfwave' && font.axes.length > 0 && (
        <LabeledControl inline label="Axis">
          <Dropdown variant="subtle" size="sm" openUp className="w-full" options={font.axes.map((a) => ({ value: a.tag, label: AXIS_LABELS[a.tag] || a.tag }))} value={m.axis || font.axes[0].tag} onChange={(v) => set('axis', v)} />
        </LabeledControl>
      )}
    </div>
  )
}

// A STACK of motion layers, composed by the engine (displacements add, scale /
// opacity multiply). The primary lives in `params.motion`; extras in
// `params.motions`. `setMotion(k,v)` patches the primary; `setMotions(next)`
// replaces the extras array.
export default function MotionControls({ params, setMotion, setMotions }) {
  const font = fontByKey(params.font)
  const extras = params.motions || []
  const canStack = typeof setMotions === 'function'
  const updateExtra = (i, k, v) => setMotions(extras.map((mm, j) => (j === i ? { ...mm, [k]: v } : mm)))
  return (
    <>
      <MotionLayer m={params.motion || { mode: 'none' }} font={font} set={setMotion} title={canStack && extras.length ? 'Motion 1' : 'Motion'} />
      {canStack && extras.map((mm, i) => (
        <MotionLayer
          key={i}
          m={mm}
          font={font}
          set={(k, v) => updateExtra(i, k, v)}
          onRemove={() => setMotions(extras.filter((_, j) => j !== i))}
          title={`Motion ${i + 2}`}
        />
      ))}
      {canStack && (
        <Button variant="primary" size="sm" className="w-full" iconLeft="plus" onClick={() => setMotions([...extras, { ...NEW_LAYER }])}>Add motion</Button>
      )}
    </>
  )
}
