// Effect pipeline orchestrator — the full render of an effect stack against a
// framed source. Two tiers run in order, then ONE global Amount crossfade:
//
//   raw framed source
//     → canvas tier   (imagefilters.js, synchronous, full strength)
//     → pixi tier      (pixi-filters on the persistent GL app, full strength)
//     → crossfade vs raw by `amount`   (0 = raw, 100 = full stack)
//
// Always async (pixi may be involved). With no pixi effects it resolves on the
// next microtask — effectively instant — so canvas-tier feedback stays snappy.

import { runCanvasStackInPlace } from './canvasEffects.js'
import { applyPixiStack, hasPixiEffect } from './pixiPipeline.js'
import { sampleSweep } from '../../radar/effects/sweeps.js'
import { applyCanvasFx } from '../../radar/hooks/useCanvasFx.js'
import { getEffectDef } from '../effects.config.js'

const newCanvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// Motion blend: instead of a uniform Amount crossfade, drive the effect strength
// per-pixel by a time-moving sweep field (Radar's `sampleSweep`), so the effect
// washes across the still over time. The combined sweep scalar (max over enabled
// sweeps) scales the global Amount at each pixel. (Reveal/geometry targets aren't
// differentiated yet — every sweep modulates the effect mask.)
function blendSweptMask(src, processed, w, h, sweeps, t, a) {
  const rawC = newCanvas(w, h)
  const rctx = rawC.getContext('2d')
  rctx.drawImage(src, 0, 0, w, h)
  const raw = rctx.getImageData(0, 0, w, h)

  const procC = newCanvas(w, h)
  const pctx = procC.getContext('2d')
  pctx.drawImage(processed, 0, 0, w, h)
  const proc = pctx.getImageData(0, 0, w, h)

  const out = rctx.createImageData(w, h)
  const rd = raw.data
  const pd = proc.data
  const od = out.data
  for (let y = 0; y < h; y++) {
    const ny = y / h
    for (let x = 0; x < w; x++) {
      const nx = x / w
      let s = 0
      for (let k = 0; k < sweeps.length; k++) {
        const v = sampleSweep(sweeps[k], nx, ny, t)
        if (v > s) s = v
      }
      const f = a * s
      const i = (y * w + x) * 4
      od[i] = rd[i] + (pd[i] - rd[i]) * f
      od[i + 1] = rd[i + 1] + (pd[i + 1] - rd[i + 1]) * f
      od[i + 2] = rd[i + 2] + (pd[i + 2] - rd[i + 2]) * f
      od[i + 3] = 255
    }
  }
  const final = newCanvas(w, h)
  final.getContext('2d').putImageData(out, 0, 0)
  return final
}

/**
 * @param {object} a
 * @param {CanvasImageSource} a.src  raw framed source (image or canvas), drawn at w×h
 * @param {number} a.w
 * @param {number} a.h
 * @param {Array}  a.stack  [{ type, enabled, params }]
 * @param {number} a.amount 0–100
 * @param {number} [a.time]  animation clock (seconds) — used with sweeps
 * @param {Array}  [a.sweeps]  motion sweeps (Radar shape) — animate the effect mask
 * @param {boolean} [a.animating]  gates the sweep field on
 * @returns {Promise<HTMLCanvasElement>} the composited result at w×h
 */
export async function renderProcessed({ src, w, h, stack, amount, time = 0, sweeps = [], animating = false }) {
  const base = newCanvas(w, h)
  base.getContext('2d').drawImage(src, 0, 0, w, h)

  runCanvasStackInPlace(base, stack) // stage 1 — sync

  let processed = base
  if (hasPixiEffect(stack)) {
    const out = await applyPixiStack(base, stack) // stage 2 — async GPU
    if (out) processed = out
  }

  // Stage 3 — Radar's canvas FX (Post-Processing category), applied last.
  const postfx = stack.filter((fx) => fx.enabled && getEffectDef(fx.type)?.tier === 'postfx')
  if (postfx.length) {
    const pc = newCanvas(w, h)
    pc.getContext('2d').drawImage(processed, 0, 0, w, h) // guarantee a 2D canvas (pixi extract → here)
    applyCanvasFx(pc, postfx)
    processed = pc
  }

  const a = Math.max(0, Math.min(100, amount)) / 100

  // Motion: per-pixel swept mask when animating with enabled sweeps.
  const enabledSweeps = animating ? sweeps.filter((sw) => sw.enabled) : []
  if (enabledSweeps.length && a > 0) {
    return blendSweptMask(src, processed, w, h, enabledSweeps, time, a)
  }

  if (a >= 1) return processed

  // Uniform global crossfade: raw underneath, processed on top at alpha `a`.
  const final = newCanvas(w, h)
  const ctx = final.getContext('2d')
  ctx.drawImage(src, 0, 0, w, h)
  if (a > 0) {
    ctx.save()
    ctx.globalAlpha = a
    ctx.drawImage(processed, 0, 0, w, h)
    ctx.restore()
  }
  return final
}
