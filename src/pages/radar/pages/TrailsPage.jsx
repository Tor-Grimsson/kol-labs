import SynthShell from './SynthShell.jsx'
import TrailsEngine from '../effects/synth/trailsEngine.js'
import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'

// Synth · Trails — recursive video feedback / colour-trail. Feedback zoom+spin
// make a still source move (the studio tunnel); on video it trails motion.
const DEFAULTS = { decay: 0.9, rgb: 0.03, shift: 0.003, zoom: 1, rotate: 0, mix: 1 }

export default function TrailsPage() {
  return (
    <SynthShell engineClass={TrailsEngine} title="Trails" name="trails" defaults={DEFAULTS}>
      {(p, update) => (
        <Section label="Feedback">
          <Slider label="Decay" min={0.8} max={0.99} step={0.005} value={p.decay} onChange={(v) => update('decay', v)} variant="default" />
          <Slider label="Colour trail" min={0} max={0.1} step={0.002} value={p.rgb} onChange={(v) => update('rgb', v)} variant="default" />
          <Slider label="Chroma shift" min={0} max={0.02} step={0.001} value={p.shift} onChange={(v) => update('shift', v)} variant="default" />
          <Slider label="Feedback zoom" min={0.9} max={1.1} step={0.002} value={p.zoom} onChange={(v) => update('zoom', v)} variant="default" />
          <Slider label="Feedback spin" min={-0.1} max={0.1} step={0.002} value={p.rotate} onChange={(v) => update('rotate', v)} variant="default" />
          <Slider label="Source mix" min={0} max={1} step={0.02} value={p.mix} onChange={(v) => update('mix', v)} variant="default" />
        </Section>
      )}
    </SynthShell>
  )
}
