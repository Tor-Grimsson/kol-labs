import SynthShell from './SynthShell.jsx'
import TrailsEngine from '../effects/synth/trailsEngine.js'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'

// Synth · Disco — recursive video feedback as a 4-head tape echo (Magneto in
// raster). Heads re-read the previous frame transformed + tinted (R·G·B·amber)
// for the 70s chromatic trail; zoom/spin/drift turn a still source into the
// studio tunnel, video into colour trails.
const DEFAULTS = {
  decay: 0.92, mix: 1,
  taps: 3, spacing: 'even', chroma: 0.6,
  zoom: 1, rotate: 0, drift: 0.02, originX: 0.5, originY: 0.5,
  hue: 0, sat: 1, gain: 1, palette: 0,
}

const SPACING = [{ value: 'even', label: 'Even' }, { value: 'triplet', label: 'Triplet' }, { value: 'shift', label: 'Shift' }]

export default function TrailsPage() {
  return (
    <SynthShell engineClass={TrailsEngine} title="Disco" name="disco" defaults={DEFAULTS}>
      {(p, update) => (
        <>
          <Section label="Feedback">
            <Slider labeled label="Decay" min={0.8} max={0.99} step={0.005} value={p.decay} onChange={(v) => update('decay', v)} variant="default" />
            <Slider labeled label="Source mix" min={0} max={1} step={0.02} value={p.mix} onChange={(v) => update('mix', v)} variant="default" />
          </Section>

          <Section label="Heads">
            <Slider labeled label="Heads" min={1} max={4} step={1} value={p.taps} onChange={(v) => update('taps', roundIfNum(v))} variant="default" />
            <LabeledControl label="Spacing">
              <SegmentedToggle options={SPACING} value={p.spacing} onChange={(v) => update('spacing', v)} className="w-full" />
            </LabeledControl>
            <Slider labeled label="Chroma" min={0} max={1} step={0.02} value={p.chroma} onChange={(v) => update('chroma', v)} variant="default" />
          </Section>

          <Section label="Transform">
            <Slider labeled label="Zoom" min={0.9} max={1.1} step={0.002} value={p.zoom} onChange={(v) => update('zoom', v)} variant="default" />
            <Slider labeled label="Spin" min={-0.1} max={0.1} step={0.002} value={p.rotate} onChange={(v) => update('rotate', v)} variant="default" />
            <Slider labeled label="Drift" min={0} max={0.06} step={0.002} value={p.drift} onChange={(v) => update('drift', v)} variant="default" />
            <Slider labeled label="Origin X" min={0} max={1} step={0.005} value={p.originX} onChange={(v) => update('originX', v)} variant="default" />
            <Slider labeled label="Origin Y" min={0} max={1} step={0.005} value={p.originY} onChange={(v) => update('originY', v)} variant="default" />
          </Section>

          <Section label="Color">
            <Slider labeled label="Hue cycle" min={0} max={2} step={0.05} value={p.hue} onChange={(v) => update('hue', v)} variant="default" />
            <Slider labeled label="Saturation" min={0} max={3} step={0.05} value={p.sat} onChange={(v) => update('sat', v)} variant="default" />
            <Slider labeled label="Brightness" min={0.2} max={2} step={0.05} value={p.gain} onChange={(v) => update('gain', v)} variant="default" />
            <Slider labeled label="70s lock" min={0} max={1} step={0.02} value={p.palette} onChange={(v) => update('palette', v)} variant="default" />
          </Section>
        </>
      )}
    </SynthShell>
  )
}
