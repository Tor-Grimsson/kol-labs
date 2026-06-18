import ColorSwatch from '../atoms/ColorSwatch'
import { HueStrip, SBSquare } from './SpectrumControls'
import { hexToHsv, hsvToHex, clampHex } from './hsv'
import { DEFAULT_PRESETS } from './presets'

/**
 * ColorPicker — the popover body. Ports the reference colour panel's default
 * "Hue" mode: SB square + hue strip + a preset swatch grid. Plain `value` /
 * `onChange` (hex string) — no editor target binding.
 *
 * No hex text field here by design: hex entry lives in the inline ColorField
 * row above the popover (matching the reference, whose Colour tab has no hex
 * field — the swatch row owns it). The spectrum widgets always emit a valid
 * hex, so every onChange from here is complete.
 */
export default function ColorPicker({ value, onChange, presets = DEFAULT_PRESETS, width = 224 }) {
  const hex = clampHex(value)
  const hsv = hexToHsv(hex)

  const set   = (next) => onChange(clampHex(next))
  const onHue = (h)    => set(hsvToHex(h, hsv.s, hsv.v))
  const onSV  = (s, v) => set(hsvToHex(hsv.h, s, v))

  return (
    <div className="flex flex-col gap-3" style={{ width }}>
      <div className="rounded-[2px] overflow-hidden" style={{ height: 150 }}>
        <SBSquare hue={hsv.h} sat={hsv.s} val={hsv.v} onChange={onSV} />
      </div>
      <HueStrip hue={hsv.h} onChange={onHue} />

      {presets?.length ? (
        <div className="flex flex-wrap gap-1">
          {presets.map((p, i) => (
            <ColorSwatch
              key={`${p}-${i}`}
              hex={p}
              size={18}
              radius="tight"
              frame={false}
              selected={clampHex(p) === hex}
              onClick={() => set(p)}
              title={clampHex(p)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
