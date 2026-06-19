import Slider from '../../components/atoms/Slider.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Button from '../../components/atoms/Button.jsx'
import OpenTypeMenu from './OpenTypeMenu.jsx'
import { FONT_OPTIONS, AXIS_LABELS, fontByKey } from './lib/vfAxes.js'
import { CURVE_OPTIONS, MORPH_MODE_OPTIONS } from './engine/morph.js'
import { roundIfNum } from '../../lib/exprParam.js'

const ALIGN = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
]

const CASE_OPTIONS = [
  { value: 'none', label: 'Aa' },
  { value: 'upper', label: 'AA' },
  { value: 'lower', label: 'aa' },
  { value: 'title', label: 'Tt' },
]

/**
 * Morph — the glyph-outline interpolation panel ("morph monster"). Cut A is this
 * instance's own font + axes; Cut B is a second set of axis coords on the SAME
 * variable font, or a different face entirely (cross-face). Three modes:
 *   morph  — real per-glyph bézier-path interpolation, distributed by a curve
 *   fade   — opacity crossfade between Cut A and Cut B layers
 *   random — every letter a random cut (the ransom-note look)
 */
function MorphPanel({ instance, font, setMorph, setMorphVf2 }) {
  const m = instance.morph || {}
  const on = !!m.on
  const mode = m.mode || 'morph'
  const cross = !!m.face2
  const showCutB = mode === 'morph' || mode === 'fade'
  const faceOptions = FONT_OPTIONS

  return (
    <Section label="Morph">
      <ToggleSwitch variant="plain" labeled label="Morph outlines" checked={on} onChange={(v) => setMorph('on', v)} />
      {on && (
        <div className="flex flex-col gap-3 pt-1">
          <SegmentedToggle value={mode} onChange={(v) => setMorph('mode', v)} options={MORPH_MODE_OPTIONS} />

          {showCutB && (
            <>
              <ToggleSwitch
                variant="plain" labeled label="Cross-face (Cut B)"
                checked={cross}
                onChange={(v) => setMorph('face2', v ? (faceOptions[0]?.value || '') : '')}
              />
              {cross ? (
                <LabeledControl inline label="Cut B face">
                  <Dropdown variant="subtle" size="sm" className="w-full" options={faceOptions} value={m.face2} onChange={(v) => setMorph('face2', v)} />
                </LabeledControl>
              ) : font.axes.length ? (
                font.axes.map((a) => (
                  <Slider labeled noExpr
                    key={a.tag}
                    label={`Cut B · ${AXIS_LABELS[a.tag] || a.tag}`}
                    min={a.min} max={a.max} step={1}
                    value={m.vf2?.[a.tag] ?? a.max}
                    onChange={(v) => setMorphVf2(a.tag, Math.round(v))}
                    variant="default"
                  />
                ))
              ) : (
                <div className="kol-helper-10 text-meta">Static font — turn on Cross-face to morph into another face.</div>
              )}
            </>
          )}

          {mode === 'morph' && (
            <LabeledControl inline label="Curve">
              <Dropdown variant="subtle" size="sm" className="w-full" options={CURVE_OPTIONS} value={m.curve || 'flat'} onChange={(v) => setMorph('curve', v)} />
            </LabeledControl>
          )}

          <Slider labeled
            label={mode === 'random' ? 'Seed' : 'Blend'}
            min={0} max={1} step={0.01}
            value={m.blend ?? 0.5}
            onChange={(v) => setMorph('blend', v)}
            formatValue={(v) => `${Math.round((typeof v === 'number' ? v : 0) * 100)}%`}
            variant="default"
          />
        </div>
      )}
    </Section>
  )
}

/**
 * Edit tab — the SELECTED instance's typography: font · size · tracking · align ·
 * fill, variable-font axes, OpenType features, and the Morph panel. (Motion lives
 * in Layout; text content in Design.)
 */
export default function EditControls({ instance, set, setVf, setOt, setMorph, setMorphVf2 }) {
  if (!instance) {
    return <div className="kol-mono-12 text-meta">Select an instance in Layout to edit it.</div>
  }
  const font = fontByKey(instance.font)
  return (
    <>
      <Section label="Type">
        <Dropdown variant="subtle" size="sm" className="w-full" options={FONT_OPTIONS} value={instance.font} onChange={(v) => set('font', v)} />
        <Slider labeled label="Size" min={4} max={1200} step={1} value={instance.fontSize} onChange={(v) => set('fontSize', roundIfNum(v))} variant="default" />
        <Slider labeled label="Tracking" min={-40} max={400} step={1} value={instance.letterSpacing} onChange={(v) => set('letterSpacing', roundIfNum(v))} variant="default" />
        <LabeledControl inline label="Case">
          <SegmentedToggle value={instance.case || 'none'} onChange={(v) => set('case', v)} options={CASE_OPTIONS} />
        </LabeledControl>
        <LabeledControl inline label="Align">
          <Dropdown variant="subtle" size="sm" className="w-full" options={ALIGN} value={instance.align} onChange={(v) => set('align', v)} />
        </LabeledControl>
        <ToggleSwitch variant="plain" labeled label="Italic" checked={!!instance.italic} onChange={(v) => set('italic', v)} />
        <ColorField label="Fill" value={instance.fill} onChange={(c) => set('fill', c)} />
      </Section>

      <Section label="Axes">
        {font.axes.length === 0 && <div className="kol-helper-10 text-meta">Static font — no variable axes.</div>}
        {font.axes.map((a) => (
          <Slider labeled
            key={a.tag}
            label={AXIS_LABELS[a.tag] || a.tag}
            min={a.min}
            max={a.max}
            step={1}
            value={instance.vf?.[a.tag] ?? a.def}
            onChange={(v) => setVf(a.tag, roundIfNum(v))}
            variant="default"
          />
        ))}
      </Section>

      <Section label="OpenType">
        <OpenTypeMenu value={instance.opentype} onToggle={setOt} />
      </Section>

      <MorphPanel instance={instance} font={font} setMorph={setMorph} setMorphVf2={setMorphVf2} />
    </>
  )
}
