// Canvas-tier execution — maps each `tier: 'canvas'` effect to a src/lib/
// imagefilters.js call and runs the stack as a synchronous ImageData pass.
//
// imagefilters fns are ImageData -> ImageData. The UI param ranges in
// effects.config.js are mapped here to each fn's NATIVE arg range (e.g. the HSL
// sliders are unit-ish but HSLAdjustment wants ±180/±100/±100). Pixi-tier
// entries are ignored (wired in a later pass), so a stack of only GPU effects
// leaves the image untouched here.

import ImageFilters from '../../../lib/imagefilters.js'
import { getEffectDef } from '../effects.config.js'

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)

// Additive uniform noise — imagefilters has no Noise primitive, so it lives here.
function applyNoise(imageData, amount) {
  if (amount <= 0) return imageData
  const out = ImageFilters.Clone(imageData)
  const d = out.data
  const mag = amount * 255
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * mag
    d[i] = clamp255(d[i] + n)
    d[i + 1] = clamp255(d[i + 1] + n)
    d[i + 2] = clamp255(d[i + 2] + n)
  }
  return out
}

// One effect → processed ImageData. Unknown / pixi-tier ids pass through.
function applyOne(imageData, type, p = {}) {
  switch (type) {
    case 'filter-brightness':
      return ImageFilters.BrightnessContrastPhotoshop(imageData, (p.brightness ?? 0) * 100, 0)
    case 'filter-contrast':
      return ImageFilters.BrightnessContrastPhotoshop(imageData, 0, p.contrast ?? 0)
    case 'filter-hsl':
    case 'filter-hsv':
      return ImageFilters.HSLAdjustment(imageData, (p.hue ?? 0) * 180, (p.saturation ?? 0) * 100, (p.value ?? 0) * 50)
    case 'filter-rgb':
      return ImageFilters.ColorTransformFilter(imageData, 1, 1, 1, 1, p.red ?? 0, p.green ?? 0, p.blue ?? 0, 0)
    case 'filter-invert':
      return ImageFilters.Invert(imageData)
    case 'filter-sepia':
      return ImageFilters.Sepia(imageData)
    case 'filter-grayscale':
      return ImageFilters.GrayScale(imageData)
    case 'filter-enhance':
      return ImageFilters.Enrich(imageData)
    case 'filter-blur': {
      const r = Math.round(p.blurRadius ?? 0)
      return r >= 1 ? ImageFilters.StackBlur(imageData, Math.min(r, 254)) : imageData
    }
    case 'filter-pixelate': {
      const b = Math.round(p.pixelSize ?? 1)
      return b > 1 ? ImageFilters.Mosaic(imageData, b) : imageData
    }
    case 'filter-posterize':
      return ImageFilters.Posterize(imageData, Math.round(p.levels ?? 6))
    case 'filter-solarize':
      return ImageFilters.Solarize(imageData)
    case 'filter-emboss':
      return ImageFilters.Emboss(imageData)
    case 'filter-noise':
      return applyNoise(imageData, p.noise ?? 0)
    case 'filter-threshold':
      return ImageFilters.Binarize(imageData, p.threshold ?? 0.5)
    default:
      return imageData
  }
}

// True if a stack has any enabled canvas-tier effect (the `amount` dial only
// matters then; lets the page skip the getImageData round-trip otherwise).
export function hasCanvasEffect(stack) {
  return stack.some((fx) => fx.enabled && getEffectDef(fx.type)?.tier === 'canvas')
}

/**
 * Run the stack's canvas-tier effects over `canvas` IN PLACE at FULL strength
 * (no crossfade). Used as stage 1 of the two-tier pipeline, where the global
 * Amount crossfade is applied once at the end against the raw source. Returns
 * true if anything was applied.
 */
export function runCanvasStackInPlace(canvas, stack) {
  const enabled = stack.filter((fx) => fx.enabled && getEffectDef(fx.type)?.tier === 'canvas')
  if (enabled.length === 0) return false
  const ctx = canvas.getContext('2d')
  let data = ctx.getImageData(0, 0, canvas.width, canvas.height) // fresh copy, safe to mutate
  for (const fx of enabled) data = applyOne(data, fx.type, fx.params)
  ctx.putImageData(data, 0, 0)
  return true
}

/**
 * Run the stack's canvas-tier effects over `canvas` IN PLACE, then crossfade the
 * processed result against the pre-effect pixels by `amount` (0 = raw, 100 =
 * full). The caller must have drawn the source onto the canvas first. Returns
 * true if anything was applied. Works on a Clone so the pristine source pixels
 * survive in-place imagefilters fns (StackBlur/Mosaic mutate).
 */
export function applyCanvasStack(canvas, stack, amount) {
  const enabled = stack.filter((fx) => fx.enabled && getEffectDef(fx.type)?.tier === 'canvas')
  if (enabled.length === 0 || amount <= 0) return false

  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const original = ctx.getImageData(0, 0, w, h)

  let data = ImageFilters.Clone(original)
  for (const fx of enabled) data = applyOne(data, fx.type, fx.params)

  const a = Math.min(amount, 100) / 100
  if (a >= 1) {
    ctx.putImageData(data, 0, 0)
  } else {
    // putImageData ignores globalAlpha, so blend via a temp canvas drawImage.
    ctx.putImageData(original, 0, 0)
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    tmp.getContext('2d').putImageData(data, 0, 0)
    ctx.save()
    ctx.globalAlpha = a
    ctx.drawImage(tmp, 0, 0)
    ctx.restore()
  }
  return true
}
