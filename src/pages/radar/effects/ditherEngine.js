/**
 * Dither / Halftone / ASCII render engine
 * Ported from sabosugi's CodePen, adapted for React integration
 */

import { evalSweeps, hasRevealSweep } from './sweeps'

const NO_SWEEP = { bright: 0, scaleMul: 1, offX: 0, offY: 0, rot: 0, hasReveal: false, reveal: 0 }

// --- SHAPE LIBRARY ---
function drawPoly(ctx, x, y, rad, sides, offset) {
  const step = (Math.PI * 2) / sides
  for (let i = 0; i < sides; i++) {
    const ang = i * step + offset
    i === 0
      ? ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad)
      : ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad)
  }
  ctx.closePath()
}

function drawStar(ctx, cx, cy, spikes, outer, inner) {
  let rot = (Math.PI / 2) * 3
  let step = Math.PI / spikes
  ctx.moveTo(cx, cy - outer)
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outer
    let y = cy + Math.sin(rot) * outer
    ctx.lineTo(x, y)
    rot += step
    x = cx + Math.cos(rot) * inner
    y = cy + Math.sin(rot) * inner
    ctx.lineTo(x, y)
    rot += step
  }
  ctx.lineTo(cx, cy - outer)
  ctx.closePath()
}

function drawShape(ctx, x, y, size, type) {
  const r = size / 2
  ctx.beginPath()

  switch (type) {
    case 'circle': ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); break
    case 'rect': ctx.rect(x - r, y - r, size, size); ctx.fill(); break
    case 'triangle': ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); ctx.fill(); break
    case 'octagon': drawPoly(ctx, x, y, r, 8, Math.PI / 8); ctx.fill(); break
    case 'star': drawStar(ctx, x, y, 5, r, r * 0.4); ctx.fill(); break
    case 'cross': { const w = r / 3; ctx.rect(x - w, y - r, w * 2, size); ctx.rect(x - r, y - w, size, w * 2); ctx.fill(); break }
    case 'rect_v': ctx.rect(x - r * 0.3, y - r, size * 0.3, size); ctx.fill(); break
    case 'rect_h': ctx.rect(x - r, y - r * 0.3, size, size * 0.3); ctx.fill(); break
    case 'hex_v': drawPoly(ctx, x, y, r, 6, Math.PI / 6); ctx.fill(); break
    case 'line_diag_r': ctx.moveTo(x - r, y + r); ctx.lineTo(x - r + size * 0.2, y + r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r - size * 0.2, y - r); ctx.closePath(); ctx.fill(); break
    case 'line_diag_l': ctx.moveTo(x - r, y - r); ctx.lineTo(x - r + size * 0.2, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - size * 0.2, y + r); ctx.closePath(); ctx.fill(); break
    case 'chevron': { const chW = r * 0.4; ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x, y - r * 0.5); ctx.lineTo(x + r, y + r * 0.5); ctx.lineTo(x + r, y + r * 0.5 - chW); ctx.lineTo(x, y - r * 0.5 - chW); ctx.lineTo(x - r, y + r * 0.5 - chW); ctx.closePath(); ctx.fill(); break }
    case 'trapezoid': ctx.moveTo(x - r * 0.6, y - r); ctx.lineTo(x + r * 0.6, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); ctx.fill(); break
    case 'semi_top': ctx.arc(x, y + r * 0.1, r, Math.PI, 0); ctx.closePath(); ctx.fill(); break
    case 'semi_bottom': ctx.arc(x, y - r * 0.1, r, 0, Math.PI); ctx.closePath(); ctx.fill(); break
    case 'rect_hollow': ctx.rect(x - r, y - r, size, size); ctx.rect(x + r * 0.5, y - r * 0.5, -size * 0.5, size * 0.5); ctx.fill(); break
    case 'spiral': {
      ctx.lineWidth = size * 0.15; ctx.lineCap = 'round'
      const loops = 2; const increment = r / (loops * 10)
      ctx.moveTo(x, y)
      for (let i = 0; i < loops * 20; i++) {
        const angle = 0.5 * i; const dist = increment * i
        ctx.lineTo(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist)
      }
      ctx.stroke(); break
    }
    case 'concentric':
      ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x, y, r * 0.7, 0, Math.PI * 2, true)
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.arc(x, y, r * 0.15, 0, Math.PI * 2, true); ctx.fill(); break
    case 'gear': {
      const teeth = 8; const outerR = r; const innerR = r * 0.7; const holeR = r * 0.3
      for (let i = 0; i < teeth * 2; i++) {
        const a = (Math.PI * 2 * i) / (teeth * 2); const rad = i % 2 === 0 ? outerR : innerR
        const px = x + Math.cos(a) * rad; const py = y + Math.sin(a) * rad
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.moveTo(x + holeR, y); ctx.arc(x, y, holeR, 0, Math.PI * 2, true); ctx.fill(); break
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5; const px = x + Math.cos(a) * (r * 0.6); const py = y + Math.sin(a) * (r * 0.6)
        ctx.moveTo(x, y); ctx.arc(px, py, r * 0.4, 0, Math.PI * 2)
      }
      ctx.fill(); break
    }
    case 'ghost': {
      ctx.arc(x, y - r * 0.2, r * 0.8, Math.PI, 0); ctx.lineTo(x + r * 0.8, y + r); ctx.lineTo(x + r * 0.4, y + r * 0.7)
      ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.4, y + r * 0.7); ctx.lineTo(x - r * 0.8, y + r); ctx.closePath()
      ctx.moveTo(x - r * 0.3, y - r * 0.2); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2)
      ctx.moveTo(x + r * 0.3, y - r * 0.2); ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2); ctx.fill(); break
    }
    default: ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); break
  }
}

