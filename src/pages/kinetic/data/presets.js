// Kinetic presets — the picker entries per sub-page. Each names a partial config;
// `presetParams` merges it over DEFAULTS and normalises the vf object to the
// chosen font's real axes. (P0 seed gallery — expand toward ~20/sub-page in P3.)

import { fontByKey, defaultVf } from '../lib/vfAxes.js'
import { PATH_DEFAULTS } from '../engine/paths.js'

export const DEFAULTS = {
  text: 'Kinetic',
  font: 'gullhamrar',
  fontSize: 120,
  fill: '#e8e4dc',
  bg: '#0b0b0e',
  letterSpacing: 0,
  align: 'center',
  vf: {},
  showPath: false,
  path: { type: 'line', ...PATH_DEFAULTS },
  motion: { mode: 'none', cycles: 1, phase: 0.5, amp: 0.3, axis: 'wght' },
}

const P = (id, label, group, params, sub) => ({ id, label, group, sub, params })

export const PRESETS = [
  // ── Path ──
  P('arc-kinetic', 'Arc', 'path', { text: 'Kinetic', font: 'gullhamrar', fontSize: 130, vf: { wght: 600 }, path: { type: 'arc', amp: 0.45 } }, 'Curves'),
  P('sine-flow', 'Sine flow', 'path', { text: 'wave along', font: 'ordspor', fontSize: 96, vf: { wght: 500 }, path: { type: 'sine', amp: 0.4, freq: 2 }, motion: { mode: 'march', cycles: 1 } }, 'Curves'),
  P('spiral-in', 'Spiral', 'path', { text: 'spiral', font: 'gullhamrar', fontSize: 88, vf: { wght: 700 }, path: { type: 'spiral', turns: 3 } }, 'Curves'),
  P('arc-march', 'Arc march', 'path', { text: 'on the arc', font: 'rot', fontSize: 96, vf: { wdth: 100, wght: 500 }, path: { type: 'arc', amp: 0.5 }, motion: { mode: 'march' } }, 'Curves'),
  P('circle-orbit', 'Circle', 'path', { text: 'KOLKRABBI', font: 'malromur', fontSize: 80, vf: { wght: 500 }, path: { type: 'circle', radius: 0.72 }, motion: { mode: 'orbit', cycles: 1 } }, 'Closed'),
  P('ellipse-loop', 'Ellipse', 'path', { text: 'REYKJAVIK', font: 'rot', fontSize: 78, vf: { wdth: 120, wght: 600 }, path: { type: 'ellipse', radius: 0.92 }, motion: { mode: 'orbit' } }, 'Closed'),
  P('zigzag', 'Zigzag', 'path', { text: 'ZIGZAG', font: 'malromur', fontSize: 92, vf: { wght: 700 }, path: { type: 'zigzag', amp: 0.5, freq: 3 } }, 'Angular'),

  // ── Variable ──
  P('weight-pulse', 'Weight pulse', 'variable', { text: 'WEIGHT', font: 'gullhamrar', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }, 'Weight'),
  P('malromur-wave', 'Malromur wave', 'variable', { text: 'Malromur', font: 'malromur', fontSize: 132, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.5 } }, 'Weight'),
  P('ordspor-pulse', 'Ordspor', 'variable', { text: 'Ordspor', font: 'ordspor', fontSize: 132, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.7 } }, 'Weight'),
  P('rot-weight', 'Rot weight', 'variable', { text: 'ROT', font: 'rot', fontSize: 200, vf: { wdth: 120, wght: 100 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'Weight'),
  P('rot-width', 'Rot width', 'variable', { text: 'WIDTH', font: 'rot', fontSize: 150, vf: { wdth: 64, wght: 600 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.6 } }, 'Width'),
  P('rot-dual', 'Variable', 'variable', { text: 'variable', font: 'rot', fontSize: 124, vf: { wdth: 100, wght: 400 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 2, phase: 0.4 } }, 'Width'),
  P('arc-weight', 'Morph on arc', 'variable', { text: 'morph', font: 'gullhamrar', fontSize: 120, path: { type: 'arc', amp: 0.3 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }, 'On path'),

  // ── Motion ──
  P('cascade', 'Cascade', 'motion', { text: 'CASCADE', font: 'gullhamrar', fontSize: 130, vf: { wght: 600 }, motion: { mode: 'cascade', cycles: 1, phase: 0.6 } }, 'Reveal'),
  P('pop', 'Pop', 'motion', { text: 'POP POP', font: 'gullhamrar', fontSize: 130, vf: { wght: 800 }, motion: { mode: 'cascade', cycles: 2, phase: 0.8 } }, 'Reveal'),
  P('arc-cascade', 'Curve cascade', 'motion', { text: 'on a curve', font: 'ordspor', fontSize: 100, vf: { wght: 500 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }, 'Reveal'),
  P('glyph-wave', 'Ripple', 'motion', { text: 'ripple', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.6, amp: 0.4 } }, 'Wave'),
  P('flag', 'Flag', 'motion', { text: 'flag', font: 'rot', fontSize: 168, vf: { wdth: 120, wght: 600 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.5, amp: 0.5 } }, 'Wave'),
  P('sine-ripple', 'Sine ripple', 'motion', { text: 'wavewave', font: 'rot', fontSize: 108, vf: { wdth: 110, wght: 600 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'glyphwave', amp: 0.3 } }, 'Wave'),
  P('orbit-spin', 'Orbit', 'motion', { text: 'ORBIT', font: 'malromur', fontSize: 88, vf: { wght: 600 }, path: { type: 'circle', radius: 0.7 }, motion: { mode: 'orbit', cycles: 1 } }, 'Orbit'),

  // ── Path (more) ──
  P('baseline', 'Baseline', 'path', { text: 'Typography', font: 'gullhamrar', fontSize: 120, vf: { wght: 500 } }, 'Lines'),
  P('baseline-mono', 'Mono line', 'path', { text: 'monospace', font: 'jetbrains', fontSize: 110, fill: '#7fd1ff' }, 'Lines'),
  P('baseline-light', 'On paper', 'path', { text: 'Reykjavik', font: 'malromur', fontSize: 130, vf: { wght: 600 }, fill: '#0b0b0e', bg: '#f4f1ea' }, 'Lines'),
  P('arc-up', 'High arc', 'path', { text: 'over the top', font: 'malromur', fontSize: 92, vf: { wght: 600 }, path: { type: 'arc', amp: 0.7 } }, 'Curves'),
  P('arc-wide', 'Wide arc', 'path', { text: 'WIDEARC', font: 'rot', fontSize: 96, vf: { wdth: 150, wght: 600 }, path: { type: 'arc', amp: 0.4 } }, 'Curves'),
  P('sine-fast', 'Fast wave', 'path', { text: 'up and down', font: 'gullhamrar', fontSize: 90, vf: { wght: 600 }, path: { type: 'sine', amp: 0.4, freq: 3 }, motion: { mode: 'march', cycles: 2 } }, 'Curves'),
  P('sine-tall', 'Tall wave', 'path', { text: 'rolling', font: 'ordspor', fontSize: 100, vf: { wght: 500 }, path: { type: 'sine', amp: 0.6, freq: 2 } }, 'Curves'),
  P('spiral-march', 'Spiral march', 'path', { text: 'into the spiral', font: 'rot', fontSize: 72, vf: { wdth: 100, wght: 500 }, path: { type: 'spiral', turns: 5 }, motion: { mode: 'march', cycles: 1 } }, 'Curves'),
  P('circle-big', 'Big circle', 'path', { text: 'AROUND WE GO', font: 'gullhamrar', fontSize: 76, vf: { wght: 600 }, path: { type: 'circle', radius: 0.85 }, motion: { mode: 'orbit' } }, 'Closed'),
  P('circle-mono', 'Mono circle', 'path', { text: 'LOOP/LOOP/', font: 'jetbrains', fontSize: 72, fill: '#f6c453', path: { type: 'circle', radius: 0.78 }, motion: { mode: 'orbit' } }, 'Closed'),
  P('ellipse-wide', 'Wide ellipse', 'path', { text: 'ELLIPTICAL', font: 'malromur', fontSize: 74, vf: { wght: 500 }, path: { type: 'ellipse', radius: 1 }, motion: { mode: 'orbit' } }, 'Closed'),
  P('zigzag-fine', 'Fine zigzag', 'path', { text: 'sawtooth', font: 'rot', fontSize: 80, vf: { wdth: 90, wght: 600 }, path: { type: 'zigzag', amp: 0.35, freq: 5 } }, 'Angular'),
  P('custom-s', 'Custom S', 'path', { text: 'freeform', font: 'gullhamrar', fontSize: 96, vf: { wght: 600 }, path: { type: 'custom' }, showPath: true }, 'Custom'),
  P('custom-march', 'Custom march', 'path', { text: 'follow me', font: 'ordspor', fontSize: 90, vf: { wght: 500 }, path: { type: 'custom' }, motion: { mode: 'march' } }, 'Custom'),

  // ── Variable (more) ──
  P('weight-slow', 'Slow weight', 'variable', { text: 'breathe', font: 'gullhamrar', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.3 } }, 'Weight'),
  P('weight-fast', 'Fast weight', 'variable', { text: 'PULSE', font: 'gullhamrar', fontSize: 160, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 3, phase: 0.6 } }, 'Weight'),
  P('malromur-heavy', 'Heavy swing', 'variable', { text: 'Malromur', font: 'malromur', fontSize: 130, vf: { wght: 300 }, fill: '#0b0b0e', bg: '#f4f1ea', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'Weight'),
  P('ordspor-wave2', 'Ordspor x2', 'variable', { text: 'twice', font: 'ordspor', fontSize: 150, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.5 } }, 'Weight'),
  P('rot-width-fast', 'Width x2', 'variable', { text: 'STRETCH', font: 'rot', fontSize: 130, vf: { wdth: 64, wght: 600 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 2, phase: 0.5 } }, 'Width'),
  P('rot-width-slow', 'Width slow', 'variable', { text: 'expand', font: 'rot', fontSize: 130, vf: { wdth: 100, wght: 500 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.3 } }, 'Width'),
  P('rot-weight2', 'Rot weight x2', 'variable', { text: 'ROT', font: 'rot', fontSize: 200, vf: { wdth: 120, wght: 100 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.4 } }, 'Weight'),
  P('sine-weight', 'Wave + weight', 'variable', { text: 'modulated', font: 'gullhamrar', fontSize: 92, vf: { wght: 400 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'On path'),
  P('circle-weight', 'Ring + weight', 'variable', { text: 'ROTATING', font: 'malromur', fontSize: 78, vf: { wght: 300 }, path: { type: 'circle', radius: 0.74 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.6 } }, 'On path'),
  P('arc-width', 'Arc + width', 'variable', { text: 'arcwidth', font: 'rot', fontSize: 96, vf: { wdth: 80, wght: 600 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.5 } }, 'On path'),
  P('big-statement', 'Statement', 'variable', { text: 'BIG', font: 'rot', fontSize: 240, vf: { wdth: 140, wght: 100 }, fill: '#c2502e', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }, 'Weight'),
  P('malromur-bigwave', 'Big wave', 'variable', { text: 'WEIGHT', font: 'malromur', fontSize: 150, vf: { wght: 300 }, fill: '#f6c453', motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.7 } }, 'Weight'),
  P('ordspor-accent', 'Ordspor accent', 'variable', { text: 'Ordspor', font: 'ordspor', fontSize: 140, fill: '#8f5ad0', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }, 'Weight'),

  // ── Motion (more) ──
  P('cascade-slow', 'Slow cascade', 'motion', { text: 'unfold', font: 'gullhamrar', fontSize: 130, vf: { wght: 600 }, motion: { mode: 'cascade', cycles: 1, phase: 0.4 } }, 'Reveal'),
  P('cascade-fast', 'Fast cascade', 'motion', { text: 'flicker', font: 'gullhamrar', fontSize: 130, vf: { wght: 700 }, motion: { mode: 'cascade', cycles: 2, phase: 0.7 } }, 'Reveal'),
  P('typewriter', 'Typewriter', 'motion', { text: 'type_type_', font: 'jetbrains', fontSize: 100, fill: '#7fd1ff', motion: { mode: 'cascade', cycles: 1, phase: 1 } }, 'Reveal'),
  P('glyph-big', 'Big ripple', 'motion', { text: 'WAVES', font: 'gullhamrar', fontSize: 150, vf: { wght: 700 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.6, amp: 0.6 } }, 'Wave'),
  P('glyph-fast', 'Fast ripple', 'motion', { text: 'shiver', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'glyphwave', cycles: 2, phase: 0.5, amp: 0.35 } }, 'Wave'),
  P('arc-glyphwave', 'Arc ripple', 'motion', { text: 'on a curve', font: 'ordspor', fontSize: 96, vf: { wght: 500 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'glyphwave', amp: 0.3 } }, 'Wave'),
  P('spiral-cascade', 'Spiral reveal', 'motion', { text: 'spiral down', font: 'gullhamrar', fontSize: 74, vf: { wght: 600 }, path: { type: 'spiral', turns: 3 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }, 'Reveal'),
  P('circle-cascade', 'Ring reveal', 'motion', { text: 'AROUND', font: 'malromur', fontSize: 86, vf: { wght: 600 }, path: { type: 'circle', radius: 0.74 }, motion: { mode: 'cascade', cycles: 1, phase: 0.6 } }, 'Reveal'),
  P('orbit-fast', 'Fast orbit', 'motion', { text: 'spinning', font: 'gullhamrar', fontSize: 84, vf: { wght: 600 }, path: { type: 'circle', radius: 0.72 }, motion: { mode: 'orbit', cycles: 2 } }, 'Orbit'),
  P('ellipse-orbit', 'Ellipse orbit', 'motion', { text: 'ORBITAL', font: 'rot', fontSize: 78, vf: { wdth: 110, wght: 600 }, path: { type: 'ellipse', radius: 0.95 }, motion: { mode: 'orbit', cycles: 1 } }, 'Orbit'),
  P('rot-flag-fast', 'Rot flag', 'motion', { text: 'flutter', font: 'rot', fontSize: 150, vf: { wdth: 120, wght: 600 }, motion: { mode: 'glyphwave', cycles: 2, phase: 0.5, amp: 0.5 } }, 'Wave'),
  P('pop-mono', 'Mono pop', 'motion', { text: 'POP.POP.', font: 'jetbrains', fontSize: 110, fill: '#f6c453', motion: { mode: 'cascade', cycles: 2, phase: 0.8 } }, 'Reveal'),
  P('sine-ripple2', 'Sine flutter', 'motion', { text: 'flowflow', font: 'ordspor', fontSize: 100, vf: { wght: 500 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'glyphwave', cycles: 2, amp: 0.3 } }, 'Wave'),
]

export const GROUPS = [
  { id: 'path', label: 'Path', route: '/kinetic' },
  { id: 'variable', label: 'Variable', route: '/kinetic/variable' },
  { id: 'motion', label: 'Motion', route: '/kinetic/motion' },
]
export const groupById = (id) => GROUPS.find((g) => g.id === id) || GROUPS[0]
export const presetsInGroup = (g) => PRESETS.filter((p) => p.group === g)
export const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0]

// Merge a preset over DEFAULTS; normalise vf to the chosen font's real axes.
export function presetParams(preset) {
  const p = preset.params || {}
  const out = {
    ...DEFAULTS,
    ...p,
    path: { ...DEFAULTS.path, ...(p.path || {}) },
    motion: { ...DEFAULTS.motion, ...(p.motion || {}) },
  }
  out.vf = normalizeVf(out.font, p.vf)
  return out
}

// vf restricted to the font's axes, missing ones filled with the axis default.
export function normalizeVf(fontKey, vf = {}) {
  const font = fontByKey(fontKey)
  const out = defaultVf(font)
  for (const a of font.axes) if (vf[a.tag] != null) out[a.tag] = vf[a.tag]
  return out
}
