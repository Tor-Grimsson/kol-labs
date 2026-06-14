import p5 from 'p5'
import { pixelate } from '../pixel'

const DIG                           = {
  '0': ['111','101','101','101','111'],
  '1': ['010','110','010','010','111'],
  '2': ['111','001','111','100','111'],
  '3': ['111','001','111','001','111'],
  '4': ['101','101','111','001','001'],
  '5': ['111','100','111','001','111'],
  '6': ['111','100','111','101','111'],
  '7': ['111','001','001','001','001'],
  '8': ['111','101','111','101','111'],
  '9': ['111','101','111','001','111'],
  ' ': ['000','000','000','000','000'],
  ':': ['000','010','000','010','000'],
  '-': ['000','000','111','000','000'],
  '.': ['000','000','000','000','010'],
}













export function sevenSeg(opts              )     {
  const digits = opts.digits ?? 6
  const scale = opts.scale ?? 3
  const interval = opts.interval ?? 1000
  const delta = opts.delta ?? 1
  const seed = opts.seed ?? 0
  const fixed = opts.text != null && String(opts.text).length > 0 // typed value → static readout
  const fg = opts.fg ?? '#e5dfcf'
  const bg = opts.bg ?? '#0b0907'
  const dim = opts.dim ?? '#3a322b'

  const charW = 3 * scale
  const charH = 5 * scale
  const gap = scale
  const W = digits * charW + (digits - 1) * gap
  const H = charH

  return new p5((p    ) => {
    p.setup = () => {
      p.createCanvas(W, H)
      pixelate(p)
      p.frameRate(12)
    }
    p.draw = () => {
      p.background(bg)
      p.noStroke()

      let str
      if (fixed) {
        str = String(opts.text).slice(0, digits).padStart(digits, ' ')
      } else {
        const n = Math.floor(p.millis() / interval) * delta + seed
        str = String(Math.abs(n)).padStart(digits, '0').slice(-digits)
      }

      for (let i = 0; i < digits; i++) {
        const ch = str[i] ?? ' '
        const mat = DIG[ch] ?? DIG[' ']
        const x0 = i * (charW + gap)
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 3; c++) {
            const on = mat[r][c] === '1'
            p.fill(on ? fg : dim)
            p.rect(x0 + c * scale, r * scale, scale, scale)
          }
        }
      }
    }
  }, opts.host)
}
