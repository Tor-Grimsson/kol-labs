import { useState } from 'react'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Input from '../../components/atoms/Input.jsx'
import { roundIfNum } from '../../lib/exprParam.js'
import Button from '../../components/atoms/Button.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Section from '../../components/molecules/Section.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import ColorField from '../../components/color/ColorField.jsx'
import RuleRow from './RuleRow.jsx'
import { SHAPE_OPTIONS } from '../../loops/pattern/shapes.js'
import { SETT_OPTIONS } from '../../loops/pattern/fields/setts.js'
import { profileToNodes } from '../../loops/pattern/fields/organicField.js'
import ProfileEditor from './ProfileEditor.jsx'
import { newRule, randomRule } from '../../loops/pattern/rules.js'
import { randFill, randShape, randWeaveType } from '../../loops/pattern/randomize.js'
import { FONT_OPTIONS, fontByKey } from '../kinetic/lib/vfAxes.js'

const PAN_DIRS = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'diag', label: 'Diagonal' },
  { value: 'anti', label: 'Anti-Diag' },
]

// Motion is two orthogonal axes, each with its own preset dropdown:
//
//   FRAME — the camera/viewport moving over the pattern (pan speed + direction).
//   FORM  — the tiles animating in place (spin + the per-cell pulse/fade/sway/
//           colour sweep). Named "Form" (not "Pattern") to avoid colliding with
//           the Pattern *tab* (the structure editor).
//
// A preset's `params` patches ONLY its own axis (Frame never touches the sweep,
// Form never touches the camera) so the two compose freely. Framing
// (camZoom/camAngle) belongs to neither — left as the user set it. Editing any
// control on an axis drops THAT axis's selector to 'custom' — a display-only
// state the dropdown surfaces ONLY while it's active (see presetOpts), never a
// pickable 'off' twin of Static. 'Static' is the real motion-off preset.
const FRAME_PRESETS = [
  { id: 'static', label: 'Static',     params: { camFlow: 0 } },
  { id: 'pan-right', label: 'Pan Right', params: { camFlow: 1, panDir: 'right' } },
  { id: 'pan-left',  label: 'Pan Left',  params: { camFlow: 1, panDir: 'left' } },
  { id: 'pan-up',    label: 'Pan Up',    params: { camFlow: 1, panDir: 'up' } },
  { id: 'pan-down',  label: 'Pan Down',  params: { camFlow: 1, panDir: 'down' } },
  { id: 'drift',     label: 'Drift',     params: { camFlow: 1, panDir: 'diag' } },
  { id: 'glide',     label: 'Glide',     params: { camFlow: 2, panDir: 'anti' } },
]

