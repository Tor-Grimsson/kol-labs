import p5 from 'p5'
import { pixelate, bayer } from '../pixel'














export function bitmap(opts            )     {
  const W = opts.w ?? 72
  const H = opts.h ?? 72
  const arms = opts.arms ?? 6
  const rings = opts.rings ?? 4
  const speed = opts.speed ?? 0.2
  const style = opts.style ?? 'radial'
  const seed = opts.seed ?? 0
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(18)
    }
    p.draw = () => {
      p.background(bg)
      p.noStroke()
      p.fill(fg)

      const t = p.millis() / 1000 * speed + seed
      const cx = W / 2
      const cy = H / 2
      const maxR = Math.min(W, H) / 2 - 1

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const dx = px - cx + 0.5
          const dy = py - cy + 0.5
          const r = Math.sqrt(dx * dx + dy * dy)
          if (r > maxR) continue
          const a = Math.atan2(dy, dx)

          let v = 0
          if (style === 'radial') {
            const armV = Math.abs(Math.cos(a * arms + t * 2))
            const ringV = Math.abs(Math.sin(r * (rings / maxR) * Math.PI - t * 1.5))
            v = armV * 0.65 + ringV * 0.35
          } else if (style === 'spiral') {
            v = Math.abs(Math.sin(a * arms + r * 0.28 - t * 2.2))
          } else if (style === 'eye') {
            const pR = maxR * 0.22
            const iR = maxR * 0.62
            if (r < pR) v = 1
            else if (r < iR) v = 0.35 + Math.abs(Math.sin(a * 10 + t * 1.2)) * 0.55
            else v = Math.max(0, 1 - (r - iR) / (maxR - iR) * 1.2)
          } else { // burst
            const dist = Math.abs(Math.sin(r * 0.4 + t * 2))
            const arm = Math.abs(Math.cos(a * arms * 0.5 + t * 0.8))
            v = dist * arm
          }

          const fade = Math.max(0, 1 - r / maxR)
          v *= 0.35 + fade * 0.65

          if (v > bayer(px, py)) p.rect(px, py, 1, 1)
        }
      }
    }
  }, opts.host)
}
