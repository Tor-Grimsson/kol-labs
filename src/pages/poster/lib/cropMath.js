/**
 * Crop math: given a source (sw×sh), a target aspect (tw/th) and a focal
 * point (fx, fy in 0..1 source coords), return the largest source-pixel crop
 * window with that aspect, positioned so the focal point stays as central
 * as possible (clamped to the source bounds).
 */
export function cropFor(sw, sh, tw, th, fx = 0.5, fy = 0.5) {
  const targetAspect = tw / th
  const sourceAspect = sw / sh
  let cw, ch
  if (sourceAspect > targetAspect) {
    ch = sh
    cw = Math.round(sh * targetAspect)
  } else {
    cw = sw
    ch = Math.round(sw / targetAspect)
  }
  let x = Math.round(fx * sw - cw / 2)
  let y = Math.round(fy * sh - ch / 2)
  x = Math.max(0, Math.min(sw - cw, x))
  y = Math.max(0, Math.min(sh - ch, y))
  // even numbers keep yuv420 happy
  return { w: cw - (cw % 2), h: ch - (ch % 2), x: x - (x % 2), y: y - (y % 2) }
}

/** Can the source deliver this output without upscaling? */
export function fits(sw, sh, outW, outH) {
  const c = cropFor(sw, sh, outW, outH)
  return c.w >= outW && c.h >= outH
}
