import p5 from 'p5'
import { pixelate } from '../pixel'











export function knob(opts          )     {
  const S = opts.size ?? 28
  const count = Math.max(1, opts.count ?? 1)
  const seed = opts.seed ?? 0
  const speed = opts.speed ?? opts.lfoHz ?? 0.12 // LFO rate
  const animate = opts.animate !== false // animate button drives the sweep
  const manual = opts.value ?? 0.5 // static position when not animating (0..1)
  const modulate = opts.modulate !== false // publish value as --knob (modulates the UI)
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'

  // a row of knobs opts out of the fixed square cell so it can span the slot
  if (count > 1) opts.host?.classList?.remove('sq')

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(count * S, S)
      pixelate(p)
      p.frameRate(24)
    }

    p.draw = () => {
      p.background(bg)
      p.noStroke()
      const t = p.millis() / 1000

      for (let k = 0; k < count; k++) {
        const cx = (k * S + S / 2) | 0
        const cy = (S / 2) | 0
        const r = (S / 2) - 2
        const kseed = seed + k * 1.7 // each knob drifts independently

        // dotted ring (12 tick marks)
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2
          p.fill(dim)
          p.rect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1)
        }

        // knob disc (filled pixel ring via per-pixel test)
        const rd = r - 3
        p.fill(fg)
        for (let y = cy - rd; y <= cy + rd; y++) {
          for (let x = cx - rd; x <= cx + rd; x++) {
            const dx = x - cx, dy = y - cy
            if (dx * dx + dy * dy <= rd * rd && dx * dx + dy * dy >= (rd - 2) * (rd - 2)) p.rect(x, y, 1, 1)
          }
        }

        // indicator: LFO-driven when animating, else the manual position
        const v = animate ? (Math.sin(t * speed * Math.PI * 2 + kseed) + 1) * 0.5 : manual // 0..1
        if (modulate && k === 0) document.documentElement.style.setProperty('--knob', v.toFixed(3))
        const ang = -Math.PI * 0.75 + v * Math.PI * 1.5 // -135°..+135°
        const ix = Math.round(cx + Math.cos(ang - Math.PI / 2) * (rd - 1))
        const iy = Math.round(cy + Math.sin(ang - Math.PI / 2) * (rd - 1))
        p.fill(fg)
        const steps = Math.max(Math.abs(ix - cx), Math.abs(iy - cy))
        for (let i = 1; i <= steps; i++) {
          const u = i / steps
          p.rect(Math.round(cx + (ix - cx) * u), Math.round(cy + (iy - cy) * u), 1, 1)
        }
      }
    }
  }, opts.host)
}
