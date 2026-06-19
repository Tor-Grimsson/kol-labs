// Luma source for the Monster mode — feeds the scanline field from a live
// webcam or an uploaded still. Keep the sample buffer small (the engine only
// needs a coarse density field); the editor reads ImageData each frame for the
// webcam, once for an image.

// Cover-fit a video/image into the buffer (centre-crop), optionally mirrored.
export function coverDraw(ctx, src, w, h, mirror) {
  const sw = src.videoWidth || src.naturalWidth || src.width
  const sh = src.videoHeight || src.naturalHeight || src.height
  if (!sw || !sh) return false
  const scale = Math.max(w / sw, h / sh)
  const dw = sw * scale, dh = sh * scale
  const dx = (w - dw) / 2, dy = (h - dh) / 2
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1) }
  ctx.drawImage(src, dx, dy, dw, dh)
  ctx.restore()
  return true
}

// Build a (nx,ny)->luma[0..1] sampler over a snapshot of ImageData.
export function makeLuma(imageData) {
  const { data, width, height } = imageData
  return (nx, ny) => {
    const x = Math.min(width - 1, Math.max(0, (nx * width) | 0))
    const y = Math.min(height - 1, Math.max(0, (ny * height) | 0))
    const i = (y * width + x) * 4
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
  }
}

export async function startWebcam(video) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
  video.srcObject = stream
  video.loop = false
  await video.play()
  return stream
}

// Play an uploaded video file (looped, muted) into the same <video> node — the
// per-frame luma pull is identical to the webcam path.
export async function startVideoFile(video, url) {
  video.srcObject = null
  video.src = url
  video.loop = true
  video.muted = true
  video.playsInline = true
  await video.play()
}

export function stopStream(stream) {
  if (stream) for (const t of stream.getTracks()) t.stop()
}
