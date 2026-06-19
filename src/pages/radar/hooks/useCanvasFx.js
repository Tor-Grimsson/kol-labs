// Canvas FX Modules — pixel-level post-processing on OffscreenCanvas buffers

// Every FX carries an `amount` (0–100) — how much of the processed result is
// mixed back into the pre-FX image (0 = original, 100 = full effect). Kept last
// so it renders below the FX-specific params.
const AMOUNT = { default: 100, min: 0, max: 100, step: 1 }
export const CANVAS_FX_DEFS = [
  { id: 'chromatic', label: 'RGB Split', params: { offsetX: { default: 5, min: 0, max: 50, step: 1 }, offsetY: { default: 0, min: 0, max: 50, step: 1 }, amount: AMOUNT } },
  { id: 'edge-detect', label: 'Edge Detect', params: { threshold: { default: 30, min: 0, max: 100, step: 1 }, invert: { default: 0, min: 0, max: 1, step: 1 }, amount: AMOUNT } },
  { id: 'posterize', label: 'Posterize', params: { levels: { default: 4, min: 2, max: 32, step: 1 }, amount: AMOUNT } },
  { id: 'pixel-sort', label: 'Pixel Sort', params: { threshold: { default: 50, min: 0, max: 100, step: 1 }, direction: { default: 0, min: 0, max: 1, step: 1 }, amount: AMOUNT } },
  { id: 'mirror', label: 'Mirror', params: { axis: { default: 'horizontal', options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] }, amount: AMOUNT } },
  { id: 'kaleidoscope', label: 'Kaleidoscope', params: { segments: { default: 6, min: 2, max: 16, step: 1 }, angle: { default: 0, min: 0, max: 360, step: 1 }, amount: AMOUNT } },
  { id: 'threshold', label: 'Threshold', params: { level: { default: 50, min: 0, max: 100, step: 1 }, amount: AMOUNT } },
]

export const MAX_CANVAS_FX = 8

export function getDefaultCanvasFxParams(fxId) {
  const def = CANVAS_FX_DEFS.find(d => d.id === fxId)
  if (!def) return {}
  const params = {}
  for (const [key, spec] of Object.entries(def.params)) {
    params[key] = spec.default
  }
  return params
}

// --- FX Processors ---
// Each takes (srcData, outData, width, height, params)
// srcData is the input ImageData.data, outData is the output ImageData.data

function fxChromatic(srcData, outData, w, h, params) {
  const ox = params.offsetX | 0
  const oy = params.offsetY | 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2
      // R from (x - ox, y - oy)
      const rx = Math.max(0, Math.min(w - 1, x - ox))
      const ry = Math.max(0, Math.min(h - 1, y - oy))
      const ri = (ry * w + rx) << 2
      // G from (x, y) — center
      // B from (x + ox, y + oy)
      const bx = Math.max(0, Math.min(w - 1, x + ox))
      const by = Math.max(0, Math.min(h - 1, y + oy))
      const bi = (by * w + bx) << 2
      outData[i] = srcData[ri]         // R
      outData[i + 1] = srcData[i + 1]  // G
      outData[i + 2] = srcData[bi + 2] // B
      outData[i + 3] = srcData[i + 3]  // A
    }
  }
}

