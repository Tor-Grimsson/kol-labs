import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'

const PRESETS = [
  { value: 'orbit', label: 'Orbit' },
  { value: 'spin', label: 'Spin' },
  { value: 'rock', label: 'Rock' },
  { value: 'rise', label: 'Rise' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
]

// Default relief-camera state. Near front-on (low pitch) so the default reads as
// a scaled-in-frame pattern, not a tilted 3D object — dolly (Distance) is the
// primary framing control, orbit (Yaw/Pitch) is secondary.
export const RELIEF_DEFAULTS = {
  on: false, res: 200, displace: 1.2, opacity: 1,
  dist: 3, fov: 45, yaw: 0, pitch: 0.15,
  cameraMotion: false, motionPreset: 'orbit', motionSpeed: 0.3,
}

// Shared 3D-relief camera panel for the optic 2D effects (Moiré, Halftone). The
// flat pattern becomes a luminance-displaced relief; Distance/FOV scale it in the
// frame (dolly-zoom), Yaw/Pitch orbit it. Drag the stage to orbit, wheel to zoom.
export default function CameraControls({ cam, update }) {
  return (
    <Section label="3D Relief">
      <ToggleSwitch labeled variant="plain" label="Enable" checked={cam.on} onChange={(v) => update('on', v)} />
      {cam.on && (
        <>
          <Slider labeled label="Distance" min={1.5} max={8} step={0.1} value={cam.dist} onChange={(v) => update('dist', v)} variant="default" />
          <Slider labeled label="Field of view" min={20} max={90} step={1} value={cam.fov} onChange={(v) => update('fov', roundIfNum(v))} variant="default" />
          <Slider labeled label="Relief depth" min={0} max={3} step={0.05} value={cam.displace} onChange={(v) => update('displace', v)} variant="default" />
          <Slider labeled label="Resolution" min={40} max={360} step={4} value={cam.res} onChange={(v) => update('res', roundIfNum(v))} variant="default" />
          <Slider labeled label="Line opacity" min={0.05} max={1} step={0.01} value={cam.opacity} onChange={(v) => update('opacity', v)} variant="default" />
          <Slider labeled label="Yaw" min={-3.14} max={3.14} step={0.02} value={cam.yaw} onChange={(v) => update('yaw', v)} variant="default" />
          <Slider labeled label="Pitch" min={-1.4} max={1.4} step={0.02} value={cam.pitch} onChange={(v) => update('pitch', v)} variant="default" />
          <ToggleSwitch labeled variant="plain" label="Camera motion" checked={cam.cameraMotion} onChange={(v) => update('cameraMotion', v)} />
          {cam.cameraMotion && (
            <>
              <LabeledControl label="preset">
                <Dropdown size="sm" variant="subtle" className="w-full" options={PRESETS} value={cam.motionPreset} onChange={(v) => update('motionPreset', v)} />
              </LabeledControl>
              <Slider labeled label="Motion speed" min={0.02} max={1.5} step={0.02} value={cam.motionSpeed} onChange={(v) => update('motionSpeed', v)} variant="default" />
            </>
          )}
        </>
      )}
    </Section>
  )
}
