import p5 from 'p5'
import { pixelate } from '../pixel'












export function vu(opts        )     {
  const W = opts.w ?? 80
  const H = opts.h ?? 5
  const segs = opts.segs ?? 20
  const seed = opts.seed ?? 1
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#3a322b'

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
      const env = Math.max(0, Math.sin(t * 1.6 + seed) * 0.6 + 0.4 + Math.sin(t * 5.2 + seed * 2) * 0.18)
      const v = Math.max(0, Math.min(1, env))
      const lit = Math.round(v * segs)
      const segW = Math.floor(W / segs)
      for (let i = 0; i < segs; i++) {
        const x = i * segW
        p.fill(i < lit ? fg : dim)
        p.rect(x, 0, Math.max(1, segW - 1), H)
      }
    }
  }, opts.host)
}
