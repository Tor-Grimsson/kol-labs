import p5 from 'p5'
import { pixelate } from '../pixel'











export function tape(opts          )     {
  const W = opts.w ?? 128
  const H = opts.h ?? 10
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'
  const bpm = opts.bpm ?? 128

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(30)
    }

    p.draw = () => {
      p.background(bg)
      p.noStroke()

      // baseline ticks every 4 px
      for (let x = 0; x < W; x += 4) {
        p.fill(dim)
        p.rect(x, (H / 2) | 0, 1, 1)
      }

      const t = p.millis() / 1000
      const bps = bpm / 60
      // scrolling bar: fills a proportion of the width, wraps
      const phase = (t * bps * 0.25) % 1
      const fillW = Math.round(phase * W)
      p.fill(fg)
      p.rect(0, 2, fillW, H - 4)

      // bigger ticks at quarters
      for (let i = 1; i < 4; i++) {
        const x = Math.round((i / 4) * W)
        p.fill(fg)
        p.rect(x, 0, 1, H)
      }

      // cursor triangle
      const cx = Math.min(W - 1, fillW)
      p.fill(fg)
      p.rect(cx, 0, 1, H)
    }
  }, opts.host)
}
