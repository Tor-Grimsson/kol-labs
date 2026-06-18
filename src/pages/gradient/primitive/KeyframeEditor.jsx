import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import { EASE_OPTIONS } from '../../../lib/easing.js'

const deg = (r) => Math.round(((r || 0) * 180) / Math.PI)
const rad = (d) => (d * Math.PI) / 180

// Keyframe timeline editor — pick a keyframe (loads its pose + seeks the
// playhead to it), edit its pose, add one at the playhead, delete. Rotations are
// stored in radians (engine-native) and edited in degrees here. Because the
// playhead sits on the selected keyframe's t, the live render = the pose being
// edited; scrub away to see the interpolation.
export default function KeyframeEditor({ keyframes, selected, onSelect, onAdd, onDelete, onPatch }) {
  const k = keyframes[selected] || keyframes[0] || { rot: [0, 0, 0], pos: [0, 0, 0], scale: 1 }
  const setRot = (axis, d) => { const r = [...(k.rot || [0, 0, 0])]; r[axis] = rad(d); onPatch({ rot: r }) }
  const setPos = (axis, v) => { const p = [...(k.pos || [0, 0, 0])]; p[axis] = v; onPatch({ pos: p }) }

  return (
    <>
      <Section label="Keyframes">
        <div className="flex flex-col gap-1">
          {keyframes.map((kf, i) => (
            <Button
              key={i}
              variant="secondary"
              size="sm"
              selected={i === selected}
              onClick={() => onSelect(i)}
              className="w-full"
              style={{ justifyContent: 'space-between' }}
            >
              <span>Key {i + 1}</span>
              <span className="kol-helper-10 text-meta tabular-nums">{Math.round(kf.t * 100)}%</span>
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" className="flex-1" onClick={onAdd}>Add @ playhead</Button>
          <Button variant="ghost" size="sm" iconOnly="cross" title="Delete keyframe" onClick={onDelete} />
        </div>
      </Section>

      <Section label="Pose">
        <Slider label="Rotate X" min={-360} max={360} step={1} value={deg(k.rot?.[0])} onChange={(v) => setRot(0, v)} variant="default" noExpr />
        <Slider label="Rotate Y" min={-360} max={360} step={1} value={deg(k.rot?.[1])} onChange={(v) => setRot(1, v)} variant="default" noExpr />
        <Slider label="Rotate Z" min={-360} max={360} step={1} value={deg(k.rot?.[2])} onChange={(v) => setRot(2, v)} variant="default" noExpr />
        <Slider label="Move X" min={-2} max={2} step={0.05} value={k.pos?.[0] || 0} onChange={(v) => setPos(0, v)} variant="default" noExpr />
        <Slider label="Move Y" min={-2} max={2} step={0.05} value={k.pos?.[1] || 0} onChange={(v) => setPos(1, v)} variant="default" noExpr />
        <Slider label="Move Z" min={-2} max={2} step={0.05} value={k.pos?.[2] || 0} onChange={(v) => setPos(2, v)} variant="default" noExpr />
        <Slider label="Scale" min={0.2} max={2} step={0.05} value={k.scale ?? 1} onChange={(v) => onPatch({ scale: v })} variant="default" noExpr />
        <LabeledControl inline label="ease">
          <Dropdown size="sm" variant="subtle" className="w-full" options={EASE_OPTIONS} value={k.ease || 'inout'} onChange={(v) => onPatch({ ease: v })} />
        </LabeledControl>
      </Section>
    </>
  )
}
