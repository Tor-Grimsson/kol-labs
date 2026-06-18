/**
 * Widget registry — the inventory the app understands. Each entry pairs a p5
 * factory with display metadata, a group, default opts, and a param schema that
 * drives the Library's live controls. This is the keystone for the Library now
 * and the mix-and-match composer later.
 *
 * Param shape:
 *   { key, label?, min, max, step }            — numeric slider
 *   { key, label?, type: 'select', options }   — enum dropdown
 * Colours (fg/bg/dim) are intentionally left at factory defaults for v1.
 */
import {
  hero, sequencer, eqBars, knob, tape, matrix, vu,
  helix, reel, hBars, sevenSeg, bitmap, codeScroll, creature3d, cipher,
} from './index.js'
import { CIPHER_MODES } from './cipher.js'
import { CHARSET_KEYS } from '../lib/charsets.js'
import { statusbar, label as labelEl, readouts, numericStrip, transport, dualNum } from '../screens.js'

export { GROUPS } from './groups.js'

const R = (key, min, max, step, label) => ({ key, min, max, step, label: label || key })
const SEL = (key, options, label) => ({ key, type: 'select', options, label: label || key })
const BOOL = (key, label) => ({ key, type: 'boolean', label: label || key })
const TXT = (key, label) => ({ key, type: 'text', label: label || key })

export const WIDGETS = [
  // displays
  { key: 'hero', label: 'Hero', group: 'displays', factory: hero,
    defaults: { w: 128, h: 72 },
    params: [R('w', 64, 200, 4), R('h', 32, 120, 4)] },
  { key: 'tape', label: 'Tape', group: 'displays', factory: tape,
    defaults: { w: 128, h: 10, bpm: 128 },
    params: [R('w', 64, 200, 4), R('h', 6, 24, 1), R('bpm', 60, 200, 1)] },
  { key: 'bitmap', label: 'Bitmap', group: 'displays', factory: bitmap,
    defaults: { w: 72, h: 72, arms: 6, rings: 4, speed: 0.2, style: 'radial', seed: 0 },
    params: [R('arms', 2, 12, 1), R('rings', 2, 8, 1), R('speed', 0.05, 1, 0.05), SEL('style', ['radial', 'spiral', 'eye']), R('seed', 0, 9, 1)] },

  // meters
  { key: 'eqBars', label: 'EQ Bars', group: 'meters', factory: eqBars,
    defaults: { bars: 24, barW: 3, gap: 1, h: 28, seed: 3 },
    params: [R('bars', 6, 48, 1), R('barW', 1, 8, 1), R('gap', 0, 4, 1), R('h', 16, 64, 2), R('seed', 0, 9, 1)] },
  { key: 'vu', label: 'VU Meter', group: 'meters', factory: vu,
    defaults: { w: 80, h: 5, segs: 20, seed: 1 },
    params: [R('w', 40, 200, 4), R('segs', 6, 40, 1), R('seed', 0, 9, 1)] },
  { key: 'hBars', label: 'Bars', group: 'meters', factory: hBars,
    defaults: { w: 160, rows: 5, seed: 0 },
    params: [R('w', 80, 220, 4), R('rows', 2, 10, 1), R('seed', 0, 9, 1)] },

  // controls (square: circular, must keep 1:1 — render at a fixed small size)
  { key: 'knob', label: 'Knob', group: 'controls', factory: knob, square: true,
    defaults: { size: 30, count: 1, seed: 0, speed: 0.12, animate: true, value: 0.5, modulate: true },
    params: [R('size', 16, 64, 2), R('count', 1, 6, 1), BOOL('animate', 'animate'), R('speed', 0.02, 1, 0.02), R('value', 0, 1, 0.01, 'position'), BOOL('modulate', 'modulate UI'), R('seed', 0, 6, 0.1)] },
  { key: 'reel', label: 'Reel', group: 'controls', factory: reel, square: true,
    defaults: { size: 56, speed: 0.7, spokes: 6 },
    params: [R('size', 24, 96, 2), R('speed', 0.1, 2, 0.05), R('spokes', 3, 10, 1)] },

  // grids
  { key: 'sequencer', label: 'Sequencer', group: 'grids', factory: sequencer,
    defaults: { cols: 16, rows: 4, cellW: 6, cellH: 5, gap: 1, bpm: 128, seed: 7 },
    params: [R('cols', 4, 32, 1), R('rows', 1, 8, 1), R('bpm', 60, 200, 1), R('seed', 0, 9, 1)] },
  { key: 'matrix', label: 'Matrix', group: 'grids', factory: matrix,
    defaults: { cols: 10, rows: 6, cell: 4, seed: 11, speed: 0.5 },
    params: [R('cols', 4, 24, 1), R('rows', 3, 16, 1), R('cell', 2, 8, 1), R('speed', 0.1, 2, 0.1), R('seed', 0, 9, 1)] },

  // readouts
  { key: 'sevenSeg', label: 'Seven Seg', group: 'readouts', factory: sevenSeg,
    defaults: { digits: 6, scale: 3, interval: 1000, delta: 1, seed: 0, text: '' },
    params: [TXT('text', 'value (blank = counter)'), R('digits', 2, 10, 1), R('scale', 1, 6, 1), R('seed', 0, 9, 1)] },
  { key: 'codeScroll', label: 'Code Scroll', group: 'readouts', factory: codeScroll,
    defaults: { rows: 4, groupsPerRow: 5, charsPerGroup: 3, interval: 180, mode: 'alphanum', custom: '', fontSize: 11 },
    params: [R('rows', 2, 10, 1), R('groupsPerRow', 2, 10, 1), R('charsPerGroup', 1, 6, 1), SEL('mode', [...CHARSET_KEYS, 'custom'], 'charset'), { key: 'custom', type: 'text', label: 'Custom glyphs' }, R('fontSize', 8, 18, 1)] },
  { key: 'cipher', label: 'Cipher', group: 'readouts', themed: true, factory: (o) => cipher(o),
    defaults: { text: 'KOLKRABBI', mode: 'hex', fontSize: 11 },
    params: [{ key: 'text', type: 'text', label: 'Text' }, SEL('mode', CIPHER_MODES), R('fontSize', 8, 18, 1)] },

  // dimensional
  { key: 'helix', label: 'Helix', group: 'dimensional', factory: helix,
    defaults: { w: 120, h: 160, turns: 2.5, dotsPerStrand: 26, radius: 22, speed: 0.28 },
    params: [R('turns', 1, 5, 0.1), R('dotsPerStrand', 10, 48, 1), R('radius', 10, 40, 1), R('speed', 0.05, 1, 0.02)] },
  { key: 'creature3d', label: 'Creature', group: 'dimensional', factory: creature3d,
    defaults: { w: 160, h: 160, shape: 'manta', samples: 30, flapFreq: 0.7, flapAmp: 0.35, spinSpeed: 0.18, scale: 34, seed: 0 },
    params: [SEL('shape', ['manta', 'whale', 'wing', 'blob', 'torus', 'core', 'squid']), R('samples', 12, 48, 1), R('flapFreq', 0.1, 2, 0.05), R('flapAmp', 0, 1, 0.05), R('spinSpeed', 0, 0.6, 0.02), R('scale', 16, 60, 1)] },
]

