import { hexToRgb } from '../style/mathStyle'

// Reference axes / grid / bounding box in 3D, projected through `proj`. Shared by
// Viewport3D (attractor, surface) and CurvePlayer (uzumaki/animate) — generalises
// the old uzumaki drawOrigin. `style` = { axis, gridColor, gridOpacity, plane,
// space }; `ext` is the figure half-extent.
export function drawAxes3D(ctx, proj, ext, d, style) {
  const { axis, gridColor = '#ffffff', gridOpacity = 0.1, plane = 'xz', space = '3D' } = style || {}
  if (!axis || axis === 'none') return
  const rgb = hexToRgb(gridColor)
  const L = ext
  ctx.lineWidth = Math.max(1, d * 0.6)
  const P = (x, y, z) => ({ x, y, z })
  const seg = (a, b, alpha) => {
    const [ax, ay] = proj(a)
    const [bx, by] = proj(b)
    ctx.strokeStyle = `rgba(${rgb},${alpha})`
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }

  if (axis === 'axes') {
    const a = Math.min(1, gridOpacity * 3)
    seg(P(-L, 0, 0), P(L, 0, 0), a)
    seg(P(0, -L, 0), P(0, L, 0), a)
    if (space === '3D') seg(P(0, 0, -L), P(0, 0, L), a)
  } else if (axis === 'grid') {
    const N = 8
    for (let i = -N; i <= N; i++) {
      const t = (i / N) * L
      if (plane === 'xy') {
        seg(P(t, -L, 0), P(t, L, 0), gridOpacity)
        seg(P(-L, t, 0), P(L, t, 0), gridOpacity)
      } else {
        seg(P(t, 0, -L), P(t, 0, L), gridOpacity)
        seg(P(-L, 0, t), P(L, 0, t), gridOpacity)
      }
    }
  } else if (axis === 'box') {
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map((c) => P(c[0] * L, c[1] * L, c[2] * L))
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    for (const [a, b] of E) seg(v[a], v[b], Math.min(1, gridOpacity * 1.5))
  }
}
