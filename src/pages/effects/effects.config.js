// Effects registry — the salvaged editor filter catalog (apps/editor's
// constants/editor.js FILTER_GROUPS + FILTER_OPTIONS), re-shaped to this repo's
// FX-def grammar (the Radar `CANVAS_FX_DEFS` shape: { id, label, params:{ key:
// { min, max, step, default } } }) and split into two execution TIERS:
//
//   tier 'canvas' — pure Canvas-2D ImageData passes via src/lib/imagefilters.js
//                   (zero-dep, synchronous). The simple PS tune-up set.
//   tier 'pixi'   — GPU effects via pixi-filters (async, one persistent app).
//                   Wired in a later pass; the param schemas live here now.
//   tier 'postfx' — Radar's own canvas FX (useCanvasFx.applyCanvasFx), pulled
//                   in as a Post-Processing category. Same FX you stack in Dither.
//
// Param ranges are transcribed verbatim from the editor's FilterPanel.jsx.
// rgb-split's nested {red:{x},blue:{x}} is flattened to redX/blueX here; the
// pixi adapter re-nests it. Parameterless effects carry params:{}.

import { CANVAS_FX_DEFS } from '../radar/hooks/useCanvasFx.js'

export const EFFECT_GROUPS = [
  { id: 'color-adjustments', label: 'Color Adjustments' },
  { id: 'blur-sharpen', label: 'Blur/Sharpen' },
  { id: 'displacement', label: 'Displacement' },
  { id: 'distortion', label: 'Distortion' },
  { id: 'artistic-effects', label: 'Artistic Effects' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'stylize', label: 'Stylize' },
  { id: 'utility', label: 'Utility' },
  { id: 'post-processing', label: 'Post-Processing' },
]

