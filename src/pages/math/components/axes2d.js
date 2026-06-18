import { hexToRgb } from '../style/mathStyle'

// Reference axes / grid in 2D screen space for the plane pages (field, complex).
// `style` = { axis, gridColor, gridOpacity }; `view` = { cx, cy, range } (world).
export function drawAxes2D(ctx, w, h, style, view) {
  const { axis, gridColor = '#ffffff', gridOpacity = 0.12 } = style || {}
  if (!axis || axis === 'none') return
  const { cx = 0, cy = 0, range = 1 } = view || {}
  const rgb = hexToRgb(gridColor)
  const ppw = w / range
  const sx = (x) => w / 2 + (x - cx) * ppw
  const sy = (y) => h / 2 - (y - cy) * ppw
  ctx.lineWidth = 1

  if (axis === 'grid') {
    const raw = range / 8
    const p = Math.pow(10, Math.floor(Math.log10(raw) || 0))
    const m = raw / p
    const step = p * (m >= 5 ? 5 : m >= 2 ? 2 : 1)
    const halfW = range / 2
    const halfH = (range * h) / w / 2
    ctx.strokeStyle = `rgba(${rgb},${gridOpacity})`
    for (let x = Math.ceil((cx - halfW) / step) * step; x <= cx + halfW; x += step) {
      const X = sx(x)
      ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, h); ctx.stroke()
    }
    for (let y = Math.ceil((cy - halfH) / step) * step; y <= cy + halfH; y += step) {
      const Y = sy(y)
      ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(w, Y); ctx.stroke()
    }
  }

  // The 0-axes, brighter (drawn for both 'axes' and 'grid').
  ctx.strokeStyle = `rgba(${rgb},${Math.min(1, gridOpacity * 3)})`
  ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(w, sy(0)); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), h); ctx.stroke()
}
