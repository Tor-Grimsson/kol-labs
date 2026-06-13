import { mulberry32 } from './prng.js'

/* The composer: (ratio, seed, params, imageCount) → a layout spec. Pure data —
 * frames in logical units on a column grid; the renderer turns the spec into
 * canvas pixels or SVG markup. Same seed, same layout.
 *
 * Frame kinds:
 *   image    — {x,y,w,h, image} (image = index into the upload list, -1 = none)
 *   headline — {x,y,w, size, color} (renderer wraps + draws top-down)
 *   body     — {x,y,w, size, color}
 *   rule     — {x,y,w,h, color}
 */

export const LOGICAL_W = 1000

const INK = '#141414'
const PAPER = '#f6f4ef'
const PAPER_INK = '#f6f4ef'

export function artboardSize(ratio) {
  return { W: LOGICAL_W, H: Math.round(LOGICAL_W * (ratio.h / ratio.w)) }
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const jitter = (rng, base, amt) => base * (1 + (rng() * 2 - 1) * amt)

export const ARCHETYPES = ['stack', 'split', 'bleed', 'editorial']

export function compose({ ratio, seed, params, imageCount }) {
  const { W, H } = artboardSize(ratio)
  const rng = mulberry32(seed)
  const columns = params.columns
  const margin = Math.round(W * params.margin)
  const gutter = Math.round(W * params.gutter)
  const colW = (W - 2 * margin - (columns - 1) * gutter) / columns
  const colX = (i) => margin + i * (colW + gutter)
  const spanW = (n) => colW * n + gutter * (n - 1)
  const innerW = W - 2 * margin
  const innerH = H - 2 * margin

  const imgIdx = () => (imageCount > 0 ? Math.floor(rng() * imageCount) : -1)

  const arch = pick(rng, ARCHETYPES)
  const headSize = jitter(rng, W * 0.085 * params.scale, 0.25)
  const bodySize = W * 0.016
  const frames = []

  if (arch === 'stack') {
    const headTop = rng() < 0.5
    const imgH = innerH * (0.42 + rng() * 0.16)
    const bodySpan = Math.min(2, columns)
    if (headTop) {
      frames.push({ kind: 'headline', x: margin, y: margin, w: innerW, size: headSize, color: INK })
      frames.push({ kind: 'body', x: colX(columns - bodySpan), y: margin + headSize * 2.5, w: spanW(bodySpan), size: bodySize, color: INK })
      frames.push({ kind: 'image', x: margin, y: H - margin - imgH, w: innerW, h: imgH, image: imgIdx() })
    } else {
      frames.push({ kind: 'image', x: margin, y: margin, w: innerW, h: imgH, image: imgIdx() })
      frames.push({ kind: 'headline', x: margin, y: margin + imgH + gutter, w: innerW, size: headSize, color: INK })
      frames.push({ kind: 'body', x: colX(0), y: H - margin - bodySize * 1.5 * 4, w: spanW(bodySpan), size: bodySize, color: INK })
    }
  } else if (arch === 'split') {
    const side = rng() < 0.5 ? 'left' : 'right'
    const imgCols = Math.max(1, Math.round(columns / 2))
    const txtCols = Math.max(1, columns - imgCols)
    const ix = side === 'left' ? colX(0) : colX(columns - imgCols)
    const tx = side === 'left' ? colX(imgCols) : colX(0)
    frames.push({ kind: 'image', x: ix, y: margin, w: spanW(imgCols), h: innerH, image: imgIdx() })
    frames.push({ kind: 'headline', x: tx, y: margin, w: spanW(txtCols), size: headSize * 0.8, color: INK })
    frames.push({ kind: 'body', x: tx, y: margin + innerH * (0.45 + rng() * 0.15), w: spanW(txtCols), size: bodySize, color: INK })
  } else if (arch === 'bleed') {
    frames.push({ kind: 'image', x: 0, y: 0, w: W, h: H, image: imgIdx() })
    frames.push({ kind: 'headline', x: margin, y: H - margin - headSize * 2.4, w: innerW, size: headSize, color: PAPER_INK })
  } else {
    // editorial
    const headScale = 0.9
    frames.push({ kind: 'headline', x: margin, y: margin, w: innerW, size: headSize * headScale, color: INK })
    const ruleY = margin + headSize * headScale * 2.3
    frames.push({ kind: 'rule', x: margin, y: ruleY, w: innerW, h: Math.max(2, W * 0.004), color: INK })
    const cellTop = ruleY + gutter * 1.5
    const cellH = Math.max(W * 0.1, (H - margin - cellTop) * (0.5 + rng() * 0.12))
    const twoUp = columns >= 2 && (imageCount === 0 || imageCount >= 2 || rng() < 0.3)
    if (twoUp) {
      const span = Math.floor(columns / 2)
      frames.push({ kind: 'image', x: colX(0), y: cellTop, w: spanW(span), h: cellH, image: imgIdx() })
      frames.push({ kind: 'image', x: colX(columns - span), y: cellTop, w: spanW(span), h: cellH, image: imgIdx() })
    } else {
      const span = Math.max(1, columns - 1)
      frames.push({ kind: 'image', x: colX(rng() < 0.5 ? 0 : columns - span), y: cellTop, w: spanW(span), h: cellH, image: imgIdx() })
    }
    frames.push({ kind: 'body', x: colX(0), y: cellTop + cellH + gutter, w: spanW(Math.min(2, columns)), size: bodySize, color: INK })
  }

  return { W, H, frames, arch, paper: PAPER }
}
