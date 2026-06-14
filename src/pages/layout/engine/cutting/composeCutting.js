import { mulberry32 } from '../prng.js'
import { artboardSize } from '../composer.js'
import { pickPalette } from './palettes.js'

/* The Cutting composer: (ratio, seed, params, imageCount) → a bold-poster spec
 * for renderCutting. Same seed → same poster. Style is Swiss-shout / brutalist:
 * type fit edge-to-edge, stacked words, outline+fill, hard colour blocks,
 * grayscale image cells, a generated index number. Deliberately allowed to
 * bleed off the artboard — that's the look, not a bug.
 *
 * Generated text is limited to a derived index number; the headline/body come
 * from the user (resolved by the renderer), never overwritten. */

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const rand = (rng, a, b) => a + rng() * (b - a)

export const CUTTING_ARCHES = ['shout', 'bleed', 'numeral', 'overlap', 'brutgrid']

export function composeCutting({ ratio, seed, params, imageCount }) {
  const { W, H } = artboardSize(ratio)
  const rng = mulberry32(seed)
  const margin = Math.round(W * (params.margin ?? 0.06))
  const innerW = W - 2 * margin
  const innerH = H - 2 * margin
  const pal = params.palette || pickPalette(rng)
  const sc = params.scale ?? 1
  const index = String(1 + Math.floor(rng() * 98)).padStart(2, '0')
  const arch = pick(rng, CUTTING_ARCHES)
  const hasImg = imageCount > 0
  const imgIdx = () => (hasImg ? Math.floor(rng() * imageCount) : -1)
  const frames = []

  const labelSize = Math.round(W * 0.016)
  const ruleH = Math.max(2, Math.round(W * 0.005))
  const gap = Math.round(W * 0.02)
  const label = (text, x, y, color, align) =>
    frames.push({ kind: 'text', content: text, x, y, size: labelSize, color, face: 'body', tracking: 0.1, align })

  if (arch === 'shout') {
    // Stacked words, each fit to the full inner width — the headline IS the poster.
    label(`№ ${index}`, margin, margin, pal.accent, 'left')
    label(ratio.id, W - margin, margin, pal.ink, 'right')
    const strokeIndex = rng() < 0.55 ? Math.floor(rng() * 3) : -1
    frames.push({
      kind: 'stacktype', content: 'headline', face: 'head',
      x: margin, y: margin + Math.round(W * 0.06 * sc), w: innerW,
      colors: rng() < 0.5 ? [pal.ink, pal.accent] : [pal.ink], lineHeight: rand(rng, 0.84, 0.93),
      strokeIndex, maxSize: W * 0.42 * sc,
    })
    const ruleY = H - margin - Math.round(W * 0.13)
    frames.push({ kind: 'rule', x: margin, y: ruleY, w: innerW, h: ruleH, color: pal.ink })
    frames.push({ kind: 'para', content: 'body', x: margin, y: ruleY + Math.round(W * 0.02), w: Math.round(innerW * 0.55), size: Math.round(W * 0.018), color: pal.ink, face: 'body', lineHeight: 1.45, maxLines: 4 })
  } else if (arch === 'bleed') {
    // Image (or accent block) full-bleed behind centred shout type.
    if (hasImg) frames.push({ kind: 'image', x: 0, y: 0, w: W, h: H, image: imgIdx(), gray: true })
    else frames.push({ kind: 'block', x: 0, y: 0, w: W, h: H, color: pal.accent })
    frames.push({ kind: 'block', x: 0, y: Math.round(H * rand(rng, 0.34, 0.5)), w: W, h: Math.round(H * 0.02), color: hasImg ? pal.accent : pal.ink })
    const overInk = hasImg ? pal.bg : pal.ink
    frames.push({
      kind: 'stacktype', content: 'headline', face: 'head', align: 'center',
      x: margin, y: margin + Math.round(H * 0.06), w: innerW,
      colors: [overInk], lineHeight: rand(rng, 0.86, 0.94), strokeIndex: rng() < 0.5 ? 1 : -1, maxSize: W * 0.4 * sc,
    })
    label(`№ ${index}`, W / 2, H - margin - labelSize, overInk, 'center')
  } else if (arch === 'numeral') {
    // Giant index number hero, bleeding; small headline + body in the corner.
    const numW = innerW * rand(rng, 1.0, 1.25)
    const bottom = rng() < 0.5
    frames.push({ kind: 'text', content: index, fitW: true, w: numW, x: rng() < 0.5 ? W - margin : margin + numW, align: rng() < 0.5 ? 'right' : 'left', y: bottom ? H * 0.42 : -H * 0.04, color: pal.accent, face: 'head' })
    if (hasImg) frames.push({ kind: 'image', x: margin, y: bottom ? margin : H * 0.5, w: Math.round(innerW * 0.42), h: Math.round(innerH * 0.42), image: imgIdx(), gray: true })
    frames.push({
      kind: 'stacktype', content: 'headline', face: 'head',
      x: margin, y: bottom ? margin : margin + Math.round(W * 0.02), w: Math.round(innerW * 0.62),
      colors: [pal.ink], lineHeight: 0.92, maxSize: W * 0.09 * sc,
    })
    frames.push({ kind: 'para', content: 'body', x: margin, y: H - margin - Math.round(W * 0.1), w: Math.round(innerW * 0.5), size: Math.round(W * 0.017), color: pal.ink, face: 'body', lineHeight: 1.45, maxLines: 4 })
  } else if (arch === 'overlap') {
    // Headline drawn twice: filled, then an outline copy offset + tilted.
    if (hasImg) frames.push({ kind: 'image', x: 0, y: 0, w: W, h: H, image: imgIdx(), gray: true })
    const bandY = Math.round(H * rand(rng, 0.32, 0.52))
    frames.push({ kind: 'block', x: 0, y: bandY, w: W, h: Math.round(H * 0.2), color: pal.accent, alpha: 0.92, blend: hasImg ? 'multiply' : null })
    const hx = margin
    const hy = margin + Math.round(H * 0.08)
    const lh = rand(rng, 0.86, 0.92)
    const fillCol = hasImg ? pal.bg : pal.ink
    frames.push({ kind: 'stacktype', content: 'headline', face: 'head', x: hx, y: hy, w: innerW, colors: [fillCol], lineHeight: lh, maxSize: W * 0.34 * sc })
    frames.push({ kind: 'stacktype', content: 'headline', face: 'head', x: hx + Math.round(W * 0.016), y: hy + Math.round(W * 0.014), w: innerW, colors: [pal.accent], lineHeight: lh, stroke: true, rotate: rand(rng, -2.5, 2.5), maxSize: W * 0.34 * sc })
    frames.push({ kind: 'para', content: 'body', x: margin, y: H - margin - Math.round(W * 0.08), w: Math.round(innerW * 0.5), size: Math.round(W * 0.016), color: fillCol, face: 'body', lineHeight: 1.4, maxLines: 3 })
  } else {
    // brutgrid — asymmetric module grid: big editorial block + stacked cells.
    const leftW = Math.round(innerW * rand(rng, 0.5, 0.6))
    const rightX = margin + leftW + gap
    const rightW = innerW - leftW - gap
    frames.push({ kind: 'block', x: margin, y: margin, w: leftW, h: innerH, color: pal.ink })
    frames.push({ kind: 'text', content: index, x: margin + Math.round(W * 0.025), y: margin + Math.round(W * 0.025), size: Math.round(W * 0.07), color: pal.bg, face: 'head' })
    frames.push({ kind: 'para', content: 'body', x: margin + Math.round(W * 0.12), y: margin + Math.round(W * 0.035), w: leftW - Math.round(W * 0.15), size: Math.round(W * 0.016), color: pal.bg, face: 'body', lineHeight: 1.45, maxLines: 9 })
    frames.push({ kind: 'stacktype', content: 'headline', face: 'head', x: margin + Math.round(W * 0.025), y: margin + Math.round(innerH * 0.46), w: leftW - Math.round(W * 0.05), colors: [pal.bg, pal.accent], lineHeight: 0.9, maxSize: W * 0.18 * sc })
    const cellH = Math.round((innerH - 2 * gap) / 3)
    frames.push({ kind: 'block', x: rightX, y: margin, w: rightW, h: cellH, color: pal.accent })
    label(`№ ${index}`, rightX + Math.round(W * 0.015), margin + Math.round(W * 0.015), pal.bg, 'left')
    frames.push(hasImg
      ? { kind: 'image', x: rightX, y: margin + cellH + gap, w: rightW, h: cellH, image: imgIdx(), gray: true }
      : { kind: 'block', x: rightX, y: margin + cellH + gap, w: rightW, h: cellH, color: pal.accent, alpha: 0.5 })
    frames.push({ kind: 'block', x: rightX, y: margin + 2 * (cellH + gap), w: rightW, h: cellH, color: pal.ink })
    frames.push({ kind: 'stacktype', content: 'headline', face: 'head', x: rightX + Math.round(W * 0.015), y: margin + 2 * (cellH + gap) + Math.round(W * 0.015), w: rightW - Math.round(W * 0.03), colors: [pal.bg], lineHeight: 0.92, maxSize: W * 0.1 * sc })
  }

  return { W, H, frames, arch, bg: pal.bg, palette: pal }
}
