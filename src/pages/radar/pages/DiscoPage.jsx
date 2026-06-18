import SynthShell from './SynthShell.jsx'
import DiscoEngine from '../effects/synth/discoEngine.js'
import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'

// Synth · Disco — club-visual fragment post: kaleidoscope, hue-cycle, spin,
// posterize, strobe.
const DEFAULTS = { segments: 6, hue: 0.3, spin: 0.1, posterize: 0, strobe: 0 }

export default function DiscoPage() {
  return (
    <SynthShell engineClass={DiscoEngine} title="Disco" name="disco" defaults={DEFAULTS}>
      {(p, update) => (
        <Section label="Disco">
          <Slider label="Kaleidoscope" min={0} max={12} step={1} value={p.segments} onChange={(v) => update('segments', roundIfNum(v))} variant="default" />
          <Slider label="Hue cycle" min={0} max={2} step={0.05} value={p.hue} onChange={(v) => update('hue', v)} variant="default" />
          <Slider label="Spin" min={-1} max={1} step={0.02} value={p.spin} onChange={(v) => update('spin', v)} variant="default" />
          <Slider label="Posterize" min={0} max={12} step={1} value={p.posterize} onChange={(v) => update('posterize', roundIfNum(v))} variant="default" />
          <Slider label="Strobe" min={0} max={12} step={0.5} value={p.strobe} onChange={(v) => update('strobe', v)} variant="default" />
        </Section>
      )}
    </SynthShell>
  )
}
