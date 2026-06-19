// Kinetic presets — each is a COMPOSITION: a frame ({ bg }) holding one or more
// type INSTANCES (text · font · arrangement · variable axes · OpenType · motion).
// `scene` = visual aesthetic (Gallery), `element` = structural building block
// (Library). `presetParams` merges frame + instance defaults into the engine shape.

import { fontByKey, defaultVf } from '../lib/vfAxes.js'
import { PATH_DEFAULTS } from '../engine/paths.js'

export const FRAME_DEFAULTS = { bg: '#16202E' }

export const INSTANCE_DEFAULTS = {
  text: 'Kinetic',
  font: 'gullhamrar',
  fontSize: 120,
  fill: '#e8e4dc',
  letterSpacing: 0,
  align: 'center',
  multiply: 1,              // type multiplier — render N copies of the word in one instance
  flow: 'flow',             // 'flow' = type ignores the frame edges (default) · 'contain' = Paragraph mode, kept inside
  offset: { x: 0, y: 0 },   // normalized position offset from frame centre (drag to move)
  vf: {},
  opentype: {},
  showPath: false,
  path: { type: 'line', ...PATH_DEFAULTS },
  motion: { mode: 'none', cycles: 1, phase: 0.5, amp: 0.3, axis: 'wght', field: 'x' },
}

// S — single-instance preset. `params` IS the one instance; a `bg` on it lifts to
// the frame (so the old single-text presets convert with the same arg order).
const S = (id, label, group, params, sub, scene, element) => {
  const { bg, ...inst } = params
  return { id, label, group, sub, scene, element, frame: bg ? { bg } : {}, instances: [inst] }
}
// M — multi-instance preset. `{ frame?, instances }`.
const M = (id, label, group, { frame = {}, instances }, sub, scene, element) =>
  ({ id, label, group, sub, scene, element, frame, instances })

