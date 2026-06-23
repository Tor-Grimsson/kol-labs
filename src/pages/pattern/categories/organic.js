import { R, PAL } from './_helpers.js'

// ORGANIC — bands with a wavy/undulating edge PROFILE (render:'field', field:'organic'):
// flowing water/contour stripes, drawn as cheap vector paths. Same band model as
// Stripes (angle/pitch/bands + palette) plus a wave:
//   waveAmp   undulation depth (× pitch)      waveFreq  waves across the field
// camFlow undulates the wave (whole cycles ⇒ seamless; paused on load).
// A few genuine dot/abstract tile marks are kept on the tile engine for variety.

const wave = (o) => ({ render: 'field', field: 'organic', ...o })

export default [
  // ── wavy bands ──
  { id: 'waves', label: 'Waves', params: wave({
    stripeAngle: 90, stripePitch: 90, bandCount: 2, waveAmp: 0.4, waveFreq: 1.4,
    color: PAL.sky, color2: PAL.ink2 }) },
  { id: 'tide', label: 'Tide', params: wave({
    stripeAngle: 90, stripePitch: 110, bandCount: 3, waveAmp: 0.5, waveFreq: 1,
    color: PAL.teal, color2: PAL.navy, color3: PAL.sky }) },
  { id: 'dunes', label: 'Dunes', params: wave({
    stripeAngle: 90, stripePitch: 120, bandCount: 3, waveAmp: 0.6, waveFreq: 0.8,
    color: PAL.gold, color2: PAL.ochre, color3: PAL.amber }) },
  { id: 'ripple', label: 'Ripple', params: wave({
    stripeAngle: 90, stripePitch: 60, bandCount: 2, waveAmp: 0.35, waveFreq: 2.4,
    color: PAL.bone, color2: PAL.teal }) },
  { id: 'contour', label: 'Contour', params: wave({
    stripeAngle: 90, stripePitch: 70, bandCount: 3, waveAmp: 0.45, waveFreq: 1.6,
    color: PAL.moss, color2: PAL.forest, color3: PAL.olive }) },
  { id: 'strata', label: 'Strata', params: wave({
    stripeAngle: 90, stripePitch: 100, bandCount: 3, waveAmp: 0.3, waveFreq: 1.1,
    color: PAL.rust, color2: PAL.brick, color3: PAL.coral }) },
  { id: 'current', label: 'Current', params: wave({
    stripeAngle: 90, stripePitch: 80, bandCount: 2, waveAmp: 0.55, waveFreq: 1.8,
    color: PAL.blue, color2: PAL.navy }) },
  { id: 'swell', label: 'Swell', params: wave({
    stripeAngle: 90, stripePitch: 140, bandCount: 2, waveAmp: 0.7, waveFreq: 0.7,
    color: PAL.sky, color2: PAL.ink2 }) },
  { id: 'marble', label: 'Marble', params: wave({
    stripeAngle: 70, stripePitch: 64, bandCount: 3, waveAmp: 0.5, waveFreq: 2,
    color: PAL.bone, color2: PAL.slate, color3: PAL.oat }) },
  { id: 'lava-flow', label: 'Lava flow', params: wave({
    stripeAngle: 90, stripePitch: 96, bandCount: 3, waveAmp: 0.65, waveFreq: 1.2,
    color: PAL.amber, color2: PAL.red, color3: PAL.brick }) },
  { id: 'aurora', label: 'Aurora', params: wave({
    stripeAngle: 80, stripePitch: 110, bandCount: 3, waveAmp: 0.6, waveFreq: 1.3,
    color: PAL.teal, color2: PAL.purple, color3: PAL.sky }) },
  { id: 'sand', label: 'Sand', params: wave({
    stripeAngle: 90, stripePitch: 48, bandCount: 2, waveAmp: 0.3, waveFreq: 2.6,
    color: PAL.oat, color2: PAL.camel }) },

  // ── dot & abstract marks (genuine tiles) ──
  { id: 'polka', label: 'Polka', params: {
    shape: 'prim:circle', cols: 6, rows: 6, cell: 120, gap: 14,
    colorRule: 'checker', color: PAL.cream, color2: PAL.red, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.25 } },
  { id: 'pin-dots', label: 'Pin dots', params: {
    shape: 'prim:circle', cols: 14, rows: 14, cell: 70, gap: 18,
    color: PAL.bone, bg: PAL.navy,
    animAxis: 'radial', animWaves: 3, fade: 0.3 } },
  { id: 'halftone', label: 'Halftone', params: {
    shape: 'prim:circle', cols: 22, rows: 22, cell: 52, gap: 6,
    color: PAL.ink, bg: PAL.bone,
    animAxis: 'radial', animWaves: 3, pulse: 0.4 } },
  { id: 'honeycomb', label: 'Honeycomb', params: {
    shape: 'prim:hexagon', cols: 8, rows: 8, cell: 120, gap: 6,
    color: PAL.gold, bg: PAL.ochre,
    animAxis: 'radial', animWaves: 2, fade: 0.2 } },
  { id: 'scatter', label: 'Scatter', params: {
    shape: 'prim:circle', cols: 16, rows: 16, cell: 80, gap: 8,
    color: PAL.gold, bg: PAL.ink,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*12.9 + row*7.3) - 0.2', hide: true })],
    animAxis: 'radial', animWaves: 3, fade: 0.35 } },
  { id: 'petals', label: 'Petals', params: {
    shape: 'abstract:abstract-01', cols: 6, rows: 6, cell: 150, gap: 8,
    colorRule: 'checker', color: PAL.pink, color2: PAL.rose, bg: PAL.plum,
    spin: 1, animAxis: 'diag', animWaves: 2, swing: 35, fade: 0.25 } },
]
