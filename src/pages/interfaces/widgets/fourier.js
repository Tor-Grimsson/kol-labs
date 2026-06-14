import p5 from 'p5'

/**
 * Fourier — epicycle wave synthesis. A chain of rotating circles (epicycles),
 * each one a term of a Fourier series, whose tip traces a band-limited wave
 * (square / sawtooth / triangle) scrolling out to the right. `harmonics` = how
 * many terms, so 1 reads as a pure sine and high counts square up with the
 * Gibbs ripple visible at the corners.
 *
 * Deliberately NOT pixelated — this is the smooth/anti-aliased cousin of the
 * lofi widget set (the "without the lofi effect" render).
 */
export function fourier(opts = {}) {
  const W = opts.w ?? 240
  const H = opts.h ?? 96
  const harmonics = Math.max(1, Math.round(opts.harmonics ?? 5))
  const wave = opts.wave ?? 'square'
  const speed = opts.speed ?? 0.6
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'

  const terms = buildTerms(wave, harmonics) // [{ k, amp, phase }], term 0 = fundamental

  return new p5((p) => {
    const path = [] // synthesized tip-samples, newest first (one per frame = 1px)
    let cy = H / 2
    let originX = 0 // epicycle origin (left), leaves room for the fundamental circle
    let baseR = 1 // scales unit amplitude → pixels

    const layout = () => {
      cy = H / 2
      const maxR = Math.min(H * 0.4, W * 0.4)
      baseR = maxR / (terms[0]?.amp || 1)
      originX = maxR + 4
    }

    p.setup = () => {
      p.createCanvas(W, H)
      p.pixelDensity(2)
      p.frameRate(30)
      const c = p.canvas
      if (c?.style) { c.style.imageRendering = 'auto'; c.style.width = '100%'; c.style.height = 'auto' }
      layout()
    }

    p.draw = () => {
      p.background(bg)
      const t = (p.millis() / 1000) * speed * Math.PI * 2

      // ---- epicycle chain ----
      let x = originX
      let y = cy
      p.noFill()
      for (const term of terms) {
        const px = x
        const py = y
        const r = Math.abs(term.amp) * baseR
        const ang = term.k * t + term.phase + (term.amp < 0 ? Math.PI : 0)
        x += r * Math.cos(ang)
        y += r * Math.sin(ang)
        p.stroke(dim)
        p.strokeWeight(1)
        p.circle(px, py, r * 2)
        p.line(px, py, x, y)
      }
      const tipX = x
      const tipY = y

      // newest sample at the head; cap to the plot width
      path.unshift(tipY)
      const maxLen = Math.max(1, Math.floor(W - originX - 8))
      if (path.length > maxLen) path.length = maxLen

      // ---- traced wave (right of the epicycles) ----
      const waveX0 = originX + 8
      p.stroke(fg)
      p.strokeWeight(1.25)
      p.beginShape()
      for (let i = 0; i < path.length; i++) p.vertex(waveX0 + i, path[i])
      p.endShape()

      // connector tip → wave start, then the leading dot
      p.stroke(dim)
      p.strokeWeight(1)
      p.line(tipX, tipY, waveX0, path[0])
      p.noStroke()
      p.fill(fg)
      p.circle(tipX, tipY, 3)
    }
  }, opts.host)
}

/* Fourier terms per waveform. amp is in unit-amplitude space (the synthesized
 * wave peaks near ±1); the factory scales it to pixels. */
function buildTerms(wave, n) {
  const terms = []
  if (wave === 'sawtooth') {
    // (2/π) Σ (-1)^(k+1) (1/k) sin(kθ)
    for (let k = 1; k <= n; k++) terms.push({ k, amp: (2 / Math.PI) * (1 / k) * (k % 2 ? 1 : -1), phase: 0 })
  } else if (wave === 'triangle') {
    // (8/π²) Σ (-1)^i (1/(2i+1)²) sin((2i+1)θ)
    let i = 0
    for (let k = 1; k <= 2 * n - 1; k += 2) { terms.push({ k, amp: (8 / (Math.PI * Math.PI)) * (1 / (k * k)) * (i % 2 ? -1 : 1), phase: 0 }); i++ }
  } else {
    // square: (4/π) Σ (1/k) sin(kθ), k odd
    for (let k = 1; k <= 2 * n - 1; k += 2) terms.push({ k, amp: (4 / Math.PI) * (1 / k), phase: 0 })
  }
  return terms
}
