import p5 from 'p5'
import { pixelate } from '../pixel'
import { isActive, beat } from '../lib/audio.js'













export function matrix(opts            )     {
  const cols = opts.cols ?? 10
  const rows = opts.rows ?? 6
  const cell = opts.cell ?? 4
  const seed = opts.seed ?? 11
  const speed = opts.speed ?? 0.5
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#3a322b'

  const W = cols * cell
  const H = rows * cell

  const rngAt = (x        , y        , tBucket        )         => {
    const s = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + tBucket * 17.3 + seed * 9.1) * 43758.5453
    return s - Math.floor(s)
  }

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(20)
    }

    p.draw = () => {
      p.background(bg)
      p.noStroke()

      const t = p.millis() / 1000
      // step on the tempo clock (steady); the track only accents the flare, so
      // adding audio doesn't run the field at the raw bass-onset rate.
      const live = isActive()
      const bucket = Math.floor(t * speed)
      const hit = live ? beat() : 0 // on a beat, more cells light up
      const onThresh = 0.7 - hit * 0.25 // beat lowers the bar → field flares on the hit

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = rngAt(x, y, bucket)
          if (v > onThresh) {
            p.fill(fg)
            p.rect(x * cell, y * cell, cell - 1, cell - 1)
          } else if (v > 0.5) {
            p.fill(dim)
            p.rect(x * cell, y * cell, cell - 1, cell - 1)
          } else {
            p.fill(dim)
            p.rect(x * cell, y * cell, 1, 1)
          }
        }
      }
    }
  }, opts.host)
}
