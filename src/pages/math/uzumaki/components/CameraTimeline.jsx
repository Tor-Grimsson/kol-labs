import Slider from '../../../../components/atoms/Slider.jsx'
import Button from '../../../../components/atoms/Button.jsx'
import Dropdown from '../../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'
import SegmentedToggle from '../../../../components/molecules/SegmentedToggle.jsx'
import { Field, fmt } from './Field'
import { EASE_OPTIONS } from '../../../../lib/easing.js'

// Camera-movement authoring: edit the keyframe timeline that the camera flies.
// Each keyframe is a camera STATE (yaw/pitch/zoom/dist) + reveal fraction at a
// time, eased into. Pure-prop: `timeline` in, `onChange(nextTimeline)` out, with
// a selected-keyframe index driven by the parent (so the scrubber/ticks and the
// editor agree). The keyframe array is kept sorted by time on edit — the sampler
// assumes ascending `at`. (Camera-motion presets now live in the Animation tab's
// Frame dropdown, so this is purely the keyframe rig.)

export default function CameraTimeline({ timeline, onChange, selected = 0, onSelect, camSpeed, onCamSpeed }) {
  const sel = Math.min(Math.max(0, selected), timeline.length - 1)
  const kf = timeline[sel] || timeline[0]
  const cam = kf.cam || {}

  const setKf = (patch) => onChange(timeline.map((k, i) => (i === sel ? { ...k, ...patch } : k)))
  const setCam = (patch) => onChange(timeline.map((k, i) => (i === sel ? { ...k, cam: { ...k.cam, ...patch } } : k)))
  // `at` can cross a neighbour → re-sort and follow the edited keyframe (same
  // object ref survives the sort, so indexOf relocates it).
  const setAt = (v) => {
    const next = timeline.map((k, i) => (i === sel ? { ...k, at: v } : k))
    const sorted = [...next].sort((a, b) => a.at - b.at)
    onChange(sorted)
    onSelect?.(sorted.indexOf(next[sel]))
  }
  const addKf = () => {
    const last = timeline[timeline.length - 1]
    const next = [...timeline, { at: (last?.at || 0) + 2, draw: 1, cam: { ...(last?.cam || {}) }, ease: 'inout' }]
    onChange(next)
    onSelect?.(next.length - 1)
  }
  const removeKf = () => {
    if (timeline.length <= 2) return
    onChange(timeline.filter((_, i) => i !== sel))
    onSelect?.(Math.max(0, sel - 1))
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="kol-helper-10 text-meta">Keyframes</span>
        <div className="flex gap-1">
          <Button variant="primary" size="sm" iconLeft="plus" onClick={addKf}>Add</Button>
          <Button variant="ghost" size="sm" iconOnly="cross" onClick={removeKf} disabled={timeline.length <= 2} aria-label="Remove keyframe" />
        </div>
      </div>

      {/* Keyframe selector — SegmentedToggle (dark active state, not a white button). */}
      <SegmentedToggle
        value={String(sel)}
        onChange={(v) => onSelect?.(Number(v))}
        className="w-full"
        options={timeline.map((k, i) => ({ value: String(i), label: `${fmt(k.at)}s` }))}
      />

      {/* Ease + camera-sequence Speed sit directly after the keyframes selector. */}
      <LabeledControl inline label="Ease" labelWidth={64}>
        <Dropdown size="sm" options={EASE_OPTIONS} value={kf.ease || 'inout'} onChange={(v) => setKf({ ease: v })} variant="subtle" className="w-full" />
      </LabeledControl>
      {onCamSpeed && (
        <Slider labeled label="Speed" min={0.1} max={3} step={0.05} value={camSpeed ?? 1} onChange={onCamSpeed} variant="default" noExpr />
      )}

      <Field label="At · s" numeric value={kf.at} onCommit={setAt} />
      <Slider labeled label="Reveal" min={0} max={1} step={0.01} value={kf.draw ?? 1} onChange={(v) => setKf({ draw: v })} variant="default" />
      <Slider labeled label="Yaw" min={-180} max={180} step={1} value={cam.yaw ?? 0} onChange={(v) => setCam({ yaw: v })} variant="default" />
      <Slider labeled label="Pitch" min={-89} max={89} step={1} value={cam.pitch ?? 0} onChange={(v) => setCam({ pitch: v })} variant="default" />
      <Slider labeled label="Zoom" min={0.3} max={3} step={0.05} value={cam.zoom ?? 1} onChange={(v) => setCam({ zoom: v })} variant="default" />
      <Slider labeled label="Distance" min={1} max={8} step={0.1} value={cam.dist ?? 3} onChange={(v) => setCam({ dist: v })} variant="default" />
    </div>
  )
}
