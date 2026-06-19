// Pixi tier — stage 2 of the effect pipeline. Applies the stack's GPU effects
// on ONE persistent Pixi Application (init'd lazily, reused across renders — the
// editor's create-app-per-filter pattern leaked GL contexts). Each render makes
// throwaway textures/sprites and destroys them; the app + GL context persist.
//
// Runs AFTER the canvas tier, on the already-processed canvas, at full strength
// (the global Amount crossfade is applied once by the orchestrator). Filters
// chain natively via `sprite.filters = [...]`.

import { Application, Sprite, Texture, CanvasSource, Rectangle } from 'pixi.js'
import { createPixiFilter } from './pixiFilters.js'
import { getEffectDef } from '../effects.config.js'

let appPromise = null
function getApp() {
  if (!appPromise) {
    const app = new Application()
    appPromise = app
      .init({ width: 16, height: 16, backgroundAlpha: 0, antialias: true, preference: 'webgl', autoStart: false })
      .then(() => app)
      .catch((e) => { appPromise = null; throw e }) // let a failed init retry next time
  }
  return appPromise
}

export function hasPixiEffect(stack) {
  return stack.some((fx) => fx.enabled && getEffectDef(fx.type)?.tier === 'pixi')
}

// Synchronous canvas → texture (avoids the editor's async Assets.load(dataURL)).
function textureFromCanvas(canvas) {
  return new Texture({ source: new CanvasSource({ resource: canvas }) })
}

// Grayscale multi-octave noise map for the displacement filter (ported verbatim
// from the editor's pixiFilters displacement branch).
function makeNoiseCanvas(w, h, params) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  const frequency = params.frequency || 1
  const octaves = params.octaves || 3
  const persistence = params.persistence || 0.5
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let value = 0
      let amplitude = 1
      let freq = frequency / 100
      for (let o = 0; o < octaves; o++) {
        const n = (Math.sin(x * freq * 12.9898 + y * freq * 78.233) * 43758.5453) % 1
        value += n * amplitude
        amplitude *= persistence
        freq *= 2
      }
      const v = ((value / octaves) * 255) | 0
      const i = (y * w + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/**
 * Apply the stack's enabled pixi-tier effects to `sourceCanvas`. Returns a
 * Promise<canvas> of the filtered result, or null if there are no pixi effects.
 * After awaiting the (one-time) app init, the body runs synchronously to
 * completion — JS is single-threaded and there's no further await — so
 * concurrent calls never interleave on the shared app.stage.
 */
export async function applyPixiStack(sourceCanvas, stack) {
  const enabled = stack.filter((fx) => fx.enabled && getEffectDef(fx.type)?.tier === 'pixi')
  if (enabled.length === 0) return null

  const app = await getApp()
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  app.renderer.resize(w, h)
  app.stage.removeChildren()

  const trash = []
  const filters = []
  for (const fx of enabled) {
    if (fx.type === 'filter-displacement') {
      // The map sprite must be in the scene graph; add it BEHIND the main
      // sprite so the (full-size, opaque) main sprite covers it on extract.
      const noiseTex = textureFromCanvas(makeNoiseCanvas(w, h, fx.params))
      const noiseSprite = new Sprite(noiseTex)
      app.stage.addChild(noiseSprite)
      trash.push(noiseSprite, noiseTex)
      const f = createPixiFilter(fx.type, fx.params, noiseSprite)
      if (f) filters.push(f)
    } else {
      const f = createPixiFilter(fx.type, fx.params)
      if (f) filters.push(f)
    }
  }

  const baseTex = textureFromCanvas(sourceCanvas)
  const sprite = new Sprite(baseTex)
  sprite.filters = filters
  app.stage.addChild(sprite)
  trash.push(sprite, baseTex)

  // Fixed frame so bounds-expanding filters (glow/shadow/bloom) extract at
  // exactly w×h, origin-aligned (effects past the edge are clipped, as with a
  // fixed-size canvas) — not the grown container bounds.
  const out = app.renderer.extract.canvas({ target: app.stage, frame: new Rectangle(0, 0, w, h) })

  // Teardown — extract is synchronous, so the GPU work is done by here.
  app.stage.removeChildren()
  for (const f of filters) { try { f.destroy?.() } catch { /* noop */ } }
  for (const t of trash) { try { t.destroy?.() } catch { /* noop */ } }

  return out
}
