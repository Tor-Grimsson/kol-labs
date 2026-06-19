// Orbital n-body sim for the trails toy. A heavy mass at the origin holds the
// bodies in (precessing) orbits; an optional weak mutual attraction makes the
// cluster breathe/tangle. Coords are normalized ~[-1,1]; the page maps to px.
// Stable bounded orbits depend on the initial speed vs gravity — calibrate live.

const SOFT = 0.02 // softening so the central singularity can't blow up dt

export function makeBodies(n, rng) {
  const bodies = []
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2
    const r = 0.16 + rng() * 0.34
    const speed = 0.7 + rng() * 0.7
    bodies.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      // velocity ⟂ radius → orbit; scaled by r so inner bodies aren't too fast
      vx: -Math.sin(a) * speed * r,
      vy: Math.cos(a) * speed * r,
      hue: Math.floor(rng() * 360),
    })
  }
  return bodies
}

// One leapfrog-ish step: accumulate accelerations, then integrate.
export function stepBodies(bodies, { gravity, mutual, dt }) {
  for (const b of bodies) {
    const d2 = b.x * b.x + b.y * b.y + SOFT
    const f = -gravity / (d2 * Math.sqrt(d2)) // central inverse-square, toward origin
    let ax = f * b.x
    let ay = f * b.y
    if (mutual) {
      for (const o of bodies) {
        if (o === b) continue
        const dx = o.x - b.x
        const dy = o.y - b.y
        const dd = dx * dx + dy * dy + SOFT
        const ff = (gravity * 0.04) / (dd * Math.sqrt(dd))
        ax += ff * dx
        ay += ff * dy
      }
    }
    b.vx += ax * dt
    b.vy += ay * dt
  }
  for (const b of bodies) {
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
}
