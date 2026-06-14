

import { CLOCK } from '../clock'
import { PALETTE } from '../settings'

export function makeSampler(sdf              , w        , h        ) {
  return (x        , y        )         => {
    const ix = Math.max(0, Math.min(w - 1, Math.round(x)))
    const iy = Math.max(0, Math.min(h - 1, Math.round(y)))
    return sdf[iy * w + ix]
  }
}

export function makeSDF(data              , w        , h        )      {
  return { data, w, h, sample: makeSampler(data, w, h) }
}

// Sample a random point inside the mask (sdf < 0). Rejection.
export function sampleInside(sdf     , rng     , tries = 128)                   {
  for (let i = 0; i < tries; i++) {
    const x = rng() * sdf.w
    const y = rng() * sdf.h
    if (sdf.sample(x, y) < 0) return [x, y]
  }
  return [sdf.w / 2, sdf.h / 2]
}

// Central-difference gradient of SDF at (x,y). Useful for pushing points inward.
export function sdfGrad(sdf     , x        , y        , h = 1.5)                   {
  const dx = sdf.sample(x + h, y) - sdf.sample(x - h, y)
  const dy = sdf.sample(x, y + h) - sdf.sample(x, y - h)
  return [dx / (2 * h), dy / (2 * h)]
}

// Returns a normalized direction pointing toward the interior from (x,y).
export function inwardDir(sdf     , x        , y        )                   {
  const [gx, gy] = sdfGrad(sdf, x, y)
  const m = Math.hypot(gx, gy) || 1
  return [-gx / m, -gy / m]
}

export function clear(ctx                          , W        , H        , bg = PALETTE.bg) {
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
}

// Faint SDF=0 outline, useful so the shape is visible even when empty
export function strokeOutline(
  ctx                          ,
  sdf     ,
  W        ,
  H        ,
  color = 'rgba(240, 230, 210, 0.35)',
  size = 1.2,
) {
  ctx.fillStyle = color
  const raw                     = []
  // Sparse sign-change probe, every 4 pixels, adds ~enough dots for an outline
  const stride = 4
  for (let y = 0; y < sdf.h - 1; y += stride) {
    for (let x = 0; x < sdf.w - 1; x += stride) {
      const a = sdf.data[y * sdf.w + x]
      const b = sdf.data[y * sdf.w + (x + stride)]
      const c = sdf.data[(y + stride) * sdf.w + x]
      if ((a < 0) !== (b < 0)) raw.push([x + (stride * a) / (a - b), y])
      if ((a < 0) !== (c < 0)) raw.push([x, y + (stride * a) / (a - c)])
    }
  }
  const sx = W / sdf.w, sy = H / sdf.h
  for (const p of raw) {
    ctx.beginPath()
    ctx.arc(p[0] * sx, p[1] * sy, size, 0, Math.PI * 2)
    ctx.fill()
  }
}

// rAF wrapper. Respects CLOCK pause — when paused, the tick still fires but
// `run()` is skipped, freezing whatever's on the canvas from the last frame.
// Pass { ignorePause: true } to keep running even when paused.
export function wrapLoop(run            , opts                            = {})             {
  let rafId = requestAnimationFrame(function tick() {
    if (opts.ignorePause || !CLOCK.isPaused()) run()
    rafId = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(rafId)
}
