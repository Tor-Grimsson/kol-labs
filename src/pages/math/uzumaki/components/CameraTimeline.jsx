import Slider from '../../../../components/atoms/Slider.jsx'
import Button from '../../../../components/atoms/Button.jsx'
import Dropdown from '../../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../../components/molecules/LabeledControl.jsx'
import { Field, fmt } from './Field'
import { EASE_OPTIONS } from '../../../../lib/easing.js'

// Camera-movement authoring: edit the keyframe timeline that the camera flies.
// Each keyframe is a camera STATE (yaw/pitch/zoom/dist) + reveal fraction at a
// time, eased into. Pure-prop: `timeline` in, `onChange(nextTimeline)` out, with
// a selected-keyframe index driven by the parent (so the scrubber/ticks and the
// editor agree). The keyframe array is kept sorted by time on edit — the sampler
// assumes ascending `at`.

// Camera-movement presets: rewrite every keyframe's cam from its position along
// the timeline (frac 0..1), keeping the keyframe times / reveal / ease. Quick
// choreography you can then hand-tweak per keyframe.
const MOTIONS = {
  orbit: (f) => ({ yaw: -180 + 360 * f, pitch: 18, zoom: 1, dist: 3 }),
  spin: (f) => ({ yaw: 720 * f, pitch: 16, zoom: 1, dist: 3 }),
  rock: (f) => ({ yaw: 35 * Math.sin(f * Math.PI * 2), pitch: 18, zoom: 1, dist: 3 }),
  rise: (f) => ({ yaw: -12 + 24 * f, pitch: -8 + 88 * f, zoom: 1, dist: 3 }),
  push: (f) => ({ yaw: -16 + 28 * f, pitch: 18, zoom: 1, dist: 5 - 3.2 * f }),
  pull: (f) => ({ yaw: -16 + 28 * f, pitch: 18, zoom: 1, dist: 2 + 4 * f }),
}
const MOTION_LIST = [
  ['orbit', 'Orbit'], ['spin', 'Spin'], ['rock', 'Rock'],
  ['rise', 'Rise'], ['push', 'Push in'], ['pull', 'Pull out'],
]

export default function CameraTimeline({ timeline, onChange, selected = 0, onSelect }) {
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
  const applyMotion = (name) => {
    const fn = MOTIONS[name]
    const n = timeline.length
    onChange(timeline.map((k, i) => ({ ...k, cam: { ...k.cam, ...fn(n > 1 ? i / (n - 1) : 0) } })))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="kol-helper-10 text-meta">Motion</span>
        <div className="flex flex-wrap gap-1">
          {MOTION_LIST.map(([key, label]) => (
            <Button key={key} variant="primary" size="sm" onClick={() => applyMotion(key)}>{label}</Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="kol-helper-10 text-meta">Keyframes</span>
        <div className="flex gap-1">
          <Button variant="primary" size="sm" iconLeft="plus" onClick={addKf}>Add</Button>
          <Button variant="ghost" size="sm" iconOnly="cross" onClick={removeKf} disabled={timeline.length <= 2} aria-label="Remove keyframe" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {timeline.map((k, i) => (
          <Button key={i} variant="secondary" size="sm" selected={i === sel} onClick={() => onSelect?.(i)}>
            {fmt(k.at)}s
          </Button>
        ))}
      </div>

      <Field label="At · s" numeric value={kf.at} onCommit={setAt} />
      <Slider labeled label="Reveal" min={0} max={1} step={0.01} value={kf.draw ?? 1} onChange={(v) => setKf({ draw: v })} variant="default" />
      <Slider labeled label="Yaw" min={-180} max={180} step={1} value={cam.yaw ?? 0} onChange={(v) => setCam({ yaw: v })} variant="default" />
      <Slider labeled label="Pitch" min={-89} max={89} step={1} value={cam.pitch ?? 0} onChange={(v) => setCam({ pitch: v })} variant="default" />
      <Slider labeled label="Zoom" min={0.3} max={3} step={0.05} value={cam.zoom ?? 1} onChange={(v) => setCam({ zoom: v })} variant="default" />
      <Slider labeled label="Distance" min={1} max={8} step={0.1} value={cam.dist ?? 3} onChange={(v) => setCam({ dist: v })} variant="default" />
      <LabeledControl label="Ease">
        <Dropdown options={EASE_OPTIONS} value={kf.ease || 'inout'} onChange={(v) => setKf({ ease: v })} variant="subtle" className="w-full" />
      </LabeledControl>
    </div>
  )
}