const FORM_PRESETS = [
  { id: 'static',     label: 'Static',       params: { spin: 0, animAxis: 'none',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'spin',       label: 'Spin',         params: { spin: 1, animAxis: 'none',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'breathe',    label: 'Breathe',      params: { spin: 0, animAxis: 'radial', animCycles: 1, animWaves: 2, pulse: 0.6, fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'pulse-wave', label: 'Pulse Wave',   params: { spin: 0, animAxis: 'diag',   animCycles: 1, animWaves: 3, pulse: 0.7, fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'fade-wave',  label: 'Fade Wave',    params: { spin: 0, animAxis: 'col',    animCycles: 1, animWaves: 2, pulse: 0,   fade: 0.8, swing: 0,  colorMix: 0 } },
  { id: 'sway',       label: 'Sway',         params: { spin: 0, animAxis: 'diag',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 60, colorMix: 0 } },
  { id: 'colour-sweep', label: 'Colour Sweep', params: { spin: 0, animAxis: 'diag', animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 0,  colorMix: 1 } },
  { id: 'ripple',     label: 'Ripple',       params: { spin: 0, animAxis: 'radial', animCycles: 1, animWaves: 4, pulse: 0.5, fade: 0.5, swing: 0,  colorMix: 0 } },
]

// Organic edge profiles — a library of band-edge silhouettes (smooth → harsh,
// simple → complex), mirrors fields/organicField.js PROFILES.
const WAVE_PROFILES = [
  { value: 'sine', label: 'Sine' },
  { value: 'blob', label: 'Blob' },
  { value: 'hump', label: 'Hump' },
  { value: 'swell', label: 'Swell' },
  { value: 'double', label: 'Double' },
  { value: 'ripple', label: 'Ripple' },
  { value: 'tri', label: 'Triangle' },
  { value: 'ridge', label: 'Ridge' },
  { value: 'pinch', label: 'Pinch' },
  { value: 'saw', label: 'Saw' },
  { value: 'step', label: 'Step' },
  { value: 'custom', label: 'Custom' },
]

// Field Form presets — the per-family analogue of FORM_PRESETS (tiles). Each patches
// only the field-motion params (Pattern-tab base values are left alone), so they
// compose with any Frame preset. Picked per `field` in the Motion → Form dropdown.
// Stripes/organic animate PER-BAND (Sway + Stagger; Stagger 1 ⇒ odd/even opposite).
const BAND_FORM_PRESETS = [
  { id: 'static',    label: 'Static',    params: { fieldSway: 0,    fieldStagger: 0,   fieldCycles: 1 } },
  { id: 'sway',      label: 'Sway',      params: { fieldSway: 0.5,  fieldStagger: 0.3, fieldCycles: 1 } },
  { id: 'alternate', label: 'Alternate', params: { fieldSway: 0.6,  fieldStagger: 1,   fieldCycles: 1 } },
  { id: 'ripple',    label: 'Ripple',    params: { fieldSway: 0.45, fieldStagger: 0.5, fieldCycles: 1 } },
]
// Tartan animates PER-BAND like stripes/organic — each sett band pulses its width,
// staggered across band index — so it shares BAND_FORM_PRESETS (real form, not the
// old field-wide breathe).
const FIELD_FORM_PRESETS = { stripes: BAND_FORM_PRESETS, organic: BAND_FORM_PRESETS, tartan: BAND_FORM_PRESETS }

// Weave Form presets — per-crossing pulse/fade swept diagonally (the weave analogue
// of the tile FORM_PRESETS; spin/swing/colourMix don't apply to ribbons).
const WEAVE_FORM_PRESETS = [
  { id: 'static', label: 'Static', params: { animAxis: 'none',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0 } },
  { id: 'pulse',  label: 'Pulse',  params: { animAxis: 'diag',   animCycles: 1, animWaves: 3, pulse: 0.6, fade: 0 } },
  { id: 'fade',   label: 'Fade',   params: { animAxis: 'col',    animCycles: 1, animWaves: 2, pulse: 0,   fade: 0.7 } },
  { id: 'ripple', label: 'Ripple', params: { animAxis: 'radial', animCycles: 1, animWaves: 4, pulse: 0.4, fade: 0.4 } },
]

// Field Frame presets — a band field only drifts perpendicular to its bands, so the
// tile Pan-L/R/U/D directions collapse to one look. These vary what actually reads:
// speed + direction (the motion ANGLE is the band Angle, in the Pattern tab).
const FIELD_FRAME_PRESETS = [
  { id: 'static',   label: 'Static',   params: { camFlow: 0, panDir: 'right' } },
  { id: 'drift',    label: 'Drift',    params: { camFlow: 1, panDir: 'right' } },
  { id: 'reverse',  label: 'Reverse',  params: { camFlow: 1, panDir: 'left' } },
  { id: 'glide',    label: 'Glide',    params: { camFlow: 2, panDir: 'right' } },
  { id: 'rush',     label: 'Rush',     params: { camFlow: 3, panDir: 'right' } },
  // Skewed — set a diagonal band angle so the drift runs at an angle (not vertical/horizontal).
  { id: 'bias',     label: 'Bias',     params: { camFlow: 1, panDir: 'right', stripeAngle: 30 } },
  { id: 'diagonal', label: 'Diagonal', params: { camFlow: 1, panDir: 'right', stripeAngle: 45 } },
  { id: 'counter',  label: 'Counter',  params: { camFlow: 1, panDir: 'right', stripeAngle: 135 } },
]
const FIELD_DIRS = [{ value: 'right', label: 'Forward' }, { value: 'left', label: 'Reverse' }, { value: 'split', label: 'Split (odd/even)' }]
const FILL_MODES = [{ value: 'off', label: 'Off' }, { value: 'extend', label: 'Extend' }, { value: 'solid', label: 'Solid' }]
// Organic moves on two axes (Flow = across · Travel = the wave runs along), so it
// gets richer Frame presets that exercise both — across, along, and diagonal (both).
const ORGANIC_FRAME_PRESETS = [
  { id: 'static',   label: 'Static',   params: { camFlow: 0, waveFlow: 0, panDir: 'right' } },
  { id: 'drift',    label: 'Drift',    params: { camFlow: 1, waveFlow: 0, panDir: 'right' } },
  { id: 'travel',   label: 'Travel',   params: { camFlow: 0, waveFlow: 1, panDir: 'right' } },
  { id: 'both',     label: 'Both',     params: { camFlow: 1, waveFlow: 1, panDir: 'right' } },
  { id: 'reverse',  label: 'Reverse',  params: { camFlow: 1, waveFlow: 0, panDir: 'left' } },
  { id: 'glide',    label: 'Glide',    params: { camFlow: 1, waveFlow: 2, panDir: 'right' } },
  { id: 'diagonal', label: 'Diagonal', params: { camFlow: 1, waveFlow: 1, panDir: 'right', stripeAngle: 45 } },
]

const WEAVE_OPTIONS = [
  { value: 'plain', label: 'Plain' },
  { value: 'twill', label: 'Twill' },
  { value: 'satin', label: 'Satin' },
  { value: 'basket', label: 'Basket' },
]

const SWEEP_AXES = [
  { value: 'none', label: 'None' },
  { value: 'diag', label: 'Diagonal' },
  { value: 'col', label: 'Columns' },
  { value: 'row', label: 'Rows' },
  { value: 'radial', label: 'Radial' },
]

// Interleave the base fill across colours by cell index — the clean R/Y/B test
// grid. checker = 2-colour; cols/rows/diag round-robin Shape · Colour 2 · Colour 3.
const COLOR_RULES = [
  { value: 'none', label: 'None' },
  { value: 'checker', label: 'Checker' },
  { value: 'cols', label: 'Columns' },
  { value: 'rows', label: 'Rows' },
  { value: 'diag', label: 'Diagonal' },
]

// The Pattern loop's Edit controls, split across two rail tabs so it isn't one
// giant scroll:
//   tab="pattern"   — what the pattern IS: shape · grid · colour · rules
//   tab="animation" — how it MOVES, on a [Frame | Form] sub-toggle: Frame =
//                     the camera (pan flow/direction + zoom/angle) · Form =
//                     the per-cell sweep (spin · axis/cycles/waves · pulse/fade/
//                     swing/colour-mix). Each axis has its own preset dropdown.
// `onChange(key, value)` patches one param on the loop's params object.
export default function PatternControls({ values, onChange, tab = 'pattern', glyphBound = false }) {
  const v = values
  // Animation tab sub-axis: Frame (camera) vs Form (per-cell sweep). One axis
  // visible at a time so it's always clear which system a control belongs to.
  const [animTab, setAnimTab] = useState('frame')
  // Canonical [swatch][label][hex] row — ColorField owns the label (never wrapped
  // in a LabeledControl; see the ColorField rule).
  const colorCtl = (label, key) => (
    <ColorField label={label} value={v[key]} onChange={(c) => onChange(key, c)} />
  )
  // Inline reroll: apply a randomizer patch (key→value object) one onChange at a time.
  const reroll = (fn) => () => { for (const [k, val] of Object.entries(fn())) onChange(k, val) }

  if (tab === 'animation') {
    // Two orthogonal motion axes (Frame = camera pan · Form = per-cell sweep),
    // each driven by a preset dropdown. Applying a preset patches only its axis;
    // editing any control on that axis reverts ITS selector to 'custom' so it
    // never lies about a hand-tuned state.
    const applyPreset = (key, presets) => (id) => {
      const p = presets.find((x) => x.id === id)
      onChange(key, id)
      if (p?.params) for (const [k, val] of Object.entries(p.params)) onChange(k, val)
    }
    const onAxis = (selKey) => (k, val) => {
      onChange(k, val)
      if ((v[selKey] ?? 'custom') !== 'custom') onChange(selKey, 'custom')
    }
    const onFrame = onAxis('framePreset')
    const onForm = onAxis('formPreset')
    // 'custom' is a display-only state (an axis is hand-tuned) — surface it in the
    // list ONLY while active so it never reads as a second pickable 'off' (Static).
    const presetOpts = (presets, val) => {
      const opts = presets.map((p) => ({ value: p.id, label: p.label }))
      return (val == null || val === 'custom') ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
    }
    // Every render kind now has BOTH motion axes: Frame (the field/grid drift) and
    // Form (per-element animation) — tiles = per-cell sweep · fields = per-band ·
    // weave = per-crossing pulse/fade.
    const tilesRender = (v.render ?? 'tiles') === 'tiles'
    const field = v.field || 'stripes'
    // Frame/Form preset lists: tiles use the tile pan + per-cell sweep presets;
    // fields use their own (a band field can't pan in arbitrary 2D); weave gets a
    // per-crossing pulse/fade Form.
    const framePresets = tilesRender ? FRAME_PRESETS : (field === 'organic' ? ORGANIC_FRAME_PRESETS : FIELD_FRAME_PRESETS)
    const formPresets = tilesRender ? FORM_PRESETS : (v.render === 'weave' ? WEAVE_FORM_PRESETS : (FIELD_FORM_PRESETS[field] || []))
    return (
      <>
        {/* Quick-select layer: pick the Frame + Pattern motion presets without
            entering either detail view. The toggle + sliders below are the deep
            settings; these two dropdowns own preset selection (no in-section dup). */}
        <Section label="Motion">
          <LabeledControl inline label="Frame">
            <Dropdown variant="subtle" size="sm" className="w-full" options={presetOpts(framePresets, v.framePreset)} value={v.framePreset ?? 'custom'} onChange={applyPreset('framePreset', framePresets)} />
          </LabeledControl>
          <LabeledControl inline label="Form">
            <Dropdown variant="subtle" size="sm" className="w-full" options={presetOpts(formPresets, v.formPreset)} value={v.formPreset ?? 'custom'} onChange={applyPreset('formPreset', formPresets)} />
          </LabeledControl>
        </Section>
        {/* Frame | Form — every render kind has both axes: tiles (per-cell sweep),
            fields (per-band), weave (per-crossing pulse/fade). */}
        <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
        {animTab === 'frame' && (
        <Section label="Frame">
          <Slider labeled label="Flow" min={0} max={4} step={1} value={v.camFlow} onChange={(x) => onFrame('camFlow', roundIfNum(x))} variant="default" />
          {/* Along-axis motion (the other screen axis from Flow's across-drift) ⇒ the
              field moves in both X and Y. Organic: the wave runs along · Tartan: the weft
              scrolls · Stripes: runs the wave (only meaningful once Wave > 0). */}
          {(field === 'organic' || field === 'tartan' || (field === 'stripes' && (v.waveAmp ?? 0) > 0)) && (
            <Slider labeled label="Travel" min={0} max={4} step={1} value={v.waveFlow ?? 0} onChange={(x) => onFrame('waveFlow', roundIfNum(x))} variant="default" />
          )}
          {/* Tiles pan the grid in 2D; a band field only drifts perpendicular to its
              bands, so it gets Forward/Reverse (the motion ANGLE is the band Angle). */}
          <LabeledControl inline label="Direction">
            <Dropdown variant="subtle" size="sm" className="w-full" options={(tilesRender || v.render === 'weave') ? PAN_DIRS : FIELD_DIRS} value={v.panDir ?? (tilesRender || v.render === 'weave' ? 'diag' : 'right')} onChange={(val) => onFrame('panDir', val)} />
          </LabeledControl>
          {/* Split separates the bands; Fill decides what's in the gaps. Its own
              reroll lands a random type (+ colour when solid). */}
          {!tilesRender && v.panDir === 'split' && (
            <LabeledControl inline label="Fill">
              <div className="flex items-center gap-1">
                <Dropdown variant="subtle" size="sm" className="w-full" options={FILL_MODES} value={v.fillMode ?? 'off'} onChange={(val) => onChange('fillMode', val)} />
                <Button variant="ghost" size="sm" iconOnly="refresh" title="Randomize fill" className="shrink-0" onClick={reroll(randFill)} />
              </div>
            </LabeledControl>
          )}
          {!tilesRender && v.panDir === 'split' && (v.fillMode ?? 'off') === 'solid' && colorCtl('Fill', 'fillColor')}
          <Slider labeled label="Zoom" min={0.3} max={3} step={0.05} value={v.camZoom} onChange={(x) => onChange('camZoom', x)} variant="default" />
          <Slider labeled label="Angle" min={0} max={360} step={1} value={v.camAngle} onChange={(x) => onChange('camAngle', roundIfNum(x))} variant="default" />
        </Section>
        )}

        {/* Field Form — animates the bands INDIVIDUALLY (Frame moves the whole field).
            Sway shifts/pulses each band; Stagger phases that across band index — at 1,
            neighbours move opposite. Seamless on whole Speed cycles. Same model for
            stripes/organic (position shift) and tartan (band-width pulse). */}
        {v.render === 'field' && animTab === 'form' && (
        <Section label="Form">
          <Slider labeled label="Sway" min={0} max={1} step={0.05} value={v.fieldSway ?? 0} onChange={(x) => onForm('fieldSway', x)} variant="default" />
          <Slider labeled label="Stagger" min={0} max={1} step={0.05} value={v.fieldStagger ?? 0} onChange={(x) => onForm('fieldStagger', x)} variant="default" />
          <Slider labeled label="Speed" min={1} max={4} step={1} value={v.fieldCycles ?? 1} onChange={(x) => onForm('fieldCycles', roundIfNum(x))} variant="default" />
        </Section>
        )}

        {/* Weave Form — per-crossing pulse/fade swept diagonally (axis), the weave
            analogue of the tile sweep. Pulse breathes strand width, Fade its opacity. */}
        {v.render === 'weave' && animTab === 'form' && (
        <Section label="Form">
          <LabeledControl inline label="Axis">
            <Dropdown variant="subtle" size="sm" className="w-full" options={SWEEP_AXES} value={v.animAxis ?? 'none'} onChange={(val) => onForm('animAxis', val)} />
          </LabeledControl>
          <Slider labeled label="Speed" min={1} max={4} step={1} value={v.animCycles ?? 1} onChange={(x) => onForm('animCycles', roundIfNum(x))} variant="default" />
          <Slider labeled label="Stagger" min={0} max={8} step={0.5} value={v.animWaves ?? 2} onChange={(x) => onForm('animWaves', x)} variant="default" />
          <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={v.pulse ?? 0} onChange={(x) => onForm('pulse', x)} variant="default" />
          <Slider labeled label="Fade" min={0} max={1} step={0.05} value={v.fade ?? 0} onChange={(x) => onForm('fade', x)} variant="default" />
        </Section>
        )}

        {tilesRender && animTab === 'form' && (
        <Section label="Form">
          <Slider labeled label="Spin" min={0} max={3} step={1} value={v.spin} onChange={(x) => onForm('spin', roundIfNum(x))} variant="default" />
          <LabeledControl inline label="Axis">
            <Dropdown variant="subtle" size="sm" className="w-full" options={SWEEP_AXES} value={v.animAxis ?? 'none'} onChange={(val) => onForm('animAxis', val)} />
          </LabeledControl>
          <Slider labeled label="Speed" min={1} max={4} step={1} value={v.animCycles ?? 1} onChange={(x) => onForm('animCycles', roundIfNum(x))} variant="default" />
          <Slider labeled label="Stagger" min={0} max={8} step={0.5} value={v.animWaves ?? 2} onChange={(x) => onForm('animWaves', x)} variant="default" />
          <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={v.pulse ?? 0} onChange={(x) => onForm('pulse', x)} variant="default" />
          <Slider labeled label="Fade" min={0} max={1} step={0.05} value={v.fade ?? 0} onChange={(x) => onForm('fade', x)} variant="default" />
          <Slider labeled label="Swing" min={0} max={180} step={5} value={v.swing ?? 0} onChange={(x) => onForm('swing', roundIfNum(x))} variant="default" />
          <Slider labeled label="Colour mix" min={0} max={1} step={0.05} value={v.colorMix ?? 0} onChange={(x) => onForm('colorMix', x)} variant="default" />
          {colorCtl('Colour 2', 'color2')}
        </Section>
        )}
      </>
    )
  }

  // tab === 'pattern' — structure
  // Field render kinds replace the tile Shape/Grid/Rules with the family's own
  // section (those tile controls don't apply to a continuous field). Colour is
  // shared — the field reads the palette (color/color2/color3 + bg ground).
  if (v.render === 'field') {
    const field = v.field || 'stripes'
    return (
      <>
        {field === 'stripes' && (
          <Section label="Stripes">
            <Slider labeled label="Angle" min={0} max={180} step={1} value={v.stripeAngle ?? 0} onChange={(x) => onChange('stripeAngle', roundIfNum(x))} variant="default" />
            <Slider labeled label="Spacing" min={8} max={240} step={1} value={v.stripePitch ?? 60} onChange={(x) => onChange('stripePitch', roundIfNum(x))} variant="default" />
            <Slider labeled label="Offset X" min={0} max={1} step={0.05} value={v.offsetX ?? 0} onChange={(x) => onChange('offsetX', x)} variant="default" />
            <Slider labeled label="Offset Y" min={0} max={1} step={0.05} value={v.offsetY ?? 0} onChange={(x) => onChange('offsetY', x)} variant="default" />
            <Slider labeled label="Bands" min={1} max={3} step={1} value={v.bandCount ?? 2} onChange={(x) => onChange('bandCount', roundIfNum(x))} variant="default" />
            <Slider labeled label="Negative space" min={0} max={0.95} step={0.05} value={1 - (v.duty ?? 1)} onChange={(x) => onChange('duty', 1 - x)} variant="default" />
            <Slider labeled label="Softness" min={0} max={1} step={0.05} value={v.edgeSoftness ?? 0} onChange={(x) => onChange('edgeSoftness', x)} variant="default" />
            {/* Optional wave: 0 = dead straight; >0 makes the bands undulate so Travel can run them. */}
            <Slider labeled label="Wave" min={0} max={1} step={0.05} value={v.waveAmp ?? 0} onChange={(x) => onChange('waveAmp', x)} variant="default" />
            {(v.waveAmp ?? 0) > 0 && <Slider labeled label="Frequency" min={0.3} max={4} step={0.1} value={v.waveFreq ?? 1.5} onChange={(x) => onChange('waveFreq', x)} variant="default" />}
          </Section>
        )}
        {field === 'tartan' && (
          <Section label="Tartan">
            <LabeledControl inline label="Sett">
              <Dropdown variant="subtle" size="sm" className="w-full" options={SETT_OPTIONS} value={v.sett ?? 'black-watch'} onChange={(val) => onChange('sett', val)} />
            </LabeledControl>
            <Slider labeled label="Scale" min={2} max={20} step={1} value={v.settScale ?? 5} onChange={(x) => onChange('settScale', roundIfNum(x))} variant="default" />
            <Slider labeled label="Twill" min={0} max={0.4} step={0.02} value={v.twill ?? 0.18} onChange={(x) => onChange('twill', x)} variant="default" />
          </Section>
        )}
        {field === 'organic' && (
          <Section label="Organic">
            <Slider labeled label="Angle" min={0} max={180} step={1} value={v.stripeAngle ?? 90} onChange={(x) => onChange('stripeAngle', roundIfNum(x))} variant="default" />
            <Slider labeled label="Spacing" min={20} max={240} step={1} value={v.stripePitch ?? 90} onChange={(x) => onChange('stripePitch', roundIfNum(x))} variant="default" />
            <Slider labeled label="Offset X" min={0} max={1} step={0.05} value={v.offsetX ?? 0} onChange={(x) => onChange('offsetX', x)} variant="default" />
            <Slider labeled label="Offset Y" min={0} max={1} step={0.05} value={v.offsetY ?? 0} onChange={(x) => onChange('offsetY', x)} variant="default" />
            <Slider labeled label="Bands" min={1} max={3} step={1} value={v.bandCount ?? 2} onChange={(x) => onChange('bandCount', roundIfNum(x))} variant="default" />
            <Slider labeled label="Amplitude" min={0} max={1} step={0.05} value={v.waveAmp ?? 0.4} onChange={(x) => onChange('waveAmp', x)} variant="default" />
            <Slider labeled label="Frequency" min={0.3} max={4} step={0.1} value={v.waveFreq ?? 1.5} onChange={(x) => onChange('waveFreq', x)} variant="default" />
            <LabeledControl inline label="Profile">
              <Dropdown variant="subtle" size="sm" className="w-full" options={WAVE_PROFILES} value={v.waveProfile ?? 'sine'}
                onChange={(val) => {
                  // Pick a named shape ⇒ reseed the editor from it; pick Custom ⇒ keep/seed a curve.
                  if (val === 'custom') { if (!(Array.isArray(v.waveCurve) && v.waveCurve.length > 1)) onChange('waveCurve', profileToNodes(v.waveProfile ?? 'sine')) }
                  else onChange('waveCurve', null)
                  onChange('waveProfile', val)
                }} />
            </LabeledControl>
            {/* The curve is ALWAYS editable — seeded from whatever profile is selected,
                so you can grab it and tweak right away (which flips it to Custom). */}
            <ProfileEditor
              value={(v.waveProfile === 'custom' && Array.isArray(v.waveCurve) && v.waveCurve.length > 1) ? v.waveCurve : profileToNodes(v.waveProfile ?? 'sine')}
              onChange={(c) => { onChange('waveCurve', c); if (v.waveProfile !== 'custom') onChange('waveProfile', 'custom') }} />
          </Section>
        )}
        <Section label="Colour">
          {field === 'stripes' && <>
            {colorCtl('Colour A', 'color')}
            {(v.bandCount ?? 2) >= 2 && colorCtl('Colour B', 'color2')}
            {(v.bandCount ?? 2) >= 3 && colorCtl('Colour C', 'color3')}
            {(v.duty ?? 1) < 1 && colorCtl('Ground', 'bg')}
          </>}
          {field === 'tartan' && <>
            {colorCtl('Colour 1', 'color')}
            {colorCtl('Colour 2', 'color2')}
            {colorCtl('Colour 3', 'color3')}
            {colorCtl('Ground', 'bg')}
          </>}
          {field === 'organic' && <>
            {colorCtl('Colour A', 'color')}
            {(v.bandCount ?? 2) >= 2 && colorCtl('Colour B', 'color2')}
            {(v.bandCount ?? 2) >= 3 && colorCtl('Colour C', 'color3')}
          </>}
        </Section>
      </>
    )
  }

  // Weave render — interlaced over/under strands (no tile Shape/Grid/Rules).
  if (v.render === 'weave') {
    return (
      <>
        <Section label="Weave">
          <LabeledControl inline label="Type">
            <div className="flex items-center gap-1">
              <Dropdown variant="subtle" size="sm" className="w-full" options={WEAVE_OPTIONS} value={v.weaveType ?? 'plain'} onChange={(val) => onChange('weaveType', val)} />
              <Button variant="ghost" size="sm" iconOnly="refresh" title="Randomize weave" className="shrink-0" onClick={reroll(randWeaveType)} />
            </div>
          </LabeledControl>
          <Slider labeled label="Columns" min={2} max={28} step={1} value={v.cols} onChange={(x) => onChange('cols', roundIfNum(x))} variant="default" />
          <Slider labeled label="Rows" min={2} max={28} step={1} value={v.rows} onChange={(x) => onChange('rows', roundIfNum(x))} variant="default" />
          <Slider labeled label="Cell" min={40} max={240} step={1} value={v.cell} onChange={(x) => onChange('cell', roundIfNum(x))} variant="default" />
          <Slider labeled label="Strand" min={0.3} max={0.95} step={0.02} value={v.strandWidth ?? 0.7} onChange={(x) => onChange('strandWidth', x)} variant="default" />
        </Section>
        <Section label="Colour">
          {colorCtl('Warp', 'color')}
          {colorCtl('Weft', 'color2')}
          {colorCtl('Ground', 'bg')}
        </Section>
      </>
    )
  }

  const rules = v.rules || []
  const setRules = (r) => onChange('rules', r)
  const addRule = () => setRules([...rules, newRule()])
  const updateRule = (i, u) => setRules(rules.map((r, k) => (k === i ? u : r)))
  const removeRule = (i) => setRules(rules.filter((_, k) => k !== i))
  const rerollRule = (i) => setRules(rules.map((r, k) => (k === i ? { ...randomRule(), id: r.id } : r)))
  const randomizeRules = () => setRules(Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => randomRule()))

  return (
    <>
      <Section label="Shape">
        <div className="flex items-center gap-1">
          <Dropdown
            variant="subtle" size="sm" className="w-full" options={SHAPE_OPTIONS} value={v.shape}
            onChange={(val) => {
              onChange('shape', val)
              // Glyph mode tiles a TYPE outline — seed the font url on first pick.
              if (val === 'glyph' && !v.glyphFontUrl) {
                const key = v.glyphFontKey || 'rot'
                onChange('glyphFontKey', key)
                onChange('glyphFontUrl', fontByKey(key).url)
              }
            }}
          />
          <Button variant="ghost" size="sm" iconOnly="refresh" title="Randomize shape" className="shrink-0" onClick={reroll(randShape)} />
        </div>
        {v.shape === 'glyph' && (glyphBound ? (
          <div className="kol-mono-10 text-meta">Tiling the text instance — change the word, font and axes in Content / Edit.</div>
        ) : (
          <>
            <Input value={v.glyphChar ?? 'A'} onChange={(e) => onChange('glyphChar', e.target.value)} placeholder="A" />
            <LabeledControl inline label="Font">
              <Dropdown variant="subtle" size="sm" className="w-full" options={FONT_OPTIONS} value={v.glyphFontKey || 'rot'} onChange={(key) => { onChange('glyphFontKey', key); onChange('glyphFontUrl', fontByKey(key).url) }} />
            </LabeledControl>
          </>
        ))}
        {v.shape === 'custom' && (
          <textarea
            className="w-full h-20 mt-1 p-2 rounded bg-surface-secondary border border-fg-08 kol-mono-12 text-body"
            value={v.customSvg}
            onChange={(e) => onChange('customSvg', e.target.value)}
            placeholder='<svg viewBox="0 0 24 24"><path d="…"/></svg>'
          />
        )}
      </Section>

      <Section label="Grid">
        <Slider labeled label="Columns" min={1} max={32} step={1} value={v.cols} onChange={(x) => onChange('cols', roundIfNum(x))} variant="default" />
        <Slider labeled label="Rows" min={1} max={32} step={1} value={v.rows} onChange={(x) => onChange('rows', roundIfNum(x))} variant="default" />
        <Slider labeled label="Cell size" min={40} max={280} step={1} value={v.cell} onChange={(x) => onChange('cell', roundIfNum(x))} variant="default" />
        <Slider labeled label="Gap" min={-120} max={120} step={1} center={0} value={v.gap} onChange={(x) => onChange('gap', roundIfNum(x))} variant="default" />
        <ToggleSwitch variant="plain" label="Stretch" checked={v.stretch} onChange={(c) => onChange('stretch', c)} />
        <ToggleSwitch variant="plain" label="Grid lines" checked={!!v.showGrid} onChange={(c) => onChange('showGrid', c)} />
      </Section>

      <Section label="Colour">
        {colorCtl('Shape', 'color')}
        <LabeledControl inline label="Interleave">
          <Dropdown variant="subtle" size="sm" className="w-full" options={COLOR_RULES} value={v.colorRule ?? 'none'} onChange={(val) => onChange('colorRule', val)} />
        </LabeledControl>
        {v.colorRule && v.colorRule !== 'none' && colorCtl('Colour 2', 'color2')}
        {(v.colorRule === 'cols' || v.colorRule === 'rows' || v.colorRule === 'diag') && colorCtl('Colour 3', 'color3')}
        {colorCtl('Background', 'bg')}
      </Section>

      <Section label={`Rules · ${rules.length}`}>
        <div className="flex flex-col gap-2">
          {rules.map((rule, i) => (
            <RuleRow key={rule.id} rule={rule} onChange={(u) => updateRule(i, u)} onRemove={() => removeRule(i)} onReroll={() => rerollRule(i)} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="sm" onClick={addRule}>Add rule</Button>
            <Button variant="primary" size="sm" onClick={randomizeRules}>Randomize</Button>
          </div>
        </div>
      </Section>
    </>
  )
}
