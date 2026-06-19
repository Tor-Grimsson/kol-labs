// Thread Spinner model (after polyhop's "Thread Spinner"). A dozen-ish balls each
// ride a BIG looping orbit that spans the frame — a two-vector epicycle (a primary
// rotation + a secondary one at a near-integer frequency ratio), giving smooth
// ovals / figure-8s / trefoils. Each loop is drawn as a glowing thread the ball
// rides. The ratio is detuned slightly off the integer (`drift`), so the loop never
// exactly closes — it precesses and fills space over time = the entropy build.
// At t≈0 the balls are evenly phased ⇒ a clean, ordered start; small drift ⇒ they
// fan apart gently, "out of order but not drastically".
//
// Pure + DOM-free: a closed-form function of t, so the renderer can fast-forward
// for showcase stills and node can verify the mechanic.

import { mulberry32 } from '../../../../lib/rng.js'

const TAU = Math.PI * 2
// Second-vector frequency ratios → the loop's shape (oval / clover / figure-8…).
const RATIOS = [2, -2, 3, -3, 2, -1, 3, -2]

export function makeSpinner(opts = {}, seed = 1) {
  const rng = mulberry32((seed ?? 1) >>> 0)
  const count = Math.max(1, Math.round(opts.count ?? 12))
  const drift = opts.drift ?? 0.05 // detune from the integer ratio ⇒ slow precession
  const span = opts.span ?? 1 // loop-size multiplier

  const balls = []
  for (let i = 0; i < count; i++) {
    const a1 = (0.36 + rng() * 0.14) * span // primary loop radius (fraction of reach)
    const a2 = (0.18 + rng() * 0.16) * span // secondary vector ⇒ the loop's character
    const dir = rng() < 0.5 ? 1 : -1
    const w1 = dir * (0.85 + rng() * 0.3) // base orbit speed (gentle spread ⇒ slow relative drift)
    const ratio = RATIOS[i % RATIOS.length]
    const detune = drift * (rng() - 0.5) * 2 // near-integer ⇒ the loop slowly precesses
    const w2 = w1 * (ratio + detune)
    const p1 = (i / count) * TAU // evenly phased ⇒ ordered start
    const p2 = rng() * TAU
    balls.push({ a1, a2, w1, w2, p1, p2, hue: (i / count) * 360, px: 0, py: 0, started: false })
  }
  return balls
}

// Ball position at time t, scaled to canvas: centre (cx,cy), `reach` = px of the
// half-frame the loops fill.
export function ballPos(b, t, cx, cy, reach) {
  const x = b.a1 * Math.cos(b.w1 * t + b.p1) + b.a2 * Math.cos(b.w2 * t + b.p2)
  const y = b.a1 * Math.sin(b.w1 * t + b.p1) + b.a2 * Math.sin(b.w2 * t + b.p2)
  return [cx + x * reach, cy + y * reach]
}

export { TAU }