function fxEdgeDetect(srcData, outData, w, h, params) {
  const thresh = (params.threshold / 100) * 255
  const inv = params.invert | 0
  // Sobel kernels
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      // Luminance samples around 3x3 neighborhood
      let gx = 0, gy = 0
      // Unrolled 3x3 Sobel
      const tl = srcData[((y - 1) * w + (x - 1)) << 2] * 0.299 + srcData[(((y - 1) * w + (x - 1)) << 2) + 1] * 0.587 + srcData[(((y - 1) * w + (x - 1)) << 2) + 2] * 0.114
      const tc = srcData[((y - 1) * w + x) << 2] * 0.299 + srcData[(((y - 1) * w + x) << 2) + 1] * 0.587 + srcData[(((y - 1) * w + x) << 2) + 2] * 0.114
      const tr = srcData[((y - 1) * w + (x + 1)) << 2] * 0.299 + srcData[(((y - 1) * w + (x + 1)) << 2) + 1] * 0.587 + srcData[(((y - 1) * w + (x + 1)) << 2) + 2] * 0.114
      const ml = srcData[(y * w + (x - 1)) << 2] * 0.299 + srcData[((y * w + (x - 1)) << 2) + 1] * 0.587 + srcData[((y * w + (x - 1)) << 2) + 2] * 0.114
      const mr = srcData[(y * w + (x + 1)) << 2] * 0.299 + srcData[((y * w + (x + 1)) << 2) + 1] * 0.587 + srcData[((y * w + (x + 1)) << 2) + 2] * 0.114
      const bl = srcData[((y + 1) * w + (x - 1)) << 2] * 0.299 + srcData[(((y + 1) * w + (x - 1)) << 2) + 1] * 0.587 + srcData[(((y + 1) * w + (x - 1)) << 2) + 2] * 0.114
      const bc = srcData[((y + 1) * w + x) << 2] * 0.299 + srcData[(((y + 1) * w + x) << 2) + 1] * 0.587 + srcData[(((y + 1) * w + x) << 2) + 2] * 0.114
      const br = srcData[((y + 1) * w + (x + 1)) << 2] * 0.299 + srcData[(((y + 1) * w + (x + 1)) << 2) + 1] * 0.587 + srcData[(((y + 1) * w + (x + 1)) << 2) + 2] * 0.114
      // Sobel X: -1 0 1 / -2 0 2 / -1 0 1
      gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      // Sobel Y: -1 -2 -1 / 0 0 0 / 1 2 1
      gy = -tl - 2 * tc - tr + bl + 2 * bc + br
      let mag = Math.sqrt(gx * gx + gy * gy)
      mag = mag > thresh ? 255 : 0
      if (inv) mag = 255 - mag
      const i = (y * w + x) << 2
      outData[i] = mag
      outData[i + 1] = mag
      outData[i + 2] = mag
      outData[i + 3] = srcData[i + 3]
    }
  }
  // Edge rows/columns: set to black (or white if inverted)
  const edgeVal = inv ? 255 : 0
  for (let x = 0; x < w; x++) {
    const t = x << 2
    const b = ((h - 1) * w + x) << 2
    outData[t] = edgeVal; outData[t + 1] = edgeVal; outData[t + 2] = edgeVal; outData[t + 3] = srcData[t + 3]
    outData[b] = edgeVal; outData[b + 1] = edgeVal; outData[b + 2] = edgeVal; outData[b + 3] = srcData[b + 3]
  }
  for (let y = 0; y < h; y++) {
    const l = (y * w) << 2
    const r = (y * w + w - 1) << 2
    outData[l] = edgeVal; outData[l + 1] = edgeVal; outData[l + 2] = edgeVal; outData[l + 3] = srcData[l + 3]
    outData[r] = edgeVal; outData[r + 1] = edgeVal; outData[r + 2] = edgeVal; outData[r + 3] = srcData[r + 3]
  }
}

function fxPosterize(srcData, outData, w, h, params) {
  const levels = Math.max(2, params.levels | 0)
  const n = levels - 1
  const len = srcData.length
  for (let i = 0; i < len; i += 4) {
    outData[i] = Math.round(srcData[i] / 255 * n) / n * 255
    outData[i + 1] = Math.round(srcData[i + 1] / 255 * n) / n * 255
    outData[i + 2] = Math.round(srcData[i + 2] / 255 * n) / n * 255
    outData[i + 3] = srcData[i + 3]
  }
}

function fxPixelSort(srcData, outData, w, h, params) {
  const thresh = (params.threshold / 100) * 255
  const vertical = (params.direction | 0) === 1
  // Copy source to output first
  outData.set(srcData)
  if (vertical) {
    // Sort columns
    for (let x = 0; x < w; x++) {
      let segStart = -1
      for (let y = 0; y <= h; y++) {
        const idx = y < h ? (y * w + x) << 2 : -1
        const brightness = idx >= 0 ? (srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114) : 0
        if (idx >= 0 && brightness > thresh) {
          if (segStart < 0) segStart = y
        } else {
          if (segStart >= 0) {
            sortSegmentVertical(outData, w, x, segStart, y - 1)
            segStart = -1
          }
        }
      }
    }
  } else {
    // Sort rows
    for (let y = 0; y < h; y++) {
      let segStart = -1
      for (let x = 0; x <= w; x++) {
        const idx = x < w ? (y * w + x) << 2 : -1
        const brightness = idx >= 0 ? (srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114) : 0
        if (idx >= 0 && brightness > thresh) {
          if (segStart < 0) segStart = x
        } else {
          if (segStart >= 0) {
            sortSegmentHorizontal(outData, w, y, segStart, x - 1)
            segStart = -1
          }
        }
      }
    }
  }
}

function sortSegmentHorizontal(data, w, y, x0, x1) {
  const len = x1 - x0 + 1
  if (len < 2) return
  // Collect pixels with brightness
  const pixels = new Array(len)
  for (let i = 0; i < len; i++) {
    const idx = (y * w + x0 + i) << 2
    pixels[i] = {
      r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3],
      lum: data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114,
    }
  }
  pixels.sort((a, b) => a.lum - b.lum)
  for (let i = 0; i < len; i++) {
    const idx = (y * w + x0 + i) << 2
    data[idx] = pixels[i].r
    data[idx + 1] = pixels[i].g
    data[idx + 2] = pixels[i].b
    data[idx + 3] = pixels[i].a
  }
}

function sortSegmentVertical(data, w, x, y0, y1) {
  const len = y1 - y0 + 1
  if (len < 2) return
  const pixels = new Array(len)
  for (let i = 0; i < len; i++) {
    const idx = ((y0 + i) * w + x) << 2
    pixels[i] = {
      r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3],
      lum: data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114,
    }
  }
  pixels.sort((a, b) => a.lum - b.lum)
  for (let i = 0; i < len; i++) {
    const idx = ((y0 + i) * w + x) << 2
    data[idx] = pixels[i].r
    data[idx + 1] = pixels[i].g
    data[idx + 2] = pixels[i].b
    data[idx + 3] = pixels[i].a
  }
}

