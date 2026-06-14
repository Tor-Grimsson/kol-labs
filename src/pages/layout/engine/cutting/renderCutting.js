/* Cutting renderer — canvas (live + PNG) and SVG, for the bold-poster spec.
 *
 * Richer frame vocabulary than the conformed renderer:
 *   block     — {x,y,w,h, color, alpha?, blend?, rotate?}
 *   image     — {x,y,w,h, image, gray?, rotate?}
 *   rule      — {x,y,w,h, color}
 *   text      — one line: {content,x,y,size|fitW,w,color,face,weight,align,
 *                          tracking,rotate,stroke,strokeColor}
 *   stacktype — word-per-line, each line fit to width w (the shout move):
 *               {content,x,y,w,colors[],face,weight,lineHeight,align,tracking,
 *                strokeIndex,maxSize}
 *
 * `content` resolves 'headline'/'body' against the live content, else literal.
 * Canvas + SVG share the wrap/fit math so PNG and SVG match. */

import { wrapText } from '../renderer.js'

const FIT_REF = 200

const resolveContent = (content, c) =>
  content === 'headline' ? (c.headline || '') : content === 'body' ? (c.body || '') : String(content ?? '')

const resolveFace = (which, headFace, bodyFace) => (which === 'body' ? bodyFace : headFace)
const fontStr = (face, weight, size) => `${weight || face.drawWeight} ${size}px "${face.family}"`

/* Scale a single line so it fills width w in the given face. */
function fitSize(ctx, text, face, weight, w, trackingEm = 0) {
  if (!text) return FIT_REF
  ctx.font = fontStr(face, weight, FIT_REF)
  ctx.letterSpacing = `${trackingEm * FIT_REF}px`
  const width = ctx.measureText(text).width || 1
  ctx.letterSpacing = '0px'
  return FIT_REF * (w / width)
}

const coverCrop = (imgW, imgH, w, h) => {
  const scale = Math.max(w / imgW, h / imgH)
  const sw = w / scale
  const sh = h / scale
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh }
}

function withRotate(ctx, frame, fn) {
  if (!frame.rotate) return fn()
  ctx.save()
  ctx.translate(frame.x, frame.y)
  ctx.rotate((frame.rotate * Math.PI) / 180)
  ctx.translate(-frame.x, -frame.y)
  fn()
  ctx.restore()
}

function drawLine(ctx, { text, x, y, size, color, align, tracking, stroke, strokeColor, strokeW }) {
  ctx.textBaseline = 'top'
  ctx.textAlign = align || 'left'
  ctx.letterSpacing = tracking ? `${tracking * size}px` : '0px'
  if (stroke) {
    ctx.lineJoin = 'round'
    ctx.lineWidth = strokeW || Math.max(1.5, size * 0.014)
    ctx.strokeStyle = strokeColor || color
    ctx.strokeText(text, x, y)
  } else {
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
  }
  ctx.letterSpacing = '0px'
}

export function renderCutting(ctx, layout, { content, images, headFace, bodyFace, pixelScale = 1 }) {
  const { W, H, frames, bg } = layout
  ctx.save()
  ctx.scale(pixelScale, pixelScale)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  for (const f of frames) {
    if (f.kind === 'block') {
      ctx.save()
      ctx.globalAlpha = f.alpha ?? 1
      if (f.blend) ctx.globalCompositeOperation = f.blend
      withRotate(ctx, f, () => { ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, f.w, f.h) })
      ctx.restore()
    } else if (f.kind === 'image') {
      const asset = f.image >= 0 ? images[f.image] : null
      ctx.save()
      withRotate(ctx, f, () => {
        if (asset) {
          if (f.gray) ctx.filter = 'grayscale(1) contrast(1.18)'
          const c = coverCrop(asset.w, asset.h, f.w, f.h)
          ctx.drawImage(asset.img, c.sx, c.sy, c.sw, c.sh, f.x, f.y, f.w, f.h)
          ctx.filter = 'none'
        } else {
          ctx.fillStyle = f.placeholder || '#9a9a9a'
          ctx.fillRect(f.x, f.y, f.w, f.h)
        }
      })
      ctx.restore()
    } else if (f.kind === 'rule') {
      ctx.fillStyle = f.color
      ctx.fillRect(f.x, f.y, f.w, f.h)
    } else if (f.kind === 'text') {
      const face = resolveFace(f.face, headFace, bodyFace)
      const text = resolveContent(f.content, content)
      const size = f.fitW ? fitSize(ctx, text, face, f.weight, f.w, f.tracking || 0) : f.size
      ctx.save()
      ctx.font = fontStr(face, f.weight, size)
      withRotate(ctx, f, () =>
        drawLine(ctx, { text, x: f.x, y: f.y, size, color: f.color, align: f.align, tracking: f.tracking, stroke: f.stroke, strokeColor: f.strokeColor, strokeW: f.strokeWidth }),
      )
      ctx.restore()
    } else if (f.kind === 'stacktype') {
      const face = resolveFace(f.face, headFace, bodyFace)
      const text = resolveContent(f.content, content)
      const words = text.split(/\s+/).filter(Boolean)
      const colors = f.colors || [f.color || '#000']
      const lh = f.lineHeight ?? 0.9
      ctx.save()
      withRotate(ctx, f, () => {
        let y = f.y
        words.forEach((word, i) => {
          let size = fitSize(ctx, word, face, f.weight, f.w, f.tracking || 0)
          if (f.maxSize) size = Math.min(size, f.maxSize)
          ctx.font = fontStr(face, f.weight, size)
          const ax = f.align === 'right' ? f.x + f.w : f.x
          drawLine(ctx, { text: word, x: ax, y, size, color: colors[i % colors.length], align: f.align, tracking: f.tracking, stroke: f.stroke || f.strokeIndex === i })
          y += size * lh
        })
      })
      ctx.restore()
    } else if (f.kind === 'para') {
      const face = resolveFace(f.face, headFace, bodyFace)
      const text = resolveContent(f.content, content)
      const size = f.size
      ctx.save()
      ctx.font = fontStr(face, f.weight, size)
      ctx.textBaseline = 'top'
      ctx.textAlign = f.align === 'right' ? 'right' : 'left'
      ctx.letterSpacing = f.tracking ? `${f.tracking * size}px` : '0px'
      ctx.fillStyle = f.color
      const ax = f.align === 'right' ? f.x + f.w : f.x
      const lh = f.lineHeight ?? 1.4
      let lines = wrapText(ctx, text, f.w)
      if (f.maxLines) lines = lines.slice(0, f.maxLines)
      lines.forEach((ln, i) => ctx.fillText(ln, ax, f.y + i * size * lh))
      ctx.letterSpacing = '0px'
      ctx.restore()
    }
  }
  ctx.restore()
}

