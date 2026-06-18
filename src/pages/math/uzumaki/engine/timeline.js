import { EASE } from '../../../../lib/easing.js'
import { resolveCam, catmull } from './camera'

export function totalDuration(tl) {
  return tl[tl.length - 1].at || 1
}

// Walk the keyframe timeline at time t. Returns { draw, cam } where cam is a
// resolved camera state { eye, target, zoom }. The eye + target fly a
// Catmull-Rom spline PATH through the keyframed positions (eased per segment) —
// a real camera following a path, not a value being lerped.
export function sampleTimeline(tl, t, ext) {
  const n = tl.length
  const states = tl.map((kf) => resolveCam(kf.cam, ext))
  if (n < 2 || t <= tl[0].at) return { draw: tl[0].draw, cam: states[0] }

  for (let i = 0; i < n - 1; i++) {
    const a = tl[i]
    const b = tl[i + 1]
    if (t <= b.at) {
      const span = Math.max(1e-6, b.at - a.at)
      const u = (EASE[b.ease] || EASE.inout)((t - a.at) / span)
      const i0 = Math.max(0, i - 1)
      const i3 = Math.min(n - 1, i + 2)
      const eye = catmull(states[i0].eye, states[i].eye, states[i + 1].eye, states[i3].eye, u)
      const target = catmull(
        states[i0].target,
        states[i].target,
        states[i + 1].target,
        states[i3].target,
        u,
      )
      const zoom = states[i].zoom + (states[i + 1].zoom - states[i].zoom) * u
      const draw = a.draw + (b.draw - a.draw) * u
      return { draw, cam: { eye, target, zoom } }
    }
  }
  return { draw: tl[n - 1].draw, cam: states[n - 1] }
}
