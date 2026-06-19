// Reusable chromatic-aberration pass — per-channel RGB offset on a 2D canvas.
// Red samples shifted +offset, blue −offset along `angle`, green stays put →
// rainbow fringing at edges. The cheapest way to make any line/curve render
// read like the moodboard (adamfuhrer / Drekker). In place, edge-clamped.
//
//   chromaticAberration(canvas, { amount: 6, angle: 0 })
//
// amount = px of split (0 = off), angle = split direction in degrees.

export function chromaticAberration(canvas, { amount = 4, angle = 0 } = {}) {
  if (amount <= 0) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  if (w <= 0 || h <= 0) return

  const src = ctx.getImageData(0, 0, w, h)
  const out = ctx.createImageData(w, h)
  const sd = src.data
  const od = out.data

  const rad = (angle * Math.PI) / 180
  const ox = Math.round(Math.cos(rad) * amount)
  const oy = Math.round(Math.sin(rad) * amount)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2
      let rx = x + ox; if (rx < 0) rx = 0; else if (rx >= w) rx = w - 1
      let ry = y + oy; if (ry < 0) ry = 0; else if (ry >= h) ry = h - 1
      let bx = x - ox; if (bx < 0) bx = 0; else if (bx >= w) bx = w - 1
      let by = y - oy; if (by < 0) by = 0; else if (by >= h) by = h - 1
      od[i] = sd[(ry * w + rx) << 2] // R shifted +offset
      od[i + 1] = sd[i + 1] // G unchanged
      od[i + 2] = sd[((by * w + bx) << 2) + 2] // B shifted −offset
      od[i + 3] = sd[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
}
