import p5 from 'p5'
import { pixelate } from '../pixel'

const TAU = Math.PI * 2

// Radar reticle — concentric rings + crosshair + a rotating sweep line that
// brightens blips as it passes (the sci-fi-HUD reference from the moodboard).
// Square widget; blips are seeded so they're stable per `seed`.
export function reticle(opts) {
  const S = opts.size ?? 72
  const rings = Math.max(1, opts.rings ?? 3)
  const blips = Math.max(0, opts.blips ?? 5)
  const speed = opts.speed ?? 0.5
  const seed = opts.seed ?? 0
  const fg = opts.fg ?? '#2ec4b6'
  const bg = opts.bg ?? '#02100e'
  const dim = opts.dim ?? '#0b3a34'

  return new p5((p) => {
    p.setup = () => {
      p.createCanvas(S, S)
      pixelate(p)
      p.frameRate(30)
    }
    p.draw = () => {
      p.background(bg)
      const cx = (S / 2) | 0
      const cy = (S / 2) | 0
      const R = S / 2 - 2

      // rings + crosshair
      p.noFill()
      p.stroke(dim)
      for (let i = 1; i <= rings; i++) p.ellipse(cx, cy, (R * 2 * i) / rings, (R * 2 * i) / rings)
      p.line(cx - R, cy, cx + R, cy)
      p.line(cx, cy - R, cx, cy + R)

      // rotating sweep + a short fading trail
      const t = p.millis() / 1000
      const ang = (t * speed * TAU) % TAU
      for (let k = 0; k < 5; k++) {
        const a = ang - k * 0.12
        const f = 1 - k / 5
        p.stroke(p.lerpColor(p.color(bg), p.color(fg), f))
        p.line(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      }

      // blips — stable seeded positions, flare when the sweep is near
      p.noStroke()
      for (let b = 0; b < blips; b++) {
        const ba = ((Math.sin((b + seed) * 12.9898) * 0.5 + 0.5) * TAU) % TAU
        const br = (Math.sin((b + seed) * 7.733) * 0.5 + 0.5) * R * 0.82
        const bx = Math.round(cx + Math.cos(ba) * br)
        const by = Math.round(cy + Math.sin(ba) * br)
        let d = Math.abs(ang - ba)
        if (d > Math.PI) d = TAU - d
        const near = d < 0.45
        p.fill(near ? fg : dim)
        const s = near ? 3 : 2
        p.rect(bx - (s >> 1), by - (s >> 1), s, s)
      }
    }
  }, opts.host)
}
