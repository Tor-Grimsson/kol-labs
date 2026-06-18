// Strange attractors — continuous ODE systems integrated (RK4) into a 3D
// trajectory. Each is `deriv([x,y,z]) -> [dx,dy,dz]` plus an init point, step
// size and a default colour. The page draws the polyline (progressively when
// playing). A warm-up discards the transient from the init point onto the
// attractor before collecting.

export const ATTRACTORS = [
  {
    id: 'lorenz', label: 'Lorenz', color: '#9ec1ff',
    init: [0.01, 0, 0], dt: 0.006,
    deriv: ([x, y, z]) => { const s = 10, r = 28, b = 8 / 3; return [s * (y - x), x * (r - z) - y, x * y - b * z] },
  },
  {
    id: 'rossler', label: 'Rössler', color: '#ffd23f',
    init: [0.1, 0, 0], dt: 0.02,
    deriv: ([x, y, z]) => { const a = 0.2, b = 0.2, c = 5.7; return [-y - z, x + a * y, b + z * (x - c)] },
  },
  {
    id: 'aizawa', label: 'Aizawa', color: '#ff5470',
    init: [0.1, 0, 0], dt: 0.01,
    deriv: ([x, y, z]) => {
      const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1
      return [(z - b) * x - d * y, d * x + (z - b) * y, c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x]
    },
  },
  {
    id: 'thomas', label: 'Thomas', color: '#c9f29b',
    init: [0.1, 0, 0], dt: 0.04,
    deriv: ([x, y, z]) => { const b = 0.208186; return [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z] },
  },
  {
    id: 'halvorsen', label: 'Halvorsen', color: '#b8a6ff',
    init: [-1.48, -1.51, 2.04], dt: 0.008,
    deriv: ([x, y, z]) => {
      const a = 1.89
      return [-a * x - 4 * y - 4 * z - y * y, -a * y - 4 * z - 4 * x - z * z, -a * z - 4 * x - 4 * y - x * x]
    },
  },
]
export const DEFAULT_ATTRACTOR = ATTRACTORS[0]

const rk4 = (f, p, dt) => {
  const k1 = f(p)
  const k2 = f([p[0] + k1[0] * dt / 2, p[1] + k1[1] * dt / 2, p[2] + k1[2] * dt / 2])
  const k3 = f([p[0] + k2[0] * dt / 2, p[1] + k2[1] * dt / 2, p[2] + k2[2] * dt / 2])
  const k4 = f([p[0] + k3[0] * dt, p[1] + k3[1] * dt, p[2] + k3[2] * dt])
  return [
    p[0] + (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * dt / 6,
    p[1] + (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * dt / 6,
    p[2] + (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) * dt / 6,
  ]
}

// RK4-integrate into centered points + maxExtent (for the camera auto-fit).
export function integrate(att, steps, dt = att.dt, warm = 600) {
  const f = att.deriv
  let p = att.init.slice()
  for (let i = 0; i < warm; i++) p = rk4(f, p, dt) // discard the transient
  const pts = []
  for (let i = 0; i < steps; i++) { p = rk4(f, p, dt); pts.push({ x: p[0], y: p[1], z: p[2] }) }

  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity
  for (const q of pts) {
    if (q.x < minx) minx = q.x; if (q.y < miny) miny = q.y; if (q.z < minz) minz = q.z
    if (q.x > maxx) maxx = q.x; if (q.y > maxy) maxy = q.y; if (q.z > maxz) maxz = q.z
  }
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, cz = (minz + maxz) / 2
  let ext = 1e-6
  for (const q of pts) {
    q.x -= cx; q.y -= cy; q.z -= cz
    const e = Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z))
    if (e > ext) ext = e
  }
  return { pts, ext }
}