function fxMirror(srcData, outData, w, h, params) {
  const vertical = params.axis === 'vertical'
  // Copy all source first
  outData.set(srcData)
  if (vertical) {
    // Copy top half to bottom
    const halfH = (h >> 1)
    for (let y = 0; y < halfH; y++) {
      const mirrorY = h - 1 - y
      const srcRow = y * w << 2
      const dstRow = mirrorY * w << 2
      for (let x = 0; x < w; x++) {
        const si = srcRow + (x << 2)
        const di = dstRow + (x << 2)
        outData[di] = srcData[si]
        outData[di + 1] = srcData[si + 1]
        outData[di + 2] = srcData[si + 2]
        outData[di + 3] = srcData[si + 3]
      }
    }
  } else {
    // Copy left half to right
    const halfW = (w >> 1)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < halfW; x++) {
        const si = (y * w + x) << 2
        const di = (y * w + (w - 1 - x)) << 2
        outData[di] = srcData[si]
        outData[di + 1] = srcData[si + 1]
        outData[di + 2] = srcData[si + 2]
        outData[di + 3] = srcData[si + 3]
      }
    }
  }
}

// Kaleidoscope — N-fold mirrored radial symmetry (N axes). Each output pixel
// folds its angle (about the centre) into one wedge of 2π/segments, mirrored
// within the wedge, then samples the source there (nearest, edge-clamped).
function fxKaleidoscope(srcData, outData, w, h, params) {
  const seg = Math.max(2, params.segments | 0)
  const rot = ((params.angle || 0) * Math.PI) / 180
  const cx = w / 2
  const cy = h / 2
  const wedge = (Math.PI * 2) / seg
  const half = wedge / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx
      const dy = y - cy
      const r = Math.sqrt(dx * dx + dy * dy)
      let a = Math.atan2(dy, dx) - rot
      a -= Math.floor(a / wedge) * wedge // → [0, wedge)
      if (a > half) a = wedge - a // mirror within the wedge
      a += rot
      let sx = Math.round(cx + r * Math.cos(a))
      let sy = Math.round(cy + r * Math.sin(a))
      if (sx < 0) sx = 0; else if (sx >= w) sx = w - 1
      if (sy < 0) sy = 0; else if (sy >= h) sy = h - 1
      const si = (sy * w + sx) << 2
      const di = (y * w + x) << 2
      outData[di] = srcData[si]
      outData[di + 1] = srcData[si + 1]
      outData[di + 2] = srcData[si + 2]
      outData[di + 3] = srcData[si + 3]
    }
  }
}

function fxThreshold(srcData, outData, w, h, params) {
  const level = (params.level / 100) * 255
  const len = srcData.length
  for (let i = 0; i < len; i += 4) {
    const lum = srcData[i] * 0.299 + srcData[i + 1] * 0.587 + srcData[i + 2] * 0.114
    const val = lum >= level ? 255 : 0
    outData[i] = val
    outData[i + 1] = val
    outData[i + 2] = val
    outData[i + 3] = srcData[i + 3]
  }
}

const FX_PROCESSORS = {
  'chromatic': fxChromatic,
  'edge-detect': fxEdgeDetect,
  'posterize': fxPosterize,
  'pixel-sort': fxPixelSort,
  'mirror': fxMirror,
  'kaleidoscope': fxKaleidoscope,
  'threshold': fxThreshold,
}

/**
 * Apply a chain of canvas FX to an OffscreenCanvas in-place.
 * Each item in fxChain: { type: string, enabled: boolean, params: {} }
 */
export function applyCanvasFx(canvas, fxChain) {
  if (!fxChain || fxChain.length === 0) return
  const enabledFx = fxChain.filter(fx => fx.enabled && FX_PROCESSORS[fx.type])
  if (enabledFx.length === 0) return

  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  if (w <= 0 || h <= 0) return

  let imageData = ctx.getImageData(0, 0, w, h)
  let srcData = imageData.data

  for (const fx of enabledFx) {
    const processor = FX_PROCESSORS[fx.type]
    const outImageData = ctx.createImageData(w, h)
    const out = outImageData.data
    processor(srcData, out, w, h, fx.params)
    // amount = how much of the processed result mixes into the pre-FX pixels
    // (0 = original, 100 = full). Default full when unset.
    const amt = fx.params.amount == null ? 1 : Math.max(0, Math.min(1, fx.params.amount / 100))
    if (amt < 1) {
      for (let i = 0; i < out.length; i += 4) {
        out[i]     = srcData[i]     + (out[i]     - srcData[i])     * amt
        out[i + 1] = srcData[i + 1] + (out[i + 1] - srcData[i + 1]) * amt
        out[i + 2] = srcData[i + 2] + (out[i + 2] - srcData[i + 2]) * amt
      }
    }
    imageData = outImageData
    srcData = out
  }

  ctx.putImageData(imageData, 0, 0)
}
