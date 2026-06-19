// audioSource — a single mic/line analyser whose smoothed bands are exposed as
// expression variables (level, bass, mid, high). Adding them to exprParam's scope
// means ANY expression slider can react to sound — `bass*2`, `t*0.1 + level*0.5`,
// `bass*0.8 + wave(t*0.5)*0.2` — with no per-page wiring. Off until enableAudio()
// is called from a user gesture (autoplay/mic policy); reads 0 when disabled, so
// audio terms just contribute nothing until it's on. Never throws, never NaNs.
//
//   enableAudio()  -> Promise (lazy getUserMedia + AudioContext + own rAF loop)
//   readAudio()    -> { level, bass, mid, high }  (live object, mutated in place)
//   disableAudio() -> tears down, resets bands to 0

// The live band object. exprParam reads this reference each eval; we mutate in
// place so no allocation per frame and no stale closures.
const audio = { level: 0, bass: 0, mid: 0, high: 0 }

let ctx = null
let analyser = null
let stream = null
let raf = 0
let timeBuf = null
let freqBuf = null
let enabled = false

// Notified on enable/disable so React consumers (e.g. Slider) can start/stop
// their own animation when audio comes and goes.
const subs = new Set()
function notify() { subs.forEach((fn) => fn(enabled)) }

// Asymmetric smoothing: rise quickly so transients read, fall slowly so the
// thumb/visual doesn't strobe. Per-frame lerp coefficients.
const ATTACK = 0.5
const RELEASE = 0.12

function smooth(prev, target) {
  return prev + (target - prev) * (target > prev ? ATTACK : RELEASE)
}

function tick() {
  if (!enabled || !analyser) return

  // level — RMS of the time-domain waveform, scaled to a useful 0–1 range
  analyser.getFloatTimeDomainData(timeBuf)
  let sum = 0
  for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i]
  const level = Math.min(1, Math.sqrt(sum / timeBuf.length) * 4)

  // bands — byte FFT split into bass / mid / high by bin fraction
  analyser.getByteFrequencyData(freqBuf)
  const N = freqBuf.length
  const bassEnd = Math.floor(N * 0.04)
  const midEnd = Math.floor(N * 0.25)
  let b = 0, m = 0, h = 0
  for (let i = 0; i < bassEnd; i++) b += freqBuf[i]
  for (let i = bassEnd; i < midEnd; i++) m += freqBuf[i]
  for (let i = midEnd; i < N; i++) h += freqBuf[i]
  const bass = Math.min(1, b / bassEnd / 200)
  const mid = Math.min(1, m / (midEnd - bassEnd) / 160)
  const high = Math.min(1, h / (N - midEnd) / 120)

  audio.level = smooth(audio.level, level)
  audio.bass = smooth(audio.bass, bass)
  audio.mid = smooth(audio.mid, mid)
  audio.high = smooth(audio.high, high)

  raf = requestAnimationFrame(tick)
}

/**
 * Start listening. Must be called from a user gesture (mic permission +
 * AudioContext autoplay policy). Idempotent. Resolves true on success, false
 * if audio is unavailable / denied (in which case bands stay 0).
 */
export async function enableAudio() {
  if (enabled) return true
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    if (ctx.state === 'suspended') await ctx.resume()
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    const src = ctx.createMediaStreamSource(stream)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 512 // 256 frequency bins
    src.connect(analyser)
    timeBuf = new Float32Array(analyser.fftSize)
    freqBuf = new Uint8Array(analyser.frequencyBinCount)
    enabled = true
    raf = requestAnimationFrame(tick)
    notify()
    return true
  } catch (err) {
    console.info('[audio] not available:', err?.message ?? err)
    disableAudio()
    return false
  }
}

/** Stop listening and release the mic. Resets all bands to 0. */
export function disableAudio() {
  enabled = false
  if (raf) { cancelAnimationFrame(raf); raf = 0 }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null }
  if (ctx) { try { ctx.close() } catch { /* already closed */ } ctx = null }
  analyser = null
  timeBuf = freqBuf = null
  audio.level = audio.bass = audio.mid = audio.high = 0
  notify()
}

/** The live band object — same reference each call, mutated in place. */
export function readAudio() { return audio }

export function isAudioEnabled() { return enabled }

/** Subscribe to enable/disable changes. Returns an unsubscribe fn. */
export function subscribeAudio(fn) { subs.add(fn); return () => subs.delete(fn) }
