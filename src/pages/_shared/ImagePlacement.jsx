import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ColorField from '../../components/color/ColorField.jsx'

/**
 * ImagePlacement — THE reusable "how does the source sit in the frame" rail
 * cluster: Cover/Fit · Zoom · Offset X/Y · (optional) Backdrop. Any page
 * that drops an uploaded image/video into an aspect frame should use this so the
 * placement UX is identical everywhere (sibling to `_shared/ExportPanel`).
 *
 * The values map straight onto the refraction/fit shader convention:
 *   fit      'cover' (fill + crop) | 'contain' (fit whole image, letterbox)
 *   zoom     scale the image within the frame (1 = native fit)
 *   offsetX  pan, normalized −0.5…0.5 of the frame
 *   offsetY  pan, normalized −0.5…0.5 of the frame
 *   bg       backdrop colour for the contain letterbox bars (optional)
 *
 *   <ImagePlacement
 *     fit={fit} onFit={setFit}
 *     zoom={zoom} onZoom={setZoom}
 *     offsetX={ox} onOffsetX={setOx} offsetY={oy} onOffsetY={setOy}
 *     bg={bg} onBg={setBg}          // omit onBg to hide the Backdrop row
 *   />
 *
 * Renders its own `Section` (label defaults to "Image"). Backdrop shows only when
 * `onBg` is provided AND fit === 'contain' (it has no effect under Cover).
 */
export const PLACEMENT_DEFAULTS = { fit: 'cover', zoom: 1, offsetX: 0, offsetY: 0 }

export default function ImagePlacement({
  label = 'Image',
  fit, onFit,
  zoom, onZoom,
  offsetX, onOffsetX,
  offsetY, onOffsetY,
  bg, onBg,
}) {
  return (
    <Section label={label}>
      <SegmentedToggle
        options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Fit' }]}
        value={fit}
        onChange={onFit}
        className="w-full"
      />
      <Slider labeled label="Zoom" min={0.2} max={3} step={0.01} value={zoom} onChange={onZoom} variant="default" />
      <Slider labeled label="Offset X" min={-0.5} max={0.5} step={0.005} value={offsetX} onChange={onOffsetX} variant="default" />
      <Slider labeled label="Offset Y" min={-0.5} max={0.5} step={0.005} value={offsetY} onChange={onOffsetY} variant="default" />
      {onBg && fit === 'contain' && <ColorField label="Backdrop" value={bg} onChange={onBg} />}
    </Section>
  )
}