export const PRESETS = [
  // ── Baseline (Lines) ──
  S('baseline',       'Baseline',    'path',     { text: 'Typography', font: 'gullhamrar', fontSize: 120, vf: { wght: 500 } }, 'Lines',   'flood',  'baseline'),
  S('baseline-mono',  'Mono line',   'path',     { text: 'monospace', font: 'jetbrains', fontSize: 110, fill: '#7fd1ff' },      'Lines',   'flood',  'baseline'),
  S('baseline-light', 'On paper',    'path',     { text: 'Reykjavik', font: 'malromur', fontSize: 130, vf: { wght: 600 }, fill: '#0b0b0e', bg: '#f4f1ea' }, 'Lines', 'flood', 'baseline'),

  // ── Curves / Arcs ──
  S('arc-kinetic',    'Arc',         'path',     { text: 'Kinetic', font: 'gullhamrar', fontSize: 130, vf: { wght: 600 }, path: { type: 'arc', amp: 0.45 } },                             'Curves',  'flow',   'arcs'),
  S('sine-flow',      'Sine flow',   'path',     { text: 'wave along', font: 'ordspor', fontSize: 96, vf: { wght: 500 }, path: { type: 'sine', amp: 0.4, freq: 2 }, motion: { mode: 'march', cycles: 1 } }, 'Curves', 'flow', 'arcs'),
  S('spiral-in',      'Spiral',      'path',     { text: 'spiral', font: 'gullhamrar', fontSize: 88, vf: { wght: 700 }, path: { type: 'spiral', turns: 3 } },                              'Curves',  'flow',   'arcs'),
  S('arc-march',      'Arc march',   'path',     { text: 'on the arc', font: 'rot', fontSize: 96, vf: { wdth: 100, wght: 500 }, path: { type: 'arc', amp: 0.5 }, motion: { mode: 'march' } }, 'Curves', 'flow', 'arcs'),
  S('arc-up',         'High arc',    'path',     { text: 'over the top', font: 'malromur', fontSize: 92, vf: { wght: 600 }, path: { type: 'arc', amp: 0.7 } },                            'Curves',  'flow',   'arcs'),
  S('arc-wide',       'Wide arc',    'path',     { text: 'WIDEARC', font: 'rot', fontSize: 96, vf: { wdth: 150, wght: 600 }, path: { type: 'arc', amp: 0.4 } },                           'Curves',  'flow',   'arcs'),
  S('sine-fast',      'Fast wave',   'path',     { text: 'up and down', font: 'gullhamrar', fontSize: 90, vf: { wght: 600 }, path: { type: 'sine', amp: 0.4, freq: 3 }, motion: { mode: 'march', cycles: 2 } }, 'Curves', 'flow', 'arcs'),
  S('sine-tall',      'Tall wave',   'path',     { text: 'rolling', font: 'ordspor', fontSize: 100, vf: { wght: 500 }, path: { type: 'sine', amp: 0.6, freq: 2 } },                       'Curves',  'wave',   'arcs'),
  S('spiral-march',   'Spiral march','path',     { text: 'into the spiral', font: 'rot', fontSize: 72, vf: { wdth: 100, wght: 500 }, path: { type: 'spiral', turns: 5 }, motion: { mode: 'march', cycles: 1 } }, 'Curves', 'flow', 'arcs'),

  // ── Loops (closed) ──
  S('circle-orbit',   'Circle',      'path',     { text: 'KOLKRABBI', font: 'malromur', fontSize: 80, vf: { wght: 500 }, path: { type: 'circle', radius: 0.72 }, motion: { mode: 'orbit', cycles: 1 } }, 'Closed', 'ring', 'loops'),
  S('ellipse-loop',   'Ellipse',     'path',     { text: 'REYKJAVIK', font: 'rot', fontSize: 78, vf: { wdth: 120, wght: 600 }, path: { type: 'ellipse', radius: 0.92 }, motion: { mode: 'orbit' } }, 'Closed', 'ring', 'loops'),
  S('circle-big',     'Big circle',  'path',     { text: 'AROUND WE GO', font: 'gullhamrar', fontSize: 76, vf: { wght: 600 }, path: { type: 'circle', radius: 0.85 }, motion: { mode: 'orbit' } }, 'Closed', 'ring', 'loops'),
  S('circle-mono',    'Mono circle', 'path',     { text: 'LOOP/LOOP/', font: 'jetbrains', fontSize: 72, fill: '#f6c453', path: { type: 'circle', radius: 0.78 }, motion: { mode: 'orbit' } }, 'Closed', 'ring', 'loops'),
  S('ellipse-wide',   'Wide ellipse','path',     { text: 'ELLIPTICAL', font: 'malromur', fontSize: 74, vf: { wght: 500 }, path: { type: 'ellipse', radius: 1 }, motion: { mode: 'orbit' } }, 'Closed', 'ring', 'loops'),

  // ── Angular ──
  S('zigzag',         'Zigzag',      'path',     { text: 'ZIGZAG', font: 'malromur', fontSize: 92, vf: { wght: 700 }, path: { type: 'zigzag', amp: 0.5, freq: 3 } },                     'Angular', 'flow',   'angular'),
  S('zigzag-fine',    'Fine zigzag', 'path',     { text: 'sawtooth', font: 'rot', fontSize: 80, vf: { wdth: 90, wght: 600 }, path: { type: 'zigzag', amp: 0.35, freq: 5 } },             'Angular', 'flow',   'angular'),

  // ── Custom ──
  S('custom-s',       'Custom S',    'path',     { text: 'freeform', font: 'gullhamrar', fontSize: 96, vf: { wght: 600 }, path: { type: 'custom' }, showPath: true },                    'Custom',  'flow',   'arcs'),
  S('custom-march',   'Custom march','path',     { text: 'follow me', font: 'ordspor', fontSize: 90, vf: { wght: 500 }, path: { type: 'custom' }, motion: { mode: 'march' } },           'Custom',  'flow',   'arcs'),

  // ── Variable · Weight ──
  S('weight-pulse',   'Weight pulse','variable', { text: 'WEIGHT', font: 'gullhamrar', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }, 'Weight', 'morph', 'weight'),
  S('malromur-wave',  'Malromur wave','variable',{ text: 'Malromur', font: 'malromur', fontSize: 132, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.5 } }, 'Weight', 'morph', 'weight'),
  S('ordspor-pulse',  'Ordspor',     'variable', { text: 'Ordspor', font: 'ordspor', fontSize: 132, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.7 } },                   'Weight',  'morph',  'weight'),
  S('rot-weight',     'Rot weight',  'variable', { text: 'ROT', font: 'rot', fontSize: 200, vf: { wdth: 120, wght: 100 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'Weight', 'morph', 'weight'),
  S('weight-slow',    'Slow weight', 'variable', { text: 'breathe', font: 'gullhamrar', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.3 } }, 'Weight', 'morph', 'weight'),
  S('weight-fast',    'Fast weight', 'variable', { text: 'PULSE', font: 'gullhamrar', fontSize: 160, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 3, phase: 0.6 } }, 'Weight', 'flood', 'weight'),
  S('malromur-heavy', 'Heavy swing', 'variable', { text: 'Malromur', font: 'malromur', fontSize: 130, vf: { wght: 300 }, fill: '#0b0b0e', bg: '#f4f1ea', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'Weight', 'morph', 'weight'),
  S('ordspor-wave2',  'Ordspor ×2',  'variable', { text: 'twice', font: 'ordspor', fontSize: 150, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.5 } },                    'Weight',  'morph',  'weight'),
  S('rot-weight2',    'Rot weight ×2','variable',{ text: 'ROT', font: 'rot', fontSize: 200, vf: { wdth: 120, wght: 100 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.4 } }, 'Weight', 'morph', 'weight'),
  S('big-statement',  'Statement',   'variable', { text: 'BIG', font: 'rot', fontSize: 240, vf: { wdth: 140, wght: 100 }, fill: '#c2502e', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'Weight', 'flood', 'weight'),
  S('malromur-bigwave','Big wave',   'variable', { text: 'WEIGHT', font: 'malromur', fontSize: 150, vf: { wght: 300 }, fill: '#f6c453', motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.7 } }, 'Weight', 'flood', 'weight'),
  S('ordspor-accent', 'Ordspor accent','variable',{ text: 'Ordspor', font: 'ordspor', fontSize: 140, fill: '#8f5ad0', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }, 'Weight', 'flood', 'weight'),

  // ── Variable · Width ──
  S('rot-width',      'Rot width',   'variable', { text: 'WIDTH', font: 'rot', fontSize: 150, vf: { wdth: 64, wght: 600 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.6 } }, 'Width', 'morph', 'width'),
  S('rot-dual',       'Variable',    'variable', { text: 'variable', font: 'rot', fontSize: 124, vf: { wdth: 100, wght: 400 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 2, phase: 0.4 } }, 'Width', 'morph', 'width'),
  S('rot-width-fast', 'Width ×2',    'variable', { text: 'STRETCH', font: 'rot', fontSize: 130, vf: { wdth: 64, wght: 600 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 2, phase: 0.5 } }, 'Width', 'morph', 'width'),
  S('rot-width-slow', 'Width slow',  'variable', { text: 'expand', font: 'rot', fontSize: 130, vf: { wdth: 100, wght: 500 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.3 } }, 'Width', 'morph', 'width'),

  // ── Variable · On path ──
  S('arc-weight',     'Morph on arc','variable', { text: 'morph', font: 'gullhamrar', fontSize: 120, path: { type: 'arc', amp: 0.3 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }, 'On path', 'morph', 'arcs'),
  S('sine-weight',    'Wave + weight','variable',{ text: 'modulated', font: 'gullhamrar', fontSize: 92, vf: { wght: 400 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'On path', 'wave', 'arcs'),
  S('circle-weight',  'Ring + weight','variable',{ text: 'ROTATING', font: 'malromur', fontSize: 78, vf: { wght: 300 }, path: { type: 'circle', radius: 0.74 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.6 } }, 'On path', 'ring', 'loops'),
  S('arc-width',      'Arc + width', 'variable', { text: 'arcwidth', font: 'rot', fontSize: 96, vf: { wdth: 80, wght: 600 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.5 } }, 'On path', 'morph', 'arcs'),

  // ── Motion · Reveal ──
  S('cascade',        'Cascade',     'motion',   { text: 'CASCADE', font: 'gullhamrar', fontSize: 130, vf: { wght: 600 }, motion: { mode: 'cascade', cycles: 1, phase: 0.6 } },            'Reveal',  'reveal', 'cascade'),
  S('pop',            'Pop',         'motion',   { text: 'POP POP', font: 'gullhamrar', fontSize: 130, vf: { wght: 800 }, motion: { mode: 'cascade', cycles: 2, phase: 0.8 } },             'Reveal',  'reveal', 'cascade'),
  S('arc-cascade',    'Curve cascade','motion',  { text: 'on a curve', font: 'ordspor', fontSize: 100, vf: { wght: 500 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }, 'Reveal', 'reveal', 'cascade'),
  S('cascade-slow',   'Slow cascade','motion',   { text: 'unfold', font: 'gullhamrar', fontSize: 130, vf: { wght: 600 }, motion: { mode: 'cascade', cycles: 1, phase: 0.4 } },             'Reveal',  'reveal', 'cascade'),
  S('cascade-fast',   'Fast cascade','motion',   { text: 'flicker', font: 'gullhamrar', fontSize: 130, vf: { wght: 700 }, motion: { mode: 'cascade', cycles: 2, phase: 0.7 } },            'Reveal',  'reveal', 'cascade'),
  S('typewriter',     'Typewriter',  'motion',   { text: 'type_type_', font: 'jetbrains', fontSize: 100, fill: '#7fd1ff', motion: { mode: 'cascade', cycles: 1, phase: 1 } },              'Reveal',  'reveal', 'cascade'),
  S('spiral-cascade', 'Spiral reveal','motion',  { text: 'spiral down', font: 'gullhamrar', fontSize: 74, vf: { wght: 600 }, path: { type: 'spiral', turns: 3 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }, 'Reveal', 'reveal', 'cascade'),
  S('circle-cascade', 'Ring reveal', 'motion',   { text: 'AROUND', font: 'malromur', fontSize: 86, vf: { wght: 600 }, path: { type: 'circle', radius: 0.74 }, motion: { mode: 'cascade', cycles: 1, phase: 0.6 } }, 'Reveal', 'ring', 'loops'),
  S('pop-mono',       'Mono pop',    'motion',   { text: 'POP.POP.', font: 'jetbrains', fontSize: 110, fill: '#f6c453', motion: { mode: 'cascade', cycles: 2, phase: 0.8 } },              'Reveal',  'reveal', 'cascade'),

  // ── Motion · Wave ──
  S('glyph-wave',     'Ripple',      'motion',   { text: 'ripple', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.6, amp: 0.4 } },  'Wave',    'wave',   'cascade'),
  S('flag',           'Flag',        'motion',   { text: 'flag', font: 'rot', fontSize: 168, vf: { wdth: 120, wght: 600 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.5, amp: 0.5 } }, 'Wave', 'wave', 'cascade'),
  S('sine-ripple',    'Sine ripple', 'motion',   { text: 'wavewave', font: 'rot', fontSize: 108, vf: { wdth: 110, wght: 600 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'glyphwave', amp: 0.3 } }, 'Wave', 'wave', 'arcs'),
  S('glyph-big',      'Big ripple',  'motion',   { text: 'WAVES', font: 'gullhamrar', fontSize: 150, vf: { wght: 700 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.6, amp: 0.6 } }, 'Wave',    'flood',  'cascade'),
  S('glyph-fast',     'Fast ripple', 'motion',   { text: 'shiver', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'glyphwave', cycles: 2, phase: 0.5, amp: 0.35 } }, 'Wave',    'wave',   'cascade'),
  S('arc-glyphwave',  'Arc ripple',  'motion',   { text: 'on a curve', font: 'ordspor', fontSize: 96, vf: { wght: 500 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'glyphwave', amp: 0.3 } }, 'Wave', 'wave', 'arcs'),
  S('rot-flag-fast',  'Rot flag',    'motion',   { text: 'flutter', font: 'rot', fontSize: 150, vf: { wdth: 120, wght: 600 }, motion: { mode: 'glyphwave', cycles: 2, phase: 0.5, amp: 0.5 } }, 'Wave', 'wave', 'width'),
  S('sine-ripple2',   'Sine flutter','motion',   { text: 'flowflow', font: 'ordspor', fontSize: 100, vf: { wght: 500 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'glyphwave', cycles: 2, amp: 0.3 } }, 'Wave', 'wave', 'arcs'),

  // ── Motion · Field sweep ──
  S('sweep-x',      'Sweep X',     'motion',   { text: 'SWEEP', font: 'gullhamrar', fontSize: 150, vf: { wght: 700 }, motion: { mode: 'sweep', field: 'x', cycles: 1, amp: 0.3 } }, 'Sweep', 'reveal', 'cascade'),
  S('sweep-y',      'Sweep Y',     'motion',   { text: 'descend', font: 'ordspor', fontSize: 130, vf: { wght: 500 }, motion: { mode: 'sweep', field: 'y', cycles: 1, amp: 0.35 } }, 'Sweep', 'reveal', 'cascade'),
  S('sweep-radial', 'Radial pulse','motion',   { text: 'PULSE', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'sweep', field: 'radial', cycles: 1, amp: 0.4 } }, 'Sweep', 'reveal', 'cascade'),
  S('sweep-weight', 'Sweep weight','motion',   { text: 'WEIGHT', font: 'gullhamrar', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'sweepWeight', field: 'x', cycles: 1, amp: 0.4 } }, 'Sweep', 'morph', 'weight'),
  S('sweep-grid',   'Grid sweep',  'motion',   { text: 'KOL', font: 'jetbrains', fontSize: 56, fill: '#7fd1ff', path: { type: 'array', rows: 4, cols: 5 }, motion: { mode: 'sweep', field: 'diagonal', cycles: 1, amp: 0.3 } }, 'Sweep', 'reveal', 'grid'),
  S('sweep-shift',  'Sweep shift', 'motion',   { text: 'shiver', font: 'rot', fontSize: 130, vf: { wdth: 110, wght: 600 }, motion: { mode: 'sweepShift', field: 'wave', cycles: 1, amp: 0.3 } }, 'Sweep', 'wave', 'cascade'),

  // ── Motion · Orbit ──
  S('orbit-spin',     'Orbit',       'motion',   { text: 'ORBIT', font: 'malromur', fontSize: 88, vf: { wght: 600 }, path: { type: 'circle', radius: 0.7 }, motion: { mode: 'orbit', cycles: 1 } }, 'Orbit', 'ring', 'loops'),
  S('orbit-fast',     'Fast orbit',  'motion',   { text: 'spinning', font: 'gullhamrar', fontSize: 84, vf: { wght: 600 }, path: { type: 'circle', radius: 0.72 }, motion: { mode: 'orbit', cycles: 2 } }, 'Orbit', 'ring', 'loops'),
  S('ellipse-orbit',  'Ellipse orbit','motion',  { text: 'ORBITAL', font: 'rot', fontSize: 78, vf: { wdth: 110, wght: 600 }, path: { type: 'ellipse', radius: 0.95 }, motion: { mode: 'orbit', cycles: 1 } }, 'Orbit', 'ring', 'loops'),

  // ── Grid (array) ──
  S('array-grid',     'Grid',        'path',     { text: 'KOL', font: 'gullhamrar', fontSize: 64, vf: { wght: 600 }, path: { type: 'array', rows: 3, cols: 4 } }, 'Array', 'morph', 'grid'),
  S('array-pulse',    'Grid pulse',  'motion',   { text: 'NODE', font: 'jetbrains', fontSize: 44, fill: '#7fd1ff', path: { type: 'array', rows: 4, cols: 5 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }, 'Array', 'reveal', 'grid'),
  S('array-wave',     'Grid wave',   'motion',   { text: 'echo', font: 'ordspor', fontSize: 52, vf: { wght: 500 }, path: { type: 'array', rows: 3, cols: 3 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.7, amp: 0.4 } }, 'Array', 'wave', 'grid'),
  S('array-weight',   'Grid weight', 'variable', { text: 'OK', font: 'rot', fontSize: 88, vf: { wdth: 100, wght: 200 }, path: { type: 'array', rows: 2, cols: 3 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }, 'Array', 'morph', 'grid'),

  // ── Multi-instance compositions ──
  M('ring-and-word', 'Ring + word', 'path', {
    instances: [
      { id: 'a', text: 'KOLKRABBI · REYKJAVIK · ', font: 'malromur', fontSize: 56, vf: { wght: 500 }, fill: '#9ec1ff', path: { type: 'circle', radius: 0.86 }, motion: { mode: 'orbit', cycles: 1 } },
      { id: 'b', text: 'KOL', font: 'gullhamrar', fontSize: 180, vf: { wght: 800 }, fill: '#e8e4dc', path: { type: 'line' } },
    ],
  }, 'Composite', 'ring', 'loops'),

  M('stacked', 'Stacked', 'path', {
    instances: [
      { id: 'a', text: 'KINETIC', font: 'gullhamrar', fontSize: 130, vf: { wght: 700 }, fill: '#e8e4dc', path: { type: 'line', offset: -0.16 } },
      { id: 'b', text: 'typography', font: 'ordspor', fontSize: 90, vf: { wght: 400 }, fill: '#f6c453', path: { type: 'line', offset: 0.16 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } },
    ],
  }, 'Composite', 'flood', 'baseline'),

  M('grid-and-ring', 'Grid + ring', 'motion', {
    frame: { bg: '#0a0b14' },
    instances: [
      { id: 'a', text: 'echo', font: 'jetbrains', fontSize: 40, fill: '#3a4a6a', path: { type: 'array', rows: 4, cols: 5 } },
      { id: 'b', text: 'SIGNAL · SIGNAL · ', font: 'rot', fontSize: 60, vf: { wdth: 110, wght: 600 }, fill: '#9ec1ff', path: { type: 'circle', radius: 0.7 }, motion: { mode: 'orbit', cycles: 1 } },
    ],
  }, 'Composite', 'morph', 'grid'),
]

export const GROUPS = [
  { id: 'path',     label: 'Path' },
  { id: 'variable', label: 'Variable' },
  { id: 'motion',   label: 'Motion' },
]
export const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0]

// ── instance + composition helpers ──

// vf restricted to the font's axes, missing ones filled with the axis default.
export function normalizeVf(fontKey, vf = {}) {
  const font = fontByKey(fontKey)
  const out = defaultVf(font)
  for (const a of font.axes) if (vf[a.tag] != null) out[a.tag] = vf[a.tag]
  return out
}

// Merge one partial instance over INSTANCE_DEFAULTS (id assigned if absent).
export function mergeInstance(p = {}, i = 0) {
  const out = {
    id: p.id || `i${i}`,
    ...INSTANCE_DEFAULTS,
    ...p,
    path: { ...INSTANCE_DEFAULTS.path, ...(p.path || {}) },
    motion: { ...INSTANCE_DEFAULTS.motion, ...(p.motion || {}) },
    offset: { ...INSTANCE_DEFAULTS.offset, ...(p.offset || {}) },
    opentype: { ...(p.opentype || {}) },
  }
  out.vf = normalizeVf(out.font, p.vf)
  return out
}

// A fresh default instance (the Layout "add instance" factory).
export const defaultInstance = (id, overrides = {}) => mergeInstance({ id, ...overrides }, 0)

// Resolve a preset to the engine composition shape: { bg, instances: [...] }.
export function presetParams(preset) {
  const frame = { ...FRAME_DEFAULTS, ...(preset.frame || {}) }
  const instances = (preset.instances || []).map((p, i) => mergeInstance(p, i))
  return { ...frame, instances }
}
