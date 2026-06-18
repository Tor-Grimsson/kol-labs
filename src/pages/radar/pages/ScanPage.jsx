import SynthShell from './SynthShell.jsx'
import ScanEngine from '../effects/synth/scanEngine.js'
import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

// Synth · Scan — Rutt/Etra scan processor: luminance displaces scanlines along z
// into the pleated 3D raster (the Vasulka lineage). Camera is manual by default;
// a motion preset (orbit/spin/rock/rise/push/pull) advances on the transport.
const DEFAULTS = {
  lines: 140, displace: 1.0, mono: false, tint: '#9fe7ff',
  yaw: 0, pitch: 0.4, dist: 3, cameraMotion: false, motionPreset: 'orbit', motionSpeed: 0.3,
}

const PRESETS = [
  { value: 'orbit', label: 'Orbit' },
  { value: 'spin', label: 'Spin' },
  { value: 'rock', label: 'Rock' },
  { value: 'rise', label: 'Rise' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
]

export default function ScanPage() {
  return (
    <SynthShell engineClass={ScanEngine} title="Scan" name="scan" defaults={DEFAULTS}>
      {(p, update) => (
        <>
          <Section label="Scan processor">
            <Slider label="Scanlines" min={40} max={300} step={1} value={p.lines} onChange={(v) => update('lines', roundIfNum(v))} variant="default" />
            <Slider label="Displace" min={0} max={2.5} step={0.05} value={p.displace} onChange={(v) => update('displace', v)} variant="default" />
            <ToggleSwitch variant="plain" label="Monochrome" checked={p.mono} onChange={(v) => update('mono', v)} />
            {p.mono && (
              <LabeledControl inline label="Tint">
                <ColorField value={p.tint} onChange={(c) => update('tint', c)} />
              </LabeledControl>
            )}
          </Section>

          <Section label="Camera">
            <ToggleSwitch variant="plain" label="Camera motion" checked={p.cameraMotion} onChange={(v) => update('cameraMotion', v)} />
            {p.cameraMotion ? (
              <>
                <LabeledControl inline label="preset">
                  <Dropdown size="sm" variant="subtle" className="w-full" options={PRESETS} value={p.motionPreset} onChange={(v) => update('motionPreset', v)} />
                </LabeledControl>
                <Slider label="Motion speed" min={0.02} max={1.5} step={0.02} value={p.motionSpeed} onChange={(v) => update('motionSpeed', v)} variant="default" />
              </>
            ) : (
              <>
                <Slider label="Yaw" min={-3.14} max={3.14} step={0.02} value={p.yaw} onChange={(v) => update('yaw', v)} variant="default" />
                <Slider label="Pitch" min={-1.4} max={1.4} step={0.02} value={p.pitch} onChange={(v) => update('pitch', v)} variant="default" />
                <Slider label="Distance" min={1.5} max={8} step={0.1} value={p.dist} onChange={(v) => update('dist', v)} variant="default" />
              </>
            )}
          </Section>
        </>
      )}
    </SynthShell>
  )
}
