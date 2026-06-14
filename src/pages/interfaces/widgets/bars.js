import p5 from 'p5'
import { pixelate } from '../pixel'
import { sample } from '../lib/audio.js'












export function hBars(opts          )     {
  const W = opts.w ?? 160
  const rows = opts.rows ?? 5
  const rowH = 6
  const H = opts.h ?? rows * (rowH + 2) + 2
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'
  const seed = opts.seed ?? 0

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
      for (let i = 0; i < rows; i++) {
        const y = 1 + i * (rowH + 2)
        const proc = Math.abs(Math.sin(t * 0.4 + i * 0.9 + seed)) * 0.6 +
                  Math.abs(Math.sin(t * 1.7 + i * 0.23 + seed * 2)) * 0.4
        const a = sample(i, rows) // null when mic off → procedural fallback
        const clamped = Math.max(0.05, Math.min(1, a != null ? a : proc))
        const barW = Math.round(clamped * (W - 6))
        // baseline
        p.fill(dim)
        for (let x = 0; x < W; x += 2) p.rect(x, y + (rowH / 2) | 0, 1, 1)
        // bar
        p.fill(fg)
        p.rect(0, y, barW, rowH)
        // endcap tick
        p.fill(fg)
        p.rect(Math.min(W - 1, barW + 1), y - 1, 1, rowH + 2)
      }
    }
  }, opts.host)
}
