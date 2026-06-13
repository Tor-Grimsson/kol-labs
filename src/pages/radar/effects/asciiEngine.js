/**
 * ASCII render engine — image → character cells. Each algorithm is a
 * different letterform strategy (density ramps, shade blocks, gradient-
 * directed strokes, braille sub-cell dots, user ramps). Same canvas contract
 * as ditherEngine: renderAscii(canvas, sourceImage, params).
 */

const DENSITY_RAMP = ' .:-=+*#%@'
const EDGE_GLYPHS = ['—', '\\', '|', '/'] // by gradient direction, quantized

export const ALGORITHM_OPTIONS = [
  { value: 'density', label: 'Density' },
  { value: 'edges', label: 'Edges' },
  { value: 'braille', label: 'Braille' },
  { value: 'custom', label: 'Custom Ramp' },
]

/* Ramps for the density algorithm — ordered sparse → dense. */
export const CHARSET_OPTIONS = [
  { value: 'classic', label: 'Classic', ramp: DENSITY_RAMP },
  { value: 'extended', label: 'Extended', ramp: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
  { value: 'blocks', label: 'Blocks', ramp: ' ░▒▓█' },
  { value: 'minimal', label: 'Minimal', ramp: ' .·:*' },
  { value: 'binary', label: 'Binary', ramp: ' 01' },
  { value: 'hex', label: 'Hex', ramp: ' 0123456789ABCDEF' },
  { value: 'katakana', label: 'Katakana', ramp: ' ･ｨｩｮｺﾆﾊﾎﾒﾗﾜ' },
  { value: 'strokes', label: 'Strokes', ramp: " `'-/\\|+X#" },
]

export const DEFAULT_ASCII_PARAMS = {
  algorithm: 'density',
  charset: 'classic',
  ramp: DENSITY_RAMP,
  cellSize: 10,
  glyphScale: 1.0,
  contrast: 0,
  invert: false,
  bgColor: '#111111',
  useColor: true,
  monoColor: '#ffffff',
}

const rampChar = (ramp, l) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(l * ramp.length)))]

export function renderAscii(canvas, sourceImage, params) {
  if (!sourceImage || !sourceImage.width) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const maxDisplay = params.maxDisplay || 1600
  const aspect = sourceImage.width / sourceImage.height
  let dw = sourceImage.width
  let dh = sourceImage.height
  if (dw > maxDisplay) { dw = maxDisplay; dh = dw / aspect }

  canvas.width = dw
  canvas.height = dh

  ctx.fillStyle = params.bgColor
  ctx.fillRect(0, 0, dw, dh)

  const tmpCnvs = document.createElement('canvas')
  tmpCnvs.width = dw; tmpCnvs.height = dh
  const tmpCtx = tmpCnvs.getContext('2d')
  tmpCtx.drawImage(sourceImage, 0, 0, dw, dh)
  const imgData = tmpCtx.getImageData(0, 0, dw, dh).data
  const step = Math.max(2, params.cellSize)

  const hex = params.monoColor.replace(/^#/, '')
  const mono = `rgb(${parseInt(hex.substring(0, 2), 16)},${parseInt(hex.substring(2, 4), 16)},${parseInt(hex.substring(4, 6), 16)})`

  const contrastFactor = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast))
  const adjust = (v) => Math.max(0, Math.min(255, contrastFactor * (v - 128) + 128))

  /* Contrast-adjusted, optionally inverted luma at a pixel (clamped). */
  const lumaAt = (px, py) => {
    const cx = Math.max(0, Math.min(dw - 1, Math.round(px)))
    const cy = Math.max(0, Math.min(dh - 1, Math.round(py)))
    const i = (cy * dw + cx) * 4
    if (imgData[i + 3] < 20) return null
    const l = (0.299 * adjust(imgData[i]) + 0.587 * adjust(imgData[i + 1]) + 0.114 * adjust(imgData[i + 2])) / 255
    return params.invert ? 1 - l : l
  }
  const colorAt = (px, py) => {
    const cx = Math.max(0, Math.min(dw - 1, Math.round(px)))
    const cy = Math.max(0, Math.min(dh - 1, Math.round(py)))
    const i = (cy * dw + cx) * 4
    return `rgb(${Math.floor(adjust(imgData[i]))},${Math.floor(adjust(imgData[i + 1]))},${Math.floor(adjust(imgData[i + 2]))})`
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.max(4, step * params.glyphScale)}px ui-monospace, monospace`

  for (let y = 0; y < dh; y += step) {
    for (let x = 0; x < dw; x += step) {
      const cx = x + step / 2
      const cy = y + step / 2
      const l = lumaAt(cx, cy)
      if (l == null) continue

      let ch = null
      switch (params.algorithm) {
        case 'density':
          ch = rampChar(CHARSET_OPTIONS.find((c) => c.value === params.charset)?.ramp || DENSITY_RAMP, l)
          break
        case 'custom':
          ch = rampChar(params.ramp || DENSITY_RAMP, l)
          break
        case 'edges': {
          const lR = lumaAt(cx + step, cy)
          const lB = lumaAt(cx, cy + step)
          if (lR == null || lB == null) break
          const dx = lR - l
          const dy = lB - l
          const mag = Math.hypot(dx, dy)
          if (mag < 0.06) { ch = l > 0.5 ? '·' : null; break }
          // gradient direction → stroke perpendicular to it (follows the edge)
          const ang = Math.atan2(dy, dx) + Math.PI / 2
          const bin = Math.round(((ang + Math.PI) / Math.PI) * 2) % 4
          ch = EDGE_GLYPHS[bin]
          break
        }
        case 'braille': {
          // 2×4 sub-cells per glyph; braille dot bit order: 1-3 left col,
          // 4-6 right col, 7-8 bottom row (U+2800 + bits).
          const sx = step / 2
          const sy = step / 4
          const dotBits = [
            [0, 0, 0x01], [0, 1, 0x02], [0, 2, 0x04], [1, 0, 0x08],
            [1, 1, 0x10], [1, 2, 0x20], [0, 3, 0x40], [1, 3, 0x80],
          ]
          let bits = 0
          for (const [col, row, bit] of dotBits) {
            const sl = lumaAt(x + sx * col + sx / 2, y + sy * row + sy / 2)
            if (sl != null && sl > 0.5) bits |= bit
          }
          if (bits === 0) break
          ch = String.fromCharCode(0x2800 + bits)
          break
        }
      }
      if (!ch || ch === ' ') continue

      ctx.fillStyle = params.useColor ? colorAt(cx, cy) : mono
      ctx.fillText(ch, cx, cy)
    }
  }
}
