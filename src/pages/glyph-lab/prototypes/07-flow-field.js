import { createNoise2D } from 'simplex-noise'

import { clear, strokeOutline, wrapLoop, sampleInside } from './common'



// Flow field: simplex noise mapped to an angle per (x,y). Particles advect
// through the field, drawing thin ink trails. Confined by SDF — if a particle
// leaves the letter it respawns inside.
//
// Tyler Hobbs' canonical flow-field essay is the reference for this aesthetic.
// https://tylerxhobbs.com/essays/2020/flow-fields
export const flowField            = {
  id: '07-flow-field',
  name: 'FLOW FIELD',
  repo: 'tylerxhobbs.com/essays/2020/flow-fields',
  summary:
    'Simplex noise → angle field. Particles drift along the field, leaving trails. SDF bounds them — they respawn when they exit. Produces ribbon / hair / smoke aesthetic within the glyph. A great motion layer.',
  helps:
    'Beautiful motion layer over any static base. Ink ribbons trapped in the letter. Tyler-Hobbs-grade aesthetic for ~60 lines of code.',
  init({ ctx, sdf, W, H, rng }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const noise2D = createNoise2D(rng)
    const scale = 0.008

    const N = 900
    const ps      = []
    const spawn = ()    => {
      const [x, y] = sampleInside(sdf, rng)
      return { x, y, px: x, py: y, life: rng() * 200 | 0 }
    }
    for (let i = 0; i < N; i++) ps.push(spawn())

    // trails accumulate — don't clear between frames, just fade
    clear(ctx, W, H)

    return wrapLoop(() => {
      // subtle fade
      ctx.fillStyle = 'rgba(10, 11, 20, 0.06)'
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.12)', 1)

      ctx.strokeStyle = 'rgba(139, 143, 214, 0.35)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      for (const p of ps) {
        p.px = p.x
        p.py = p.y
        const a = noise2D(p.x * scale, p.y * scale) * Math.PI * 2
        p.x += Math.cos(a) * 1.4
        p.y += Math.sin(a) * 1.4
        p.life--
        if (p.life <= 0 || sdf.sample(p.x, p.y) >= 0) {
          const n = spawn()
          p.x = n.x; p.y = n.y; p.px = n.x; p.py = n.y; p.life = 200
          continue
        }
        ctx.moveTo(p.px * sx, p.py * sy)
        ctx.lineTo(p.x * sx, p.y * sy)
      }
      ctx.stroke()

      // heads
      ctx.fillStyle = 'rgba(243, 201, 196, 0.7)'
      for (const p of ps) {
        ctx.beginPath()
        ctx.arc(p.x * sx, p.y * sy, 0.8, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
