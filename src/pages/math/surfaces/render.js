// Surfaces category — the two render kinds, lifted verbatim from the old
// SurfacePage / AttractorPage so the consolidated shell draws bit-identically.
// Both are pure: they take the Viewport3D frame args + a plain params object and
// stroke into the 2D context. `morph` (default 0) is the Form-axis time wobble —
// 0 reproduces the original render exactly.

import { resolveRate } from '../../../lib/exprParam.js'
import { hexToRgb } from '../style/mathStyle'

const toRGB = (h) => { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] }
const lerpHex = (a, b, u) => {
  const A = toRGB(a)
  const B = toRGB(b)
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * u)},${Math.round(A[1] + (B[1] - A[1]) * u)},${Math.round(A[2] + (B[2] - A[2]) * u)})`
}

const NB = 18

// z = f(x,y,t) wireframe / filled heightfield + optional contours. Ported from
// SurfacePage.render. Form axis (all default 0 → static render unchanged):
// `morph` = Breathe (height pulse) · `ripple` = a travelling radial wave added to
// z · `fade` = opacity breathe · `formSpeed` = master time-scale for all three.
export function surfaceRender({ ctx, proj, d, t, eye }, p) {
  const { fn, res, mode, contours, low, high, weight, gridColor, gridOpacity, morph = 0, ripple = 0, fade = 0, formSpeed = 1 } = p
  if (!fn) return
  const R = res
  const tf = t * formSpeed
  const D = resolveRate(p.domain, t, 3.2)
  const hs = resolveRate(p.height, t, 1) * (1 + morph * Math.sin(tf * 1.4))
  const xs = new Float64Array(R)
  for (let i = 0; i < R; i++) xs[i] = -D + (2 * D * i) / (R - 1)
  const SX = new Float64Array(R * R)
  const SY = new Float64Array(R * R)
  const Z = new Float64Array(R * R)
  let zmin = Infinity
  let zmax = -Infinity
  for (let j = 0; j < R; j++) {
    const yy = xs[j]
    for (let i = 0; i < R; i++) {
      let z = fn(xs[i], yy, t)
      if (!Number.isFinite(z)) z = 0
      if (ripple) z += ripple * Math.sin(Math.hypot(xs[i], yy) * 2 - tf * 3)
      z *= hs
      const idx = j * R + i
      Z[idx] = z
      const [sx, sy] = proj({ x: xs[i], y: z, z: yy })
      SX[idx] = sx
      SY[idx] = sy
      if (z < zmin) zmin = z
      if (z > zmax) zmax = z
    }
  }
  const span = (zmax - zmin) || 1
  const norm = (z) => (z - zmin) / span

  if (fade) ctx.globalAlpha = 1 - fade * 0.5 * (1 - Math.cos(tf * 2))

  if (mode === 'fill') {
    const quads = []
    for (let j = 0; j < R - 1; j++) {
      for (let i = 0; i < R - 1; i++) {
        const a = j * R + i, b = j * R + i + 1, c = (j + 1) * R + i + 1, e = (j + 1) * R + i
        const h = (Z[a] + Z[b] + Z[c] + Z[e]) / 4
        const dx = (xs[i] + xs[i + 1]) / 2 - eye[0]
        const dy = h - eye[1]
        const dz = (xs[j] + xs[j + 1]) / 2 - eye[2]
        quads.push({ a, b, c, e, h, depth: dx * dx + dy * dy + dz * dz })
      }
    }
    quads.sort((p2, q) => q.depth - p2.depth)
    ctx.lineWidth = 1
    for (const q of quads) {
      ctx.fillStyle = lerpHex(low, high, norm(q.h))
      ctx.strokeStyle = ctx.fillStyle
      ctx.beginPath()
      ctx.moveTo(SX[q.a], SY[q.a]); ctx.lineTo(SX[q.b], SY[q.b]); ctx.lineTo(SX[q.c], SY[q.c]); ctx.lineTo(SX[q.e], SY[q.e]); ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else {
    const buckets = Array.from({ length: NB }, () => [])
    const addSeg = (a, b) => {
      const bk = Math.max(0, Math.min(NB - 1, Math.floor(norm((Z[a] + Z[b]) / 2) * NB)))
      buckets[bk].push(a, b)
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < R - 1; i++) addSeg(j * R + i, j * R + i + 1)
    for (let i = 0; i < R; i++) for (let j = 0; j < R - 1; j++) addSeg(j * R + i, (j + 1) * R + i)
    ctx.lineWidth = resolveRate(weight, t, 1) * d
    ctx.lineJoin = 'round'
    for (let b = 0; b < NB; b++) {
      const seg = buckets[b]
      if (!seg.length) continue
      ctx.strokeStyle = lerpHex(low, high, b / (NB - 1))
      ctx.beginPath()
      for (let s = 0; s < seg.length; s += 2) { ctx.moveTo(SX[seg[s]], SY[seg[s]]); ctx.lineTo(SX[seg[s + 1]], SY[seg[s + 1]]) }
      ctx.stroke()
    }
  }

  if (contours) {
    const NL = 10
    ctx.lineWidth = Math.max(1, d)
    ctx.strokeStyle = `rgba(${hexToRgb(gridColor)},${Math.min(1, gridOpacity * 3 + 0.2)})`
    ctx.beginPath()
    for (let l = 1; l < NL; l++) {
      const level = zmin + (span * l) / NL
      for (let j = 0; j < R - 1; j++) {
        for (let i = 0; i < R - 1; i++) {
          const idx = [j * R + i, j * R + i + 1, (j + 1) * R + i + 1, (j + 1) * R + i]
          const hh = idx.map((k) => Z[k])
          const cr = []
          for (let e = 0; e < 4; e++) {
            const ha = hh[e]
            const hb = hh[(e + 1) % 4]
            if ((ha - level) * (hb - level) < 0) {
              const tt = (level - ha) / (hb - ha)
              const ka = idx[e]
              const kb = idx[(e + 1) % 4]
              cr.push([SX[ka] + (SX[kb] - SX[ka]) * tt, SY[ka] + (SY[kb] - SY[ka]) * tt])
            }
          }
          if (cr.length >= 2) { ctx.moveTo(cr[0][0], cr[0][1]); ctx.lineTo(cr[1][0], cr[1][1]) }
        }
      }
    }
    ctx.stroke()
  }

  if (fade) ctx.globalAlpha = 1
}

// Strange-attractor polyline. Ported from AttractorPage.render; `morph` breathes
// the stroke weight in place (Form axis). `pts` is the precomputed centered
// trajectory. Glow removed (shadowBlur tanked FPS — same call the Fourier scope made).
export function attractorRender({ ctx, proj, d, t }, p) {
  const { pts, playing, weight, stroke, gradient, morph = 0, fade = 0, formSpeed = 1, drawSeconds = 14 } = p
  if (!pts || !pts.length) return
  const N = pts.length
  const tf = t * formSpeed
  const count = playing
    ? Math.max(1, Math.floor(Math.min(1, t / drawSeconds) * (N - 1)))
    : N - 1
  ctx.lineWidth = Math.max(0.3, resolveRate(weight, t, 1.1) * (1 + morph * 0.6 * Math.sin(tf * 2))) * d
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (fade) ctx.globalAlpha = 1 - fade * 0.5 * (1 - Math.cos(tf * 2))
  if (gradient) {
    const NBANDS = 24
    for (let b = 0; b < NBANDS; b++) {
      const i0 = Math.floor((b / NBANDS) * count)
      const i1 = Math.floor(((b + 1) / NBANDS) * count)
      if (i1 <= i0) continue
      ctx.strokeStyle = `hsl(${200 + (b / NBANDS) * 200}, 72%, 62%)`
      ctx.beginPath()
      for (let i = i0; i <= i1; i++) {
        const [x, y] = proj(pts[i])
        if (i === i0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = stroke
    ctx.beginPath()
    for (let i = 0; i <= count; i++) {
      const [x, y] = proj(pts[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  if (fade) ctx.globalAlpha = 1
  if (playing) {
    const [hx, hy] = proj(pts[count])
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(hx, hy, Math.max(2, d * 1.8), 0, Math.PI * 2)
    ctx.fill()
  }
}
