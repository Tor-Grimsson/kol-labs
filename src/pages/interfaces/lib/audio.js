/**
 * Shared audio → analyser singleton for audio-reactive widgets. The source is
 * either the live mic or an uploaded file; one AudioContext for the whole page.
 * Widgets sample it at draw time via sample(i, n) (per-band) or level() (overall
 * amplitude); both return null/0 when nothing plays so widgets fall back to
 * procedural animation. Mirrors lib/clock.js — the FFT is read once per rAF into
 * a reused buffer, and the overall level is published to CSS as `--audio` so
 * non-canvas chrome can react too. A media-stream tap (recStream) carries the
 * audio into the synced webm export.
 */
let ctx = null
let analyser = null
let freq = null // reused Uint8Array of frequency magnitudes
let timeBuf = null // reused Uint8Array of time-domain samples (the waveform)
let recDest = null // MediaStreamAudioDestinationNode — audio tap for recording
let srcNode = null // current source node (mic or media-element)
let audioEl = null // <audio> element when source === 'file'
let audioUrl = null
let micStream = null
let source = null // 'mic' | 'file' | null
let toSpeakers = false // analyser → destination wired (file only; mic would feed back)
let lvl = 0 // smoothed overall amplitude 0..1
let beatEnv = 0 // beat envelope: spikes to 1 on a detected onset, decays
let bassAvg = 0 // slow moving average of bass energy (the onset threshold)
let beatStep = 0 // integer beat counter — increments once per detected beat
let raf = null
let endedCb = null

function ensureCtx() {
  if (ctx) return
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  analyser = ctx.createAnalyser()
  analyser.fftSize = 256 // → 128 frequency bins + 256 time-domain samples
  analyser.smoothingTimeConstant = 0.8
  freq = new Uint8Array(analyser.frequencyBinCount)
  timeBuf = new Uint8Array(analyser.fftSize)
  recDest = ctx.createMediaStreamDestination()
  analyser.connect(recDest) // silent tap, always available for recording
}

function tick() {
  if (analyser) {
    analyser.getByteFrequencyData(freq)
    analyser.getByteTimeDomainData(timeBuf)
    let sum = 0
    for (let i = 0; i < freq.length; i++) sum += freq[i]
    const avg = sum / freq.length / 255
    lvl += (avg - lvl) * 0.3 // ease the global level so the CSS pulse isn't jittery

    // beat detection: bass energy crossing above its slow average = an onset
    let bass = 0
    for (let i = 1; i < 8; i++) bass += freq[i]
    bass = bass / (7 * 255)
    bassAvg += (bass - bassAvg) * 0.08
    if (bass > bassAvg * 1.35 + 0.05 && beatEnv < 0.35) { beatEnv = 1; beatStep++ }
    beatEnv *= 0.86 // decay each frame

    document.documentElement.style.setProperty('--audio', lvl.toFixed(3))
    document.documentElement.style.setProperty('--beat', beatEnv.toFixed(3))
  }
  raf = requestAnimationFrame(tick)
}

function startTick() { if (raf == null) raf = requestAnimationFrame(tick) }

function detachSource() {
  if (srcNode) { try { srcNode.disconnect() } catch { /* noop */ } srcNode = null }
  if (toSpeakers) { try { analyser.disconnect(ctx.destination) } catch { /* noop */ } toSpeakers = false }
  if (audioEl) { audioEl.pause(); audioEl.onended = null; audioEl = null }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null }
  if (micStream) { for (const t of micStream.getTracks()) t.stop(); micStream = null }
}

/** Open the mic as the source. Idempotent-ish; resolves false if denied. */
export async function startMic() {
  ensureCtx()
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (err) {
    console.warn('[audio] mic denied / unavailable:', err)
    return false
  }
  detachSource()
  micStream = stream
  srcNode = ctx.createMediaStreamSource(stream)
  srcNode.connect(analyser) // NOT to destination — avoid feedback
  source = 'mic'
  await ctx.resume()
  startTick()
  return true
}

/** Load an audio file as the source (audible + recordable). Paused until play(). */
export async function loadFile(file) {
  ensureCtx()
  detachSource()
  audioUrl = URL.createObjectURL(file)
  audioEl = new Audio(audioUrl)
  audioEl.onended = () => endedCb?.()
  srcNode = ctx.createMediaElementSource(audioEl)
  srcNode.connect(analyser)
  analyser.connect(ctx.destination) // hear the file
  toSpeakers = true
  source = 'file'
  await ctx.resume()
  startTick()
  return true
}

/** Tear down the current source (keeps the context for reuse). */
export function stop() {
  if (raf != null) { cancelAnimationFrame(raf); raf = null }
  detachSource()
  source = null
  lvl = 0
  beatEnv = 0
  bassAvg = 0
  document.documentElement.style.setProperty('--audio', '0')
  document.documentElement.style.setProperty('--beat', '0')
}

// ── file transport (no-ops for mic) ──
export function play() { return audioEl?.play() }
export function pause() { audioEl?.pause() }
export function seek(t) { if (audioEl) audioEl.currentTime = t }
export function duration() { return audioEl?.duration || 0 }
export function onEnded(cb) { endedCb = cb }

// ── state ──
export function isActive() { return source != null }
export function isFile() { return source === 'file' }
export function isPlaying() { return !!audioEl && !audioEl.paused }

/** MediaStream carrying the source audio — fed to MediaRecorder for synced export. */
export function recStream() { return recDest?.stream || null }

/** Overall amplitude 0..1 (eased). 0 when nothing plays. */
export function level() { return source ? lvl : 0 }

/** Beat envelope 0..1 — spikes on each detected onset, decays. 0 when idle. */
export function beat() { return source ? beatEnv : 0 }

/** Integer beat counter — increments once per detected onset. Drives step locks. */
export function beatCount() { return beatStep }

/**
 * Time-domain waveform sample at position i of n, in [-1, 1]. The actual signal
 * shape (an oscilloscope), not the spectrum. Returns null when nothing plays.
 */
export function wave(i, n) {
  if (!source || !timeBuf) return null
  const idx = Math.min(timeBuf.length - 1, Math.floor((i / n) * timeBuf.length))
  return (timeBuf[idx] - 128) / 128
}

/**
 * Normalised level [0,1] for band i of n, log-spaced across the spectrum so the
 * bass end isn't all crammed into one bar. Returns null when nothing plays.
 */
export function sample(i, n) {
  if (!source || !freq) return null
  const bins = freq.length
  const edge = (k) => Math.round(Math.pow(bins - 1, k / n)) // 1 … bins-1, log-spaced
  const lo = edge(i)
  const hi = Math.max(lo + 1, edge(i + 1))
  let sum = 0
  let c = 0
  for (let b = lo; b < hi && b < bins; b++) { sum += freq[b]; c++ }
  return c ? sum / c / 255 : 0
}
