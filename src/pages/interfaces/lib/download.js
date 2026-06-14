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

const pickType = (audio) => {
  const order = audio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm']
  return order.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm'
}

/**
 * Record `seconds` of the live canvas to webm. Draws the source onto a scaled
 * offscreen canvas each frame (nearest-neighbour) and captures that stream.
 * Pass `audioStream` (a MediaStream) to mux its audio track in — the export is
 * then the widget animation synced to that sound. Returns a stop() so the UI
 * can end early; calls onStop when the file is saved.
 */
export function recordWebm(canvas, name, { seconds = 4, fps = 30, scale = 4, audioStream = null, onStop } = {}) {
  if (!canvas || typeof MediaRecorder === 'undefined') return () => {}
  const off = scaledCanvas(canvas, scale)
  const offCtx = off.getContext('2d')
  offCtx.imageSmoothingEnabled = false
  const stream = off.captureStream(fps)
  if (audioStream) for (const t of audioStream.getAudioTracks()) stream.addTrack(t)
  const rec = new MediaRecorder(stream, { mimeType: pickType(audioStream) })
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.onstop = () => { cancelAnimationFrame(raf); save(new Blob(chunks, { type: 'video/webm' }), `${name}.webm`); onStop?.() }

  let raf
  const draw = () => { offCtx.drawImage(canvas, 0, 0, off.width, off.height); raf = requestAnimationFrame(draw) }
  raf = requestAnimationFrame(draw)
  rec.start()
  const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), seconds * 1000)
  return () => { clearTimeout(timer); rec.state !== 'inactive' && rec.stop() }
}
