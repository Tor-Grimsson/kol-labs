import { PAL } from './_helpers.js'

// STRIPES — a continuous directional band FIELD (render:'field', field:'stripes'),
// not tiles. The stripe engine (src/loops/pattern/fields/stripeField.js) reads the
// palette: color/color2/color3 are the bands, bg is the ground for pinstripes.
//   stripeAngle  0 vertical · 90 horizontal · 45 diagonal
//   stripePitch  band width (field units)        bandCount  1 single · 2 A/B · 3 A/B/C
//   duty         1 = solid bands · <1 = ink band of that width on the bg ground
//   edgeSoftness 0 = hard · >0 = soft / ombré blend
// camFlow drifts the bands (barber-pole) — whole cycles ⇒ seamless; page loads
// paused, so it only moves on play. Scale is varied on purpose (wide awnings →
// fine corduroy). `stripe()` stamps the render kind so every preset is a field.

const stripe = (o) => ({ render: 'field', field: 'stripes', waveAmp: 0, ...o })

export default [
  // ── solid colour bands ──
  { id: 'awning', label: 'Awning', params: stripe({
    stripeAngle: 0, stripePitch: 96, bandCount: 2, duty: 1,
    color: PAL.red, color2: PAL.cream, bg: PAL.ink }) },
  { id: 'deckchair', label: 'Deckchair', params: stripe({
    stripeAngle: 0, stripePitch: 64, bandCount: 3, duty: 1,
    color: PAL.teal, color2: PAL.amber, color3: PAL.coral, bg: PAL.ink }) },
  { id: 'corduroy', label: 'Corduroy', params: stripe({
    stripeAngle: 0, stripePitch: 16, bandCount: 3, duty: 1,
    color: PAL.rust, color2: PAL.brick, color3: PAL.coral, bg: PAL.noir }) },
  { id: 'candy', label: 'Candy', params: stripe({
    stripeAngle: 45, stripePitch: 48, bandCount: 3, duty: 1,
    color: PAL.red, color2: PAL.bone, color3: PAL.rose, bg: PAL.ink }) },
  { id: 'gradient-bands', label: 'Gradient bands', params: stripe({
    stripeAngle: 0, stripePitch: 64, bandCount: 2, duty: 1, edgeSoftness: 1,
    color: PAL.violet, color2: PAL.sky, bg: PAL.noir }) },

  // ── diagonal ──
  { id: 'barber', label: 'Barber', params: stripe({
    stripeAngle: 72, stripePitch: 40, bandCount: 3, duty: 1,
    color: PAL.red, color2: PAL.bone, color3: PAL.blue, bg: PAL.ink }) },
  { id: 'chevron', label: 'Chevron', params: stripe({
    stripeAngle: 60, stripePitch: 40, bandCount: 3, duty: 1,
    color: PAL.teal, color2: PAL.cream, color3: PAL.navy, bg: PAL.ink }) },

  // ── pinstripe / lines (ink band on a ground) ──
  { id: 'pinstripe', label: 'Pinstripe', params: stripe({
    stripeAngle: 0, stripePitch: 40, bandCount: 1, duty: 0.12,
    color: PAL.cream, bg: PAL.navy }) },
  { id: 'venetian', label: 'Venetian', params: stripe({
    stripeAngle: 90, stripePitch: 46, bandCount: 1, duty: 0.62,
    color: PAL.oat, bg: PAL.slate }) },
]
