// Shared orbit-camera math: spherical (yaw, pitch, dist) → cartesian eye.
// yaw/pitch in RADIANS, dist in world units, optional target offset (default
// origin). y-up: yaw rotates around y, pitch lifts toward +y. This is the one
// place the eye formula lives — used by the uzumaki camera (hand-rolled
// projector, degrees → converts before calling) and the radar Scan engine
// (three.js camera, already radians).
export function orbitEye(yaw, pitch, dist, target = [0, 0, 0]) {
  const cp = Math.cos(pitch)
  return [
    target[0] + dist * cp * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * cp * Math.cos(yaw),
  ]
}
