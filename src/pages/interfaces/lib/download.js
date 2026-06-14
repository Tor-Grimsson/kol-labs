/**
 * Per-widget export. Widgets are single p5 canvases at low intrinsic resolution,
 * so we upscale with nearest-neighbour (imageSmoothing off) to keep the pixel
 * look crisp in the downloaded PNG / webm.
 */
const save = (blob, name) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const scaledCanvas = (src, scale) => {
  const c = document.createElement('canvas')
  c.width = src.width * scale
  c.height = src.height * scale
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

export function downloadPng(canvas, name, scale = 4) {
  if (!canvas) return
  scaledCanvas(canvas, scale).toBlob((b) => b && save(b, `${name}.png`), 'image/png')
}

/**
 * Record `seconds` of the live canvas to webm. Draws the source onto a scaled
 * offscreen canvas each frame (nearest-neighbour) and captures that stream.
 * Returns a stop() so the UI can end early. Resolves the blob via onDone too.
 */
export function recordWebm(canvas, name, { seconds = 4, fps = 30, scale = 4 } = {}) {
  if (!canvas || typeof MediaRecorder === 'undefined') return () => {}
  const off = scaledCanvas(canvas, scale)
  const offCtx = off.getContext('2d')
  offCtx.imageSmoothingEnabled = false
  const stream = off.captureStream(fps)
  const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
  const rec = new MediaRecorder(stream, { mimeType: type })
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.onstop = () => { cancelAnimationFrame(raf); save(new Blob(chunks, { type: 'video/webm' }), `${name}.webm`) }

  let raf
  const draw = () => { offCtx.drawImage(canvas, 0, 0, off.width, off.height); raf = requestAnimationFrame(draw) }
  raf = requestAnimationFrame(draw)
  rec.start()
  const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), seconds * 1000)
  return () => { clearTimeout(timer); rec.state !== 'inactive' && rec.stop() }
}
