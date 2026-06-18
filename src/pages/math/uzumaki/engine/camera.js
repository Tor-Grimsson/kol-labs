// A real camera as a 3D entity: a position (eye) in world space, a look-at
// target (the focal function, default origin), an up vector and a lens. This is
// the foundation the timeline editor sits on — camera keyframes are camera
// STATES (eye + target + lens) at times, and between them the eye flies a
// Catmull-Rom spline PATH while framing the subject.
//
// Kept deliberately light (hand-rolled vectors + lookAt + perspective, no
// three.js). The data model — eye/target/lens keyframes on a spline — is
// renderer-agnostic, so a richer authoring renderer can be swapped in later.

import { orbitEye } from '../../../../lib/orbit.js'

const DEG = Math.PI / 180

export const v = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
  },
}

// Catmull-Rom: smooth position between p1→p2 using neighbours p0,p3 (t in 0..1).
export function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  const out = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    out[i] =
      0.5 *
      (2 * p1[i] +
        (-p0[i] + p2[i]) * t +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)
  }
  return out
}

// A keyframe camera → a concrete state { eye, target, zoom }.
// Authoring shorthand: orbit the focus by yaw/pitch at `dist` (× extent), OR
// give an explicit `eye` (and `target`) for a free path.
export function resolveCam(cam, ext) {
  const target = cam.target || [0, 0, 0]
  const zoom = cam.zoom || 1
  if (cam.eye) return { eye: cam.eye, target, zoom }
  const dist = (cam.dist || 3.0) * ext
  const yaw = (cam.yaw || 0) * DEG
  const pitch = (cam.pitch || 0) * DEG
  return { eye: orbitEye(yaw, pitch, dist, target), target, zoom }
}

// Build a world-point → [screenX, screenY] projector for a camera state.
// Real lookAt basis + perspective divide; auto-fits the figure's extent.
export function projector(camState, W, H, ext) {
  const eye = camState.eye
  const target = camState.target
  const zoom = camState.zoom || 1
  const up = [0, 1, 0]
  const forward = v.norm(v.sub(target, eye))
  let right = v.cross(forward, up)
  if (v.len(right) < 1e-6) right = [1, 0, 0]
  right = v.norm(right)
  const camUp = v.cross(right, forward)
  const dist = v.len(v.sub(target, eye)) || 1
  const f = 2.0 // focal — ~53° fov, enough perspective to read depth
  // auto-fit: a point at radius `ext` near the focus fills ~0.4 of the frame
  const k = (0.4 * Math.min(W, H) * dist) / (Math.max(1e-6, ext) * f) * zoom
  const cx = W / 2
  const cy = H / 2
  const minZ = dist * 0.05
  return (p) => {
    const rx = p.x - eye[0]
    const ry = p.y - eye[1]
    const rz = p.z - eye[2]
    const x = rx * right[0] + ry * right[1] + rz * right[2]
    const y = rx * camUp[0] + ry * camUp[1] + rz * camUp[2]
    let z = rx * forward[0] + ry * forward[1] + rz * forward[2]
    if (z < minZ) z = minZ
    const s = (f * k) / z
    return [cx + x * s, cy - y * s]
  }
}