/* ------------------------------------------------------------------ SVG --- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function textAttrs(face, weight, size, color, align, tracking, stroke, strokeColor, strokeW) {
  const anchor = align === 'right' ? 'end' : align === 'center' ? 'middle' : 'start'
  const fill = stroke ? 'none' : color
  const strokeAttr = stroke ? ` stroke="${strokeColor || color}" stroke-width="${strokeW || Math.max(1.5, size * 0.014)}" stroke-linejoin="round"` : ''
  const ls = tracking ? ` letter-spacing="${tracking * size}"` : ''
  return `dominant-baseline="hanging" text-anchor="${anchor}" font-family="${esc(face.family)}" font-weight="${weight || face.drawWeight}" font-size="${size}" fill="${fill}"${strokeAttr}${ls}`
}

const rotAttr = (f) => (f.rotate ? ` transform="rotate(${f.rotate} ${f.x} ${f.y})"` : '')

export function serializeCuttingSvg(layout, { content, images, headFace, bodyFace }) {
  const { W, H, frames, bg } = layout
  const ctx = document.createElement('canvas').getContext('2d')
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="${bg}"/>`,
  ]
  for (const f of frames) {
    if (f.kind === 'block') {
      const style = `${f.alpha != null ? `opacity:${f.alpha};` : ''}${f.blend ? `mix-blend-mode:${f.blend};` : ''}`
      parts.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${f.color}"${style ? ` style="${style}"` : ''}${rotAttr(f)}/>`)
    } else if (f.kind === 'image') {
      const asset = f.image >= 0 ? images[f.image] : null
      if (asset) {
        const filt = f.gray ? ' style="filter:grayscale(1) contrast(1.18)"' : ''
        parts.push(`<image x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" preserveAspectRatio="xMidYMid slice" href="${asset.dataUrl}"${filt}${rotAttr(f)}/>`)
      } else {
        parts.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${f.placeholder || '#9a9a9a'}"${rotAttr(f)}/>`)
      }
    } else if (f.kind === 'rule') {
      parts.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${f.color}"/>`)
    } else if (f.kind === 'text') {
      const face = resolveFace(f.face, headFace, bodyFace)
      const text = resolveContent(f.content, content)
      const size = f.fitW ? fitSize(ctx, text, face, f.weight, f.w, f.tracking || 0) : f.size
      parts.push(`<text x="${f.x}" y="${f.y}" ${textAttrs(face, f.weight, size, f.color, f.align, f.tracking, f.stroke, f.strokeColor, f.strokeWidth)}${rotAttr(f)}>${esc(text)}</text>`)
    } else if (f.kind === 'stacktype') {
      const face = resolveFace(f.face, headFace, bodyFace)
      const text = resolveContent(f.content, content)
      const words = text.split(/\s+/).filter(Boolean)
      const colors = f.colors || [f.color || '#000']
      const lh = f.lineHeight ?? 0.9
      let y = f.y
      words.forEach((word, i) => {
        let size = fitSize(ctx, word, face, f.weight, f.w, f.tracking || 0)
        if (f.maxSize) size = Math.min(size, f.maxSize)
        const ax = f.align === 'right' ? f.x + f.w : f.x
        parts.push(`<text x="${ax}" y="${y}" ${textAttrs(face, f.weight, size, colors[i % colors.length], f.align, f.tracking, f.stroke || f.strokeIndex === i, null, null)}>${esc(word)}</text>`)
        y += size * lh
      })
    } else if (f.kind === 'para') {
      const face = resolveFace(f.face, headFace, bodyFace)
      const text = resolveContent(f.content, content)
      const size = f.size
      ctx.font = fontStr(face, f.weight, size)
      const lh = f.lineHeight ?? 1.4
      const ax = f.align === 'right' ? f.x + f.w : f.x
      let lines = wrapText(ctx, text, f.w)
      if (f.maxLines) lines = lines.slice(0, f.maxLines)
      lines.forEach((ln, i) =>
        parts.push(`<text x="${ax}" y="${f.y + i * size * lh}" ${textAttrs(face, f.weight, size, f.color, f.align, f.tracking, false, null, null)}>${esc(ln)}</text>`),
      )
    }
  }
  parts.push('</svg>')
  return parts.join('\n')
}
