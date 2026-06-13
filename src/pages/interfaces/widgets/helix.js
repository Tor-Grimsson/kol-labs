import p5 from 'p5'
import { pixelate } from '../pixel'
















export function helix(opts           )     {
  const W = opts.w ?? 120
  const H = opts.h ?? 160
  const turns = opts.turns ?? 2.5
  const N = opts.dotsPerStrand ?? 26
  const R = opts.radius ?? 22
  const speed = opts.speed ?? 0.28
  const showRungs = opts.showRungs ?? true
  const rungStride = opts.rungStride ?? 2
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
      p.noStroke()

      const t = p.millis() / 1000
      const phase = t * speed * Math.PI * 2
      const cx = (W / 2) | 0
      const topY = 4
      const botY = H - 4


      const a       = []
      const b       = []
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1)
        const y = topY + u * (botY - topY)
        const ang0 = u * turns * Math.PI * 2 + phase
        const ang1 = ang0 + Math.PI
        a.push({ x: cx + Math.sin(ang0) * R, y, depth: Math.cos(ang0) })
        b.push({ x: cx + Math.sin(ang1) * R, y, depth: Math.cos(ang1) })
      }

      // rungs — back half first, then front half to preserve layering
      const drawRungs = (wantFront         ) => {
        for (let i = 0; i < N; i += rungStride) {
          const avg = (a[i].depth + b[i].depth) / 2
          const isFront = avg > 0
          if (isFront !== wantFront) continue
          const col = isFront ? fg : dim
          p.fill(col)
          const x0 = Math.round(a[i].x)
          const x1 = Math.round(b[i].x)
          const y = Math.round(a[i].y)
          const lo = Math.min(x0, x1)
          const hi = Math.max(x0, x1)
          for (let x = lo; x <= hi; x++) p.rect(x, y, 1, 1)
        }
      }

      const drawDots = (wantFront         ) => {
        for (let i = 0; i < N; i++) {
          for (const pt of [a[i], b[i]]) {
            const isFront = pt.depth > 0
            if (isFront !== wantFront) continue
            const col = pt.depth > 0.3 ? fg : pt.depth > -0.3 ? dim : dim
            p.fill(col)
            const sz = pt.depth > 0.2 ? 2 : 1
            p.rect(Math.round(pt.x) - (sz - 1), Math.round(pt.y) - (sz - 1), sz, sz)
          }
        }
      }

      // back layer
      if (showRungs) drawRungs(false)
      drawDots(false)
      // front layer
      if (showRungs) drawRungs(true)
      drawDots(true)
    }
  }, opts.host)
}
