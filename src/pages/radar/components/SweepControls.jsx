import { SWEEP_SHAPE_OPTIONS, SWEEP_TARGET_OPTIONS, SWEEP_PRESETS } from '../effects/sweeps'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Section from '../../../components/molecules/Section.jsx'

const ANGLED_SHAPES = ['linear', 'wave', 'angular']
const shapeLabel = (v) => SWEEP_SHAPE_OPTIONS.find((s) => s.value === v)?.label || v

/**
 * Motion panel — time-driven sweeps that animate a still (or compound on top
 * of video). Stack several for layered motion; each picks a shape + target.
 * Presentational: the page owns the sweeps array + animation clock.
 */
export default function SweepControls({ isVideo, animating, onAnimate, sweeps, onAdd, onRemove, onUpdate }) {
  return (
    <Section label="Motion">
      {!isVideo && (
        <ToggleSwitch labeled variant="plain" label="Animate" checked={animating} onChange={onAnimate} />
      )}
      <Dropdown
        size="sm"
        options={[{ value: '', label: 'Add motion…' }, ...SWEEP_PRESETS.map((p) => ({ value: p.name, label: p.name }))]}
        value=""
        onChange={(name) => { const p = SWEEP_PRESETS.find((x) => x.name === name); if (p) onAdd(p) }}
        variant="subtle"
        className="w-full"
      />

      {sweeps.map((sw, i) => {
        const isReveal = sw.target === 'reveal'
        const angled = ANGLED_SHAPES.includes(sw.shape)
        return (
          <div key={i} className="flex flex-col gap-2 p-2 rounded bg-fg-04">
            <div className="flex items-center gap-2">
              <ToggleSwitch labeled variant="plain" label={shapeLabel(sw.shape)} checked={sw.enabled} onChange={() => onUpdate(i, 'enabled', !sw.enabled)} />
              <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} className="ml-auto" aria-label="Remove sweep" onClick={() => onRemove(i)} />
            </div>
            {sw.enabled && (
              <>
                <Dropdown size="sm" options={SWEEP_SHAPE_OPTIONS} value={sw.shape} onChange={(v) => onUpdate(i, 'shape', v)} variant="subtle" raised className="w-full" />
                <Dropdown size="sm" options={SWEEP_TARGET_OPTIONS} value={sw.target} onChange={(v) => onUpdate(i, 'target', v)} variant="subtle" raised className="w-full" />
                {!isReveal && (
                  <Slider labeled raised label="Amount" min={-1} max={1} step={0.05} value={sw.amount} onChange={(v) => onUpdate(i, 'amount', v)} variant="default" />
                )}
                <Slider labeled raised label="Speed" min={-1} max={1} step={0.02} value={sw.speed} onChange={(v) => onUpdate(i, 'speed', v)} variant="default" />
                <Slider labeled raised label="Width" min={0.05} max={1} step={0.01} value={sw.width} onChange={(v) => onUpdate(i, 'width', v)} variant="default" />
                {angled && (
                  <Slider labeled raised label="Angle" min={0} max={360} step={1} value={sw.angle} onChange={(v) => onUpdate(i, 'angle', v)} variant="default" />
                )}
              </>
            )}
          </div>
        )
      })}

      <Button variant="primary" size="sm" iconLeft="plus" onClick={() => onAdd()} className="w-full">Add custom sweep</Button>
    </Section>
  )
}
