/**
 * Whole-composition video capture via Region Capture.
 *
 * A composition is many separate p5 canvases + DOM chrome in a grid — there's
 * no single canvas to record. Instead we capture the current browser tab
 * (`getDisplayMedia`) and crop the video track to the composition element
 * (`CropTarget` + `track.cropTo`), so the recording is a pixel-perfect grab of
 * canvases + DOM + fonts + theme with zero per-element compositing. Audio is
 * muxed in the same way the per-widget export does it. Chromium-only — the crop
 * API is absent elsewhere, so callers gate on `regionCaptureSupported()`.
 */
import { save, pickType } from './download.js'

/** Region Capture (CropTarget + cropTo) is Chrome/Edge only. */
export function regionCaptureSupported() {
  return typeof window !== 'undefined'
    && typeof window.CropTarget?.fromElement === 'function'
    && !!navigator.mediaDevices?.getDisplayMedia
}

/**
 * Record `seconds` of `targetEl` to a downloaded webm. Returns a stop() to end
 * early. `onStart` fires once recording actually begins (after the user grants
 * the tab share + the crop applies) — start audio playback there so a cancelled
 * prompt never leaves sound playing. `onStop(err?)` fires on save, cancel, or
 * failure (err set on the latter two).
 */
export async function recordRegion(targetEl, { seconds = 5, fps = 30, name = 'composition', audioStream = null, videoBitrate = 12_000_000, warmupMs = 500, onStart, onStop } = {}) {
  if (!targetEl || typeof MediaRecorder === 'undefined' || !regionCaptureSupported()) {
    onStop?.(new Error('unsupported'))
    return () => {}
  }

  let display
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: fps },
      audio: false,
      preferCurrentTab: true, // Chromium: one-click "share this tab"
    })
  } catch (err) {
    onStop?.(err) // user dismissed / denied the picker
    return () => {}
  }

  const [track] = display.getVideoTracks()
  try {
    const target = await window.CropTarget.fromElement(targetEl)
    await track.cropTo(target)
  } catch (err) {
    track.stop()
    onStop?.(err) // crop unsupported/failed — bail rather than record the whole tab
    return () => {}
  }

  const stream = new MediaStream([track])
  if (audioStream) for (const t of audioStream.getAudioTracks()) stream.addTrack(t)

  const rec = new MediaRecorder(stream, { mimeType: pickType(audioStream), videoBitsPerSecond: videoBitrate })
  const chunks = []
  let stopped = false
  let timer = null
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.onstop = () => {
    for (const t of stream.getTracks()) t.stop()
    save(new Blob(chunks, { type: 'video/webm' }), `${name}.webm`)
    onStop?.()
  }

  const end = () => {
    if (stopped || rec.state === 'inactive') return
    stopped = true
    if (timer) clearTimeout(timer)
    rec.stop()
  }
  // user hits the browser's own "Stop sharing" chip
  track.addEventListener('ended', end)

  // warm-up: the first frames after cropTo are often uncropped/black while the
  // capture pipeline settles — wait them out so the recording starts clean.
  if (warmupMs) await new Promise((r) => setTimeout(r, warmupMs))
  if (track.readyState !== 'live') { onStop?.(new Error('ended')); return () => {} }

  rec.start()
  onStart?.()
  timer = setTimeout(end, seconds * 1000)
  return end
}
