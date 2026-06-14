import p5 from 'p5'
import { pixelate } from '../pixel'
import { isActive, beatCount, beat } from '../lib/audio.js'















export function sequencer(opts         )     {
  const cols = opts.cols ?? 16
  const rows = opts.rows ?? 4
  const cellW = opts.cellW ?? 6
  const cellH = opts.cellH ?? 5
  const gap = opts.gap ?? 1
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#3a322b'
  const bpm = opts.bpm ?? 128
  const seed = opts.seed ?? 7

  const W = cols * (cellW + gap) + gap
  const H = rows * (cellH + gap) + gap

  // pattern (deterministic from seed)
  let t = seed | 0
  const rng = ()         => {
    t = (t + 0x6d2b79f5) | 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  const densities = [0.55, 0.3, 0.25, 0.18]
  const pattern              = []
  for (let r = 0; r < rows; r++) {
    const row            = []
    const d = densities[r % densities.length]
    for (let c = 0; c < cols; c++) row.push(rng() < d)
    pattern.push(row)
  }

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(30)
    }

    p.draw = () => {
      p.background(bg)
      p.noStroke()

      // locked to the track: advance one step per detected beat; else free-run bpm
      const live = isActive()
      const beatsPerSec = (bpm / 60) * 2 // 8ths
      const step = live ? (beatCount() % cols) : (Math.floor((p.millis() / 1000) * beatsPerSec) % cols)
      const hit = live ? beat() : 0 // brighten the playhead on the downbeat

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = gap + c * (cellW + gap)
          const y = gap + r * (cellH + gap)
          const on = pattern[r][c]
          const head = c === step

          if (on && head) {
            // a hit landing on the playhead pops a bright outline ring on the beat
            p.fill(fg)
            p.rect(x, y, cellW, cellH)
            if (hit > 0.4) { p.fill(bg); p.rect(x + 1, y + 1, cellW - 2, cellH - 2); p.fill(fg); p.rect(x + 2, y + 2, cellW - 4, cellH - 4) }
          } else if (on) {
            p.fill(fg)
            p.rect(x, y, cellW, cellH)
          } else if (head) {
            p.fill(dim)
            p.rect(x, y, cellW, cellH)
            p.fill(fg)
            p.rect(x, y, 1, cellH)
            p.rect(x + cellW - 1, y, 1, cellH)
          } else {
            p.fill(dim)
            p.rect(x, y, 1, 1)
            p.rect(x + cellW - 1, y, 1, 1)
            p.rect(x, y + cellH - 1, 1, 1)
            p.rect(x + cellW - 1, y + cellH - 1, 1, 1)
          }
        }
      }
    }
  }, opts.host)
}
