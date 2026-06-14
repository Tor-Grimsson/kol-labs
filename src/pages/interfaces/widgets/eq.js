import p5 from 'p5'
import { pixelate } from '../pixel'
import { sample } from '../lib/audio.js'













export function eqBars(opts        )     {
  const bars = opts.bars ?? 24
  const barW = opts.barW ?? 3
  const gap = opts.gap ?? 1
  const H = opts.h ?? 28
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'
  const seed = opts.seed ?? 3

  const W = bars * (barW + gap) + gap
  const peaks = new Array        (bars).fill(0)

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(24)
    }

    p.draw = () => {
      p.background(bg)
      p.noStroke()

      const t = p.millis() / 1000

      for (let i = 0; i < bars; i++) {
        const x = gap + i * (barW + gap)
        const f1 = Math.sin(t * 2.1 + i * 0.7 + seed) * 0.5 + 0.5
        const f2 = Math.sin(t * 5.3 + i * 0.23) * 0.5 + 0.5
        const f3 = Math.sin(t * 0.9 + i * 1.1 + seed * 3) * 0.5 + 0.5
        const env = Math.max(0, 1 - Math.abs(i / bars - 0.5) * 1.2)
        const proc = Math.max(0, Math.min(1, f1 * 0.6 + f2 * 0.25 + f3 * 0.15)) * env
        const a = sample(i, bars) // null when mic off → procedural fallback
        const v = a != null ? a : proc
        const barH = Math.round(v * (H - 4)) | 0

        // baseline
        p.fill(dim)
        p.rect(x, H - 1, barW, 1)

        // bar
        p.fill(fg)
        if (barH > 0) p.rect(x, H - 1 - barH, barW, barH)

        // peak hold (decays)
        peaks[i] = Math.max(peaks[i] - 0.015, v)
        const peakY = H - 2 - Math.round(peaks[i] * (H - 4))
        p.fill(fg)
        p.rect(x, peakY, barW, 1)
      }
    }
  }, opts.host)
}
