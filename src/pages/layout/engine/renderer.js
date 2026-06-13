/* Renderers for the composer's layout spec: canvas (live preview + PNG export)
 * and an SVG serializer (same wrapping math, real <text> + embedded images).
 * Headline line-height 1.08, body 1.5 — keep the two renderers in sync. */

const HEAD_LH = 1.08
const BODY_LH = 1.5
const PLACEHOLDER = '#dad6cd'

export function wrapText(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w
    if (!line || ctx.measureText(probe).width <= maxW) line = probe
    else { lines.push(line); line = w }
  }
  if (line) lines.push(line)
  return lines
}

const coverCrop = (imgW, imgH, w, h) => {
  const scale = Math.max(w / imgW, h / imgH)
  const sw = w / scale
  const sh = h / scale
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh }
}

export function renderLayout(ctx, layout, { content, images, headFace, bodyFace, pixelScale = 1 }) {
  const { W, H, frames, paper } = layout
  ctx.save()
  ctx.scale(pixelScale, pixelScale)
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'top'
  for (const f of frames) {
    if (f.kind === 'image') {
      const asset = f.image >= 0 ? images[f.image] : null
      if (asset) {
        const c = coverCrop(asset.w, asset.h, f.w, f.h)
        ctx.drawImage(asset.img, c.sx, c.sy, c.sw, c.sh, f.x, f.y, f.w, f.h)
      } else {
        ctx.fillStyle = PLACEHOLDER
        ctx.fillRect(f.x, f.y, f.w, f.h)
      }
    } else if (f.kind === 'rule') {
      ctx.fillStyle = f.color
      ctx.fillRect(f.x, f.y, f.w, f.h)
    } else if (f.kind === 'headline' || f.kind === 'body') {
      const face = f.kind === 'headline' ? headFace : bodyFace
      const lh = f.kind === 'headline' ? HEAD_LH : BODY_LH
      const text = f.kind === 'headline' ? content.headline : content.body
      ctx.fillStyle = f.color
      ctx.font = `${face.drawWeight} ${f.size}px "${face.family}"`
      wrapText(ctx, text, f.w).forEach((ln, i) => ctx.fillText(ln, f.x, f.y + i * f.size * lh))
    }
  }
  ctx.restore()
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function serializeSvg(layout, { content, images, headFace, bodyFace }) {
  const { W, H, frames, paper } = layout
  const ctx = document.createElement('canvas').getContext('2d')
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="${paper}"/>`,
  ]
  for (const f of frames) {
    if (f.kind === 'image') {
      const asset = f.image >= 0 ? images[f.image] : null
      if (asset) {
        parts.push(`<image x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" preserveAspectRatio="xMidYMid slice" href="${asset.dataUrl}"/>`)
      } else {
        parts.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${PLACEHOLDER}"/>`)
      }
    } else if (f.kind === 'rule') {
      parts.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${f.color}"/>`)
    } else if (f.kind === 'headline' || f.kind === 'body') {
      const face = f.kind === 'headline' ? headFace : bodyFace
      const lh = f.kind === 'headline' ? HEAD_LH : BODY_LH
      const text = f.kind === 'headline' ? content.headline : content.body
      ctx.font = `${face.drawWeight} ${f.size}px "${face.family}"`
      wrapText(ctx, text, f.w).forEach((ln, i) => {
        parts.push(`<text x="${f.x}" y="${f.y + i * f.size * lh}" dominant-baseline="hanging" font-family="${esc(face.family)}" font-weight="${face.drawWeight}" font-size="${f.size}" fill="${f.color}">${esc(ln)}</text>`)
      })
    }
  }
  parts.push('</svg>')
  return parts.join('\n')
}
