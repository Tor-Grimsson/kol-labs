import Textarea from '../../components/atoms/Textarea.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import { THEME_OPTIONS } from '../../lib/themes.js'

/**
 * Design tab — the FRAME: theme + colour scheme, then the text content of every
 * instance (the "what text/sentences"). Per-instance typography lives in Edit;
 * the instance list + arrangement lives in Layout.
 */
export default function DesignControls({
  themeId, onTheme, invert, onInvert,
  frameBg, onFrameBg, onAllFill,
  instances, onText,
}) {
  return (
    <>
      <Section label="Theme">
        <LabeledControl inline label="Theme">
          <Dropdown variant="subtle" size="sm" className="w-full" value={themeId} onChange={onTheme} options={THEME_OPTIONS} />
        </LabeledControl>
        <ToggleSwitch variant="plain" labeled label="Invert" checked={invert} onChange={onInvert} />
      </Section>

      <Section label="Colour scheme">
        <ColorField label="Background" value={frameBg} onChange={onFrameBg} />
        <ColorField label="Text" value={instances[0]?.fill || '#e8e4dc'} onChange={onAllFill} />
      </Section>

      <Divider />

      <Section label="Content">
        {instances.map((ins) => (
          <Textarea key={ins.id} value={ins.text} onChange={(e) => onText(ins.id, e.target.value)} rows={2} resize="vertical" placeholder="Type…" />
        ))}
      </Section>
    </>
  )
}
