// Minimal audio analyser — mic or file → an average level (0..1), read on demand
// in the render loop (no own rAF, no CSS-var side-effects). Self-contained so the
// 3D scene doesn't couple to the interfaces audio singleton. One AudioContext.

let ctx = null
let analyser = null
let data = null
let node = null
let mediaEl = null
let stream = null
let active = false

function ensure() {
  if (ctx) return
  const AC = window.AudioContext || window.webkitAudioContext
  ctx = new AC()
  analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.8
  data = new Uint8Array(analyser.frequencyBinCount)
}

function disconnect() {
  if (mediaEl) { try { mediaEl.pause() } catch { /* ignore */ } mediaEl = null }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null }
  if (node) { try { node.disconnect() } catch { /* ignore */ } node = null }
  try { analyser?.disconnect() } catch { /* ignore */ }
}

export async function startMic() {
  ensure()
  await ctx.resume?.()
  disconnect()
  stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  node = ctx.createMediaStreamSource(stream)
  node.connect(analyser) // analysed only — not routed to output (no feedback)
  active = true
}

export function loadFile(file) {
  ensure()
  ctx.resume?.()
  disconnect()
  mediaEl = new Audio()
  mediaEl.src = URL.createObjectURL(file)
  mediaEl.loop = true
  node = ctx.createMediaElementSource(mediaEl)
  node.connect(analyser)
  analyser.connect(ctx.destination) // routed so the file is audible
  mediaEl.play()
  active = true
}

export function stop() {
  disconnect()
  active = false
}

export function isActive() {
  return active
}

// Average normalized level 0..1, sampled on demand.
export function level() {
  if (!analyser || !active) return 0
  analyser.getByteFrequencyData(data)
  let s = 0
  for (let i = 0; i < data.length; i++) s += data[i]
  return s / data.length / 255
}
