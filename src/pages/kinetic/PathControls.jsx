import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Button from '../../components/atoms/Button.jsx'
import { PATH_OPTIONS, DEFAULT_POINTS, isArray } from './engine/paths.js'

// One instance's arrangement: its TYPE (line/path/circle/array/…), whether it's
// kept inside the frame (Paragraph), and its position. By default type ignores the
// frame edges — Paragraph constrains it. The Layout tab uses this for the selection.
export default function PathControls({ params, set, setPath }) {
  const path = params.path
  const array = isArray(path.type)
  const off = params.offset || { x: 0, y: 0 }
  const setOff = (axis, v) => set('offset', { ...off, [axis]: v })
  return (
    <>
      <Section label="Arrangement">
        <LabeledControl inline label="Type">
          <Dropdown variant="subtle" size="sm" className="w-full" options={PATH_OPTIONS} value={path.type} onChange={(v) => setPath('type', v)} />
        </LabeledControl>
        {!array && <Slider labeled noExpr label="Copies" min={1} max={24} step={1} value={params.multiply ?? 1} onChange={(v) => set('multiply', Math.round(v))} variant="default" />}
        {!array && <ToggleSwitch variant="plain" labeled label="Paragraph" checked={params.flow === 'contain'} onChange={(c) => set('flow', c ? 'contain' : 'flow')} />}
        {!array && <ToggleSwitch variant="plain" labeled label="Show path" checked={!!params.showPath} onChange={(c) => set('showPath', c)} />}
      </Section>

      <Section label="Position">
        <Slider labeled noExpr label="X" min={-1} max={1} step={0.01} value={off.x ?? 0} onChange={(v) => setOff('x', v)} variant="default" />
        <Slider labeled noExpr label="Y" min={-1} max={1} step={0.01} value={off.y ?? 0} onChange={(v) => setOff('y', v)} variant="default" />
      </Section>

      {array && (
        <Section label="Grid">
          <Slider labeled noExpr label="Rows" min={1} max={8} step={1} value={path.rows ?? 2} onChange={(v) => setPath('rows', Math.round(v))} variant="default" />
          <Slider labeled noExpr label="Columns" min={1} max={8} step={1} value={path.cols ?? 3} onChange={(v) => setPath('cols', Math.round(v))} variant="default" />
        </Section>
      )}

      {!array && path.type !== 'custom' && (
        <Section label="Shape">
          <Slider labeled noExpr label="Amplitude" min={0} max={1} step={0.02} value={path.amp ?? 0.4} onChange={(v) => setPath('amp', v)} variant="default" />
          <Slider labeled noExpr label="Frequency" min={1} max={8} step={1} value={path.freq ?? 2} onChange={(v) => setPath('freq', Math.round(v))} variant="default" />
          <Slider labeled noExpr label="Turns" min={1} max={8} step={1} value={path.turns ?? 3} onChange={(v) => setPath('turns', Math.round(v))} variant="default" />
          <Slider labeled noExpr label="Radius" min={0.3} max={1} step={0.02} value={path.radius ?? 0.72} onChange={(v) => setPath('radius', v)} variant="default" />
        </Section>
      )}

      {!array && path.type === 'custom' && (
        <Section label="Points">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="sm" onClick={() => setPath('points', [...(path.points || DEFAULT_POINTS), [0.5, 0.5]])}>Add point</Button>
            <Button variant="primary" size="sm" onClick={() => { const pts = path.points || DEFAULT_POINTS; if (pts.length > 2) setPath('points', pts.slice(0, -1)) }}>Remove</Button>
          </div>
          <div className="kol-helper-10 text-meta">drag the dots on the stage</div>
        </Section>
      )}
    </>
  )
}
