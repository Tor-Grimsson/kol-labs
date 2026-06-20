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
// into the pleated 3D raster (the Vasulka lineage). Camera: drag to orbit / wheel
// to zoom (three.js OrbitControls), the sliders snap to an angle, or a motion
// preset (orbit/spin/rock/rise/push/pull) animates on the transport.
const DEFAULTS = {
  lines: 140, cols: 220, displace: 1.0, mono: false, tint: '#9fe7ff', opacity: 1,
  yaw: 0, pitch: 0.4, dist: 3, fov: 45, cameraMotion: false, motionPreset: 'orbit', motionSpeed: 0.3,
  bg: '#0b0e13', bgAlpha: 1,
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
          <Section label="Raster">
            <Slider labeled label="Scanlines" min={40} max={300} step={1} value={p.lines} onChange={(v) => update('lines', roundIfNum(v))} variant="default" />
            <Slider labeled label="Columns" min={40} max={400} step={1} value={p.cols} onChange={(v) => update('cols', roundIfNum(v))} variant="default" />
            <Slider labeled label="Displace" min={0} max={2.5} step={0.05} value={p.displace} onChange={(v) => update('displace', v)} variant="default" />
          </Section>

          <Section label="Color">
            <ToggleSwitch variant="plain" label="Monochrome" checked={p.mono} onChange={(v) => update('mono', v)} />
            {p.mono && <ColorField label="Tint" value={p.tint} onChange={(c) => update('tint', c)} />}
            <Slider labeled label="Line opacity" min={0.05} max={1} step={0.01} value={p.opacity} onChange={(v) => update('opacity', v)} variant="default" />
          </Section>

          <Section label="Camera">
            <Slider labeled label="Yaw" min={-3.14} max={3.14} step={0.02} value={p.yaw} onChange={(v) => update('yaw', v)} variant="default" />
            <Slider labeled label="Pitch" min={-1.4} max={1.4} step={0.02} value={p.pitch} onChange={(v) => update('pitch', v)} variant="default" />
            <Slider labeled label="Distance" min={1.5} max={8} step={0.1} value={p.dist} onChange={(v) => update('dist', v)} variant="default" />
            <Slider labeled label="Field of view" min={20} max={90} step={1} value={p.fov} onChange={(v) => update('fov', roundIfNum(v))} variant="default" />
            <ToggleSwitch variant="plain" label="Camera motion" checked={p.cameraMotion} onChange={(v) => update('cameraMotion', v)} />
            {p.cameraMotion && (
              <>
                <LabeledControl label="preset">
                  <Dropdown size="sm" variant="subtle" className="w-full" options={PRESETS} value={p.motionPreset} onChange={(v) => update('motionPreset', v)} />
                </LabeledControl>
                <Slider labeled label="Motion speed" min={0.02} max={1.5} step={0.02} value={p.motionSpeed} onChange={(v) => update('motionSpeed', v)} variant="default" />
              </>
            )}
          </Section>

          <Section label="Background">
            <ColorField label="Color" value={p.bg} onChange={(c) => update('bg', c)} />
            <Slider labeled label="Opacity" min={0} max={1} step={0.01} value={p.bgAlpha} onChange={(v) => update('bgAlpha', v)} variant="default" />
          </Section>
        </>
      )}
    </SynthShell>
  )
}
