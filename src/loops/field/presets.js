// Field loops — continuous per-pixel fields (plasma / rings / stripes / swirl).
// Base draw-fn modules + the picker presets. A preset names a base loop + a
// partial param override. Add a base loop to FIELD_LOOPS, picker entries to
// FIELD_PRESETS.

import gradientField from './gradientField.js'
import halftone from './halftone.js'
import stripes from './stripes.js'
import checkerField from './checkerField.js'
import moire from './moire.js'
import ringsField from './ringsField.js'
import swirl from './swirl.js'
import interference from './interference.js'
import plasma from './plasma.js'
import contour from './contour.js'

export const FIELD_LOOPS = [
  gradientField, halftone, stripes, checkerField, moire,
  ringsField, swirl, interference, plasma, contour,
]

const P = (id, label, loop, params = {}, sub) => ({ id, label, loop, params, sub })

export const FIELD_PRESETS = [
  // Plasma & gradient
  P('gradient-field', 'Gradient field', 'gradient-field', {}, 'Plasma & gradient'),
  P('gradient-sunset', 'Gradient · sunset', 'gradient-field', { colA: '#2b1055', colB: '#d7263d', colC: '#f6c453' }, 'Plasma & gradient'),
  P('plasma', 'Plasma', 'plasma', {}, 'Plasma & gradient'),
  P('plasma-ice', 'Plasma · ice', 'plasma', { colA: '#06283d', colB: '#2a8f8f', colC: '#f4f1ea' }, 'Plasma & gradient'),
  P('contour', 'Contour', 'contour', {}, 'Plasma & gradient'),
  P('contour-ember', 'Contour · ember', 'contour', { colA: '#0b0b0e', colB: '#c2502e', line: '#f6c453' }, 'Plasma & gradient'),
  // Rings & waves
  P('rings-field', 'Rings field', 'rings-field', {}, 'Rings & waves'),
  P('rings-mono', 'Rings · mono', 'rings-field', { colA: '#0b0b0e', colB: '#6b6b6b', colC: '#f4f1ea' }, 'Rings & waves'),
  P('moire', 'Moiré', 'moire', {}, 'Rings & waves'),
  P('moire-warm', 'Moiré · warm', 'moire', { colB: '#c2502e', colC: '#f6c453', freq2: 9 }, 'Rings & waves'),
  P('interference', 'Interference', 'interference', {}, 'Rings & waves'),
  P('interference-5', 'Interference · 5', 'interference', { sources: 5, colB: '#7a3fb0' }, 'Rings & waves'),
  // Bands & cells
  P('stripes', 'Stripes', 'stripes', {}, 'Bands & cells'),
  P('stripes-hard', 'Stripes · hard', 'stripes', { sharp: 0.9, freq: 10 }, 'Bands & cells'),
  P('checker-field', 'Checker field', 'checker-field', {}, 'Bands & cells'),
  P('checker-soft', 'Checker · soft', 'checker-field', { soft: 0.7, colB: '#5a7fb0' }, 'Bands & cells'),
  P('halftone', 'Halftone', 'halftone', {}, 'Bands & cells'),
  P('halftone-warm', 'Halftone · warm', 'halftone', { dot: '#f6c453' }, 'Bands & cells'),
  // Swirl
  P('swirl', 'Swirl', 'swirl', {}, 'Swirl'),
  P('swirl-8', 'Swirl · 8 arms', 'swirl', { arms: 8, colB: '#2a8f8f' }, 'Swirl'),
]
