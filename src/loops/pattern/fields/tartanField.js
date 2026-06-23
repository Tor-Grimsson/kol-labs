import { TAU } from '../../lib/util.js'
import { SETTS } from './setts.js'

// Tartan — VECTOR bands, not per-pixel. The woven "mix" tone comes for free from
// alpha compositing: draw the weft (horizontal sett bands) solid, then the warp
// (vertical sett bands) at 50% → every cell is the AVERAGE of its warp+weft thread
// (same colour ⇒ that colour; different ⇒ the muddy crossing third). A few dozen
// rects total. Palette indices 0..3 → color/color2/color3/bg. Seamless: the sett
// scrolls whole repeats per loop (phase = u·TAU·round(camFlow)).
export function drawTartan(ctx, u, w, h, p) {
  const pal = [p.color, p.color2 || p.color, p.color3 || p.color2 || p.color, p.bg]
  const sett = SETTS[p.sett] || SETTS['black-watch']
  const total = sett.reduce((s, b) => s + b[1], 0)
  // Field animation (seamless on whole fieldCycles): the sett breathes its scale,
  // the warp/weft balance shimmers.
  const tphase = u * TAU * Math.round(p.fieldCycles || 1)
  const scale = Math.max(0.5, p.settScale || 5) * (1 + (p.fieldPulse || 0) * 0.3 * Math.sin(tphase))
  const warpAlpha = 0.5 + (p.fieldShimmer || 0) * 0.3 * Math.sin(tphase)
  const span = total * scale
  const z = p.camZoom || 1
  const dir = (p.panDir === 'left' || p.panDir === 'up' || p.panDir === 'anti') ? -1 : 1
  // Two independent axes (whole repeats/loop ⇒ seamless): Flow scrolls the warp
  // (horizontal), Travel scrolls the weft (vertical) — the weave drifts in X and Y.
  const driftX = u * Math.round(p.camFlow || 0) * span * dir
  const driftY = u * Math.round(p.waveFlow || 0) * span * dir

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((p.camAngle || 0) * Math.PI / 180)
  ctx.scale(z, z)
  ctx.translate(-driftX, -driftY)

  const reach = (Math.hypot(w, h) / 2) / z + span

  const drawAxis = (horizontal, alpha, posDrift, longDrift) => {
    ctx.globalAlpha = alpha
    const r0 = Math.floor((-reach + posDrift) / span) - 1
    const r1 = Math.ceil((reach + posDrift) / span) + 1
    const long0 = -reach + longDrift - span, longLen = reach * 2 + span * 2
    for (let r = r0; r <= r1; r++) {
      let pos = r * span
      for (let b = 0; b < sett.length; b++) {
        const wdt = sett[b][1] * scale
        ctx.fillStyle = pal[sett[b][0]]
        if (horizontal) ctx.fillRect(long0, pos, longLen, wdt)
        else ctx.fillRect(pos, long0, wdt, longLen)
        pos += wdt
      }
    }
    ctx.globalAlpha = 1
  }
  drawAxis(true, 1, driftY, driftX)          // weft (horizontal) — solid, scrolls vertically (Travel)
  drawAxis(false, warpAlpha, driftX, driftY) // warp (vertical) ~50%, scrolls horizontally (Flow)
  ctx.restore()
}
