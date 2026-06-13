import p5 from 'p5'
import { pixelate } from '../pixel'











export function reel(opts          )     {
  const S = opts.size ?? 56
  const speed = opts.speed ?? 0.7
  const spokes = opts.spokes ?? 6
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(S, S)
      pixelate(p)
      p.frameRate(30)
    }
    p.draw = () => {
      p.background(bg)
      p.noStroke()

      const t = p.millis() / 1000
      const phase = t * speed * Math.PI * 2
      const cx = (S / 2) | 0
      const cy = (S / 2) | 0
      const R = (S / 2) - 2

      // outer tick ring
      const ticks = 32
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2
        const x = Math.round(cx + Math.cos(a) * R)
        const y = Math.round(cy + Math.sin(a) * R)
        p.fill(dim)
        p.rect(x, y, 1, 1)
      }

      // inner disc outline
      const rd = R - 4
      p.fill(dim)
      for (let y = cy - rd; y <= cy + rd; y++) {
        for (let x = cx - rd; x <= cx + rd; x++) {
          const dx = x - cx
          const dy = y - cy
          const d2 = dx * dx + dy * dy
          if (d2 <= rd * rd && d2 >= (rd - 2) * (rd - 2)) p.rect(x, y, 1, 1)
        }
      }

      // rotating spokes (hub → rim)
      p.fill(fg)
      for (let i = 0; i < spokes; i++) {
        const a = phase + (i / spokes) * Math.PI * 2
        const ex = cx + Math.cos(a) * (rd - 1)
        const ey = cy + Math.sin(a) * (rd - 1)
        const steps = Math.max(Math.abs(Math.round(ex) - cx), Math.abs(Math.round(ey) - cy))
        for (let s = 2; s <= steps; s++) {
          const u = s / steps
          const xx = Math.round(cx + (ex - cx) * u)
          const yy = Math.round(cy + (ey - cy) * u)
          p.rect(xx, yy, 1, 1)
        }
      }

      // counter-rotating inner triangle (reel windows)
      p.fill(fg)
      for (let i = 0; i < 3; i++) {
        const a = -phase * 1.3 + (i / 3) * Math.PI * 2
        const x = Math.round(cx + Math.cos(a) * (rd - 5))
        const y = Math.round(cy + Math.sin(a) * (rd - 5))
        p.rect(x - 1, y - 1, 2, 2)
      }

      // hub
      p.fill(fg)
      p.rect(cx - 2, cy - 2, 5, 5)
      p.fill(bg)
      p.rect(cx, cy, 1, 1)
    }
  }, opts.host)
}