export const EFFECT_DEFS = [
  // ── Color Adjustments ──────────────────────────────────────────────────
  { id: 'filter-hsl', label: 'HSL', group: 'color-adjustments', tier: 'canvas', params: {
    hue: { min: -1, max: 1, step: 0.01, default: 0 },
    saturation: { min: -2, max: 10, step: 0.1, default: 0 },
    value: { min: -2, max: 2, step: 0.1, default: 0 },
  } },
  { id: 'filter-hsv', label: 'HSV', group: 'color-adjustments', tier: 'canvas', params: {
    hue: { min: -1, max: 1, step: 0.01, default: 0 },
    saturation: { min: -2, max: 10, step: 0.1, default: 0 },
    value: { min: -2, max: 2, step: 0.1, default: 0 },
  } },
  { id: 'filter-brightness', label: 'Brightness', group: 'color-adjustments', tier: 'canvas', params: {
    brightness: { min: -1, max: 1, step: 0.01, default: 0 },
  } },
  { id: 'filter-contrast', label: 'Contrast', group: 'color-adjustments', tier: 'canvas', params: {
    contrast: { min: -100, max: 100, step: 1, default: 0 },
  } },
  { id: 'filter-rgb', label: 'RGB', group: 'color-adjustments', tier: 'canvas', params: {
    red: { min: -255, max: 255, step: 1, default: 0 },
    green: { min: -255, max: 255, step: 1, default: 0 },
    blue: { min: -255, max: 255, step: 1, default: 0 },
  } },
  { id: 'filter-invert', label: 'Invert', group: 'color-adjustments', tier: 'canvas', params: {} },
  { id: 'filter-sepia', label: 'Sepia', group: 'color-adjustments', tier: 'canvas', params: {} },
  { id: 'filter-grayscale', label: 'Grayscale', group: 'color-adjustments', tier: 'canvas', params: {} },
  { id: 'filter-enhance', label: 'Enhance', group: 'color-adjustments', tier: 'canvas', params: {} },
  { id: 'filter-adjustment', label: 'Adjustment', group: 'color-adjustments', tier: 'pixi', params: {
    gamma: { min: 0, max: 2, step: 0.01, default: 1 },
    saturation: { min: 0, max: 2, step: 0.01, default: 1 },
    contrast: { min: 0, max: 2, step: 0.01, default: 1 },
    brightness: { min: 0, max: 2, step: 0.01, default: 1 },
  } },
  { id: 'filter-hsl-adjustment', label: 'HSL Adjustment', group: 'color-adjustments', tier: 'pixi', params: {
    hue: { min: -1, max: 1, step: 0.01, default: 0 },
    saturation: { min: -1, max: 1, step: 0.01, default: 0 },
    lightness: { min: -1, max: 1, step: 0.01, default: 0 },
  } },
  { id: 'filter-color-gradient', label: 'Color Gradient', group: 'color-adjustments', tier: 'pixi', params: {} },
  { id: 'filter-color-map', label: 'Color Map', group: 'color-adjustments', tier: 'pixi', params: {} },
  { id: 'filter-color-overlay', label: 'Color Overlay', group: 'color-adjustments', tier: 'pixi', params: {} },
  { id: 'filter-color-replace', label: 'Color Replace', group: 'color-adjustments', tier: 'pixi', params: {} },
  { id: 'filter-multi-color-replace', label: 'Multi Color Replace', group: 'color-adjustments', tier: 'pixi', params: {} },

  // ── Blur/Sharpen ───────────────────────────────────────────────────────
  { id: 'filter-blur', label: 'Blur', group: 'blur-sharpen', tier: 'canvas', params: {
    blurRadius: { min: 0, max: 40, step: 1, default: 0 },
  } },
  { id: 'filter-radial-blur', label: 'Radial Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    angle: { min: 0, max: 20, step: 0.1, default: 0 },
    kernelSize: { min: 3, max: 25, step: 1, default: 5 },
  } },
  { id: 'filter-zoom-blur', label: 'Zoom Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    strength: { min: 0, max: 1, step: 0.01, default: 0.1 },
  } },
  { id: 'filter-motion-blur', label: 'Motion Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    velocityX: { min: -50, max: 50, step: 1, default: 0 },
    velocityY: { min: -50, max: 50, step: 1, default: 5 },
  } },
  { id: 'filter-kawase-blur', label: 'Kawase Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    blur: { min: 0, max: 20, step: 1, default: 4 },
    quality: { min: 1, max: 10, step: 1, default: 3 },
  } },
  { id: 'filter-tilt-shift', label: 'Tilt Shift', group: 'blur-sharpen', tier: 'pixi', params: {} },
  { id: 'filter-backdrop-blur', label: 'Backdrop Blur', group: 'blur-sharpen', tier: 'pixi', params: {} },

  // ── Displacement ───────────────────────────────────────────────────────
  { id: 'filter-displacement', label: 'Displacement Map', group: 'displacement', tier: 'pixi', params: {
    scaleX: { min: 0, max: 200, step: 1, default: 20 },
    scaleY: { min: 0, max: 200, step: 1, default: 20 },
    frequency: { min: 0.1, max: 10, step: 0.1, default: 1 },
    octaves: { min: 1, max: 8, step: 1, default: 3 },
    persistence: { min: 0, max: 1, step: 0.01, default: 0.5 },
  } },

  // ── Distortion ─────────────────────────────────────────────────────────
  { id: 'filter-twist', label: 'Twist', group: 'distortion', tier: 'pixi', params: {
    radius: { min: 0, max: 500, step: 1, default: 200 },
    angle: { min: -10, max: 10, step: 0.1, default: 4 },
  } },
  { id: 'filter-bulge-pinch', label: 'Bulge/Pinch', group: 'distortion', tier: 'pixi', params: {
    radius: { min: 0, max: 500, step: 1, default: 100 },
    strength: { min: -3, max: 3, step: 0.1, default: 1 },
  } },
  { id: 'filter-shockwave', label: 'Shockwave', group: 'distortion', tier: 'pixi', params: {
    amplitude: { min: 0, max: 100, step: 1, default: 30 },
    wavelength: { min: 10, max: 500, step: 1, default: 160 },
  } },

  // ── Artistic Effects ───────────────────────────────────────────────────
  { id: 'filter-pixelate', label: 'Pixelate', group: 'artistic-effects', tier: 'canvas', params: {
    pixelSize: { min: 1, max: 20, step: 1, default: 1 },
  } },
  { id: 'filter-posterize', label: 'Posterize', group: 'artistic-effects', tier: 'canvas', params: {
    levels: { min: 2, max: 32, step: 1, default: 6 },
  } },
  { id: 'filter-solarize', label: 'Solarize', group: 'artistic-effects', tier: 'canvas', params: {} },
  { id: 'filter-emboss', label: 'Emboss', group: 'artistic-effects', tier: 'canvas', params: {} },
  { id: 'filter-noise', label: 'Noise', group: 'artistic-effects', tier: 'canvas', params: {
    noise: { min: 0, max: 1, step: 0.01, default: 0 },
  } },
  { id: 'filter-ascii', label: 'ASCII', group: 'artistic-effects', tier: 'pixi', params: {
    size: { min: 2, max: 20, step: 1, default: 8 },
  } },
  { id: 'filter-cross-hatch', label: 'Cross Hatch', group: 'artistic-effects', tier: 'pixi', params: {} },
  { id: 'filter-dot', label: 'Dot Screen', group: 'artistic-effects', tier: 'pixi', params: {
    scale: { min: 0.1, max: 5, step: 0.1, default: 1 },
    angle: { min: 0, max: 360, step: 1, default: 5 },
  } },
  { id: 'filter-crt', label: 'CRT', group: 'artistic-effects', tier: 'pixi', params: {
    curvature: { min: 0, max: 10, step: 0.1, default: 1 },
    lineWidth: { min: 0, max: 5, step: 0.1, default: 1 },
    noise: { min: 0, max: 1, step: 0.01, default: 0.3 },
  } },
  { id: 'filter-old-film', label: 'Old Film', group: 'artistic-effects', tier: 'pixi', params: {
    sepia: { min: 0, max: 1, step: 0.01, default: 0.3 },
    noise: { min: 0, max: 1, step: 0.01, default: 0.3 },
    scratch: { min: 0, max: 1, step: 0.01, default: 0.5 },
  } },
  { id: 'filter-glitch', label: 'Glitch', group: 'artistic-effects', tier: 'pixi', params: {
    slices: { min: 1, max: 50, step: 1, default: 5 },
    offset: { min: 0, max: 500, step: 1, default: 100 },
  } },
  { id: 'filter-rgb-split', label: 'RGB Split', group: 'artistic-effects', tier: 'pixi', params: {
    redX: { min: -50, max: 50, step: 1, default: -10 },
    blueX: { min: -50, max: 50, step: 1, default: 10 },
  } },
  { id: 'filter-simplex-noise', label: 'Simplex Noise', group: 'artistic-effects', tier: 'pixi', params: {} },

  // ── Lighting ───────────────────────────────────────────────────────────
  { id: 'filter-bloom', label: 'Bloom', group: 'lighting', tier: 'pixi', params: {
    blur: { min: 0, max: 20, step: 1, default: 2 },
    strength: { min: 0, max: 5, step: 0.1, default: 1 },
  } },
  { id: 'filter-advanced-bloom', label: 'Advanced Bloom', group: 'lighting', tier: 'pixi', params: {
    threshold: { min: 0, max: 1, step: 0.01, default: 0.5 },
    bloomScale: { min: 0, max: 3, step: 0.1, default: 1 },
    brightness: { min: 0, max: 2, step: 0.1, default: 1 },
  } },
  { id: 'filter-glow', label: 'Glow', group: 'lighting', tier: 'pixi', params: {
    distance: { min: 0, max: 50, step: 1, default: 10 },
    outerStrength: { min: 0, max: 20, step: 1, default: 4 },
  } },
  { id: 'filter-godray', label: 'God Ray', group: 'lighting', tier: 'pixi', params: {} },
  { id: 'filter-simple-lightmap', label: 'Simple Lightmap', group: 'lighting', tier: 'pixi', params: {} },

  // ── Stylize ────────────────────────────────────────────────────────────
  { id: 'filter-bevel', label: 'Bevel', group: 'stylize', tier: 'pixi', params: {
    thickness: { min: 0, max: 20, step: 1, default: 2 },
    rotation: { min: 0, max: 360, step: 1, default: 45 },
  } },
  { id: 'filter-drop-shadow', label: 'Drop Shadow', group: 'stylize', tier: 'pixi', params: {
    distance: { min: 0, max: 50, step: 1, default: 5 },
    blur: { min: 0, max: 20, step: 1, default: 2 },
    alpha: { min: 0, max: 1, step: 0.01, default: 0.5 },
  } },
  { id: 'filter-outline', label: 'Outline', group: 'stylize', tier: 'pixi', params: {
    thickness: { min: 0, max: 20, step: 1, default: 1 },
  } },
  { id: 'filter-reflection', label: 'Reflection', group: 'stylize', tier: 'pixi', params: {} },

  // ── Utility ────────────────────────────────────────────────────────────
  { id: 'filter-threshold', label: 'Threshold', group: 'utility', tier: 'canvas', params: {
    threshold: { min: 0, max: 1, step: 0.01, default: 0.5 },
  } },
  { id: 'filter-convolution', label: 'Convolution', group: 'utility', tier: 'pixi', params: {} },

  // ── Post-Processing (Radar's own canvas FX, applied via applyCanvasFx) ─────
  ...CANVAS_FX_DEFS.map((d) => ({ id: d.id, label: d.label, group: 'post-processing', tier: 'postfx', params: d.params })),
]

const GROUP_LABEL = Object.fromEntries(EFFECT_GROUPS.map((g) => [g.id, g.label]))
export const groupLabel = (id) => GROUP_LABEL[id] || id

export const getEffectDef = (id) => EFFECT_DEFS.find((d) => d.id === id) || null

// Effects bucketed by group, in EFFECT_GROUPS order — for the categorized picker.
export const effectsByGroup = EFFECT_GROUPS.map((g) => ({
  ...g,
  effects: EFFECT_DEFS.filter((d) => d.group === g.id),
}))

// Resolve a def's default param map ({} for parameterless effects).
export function getDefaultEffectParams(id) {
  const def = getEffectDef(id)
  if (!def) return {}
  const out = {}
  for (const [key, spec] of Object.entries(def.params)) out[key] = spec.default
  return out
}
