/* Path-string transformations: 15 Illustrator warps + 5 Distort & Transform.
 *
 * Each transform is `(d, params) → d`. They work on SVG path strings via
 * warpjs, which flattens curves first via `interpolate(threshold)` so the
 * displacement actually shows along curves.
 *
 * Warps map normalized (u,v) ∈ [-0.5, 0.5]² to displaced (u',v').
 * They use the path's bounding box to normalize and then re-scale.
 *
 * NOTE: warpjs is small and unmaintained (since 2017) but does the right
 * job — interpolate paths then apply a per-point displacement callback. */

import Warp from 'warpjs'
import SVGPathCommander from 'svg-path-commander'
import { clamp, smoothstep, rng } from '../math.js'

/* Convert any path-d string to an SVG element, run warpjs over it, return
 * the resulting `d`. */
function applyWarp(d, displaceFn, { flatten = 4 } = {}) {
  try {
    const svgNS = 'http://www.w3.org/2000/svg'
    const tmp = document.createElementNS(svgNS, 'svg')
    const path = document.createElementNS(svgNS, 'path')
    /* Normalize all relative commands to absolute (warpjs requires it). */
    const normalized = new SVGPathCommander(d).toAbsolute().toString()
    path.setAttribute('d', normalized)
    tmp.appendChild(path)
    const warp = new Warp(tmp)
    warp.interpolate(flatten)
    warp.transform(displaceFn)
    return path.getAttribute('d')
  } catch {
    return d
  }
}

/* Compute bbox of a path string. */
function bboxOf(d) {
  try {
    return new SVGPathCommander(d).getBBox()
  } catch {
    return { x: 0, y: 0, x2: 100, y2: 100, width: 100, height: 100 }
  }
}

/* Wrap a displace-uv function: callback receives bbox-normalized (u,v) ∈ [-0.5, 0.5]
 * and returns [u', v']. We compose into the (x,y) → (x',y') signature that
 * warpjs expects. */
function withNormalizedUV(d, fn) {
  const bb = bboxOf(d)
  const w = bb.width || 1
  const h = bb.height || 1
  const cx = bb.x + w / 2
  const cy = bb.y + h / 2
  return ([x, y]) => {
    const u = (x - cx) / w
    const v = (y - cy) / h
    const [up, vp] = fn(u, v)
    return [cx + up * w, cy + vp * h]
  }
}

/* ── 15 Illustrator-style warps ─────────────────────────────────────── */

export const WARPS = {
  arc: (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + (Math.cos(u * Math.PI * bend) - 1) * 0.4])),
  arcUpper: (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + (v + 0.5) * bend * Math.cos(Math.PI * u)])),
  arcLower: (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + (0.5 - v) * bend * Math.cos(Math.PI * u)])),
  arch:     (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + bend * (1 - 4 * u * u)])),
  bulge:    (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u * (1 + bend * (1 - 4 * v * v)), v * (1 + bend * (1 - 4 * u * u))])),
  shellUpper: (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + (v + 0.5) * bend * (1 - 4 * u * u)])),
  shellLower: (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + (0.5 - v) * bend * (1 - 4 * u * u)])),
  flag:     (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + bend * Math.sin(2 * Math.PI * u)])),
  wave:     (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + bend * Math.sin(2 * Math.PI * u + Math.PI / 2)])),
  fish:     (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v * (1 + bend * (1 - 4 * u * u))])),
  rise:     (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u, v + bend * smoothstep(0, 1, u + 0.5)])),
  fishEye:  (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => {
    const r = Math.sqrt(u * u + v * v)
    const factor = 1 + bend * (1 - r * 2)
    return [u * factor, v * factor]
  })),
  inflate:  (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u * (1 + bend * 0.5), v + bend * (1 - 4 * u * u) * Math.sign(v) * 0.5])),
  squeeze:  (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => [u * (1 + bend * (1 - 4 * u * u) * 0.3), v * (1 - bend * (1 - 4 * u * u))])),
  twist:    (d, { bend = 0 } = {}) => applyWarp(d, withNormalizedUV(d, (u, v) => {
    const angle = bend * Math.PI * (1 - 2 * Math.abs(v))
    return [u * Math.cos(angle) - v * Math.sin(angle), u * Math.sin(angle) + v * Math.cos(angle)]
  })),
}