/* Structural / chrome elements — the DOM pieces (no p5) the screens are built
 * from. `themed: true` means the Library renders them inside a .screen.theme-*
 * context so the --fg/--dim vars resolve. */
export const CHROME = [
  { key: 'statusbar', label: 'Status Bar', group: 'chrome', themed: true, factory: (o) => statusbar(o.host, o.right), defaults: { right: '··· ⟐ 100%' }, params: [] },
  { key: 'sectionLabel', label: 'Section Label', group: 'chrome', themed: true, factory: (o) => labelEl(o.host, o.left, o.right), defaults: { left: 'OUTPUT · OSC-A', right: 'LIVE' }, params: [] },
  { key: 'readouts', label: 'Readout Block', group: 'chrome', themed: true, factory: (o) => readouts(o.host, o.items), defaults: { items: [['FRQ', '440.00 HZ'], ['Q', '0.71'], ['CUT', '0.42'], ['GAIN', '0.84'], ['LFO', '0.18'], ['RATE', '2.7 HZ']] }, params: [] },
  { key: 'hexStrip', label: 'Hex Strip', group: 'chrome', themed: true, factory: (o) => numericStrip(o.host, o.groups, o.per), defaults: { groups: 1, per: 12 }, params: [{ key: 'groups', min: 1, max: 3, step: 1 }, { key: 'per', min: 4, max: 16, step: 1 }] },
  { key: 'transport', label: 'Transport', group: 'chrome', themed: true, factory: (o) => transport(o.host, o.label, o.active), defaults: { label: 'STEREO · 24BIT · 48K', active: '▶' }, params: [] },
  { key: 'dualNum', label: 'Dual Numbers', group: 'chrome', themed: true, factory: (o) => dualNum(o.host, o.rows, o.cols), defaults: { rows: 6, cols: 2 }, params: [{ key: 'rows', min: 3, max: 10, step: 1 }, { key: 'cols', min: 1, max: 4, step: 1 }] },
]

/* Everything in the inventory — animated widgets + chrome. */
export const ALL = [...WIDGETS, ...CHROME]

export const widgetFor = (key) => ALL.find((w) => w.key === key)

/* Catalog: expand each element's first enum param into one entry per option
 * (cipher modes, creature shapes, bitmap styles, …) so the Library reflects the
 * real variety. Elements with no enum get a single default entry. Registry-
 * sourced, so new modes/elements appear automatically. */
export function variantsOf(w) {
  const sel = w.params.find((p) => p.type === 'select')
  if (!sel) return [{ id: w.key, widget: w, label: w.label, opts: { ...w.defaults } }]
  return sel.options.map((opt) => ({ id: `${w.key}:${opt}`, widget: w, label: `${w.label} · ${opt}`, opts: { ...w.defaults, [sel.key]: opt } }))
}
export const CATALOG = ALL.flatMap(variantsOf)
