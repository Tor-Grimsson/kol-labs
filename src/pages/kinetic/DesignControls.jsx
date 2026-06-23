import Textarea from '../../components/atoms/Textarea.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import PatternControls from '../loops/PatternControls.jsx'
import { useState } from 'react'
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
  pattern, onPattern,
  hideContent = false,
}) {
  const [patTab, setPatTab] = useState('pattern')
  return (
    <>
      <Section label="Theme">
        <LabeledControl inline label="Theme">
          <Dropdown variant="subtle" size="sm" openUp className="w-full" value={themeId} onChange={onTheme} options={THEME_OPTIONS} />
        </LabeledControl>
        <ToggleSwitch variant="plain" labeled label="Invert" checked={invert} onChange={onInvert} />
      </Section>

      <Section label="Colour scheme">
        <ColorField label="Background" value={frameBg} onChange={onFrameBg} />
        <ColorField label="Text" value={instances[0]?.fill || '#e8e4dc'} onChange={onAllFill} />
      </Section>

      {!hideContent && (
        <>
          <Divider />
          <Section label="Content">
            {instances.map((ins) => (
              <Textarea key={ins.id} value={ins.text} onChange={(e) => onText(ins.id, e.target.value)} rows={2} resize="vertical" placeholder="Type…" />
            ))}
          </Section>
        </>
      )}

      {pattern && onPattern && (
        <>
          <Divider />
          <Section label="Pattern background">
            <ToggleSwitch variant="plain" labeled label="Pattern fill" checked={!!pattern.on} onChange={(v) => {
              onPattern('on', v)
              // seed glyph mode + a word-friendly grid (a wide word in a dense square
              // grid reads as mush) the first time it's enabled.
              if (v && pattern.shape !== 'glyph') { onPattern('shape', 'glyph'); onPattern('cols', 2); onPattern('rows', 4); onPattern('cell', 200); onPattern('gap', 12) }
            }} />
          </Section>
          {pattern.on && (
            <>
              <SegmentedToggle value={patTab} onChange={setPatTab} options={[{ value: 'pattern', label: 'Pattern' }, { value: 'animation', label: 'Animation' }]} />
              <PatternControls values={pattern} onChange={onPattern} tab={patTab} glyphBound />
            </>
          )}
        </>
      )}
    </>
  )
}
