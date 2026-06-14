import p5 from 'p5'
import { pixelate } from '../pixel'











export function knob(opts          )     {
  const S = opts.size ?? 28
  const seed = opts.seed ?? 0
  const speed = opts.speed ?? opts.lfoHz ?? 0.12 // LFO rate
  const animate = opts.animate !== false // animate button drives the sweep
  const manual = opts.value ?? 0.5 // static position when not animating (0..1)
  const modulate = opts.modulate !== false // publish value as --knob (modulates the UI)
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#4a3e34'

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(S, S)
      pixelate(p)
      p.frameRate(24)
    }

    p.draw = () => {
      p.background(bg)
      p.noStroke()

      const t = p.millis() / 1000
      const cx = (S / 2) | 0
      const cy = (S / 2) | 0
      const r = (S / 2) - 2

      // dotted ring (12 tick marks)
      const ticks = 12
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2 - Math.PI / 2
        const tx = Math.round(cx + Math.cos(a) * r)
        const ty = Math.round(cy + Math.sin(a) * r)
        p.fill(dim)
        p.rect(tx, ty, 1, 1)
      }

      // knob disc (filled pixel circle via per-pixel test)
      const rd = r - 3
      p.fill(fg)
      for (let y = cy - rd; y <= cy + rd; y++) {
        for (let x = cx - rd; x <= cx + rd; x++) {
          const dx = x - cx
          const dy = y - cy
          if (dx * dx + dy * dy <= rd * rd) {
            // center hole
            if (dx * dx + dy * dy >= (rd - 2) * (rd - 2)) p.rect(x, y, 1, 1)
          }
        }
      }

      // indicator: LFO-driven when animating, else the manual position
      const v = animate ? (Math.sin(t * speed * Math.PI * 2 + seed) + 1) * 0.5 : manual // 0..1
      if (modulate) document.documentElement.style.setProperty('--knob', v.toFixed(3)) // knob → UI modulation
      const ang = -Math.PI * 0.75 + v * Math.PI * 1.5 // -135°..+135°, pointing down-left → down-right
      const ix = Math.round(cx + Math.cos(ang - Math.PI / 2) * (rd - 1))
      const iy = Math.round(cy + Math.sin(ang - Math.PI / 2) * (rd - 1))
      p.fill(fg)
      // draw a 2-pixel indicator line from center toward ix,iy
      const steps = Math.max(Math.abs(ix - cx), Math.abs(iy - cy))
      for (let i = 1; i <= steps; i++) {
        const u = i / steps
        const x = Math.round(cx + (ix - cx) * u)
        const y = Math.round(cy + (iy - cy) * u)
        p.rect(x, y, 1, 1)
      }
    }
  }, opts.host)
}