export const WARP_OPTIONS = [
  { value: 'none',       label: 'none' },
  { value: 'arc',        label: 'arc' },
  { value: 'arcUpper',   label: 'arc upper' },
  { value: 'arcLower',   label: 'arc lower' },
  { value: 'arch',       label: 'arch' },
  { value: 'bulge',      label: 'bulge' },
  { value: 'shellUpper', label: 'shell upper' },
  { value: 'shellLower', label: 'shell lower' },
  { value: 'flag',       label: 'flag' },
  { value: 'wave',       label: 'wave' },
  { value: 'fish',       label: 'fish' },
  { value: 'rise',       label: 'rise' },
  { value: 'fishEye',    label: 'fish eye' },
  { value: 'inflate',    label: 'inflate' },
  { value: 'squeeze',    label: 'squeeze' },
  { value: 'twist',      label: 'twist' },
]

/* ── Distort & Transform (5) ───────────────────────────────────────── */

export const DISTORTS = {
  roughen: (d, { size = 0.04, amount = 0, seed = 1 } = {}) => {
    if (amount === 0) return d
    const r = rng(seed | 0)
    const bb = bboxOf(d)
    const amp = amount * Math.max(bb.width, bb.height) * 0.1
    return applyWarp(d, ([x, y]) => [x + (r() - 0.5) * amp, y + (r() - 0.5) * amp], { flatten: Math.max(2, 8 * (1 - size)) })
  },
  tweak: (d, { anchor = 0, handle = 0, seed = 2 } = {}) => {
    if (anchor === 0 && handle === 0) return d
    const r = rng(seed | 0)
    const bb = bboxOf(d)
    const amp = (anchor + handle) * Math.max(bb.width, bb.height) * 0.05
    return applyWarp(d, ([x, y]) => [x + (r() - 0.5) * amp, y + (r() - 0.5) * amp], { flatten: 12 })
  },
  puckerBloat: (d, { amount = 0 } = {}) => {
    if (amount === 0) return d
    return applyWarp(d, withNormalizedUV(d, (u, v) => {
      const factor = amount * 0.5
      return [u + u * factor, v + v * factor]
    }))
  },
  zigZag: (d, { size = 0.1, ridges = 4 } = {}) => {
    if (size === 0) return d
    return applyWarp(d, withNormalizedUV(d, (u, v) => {
      const k = Math.sin(2 * Math.PI * ridges * u) * size
      return [u, v + k]
    }))
  },
  freeDistort: (d, { p00 = [-0.5,-0.5], p10 = [0.5,-0.5], p01 = [-0.5,0.5], p11 = [0.5,0.5] } = {}) => {
    return applyWarp(d, withNormalizedUV(d, (u, v) => {
      const uu = u + 0.5
      const vv = v + 0.5
      const x = (1-uu)*(1-vv)*p00[0] + uu*(1-vv)*p10[0] + (1-uu)*vv*p01[0] + uu*vv*p11[0]
      const y = (1-uu)*(1-vv)*p00[1] + uu*(1-vv)*p10[1] + (1-uu)*vv*p01[1] + uu*vv*p11[1]
      return [x, y]
    }))
  },
}

/* Compose a chain of (d) → d transforms. */
export function chainTransforms(d, ops) {
  return ops.reduce((acc, op) => op(acc), d)
}

/* Affine transform string for CSS or SVG `transform=` attribute. */
export function affineTransform({ rotate = 0, scaleX = 1, scaleY = 1, skewX = 0, skewY = 0, tx = 0, ty = 0 } = {}) {
  /* Order: translate → rotate → skew → scale; visual-natural for type. */
  return `translate(${tx} ${ty}) rotate(${rotate}) skewX(${skewX}) skewY(${skewY}) scale(${scaleX} ${scaleY})`
}

/* Clamp warp bend so users don't push so far that the path collapses. */
export const clampBend = (v) => clamp(v, -1, 1)
