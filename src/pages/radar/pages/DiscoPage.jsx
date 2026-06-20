import SynthShell from './SynthShell.jsx'
import DiscoEngine from '../effects/synth/discoEngine.js'
import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'

// Synth · Symmetry — mirror/kaleidoscope with per-axis transform, animated
// movement and a colour stage.
const DEFAULTS = {
  mirror: 'kaleido', segments: 6, twist: 0,
  originX: 0.5, originY: 0.5, zoomX: 1, zoomY: 1, panX: 0, panY: 0, rotate: 0,
  spin: 0.1, driftX: 0, driftY: 0, pulse: 0, pulseRate: 0.5,
  hue: 0.3, sat: 1, posterize: 0, strobe: 0, palette: 0,
}

const MODES = [
  { value: 'kaleido', label: 'Kaleido' },
  { value: 'mirrorX', label: 'Mirror X' },
  { value: 'mirrorY', label: 'Mirror Y' },
  { value: 'quad', label: 'Quad' },
]

export default function DiscoPage() {
  return (
    <SynthShell engineClass={DiscoEngine} title="Symmetry" name="symmetry" defaults={DEFAULTS}>
      {(p, update) => (
        <>
          <Section label="Symmetry">
            <LabeledControl label="Mode">
              <SegmentedToggle options={MODES} value={p.mirror} onChange={(v) => update('mirror', v)} className="w-full" />
            </LabeledControl>
            {p.mirror === 'kaleido' && (
              <Slider labeled label="Segments" min={1} max={16} step={1} value={p.segments} onChange={(v) => update('segments', roundIfNum(v))} variant="default" />
            )}
            <Slider labeled label="Twist" min={-3.14} max={3.14} step={0.02} value={p.twist} onChange={(v) => update('twist', v)} variant="default" />
          </Section>

          <Section label="Transform">
            <Slider labeled label="Origin X" min={0} max={1} step={0.005} value={p.originX} onChange={(v) => update('originX', v)} variant="default" />
            <Slider labeled label="Origin Y" min={0} max={1} step={0.005} value={p.originY} onChange={(v) => update('originY', v)} variant="default" />
            <Slider labeled label="Zoom X" min={0.2} max={4} step={0.01} value={p.zoomX} onChange={(v) => update('zoomX', v)} variant="default" />
            <Slider labeled label="Zoom Y" min={0.2} max={4} step={0.01} value={p.zoomY} onChange={(v) => update('zoomY', v)} variant="default" />
            <Slider labeled label="Pan X" min={-1} max={1} step={0.01} value={p.panX} onChange={(v) => update('panX', v)} variant="default" />
            <Slider labeled label="Pan Y" min={-1} max={1} step={0.01} value={p.panY} onChange={(v) => update('panY', v)} variant="default" />
            <Slider labeled label="Rotate" min={-3.14} max={3.14} step={0.02} value={p.rotate} onChange={(v) => update('rotate', v)} variant="default" />
          </Section>

          <Section label="Movement">
            <Slider labeled label="Spin" min={-2} max={2} step={0.02} value={p.spin} onChange={(v) => update('spin', v)} variant="default" />
            <Slider labeled label="Drift X" min={-0.5} max={0.5} step={0.005} value={p.driftX} onChange={(v) => update('driftX', v)} variant="default" />
            <Slider labeled label="Drift Y" min={-0.5} max={0.5} step={0.005} value={p.driftY} onChange={(v) => update('driftY', v)} variant="default" />
            <Slider labeled label="Pulse" min={0} max={1} step={0.01} value={p.pulse} onChange={(v) => update('pulse', v)} variant="default" />
            <Slider labeled label="Pulse rate" min={0} max={4} step={0.05} value={p.pulseRate} onChange={(v) => update('pulseRate', v)} variant="default" />
          </Section>

          <Section label="Color">
            <Slider labeled label="Hue cycle" min={0} max={2} step={0.05} value={p.hue} onChange={(v) => update('hue', v)} variant="default" />
            <Slider labeled label="Saturation" min={0} max={3} step={0.05} value={p.sat} onChange={(v) => update('sat', v)} variant="default" />
            <Slider labeled label="Posterize" min={0} max={12} step={1} value={p.posterize} onChange={(v) => update('posterize', roundIfNum(v))} variant="default" />
            <Slider labeled label="Strobe" min={0} max={12} step={0.5} value={p.strobe} onChange={(v) => update('strobe', v)} variant="default" />
            <Slider labeled label="70s lock" min={0} max={1} step={0.02} value={p.palette} onChange={(v) => update('palette', v)} variant="default" />
          </Section>
        </>
      )}
    </SynthShell>
  )
}
