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
// pixi param keys mirror the pixi-filters v6 constructor option names exactly —
// the adapter (engine/pixiFilters.js) spreads them straight into `new XFilter()`.
// Flattened exceptions (re-nested in the adapter): displacement scaleX/scaleY,
// rgb-split redX/blueX, drop-shadow offsetX/offsetY. Boolean options render as an
// Off/On dropdown; `{x,y}` centres and colours need richer controls (follow-up).

import { CANVAS_FX_DEFS } from '../radar/hooks/useCanvasFx.js'

// Boolean filter option → an Off/On enum control (FxParamControl renders a Dropdown).
const onOff = (def = false) => ({ options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }], default: def })
// Colour option → a ColorField (hex string; pixi-filters accepts it as a ColorSource).
const color = (def = '#ffffff') => ({ type: 'color', default: def })
// Normalised 0–1 centre axis → the adapter maps it to the filter's center{x,y}.
const centre = { min: 0, max: 1, step: 0.01, default: 0.5 }

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
    red: { min: 0, max: 2, step: 0.01, default: 1 },
    green: { min: 0, max: 2, step: 0.01, default: 1 },
    blue: { min: 0, max: 2, step: 0.01, default: 1 },
    alpha: { min: 0, max: 1, step: 0.01, default: 1 },
  } },
  { id: 'filter-hsl-adjustment', label: 'HSL Adjustment', group: 'color-adjustments', tier: 'pixi', params: {
    hue: { min: -1, max: 1, step: 0.01, default: 0 },
    saturation: { min: -1, max: 1, step: 0.01, default: 0 },
    lightness: { min: -1, max: 1, step: 0.01, default: 0 },
    alpha: { min: 0, max: 1, step: 0.01, default: 1 },
    colorize: onOff(false),
  } },
  { id: 'filter-color-gradient', label: 'Color Gradient', group: 'color-adjustments', tier: 'pixi', params: {} },
  { id: 'filter-color-map', label: 'Color Map', group: 'color-adjustments', tier: 'pixi', params: {} },
  { id: 'filter-color-overlay', label: 'Color Overlay', group: 'color-adjustments', tier: 'pixi', params: {
    color: color('#ff0000'),
    alpha: { min: 0, max: 1, step: 0.01, default: 1 },
  } },
  { id: 'filter-color-replace', label: 'Color Replace', group: 'color-adjustments', tier: 'pixi', params: {
    originalColor: color('#ff0000'),
    targetColor: color('#000000'),
    tolerance: { min: 0, max: 1, step: 0.01, default: 0.4 },
  } },
  { id: 'filter-multi-color-replace', label: 'Multi Color Replace', group: 'color-adjustments', tier: 'pixi', params: {
    from1: color('#ff0000'), to1: color('#ff0000'),
    from2: color('#00ff00'), to2: color('#00ff00'),
    from3: color('#0000ff'), to3: color('#0000ff'),
    tolerance: { min: 0, max: 1, step: 0.01, default: 0.1 },
  } },

  // ── Blur/Sharpen ───────────────────────────────────────────────────────
  { id: 'filter-blur', label: 'Blur', group: 'blur-sharpen', tier: 'canvas', params: {
    blurRadius: { min: 0, max: 40, step: 1, default: 0 },
  } },
  { id: 'filter-radial-blur', label: 'Radial Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    angle: { min: 0, max: 20, step: 0.1, default: 0 },
    kernelSize: { min: 3, max: 25, step: 2, default: 5 },
    centerX: centre, centerY: centre,
  } },
  { id: 'filter-zoom-blur', label: 'Zoom Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    strength: { min: 0, max: 1, step: 0.01, default: 0.1 },
    innerRadius: { min: 0, max: 500, step: 1, default: 0 },
    centerX: centre, centerY: centre,
  } },
  { id: 'filter-motion-blur', label: 'Motion Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    velocityX: { min: -50, max: 50, step: 1, default: 0 },
    velocityY: { min: -50, max: 50, step: 1, default: 5 },
    kernelSize: { min: 5, max: 25, step: 2, default: 5 },
    offset: { min: -50, max: 50, step: 1, default: 0 },
  } },
  { id: 'filter-kawase-blur', label: 'Kawase Blur', group: 'blur-sharpen', tier: 'pixi', params: {
    blur: { min: 0, max: 20, step: 1, default: 4 },
    quality: { min: 1, max: 10, step: 1, default: 3 },
  } },
  { id: 'filter-tilt-shift', label: 'Tilt Shift', group: 'blur-sharpen', tier: 'pixi', params: {
    blur: { min: 0, max: 200, step: 1, default: 100 },
    gradientBlur: { min: 0, max: 1000, step: 10, default: 600 },
  } },
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
    padding: { min: 0, max: 100, step: 1, default: 20 },
  } },
  { id: 'filter-bulge-pinch', label: 'Bulge/Pinch', group: 'distortion', tier: 'pixi', params: {
    radius: { min: 0, max: 500, step: 1, default: 100 },
    strength: { min: -3, max: 3, step: 0.1, default: 1 },
    centerX: centre, centerY: centre,
  } },
  { id: 'filter-shockwave', label: 'Shockwave', group: 'distortion', tier: 'pixi', params: {
    amplitude: { min: 0, max: 100, step: 1, default: 30 },
    wavelength: { min: 10, max: 500, step: 1, default: 160 },
    speed: { min: 0, max: 2000, step: 10, default: 500 },
    brightness: { min: 0, max: 2, step: 0.05, default: 1 },
    time: { min: 0, max: 20, step: 0.1, default: 1 },
    centerX: centre, centerY: centre,
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
    replaceColor: onOff(false),
  } },
  { id: 'filter-cross-hatch', label: 'Cross Hatch', group: 'artistic-effects', tier: 'pixi', params: {} },
  { id: 'filter-dot', label: 'Dot Screen', group: 'artistic-effects', tier: 'pixi', params: {
    scale: { min: 0.1, max: 5, step: 0.1, default: 1 },
    angle: { min: 0, max: 360, step: 1, default: 5 },
    grayscale: onOff(true),
  } },
  { id: 'filter-crt', label: 'CRT', group: 'artistic-effects', tier: 'pixi', params: {
    curvature: { min: 0, max: 10, step: 0.1, default: 1 },
    lineWidth: { min: 0, max: 5, step: 0.1, default: 1 },
    lineContrast: { min: 0, max: 1, step: 0.01, default: 0.25 },
    noise: { min: 0, max: 1, step: 0.01, default: 0.3 },
    noiseSize: { min: 0, max: 10, step: 0.1, default: 1 },
    vignetting: { min: 0, max: 1, step: 0.01, default: 0.3 },
    vignettingAlpha: { min: 0, max: 1, step: 0.01, default: 1 },
    vignettingBlur: { min: 0, max: 1, step: 0.01, default: 0.3 },
    time: { min: 0, max: 20, step: 0.1, default: 0 },
    verticalLine: onOff(false),
  } },
  { id: 'filter-old-film', label: 'Old Film', group: 'artistic-effects', tier: 'pixi', params: {
    sepia: { min: 0, max: 1, step: 0.01, default: 0.3 },
    noise: { min: 0, max: 1, step: 0.01, default: 0.3 },
    noiseSize: { min: 0, max: 10, step: 0.1, default: 1 },
    scratch: { min: 0, max: 1, step: 0.01, default: 0.5 },
    scratchDensity: { min: 0, max: 1, step: 0.01, default: 0.3 },
    scratchWidth: { min: 0, max: 20, step: 0.5, default: 1 },
    vignetting: { min: 0, max: 1, step: 0.01, default: 0.3 },
    vignettingAlpha: { min: 0, max: 1, step: 0.01, default: 1 },
    vignettingBlur: { min: 0, max: 1, step: 0.01, default: 0.3 },
  } },
  { id: 'filter-glitch', label: 'Glitch', group: 'artistic-effects', tier: 'pixi', params: {
    slices: { min: 1, max: 50, step: 1, default: 5 },
    offset: { min: 0, max: 500, step: 1, default: 100 },
    direction: { min: 0, max: 360, step: 1, default: 0 },
    seed: { min: 0, max: 1, step: 0.01, default: 0 },
    minSize: { min: 1, max: 50, step: 1, default: 8 },
    sampleSize: { min: 256, max: 2048, step: 256, default: 512 },
    fillMode: { options: [
      { value: 0, label: 'Transparent' }, { value: 1, label: 'Original' }, { value: 2, label: 'Loop' },
      { value: 3, label: 'Clamp' }, { value: 4, label: 'Mirror' },
    ], default: 0 },
    average: onOff(false),
  } },
  { id: 'filter-rgb-split', label: 'RGB Split', group: 'artistic-effects', tier: 'pixi', params: {
    redX: { min: -50, max: 50, step: 1, default: -10 },
    blueX: { min: -50, max: 50, step: 1, default: 10 },
  } },
  { id: 'filter-simplex-noise', label: 'Simplex Noise', group: 'artistic-effects', tier: 'pixi', params: {
    strength: { min: 0, max: 1, step: 0.01, default: 0.5 },
    noiseScale: { min: 0, max: 50, step: 0.5, default: 10 },
    offsetX: { min: -100, max: 100, step: 1, default: 0 },
    offsetY: { min: -100, max: 100, step: 1, default: 0 },
    offsetZ: { min: -100, max: 100, step: 1, default: 0 },
    step: { min: -1, max: 1, step: 0.01, default: -1 },
  } },

  // ── Lighting ───────────────────────────────────────────────────────────
  { id: 'filter-bloom', label: 'Bloom', group: 'lighting', tier: 'pixi', params: {
    blur: { min: 0, max: 20, step: 1, default: 2 },
    strength: { min: 0, max: 5, step: 0.1, default: 1 },
  } },
  { id: 'filter-advanced-bloom', label: 'Advanced Bloom', group: 'lighting', tier: 'pixi', params: {
    threshold: { min: 0, max: 1, step: 0.01, default: 0.5 },
    bloomScale: { min: 0, max: 3, step: 0.1, default: 1 },
    brightness: { min: 0, max: 2, step: 0.1, default: 1 },
    blur: { min: 0, max: 20, step: 1, default: 8 },
    quality: { min: 1, max: 10, step: 1, default: 4 },
  } },
  { id: 'filter-glow', label: 'Glow', group: 'lighting', tier: 'pixi', params: {
    distance: { min: 0, max: 50, step: 1, default: 10 },
    outerStrength: { min: 0, max: 20, step: 1, default: 4 },
    innerStrength: { min: 0, max: 20, step: 0.5, default: 0 },
    alpha: { min: 0, max: 1, step: 0.01, default: 1 },
    quality: { min: 0.1, max: 1, step: 0.05, default: 0.1 },
    color: color('#ffffff'),
  } },
  { id: 'filter-godray', label: 'God Ray', group: 'lighting', tier: 'pixi', params: {
    angle: { min: 0, max: 90, step: 1, default: 30 },
    gain: { min: 0, max: 1, step: 0.01, default: 0.5 },
    lacunarity: { min: 0, max: 5, step: 0.1, default: 2.5 },
    alpha: { min: 0, max: 1, step: 0.01, default: 1 },
    time: { min: 0, max: 20, step: 0.1, default: 0 },
    parallel: onOff(true),
    centerX: centre, centerY: centre,
  } },
  { id: 'filter-simple-lightmap', label: 'Simple Lightmap', group: 'lighting', tier: 'pixi', params: {} },

  // ── Stylize ────────────────────────────────────────────────────────────
  { id: 'filter-bevel', label: 'Bevel', group: 'stylize', tier: 'pixi', params: {
    thickness: { min: 0, max: 20, step: 1, default: 2 },
    rotation: { min: 0, max: 360, step: 1, default: 45 },
    lightColor: color('#ffffff'),
    lightAlpha: { min: 0, max: 1, step: 0.01, default: 0.7 },
    shadowColor: color('#000000'),
    shadowAlpha: { min: 0, max: 1, step: 0.01, default: 0.7 },
  } },
  { id: 'filter-drop-shadow', label: 'Drop Shadow', group: 'stylize', tier: 'pixi', params: {
    offsetX: { min: -50, max: 50, step: 1, default: 4 },
    offsetY: { min: -50, max: 50, step: 1, default: 4 },
    blur: { min: 0, max: 20, step: 1, default: 2 },
    alpha: { min: 0, max: 1, step: 0.01, default: 0.5 },
    quality: { min: 0, max: 10, step: 1, default: 3 },
    color: color('#000000'),
    shadowOnly: onOff(false),
  } },
  { id: 'filter-outline', label: 'Outline', group: 'stylize', tier: 'pixi', params: {
    thickness: { min: 0, max: 20, step: 1, default: 1 },
    color: color('#000000'),
    alpha: { min: 0, max: 1, step: 0.01, default: 1 },
    quality: { min: 0.05, max: 1, step: 0.05, default: 0.1 },
    knockout: onOff(false),
  } },
  { id: 'filter-reflection', label: 'Reflection', group: 'stylize', tier: 'pixi', params: {
    boundary: { min: 0, max: 1, step: 0.01, default: 0.5 },
    time: { min: 0, max: 20, step: 0.1, default: 0 },
    mirror: onOff(true),
  } },

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