/**
 * Render dither effect onto a canvas
 * @param {HTMLCanvasElement} canvas - target canvas
 * @param {HTMLImageElement} sourceImage - loaded source image
 * @param {Object} params - effect parameters
 */
export function renderDither(canvas, sourceImage, params) {
  if (!sourceImage || !sourceImage.width) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const maxDisplay = params.maxDisplay || 1600
  const aspect = sourceImage.width / sourceImage.height
  let dw = sourceImage.width
  let dh = sourceImage.height
  if (dw > maxDisplay) { dw = maxDisplay; dh = dw / aspect }

  canvas.width = dw
  canvas.height = dh

  // Background
  ctx.fillStyle = params.bgColor
  ctx.fillRect(0, 0, dw, dh)

  // Temp canvas for pixel reading
  const tmpCnvs = document.createElement('canvas')
  tmpCnvs.width = dw; tmpCnvs.height = dh
  const tmpCtx = tmpCnvs.getContext('2d')
  tmpCtx.drawImage(sourceImage, 0, 0, dw, dh)
  const imgData = tmpCtx.getImageData(0, 0, dw, dh).data
  const step = params.cellSize

  // Sweep field (time-driven animation over a static frame). Reveal-target
  // sweeps wipe the effect in/out, so lay the raw image underneath first —
  // gated-off cells then show the photo instead of the background.
  const sweeps = params.sweeps || []
  const time = params.time || 0
  if (hasRevealSweep(sweeps)) ctx.drawImage(sourceImage, 0, 0, dw, dh)

  // Mono color
  const hex = params.monoColor.replace(/^#/, '')
  const mR = parseInt(hex.substring(0, 2), 16)
  const mG = parseInt(hex.substring(2, 4), 16)
  const mB = parseInt(hex.substring(4, 6), 16)

  // Contrast factor
  const contrastFactor = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast))

  for (let y = 0; y < dh; y += step) {
    for (let x = 0; x < dw; x += step) {
      const pIdx = ((y + Math.floor(step / 2)) * dw + (x + Math.floor(step / 2))) * 4
      if (pIdx >= imgData.length) continue

      let r = imgData[pIdx]
      let g = imgData[pIdx + 1]
      let b = imgData[pIdx + 2]
      const a = imgData[pIdx + 3]
      if (a < 20) continue

      // Contrast
      r = Math.max(0, Math.min(255, contrastFactor * (r - 128) + 128))
      g = Math.max(0, Math.min(255, contrastFactor * (g - 128) + 128))
      b = Math.max(0, Math.min(255, contrastFactor * (b - 128) + 128))

      const sw = sweeps.length ? evalSweeps(sweeps, (x + step / 2) / dw, (y + step / 2) / dh, time) : NO_SWEEP
      if (sw.hasReveal && sw.reveal < 0.5) continue // raw image (underlay) shows through

      let luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      if (sw.bright) luma = Math.max(0, Math.min(1, luma + sw.bright))

      let scX = params.baseScale
      let scY = params.baseScale
      let rot = 0
      let offX = 0
      let offY = 0
      let alpha = 1.0

      switch (params.mode) {
        case 'flat': break
        case 'halftone': scX = scY = luma * params.baseScale * 1.5; break
        case 'inv_halftone': scX = scY = (1.0 - luma) * params.baseScale * 1.5; break
        case 'rotation': rot = luma * Math.PI; break
        case 'random_size': scX = scY = Math.random() * params.baseScale; break
        case 'random_rot': rot = Math.random() * Math.PI * 2; break
        case 'glitch': offX = (luma - 0.5) * step * 1.5 * params.intensity; break
        case 'opacity': alpha = luma; break
        case 'inv_opacity': alpha = 1.0 - luma; break
        case 'threshold': if (luma < 0.5) scX = scY = 0; break
        case 'crosshatch':
          rot = luma > 0.5 ? Math.PI / 4 : -Math.PI / 4
          scY = params.baseScale * 1.5; scX = params.baseScale * 0.2; break
        case 'stretch_v': scX = params.baseScale * 0.5; scY = luma * params.baseScale * 3; break
        case 'stretch_h': scX = luma * params.baseScale * 3; scY = params.baseScale * 0.5; break
        case 'flow': {
          const iR = pIdx + step * 4
          const iB = pIdx + (dw * step) * 4
          const rR = imgData[iR] || 0, gR = imgData[iR + 1] || 0, bR = imgData[iR + 2] || 0
          const rB = imgData[iB] || 0, gB = imgData[iB + 1] || 0, bB = imgData[iB + 2] || 0
          const lR = (0.299 * rR + 0.587 * gR + 0.114 * bR) / 255
          const lB = (0.299 * rB + 0.587 * gB + 0.114 * bB) / 255
          const rawLuma = (0.299 * imgData[pIdx] + 0.587 * imgData[pIdx + 1] + 0.114 * imgData[pIdx + 2]) / 255
          const dx = lR - rawLuma
          const dy = lB - rawLuma
          rot = Math.atan2(dy, dx) * params.intensity
          scX = scY = luma * params.baseScale * 1.2; break
        }
        case 'edges': {
          const idxNext = pIdx + step * 4
          let rN = imgData[idxNext] || 0
          rN = contrastFactor * (rN - 128) + 128
          const gN = imgData[idxNext + 1] || 0, bN = imgData[idxNext + 2] || 0
          const lumaN = (0.299 * rN + 0.587 * gN + 0.114 * bN) / 255
          const diff = Math.abs(luma - lumaN)
          scX = scY = diff * 5 * params.baseScale * params.intensity; break
        }
        case 'melt':
          offY = luma * step * 2 * params.intensity
          scX = scY = luma * params.baseScale; break
        case 'jitter': {
          const jit = (Math.random() - 0.5) * step * 2
          if (luma > 0.5) { offX = jit * params.intensity; offY = jit * params.intensity }
          scX = scY = luma * params.baseScale; break
        }
        case 'checker': {
          const gridX = Math.floor(x / step)
          const gridY = Math.floor(y / step)
          scX = scY = (gridX + gridY) % 2 === 0
            ? luma * params.baseScale * 1.5
            : (1.0 - luma) * params.baseScale * 1.5; break
        }
        case 'posterize': {
          let level = 0.2
          if (luma > 0.3) level = 0.5
          if (luma > 0.6) level = 0.8
          if (luma > 0.8) level = 1.0
          scX = scY = level * params.baseScale; break
        }
        case 'interference': {
          const pattern = Math.sin((x * y) * 0.0001 * params.intensity)
          scX = scY = (luma + pattern) * 0.5 * params.baseScale * 1.5; break
        }
        case 'crt_scan': {
          const line = Math.floor(y / step)
          if (line % 2 === 0) {
            scX = params.baseScale * 1.2; scY = params.baseScale * 0.2; offX = 2 * params.intensity
          } else {
            scX = luma * params.baseScale; scY = params.baseScale * 0.8
          }; break
        }
        case 'bio':
          rot = Math.sin(luma * Math.PI * 2) + Math.random() * 0.5
          scX = scY = (luma + 0.2) * params.baseScale; break
        case 'eraser':
          if (Math.random() > luma * params.intensity) scX = scY = 0; break
      }

      // Draw
      ctx.save()
      const cx = x + step / 2 + offX
      const cy = y + step / 2 + offY
      const size = Math.max(0, step - params.gap)

      ctx.translate(cx + sw.offX * step, cy + sw.offY * step)
      ctx.rotate(rot + sw.rot)
      ctx.scale(scX * sw.scaleMul, scY * sw.scaleMul)

      if (params.useColor) {
        ctx.fillStyle = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${alpha})`
        ctx.strokeStyle = ctx.fillStyle
      } else {
        ctx.fillStyle = `rgba(${mR},${mG},${mB},${alpha})`
        ctx.strokeStyle = ctx.fillStyle
      }

      drawShape(ctx, 0, 0, size, params.shape)
      ctx.restore()
    }
  }
}

export const MODE_OPTIONS = [
  { value: 'halftone', label: 'Halftone' },
  { value: 'inv_halftone', label: 'Inverse Halftone' },
  { value: 'flat', label: 'Static (Flat)' },
  { value: 'stretch_v', label: 'Stretch Vertical' },
  { value: 'stretch_h', label: 'Stretch Horizontal' },
  { value: 'checker', label: 'Checkerboard' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'melt', label: 'Pixel Melt' },
  { value: 'crosshatch', label: 'Crosshatch' },
  { value: 'rotation', label: 'Rotation' },
  { value: 'random_size', label: 'Random Size' },
  { value: 'random_rot', label: 'Random Rotation' },
  { value: 'opacity', label: 'Opacity' },
  { value: 'inv_opacity', label: 'Inv. Opacity' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'flow', label: 'Flow Field' },
  { value: 'edges', label: 'Edge Detect' },
  { value: 'jitter', label: 'Mosaic Jitter' },
  { value: 'posterize', label: 'Posterize' },
  { value: 'interference', label: 'Interference' },
  { value: 'crt_scan', label: 'CRT Scanline' },
  { value: 'bio', label: 'Bio-Organic' },
  { value: 'eraser', label: 'Eraser' },
]

export const SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'rect', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'octagon', label: 'Octagon' },
  { value: 'star', label: 'Star' },
  { value: 'cross', label: 'Cross' },
  { value: 'rect_v', label: 'Rect Vertical' },
  { value: 'rect_h', label: 'Rect Horizontal' },
  { value: 'hex_v', label: 'Hexagon' },
  { value: 'line_diag_r', label: 'Diagonal /' },
  { value: 'line_diag_l', label: 'Diagonal \\' },
  { value: 'chevron', label: 'Chevron' },
  { value: 'trapezoid', label: 'Trapezoid' },
  { value: 'semi_top', label: 'Semi-Circle Top' },
  { value: 'semi_bottom', label: 'Semi-Circle Bottom' },
  { value: 'rect_hollow', label: 'Square Hollow' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'concentric', label: 'Concentric' },
  { value: 'gear', label: 'Gear' },
  { value: 'flower', label: 'Flower' },
  { value: 'ghost', label: 'Pacman Ghost' },
]

export const DEFAULT_PARAMS = {
  mode: 'halftone',
  shape: 'circle',
  cellSize: 10,
  baseScale: 0.9,
  gap: 1,
  bgColor: '#111111',
  useColor: true,
  monoColor: '#ffffff',
  contrast: 0,
  intensity: 1.0,
}
