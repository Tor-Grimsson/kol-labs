/**
 * Retarget a source (image or video) into a fresh w×h canvas at a target export
 * aspect: 'cover' scales to fill and centre-crops; 'fit' scales to contain and
 * centres with a letterbox fill. Returns the canvas — fed to the effect engine
 * as its source so the effect renders across the whole export frame.
 */
export function fitSourceToFrame(source, w, h, mode = 'cover', bg = '#000') {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const sw = source.width || source.videoWidth || 1
  const sh = source.height || source.videoHeight || 1
  const sr = sw / sh
  const dr = w / h
  let dw, dh
  if (mode === 'fit') {
    ctx.fillStyle = bg || '#000'
    ctx.fillRect(0, 0, w, h)
    if (sr > dr) { dw = w; dh = w / sr } else { dh = h; dw = h * sr }
  } else { // cover
    if (sr > dr) { dh = h; dw = h * sr } else { dw = w; dh = w / sr }
  }
  ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh)
  return c
}
