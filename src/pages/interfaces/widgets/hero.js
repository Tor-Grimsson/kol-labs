import p5 from 'p5'
import { pixelate, bayer, dither } from '../pixel'










export function hero(opts          )     {
  const W = opts.w ?? 128
  const H = opts.h ?? 72
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(30)
    }

    p.draw = () => {
      p.background(bg)

      const t = p.frameCount / 30

      // grid dots
      p.noStroke()
      p.fill(dim)
      for (let y = 4; y < H - 4; y += 6) {
        for (let x = 4; x < W; x += 6) {
          p.rect(x, y, 1, 1)
        }
      }

      // frame corners
      p.fill(fg)
      const corners = 5
      for (let i = 0; i < corners; i++) {
        p.rect(0 + i, 0, 1, 1); p.rect(0, 0 + i, 1, 1)
        p.rect(W - 1 - i, 0, 1, 1); p.rect(W - 1, 0 + i, 1, 1)
        p.rect(0 + i, H - 1, 1, 1); p.rect(0, H - 1 - i, 1, 1)
        p.rect(W - 1 - i, H - 1, 1, 1); p.rect(W - 1, H - 1 - i, 1, 1)
      }

      // central waveform: two overlaid sines, Bayer-dithered thickness
      const mid = (H / 2) | 0
      for (let x = 1; x < W - 1; x++) {
        const s1 = Math.sin((x + t * 18) * 0.18) * 8
        const s2 = Math.sin((x - t * 11) * 0.11 + 1) * 5
        const y = mid + ((s1 + s2) | 0)

        // main line
        p.fill(fg)
        p.rect(x, y, 1, 1)

        // dithered glow above and below
        const glowRange = 3
        for (let dy = -glowRange; dy <= glowRange; dy++) {
          if (dy === 0) continue
          const gray = 1 - Math.abs(dy) / (glowRange + 1)
          if (dither(gray * 0.55, x, y + dy)) {
            p.rect(x, y + dy, 1, 1)
          }
        }
      }

      // sweeping cursor
      const cx = Math.floor(((t * 0.35) % 1) * (W - 2)) + 1
      p.fill(fg)
      for (let yy = 2; yy < H - 2; yy += 2) p.rect(cx, yy, 1, 1)

      // corner label dots
      p.fill(fg)
      p.rect(3, 3, 2, 2)
      p.rect(W - 5, H - 5, 2, 2)

      // subtle bayer noise floor across the bottom strip
      for (let x = 0; x < W; x++) {
        const g = 0.22 + Math.sin(t * 0.4 + x * 0.05) * 0.08
        if (g > bayer(x, H - 3)) p.rect(x, H - 3, 1, 1)
        if (g * 0.7 > bayer(x, H - 2)) p.rect(x, H - 2, 1, 1)
      }
    }
  }, opts.host)
}
