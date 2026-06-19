// exprParam — let a slider's number box hold a time-expression instead of a
// number, so any param can animate without keyframes (TouchDesigner-style).
//
//   evalExpr("t*0.1", t) -> number
//   resolveParams({ rot: "t*30", size: 8 }, t) -> { rot: <t*30>, size: 8 }
//
// The only variable is `t` (the engine's playhead, in seconds). Because `t` is
// the transport playhead — not a wall clock — expression motion pauses, scrubs
// and tempo-scales with the existing controls for free.
//
// Grammar mirrors src/pages/math/uzumaki/lib/funcgen.js (kept self-contained so
// this stays a foundational lib with no PAGE import — audioSource is a sibling lib):
//   constants  : PI TAU PHI E SQRT2 SQRT3 SQRT5 LN2 LN10 DEG
//   raw math   : sin cos tan asin acos atan atan2 sinh cosh tanh
//                abs sign floor ceil round trunc sqrt cbrt exp log log2 log10
//                pow hypot min max
//   helpers    : frac mod clamp lerp smooth
//   oscillators (0…1, scale explicitly): wave saw tri pulse ease bell step rand
//   audio (0…1, 0 when off): level bass mid high  — e.g. `bass*2`, `t*0.1+level`

import { readAudio } from './audioSource.js'

const ZERO_AUDIO = { level: 0, bass: 0, mid: 0, high: 0 }

const PRELUDE = `
  "use strict";
  var s=t, time=t;
  var level=+a.level||0, bass=+a.bass||0, mid=+a.mid||0, high=+a.high||0;
  var PI=Math.PI, TAU=6.283185307179586, PHI=1.618033988749895, E=Math.E,
      SQRT2=Math.SQRT2, SQRT3=1.7320508075688772, SQRT5=2.23606797749979,
      LN2=Math.LN2, LN10=Math.LN10, DEG=0.017453292519943295;
  var sin=Math.sin, cos=Math.cos, tan=Math.tan,
      asin=Math.asin, acos=Math.acos, atan=Math.atan, atan2=Math.atan2,
      sinh=Math.sinh, cosh=Math.cosh, tanh=Math.tanh,
      abs=Math.abs, sign=Math.sign, floor=Math.floor, ceil=Math.ceil,
      round=Math.round, trunc=Math.trunc, sqrt=Math.sqrt, cbrt=Math.cbrt,
      exp=Math.exp, log=Math.log, log2=Math.log2, log10=Math.log10,
      pow=Math.pow, hypot=Math.hypot, min=Math.min, max=Math.max;
  function frac(x){return x-floor(x);}
  function mod(a,b){return ((a%b)+b)%b;}
  function clamp(x,a,b){return x<a?a:(x>b?b:x);}
  function lerp(a,b,u){return a+(b-a)*u;}
  function smooth(u){u=clamp(u,0,1);return u*u*(3-2*u);}
  function wave(x){return sin(x*TAU)*0.5+0.5;}
  function saw(x){return frac(x);}
  function tri(x){var p=frac(x);return p<0.5?p*2:(1-p)*2;}
  function pulse(x,w){w=(w===undefined?0.5:w);return frac(x)<w?1:0;}
  function ease(x,c){c=(c===undefined?2:c);var p=frac(x);var v=p<0.5?p*2:(1-p)*2;return pow(v,c);}
  function bell(x){var p=frac(x);return exp(-pow((p-0.5)*6,2));}
  function step(x,k){k=(k===undefined?4:k);return floor(frac(x)*k)/k;}
  function rand(){return Math.random();}
`

const cache = new Map()

/**
 * Is this param value an expression (a string that isn't just a number)?
 * Numeric strings ("0.5") are NOT expressions — they're plain values.
 */
export function isExpr(v) {
  return typeof v === 'string' && v.trim() !== '' && !Number.isFinite(Number(v))
}

/**
 * Compile an expression string to `(t) => number`. Cached by string.
 * Returns { ok, fn }. `ok` is false on a compile (syntax) error.
 * `fn` never throws: runtime errors / non-finite results yield the last good
 * value for this expression, or 0 if there isn't one yet.
 */
export function compileExprParam(str) {
  const key = String(str)
  const hit = cache.get(key)
  if (hit) return hit

  let entry
  try {
    // `a` carries the live audio bands (level/bass/mid/high); see PRELUDE.
    // eslint-disable-next-line no-new-func
    const raw = new Function('t', 'a', `${PRELUDE}return (${str});`)
    // Probe at t=1 with silent audio: rejects strings that LOOK like expressions
    // but aren't real numeric ones — "#fff" (syntax error, caught below) and "red"
    // (undefined ref → throws here) both fall through to ok:false, so colors
    // / enums / text pass through resolveParams untouched.
    const probe = raw(1, ZERO_AUDIO)
    if (typeof probe !== 'number') throw new Error('not numeric')
    let last = 0
    entry = {
      ok: true,
      fn: (t, a = ZERO_AUDIO) => {
        try {
          const v = raw(t, a)
          if (typeof v === 'number' && Number.isFinite(v)) { last = v; return v }
          return last
        } catch {
          return last
        }
      },
    }
  } catch {
    entry = { ok: false, fn: () => 0 }
  }
  cache.set(key, entry)
  return entry
}

/** True if `str` is a syntactically valid expression. */
export function isValidExpr(str) {
  return compileExprParam(str).ok
}

const AUDIO_RE = /\b(level|bass|mid|high)\b/
/** True if the expression references an audio band — so a consumer can re-eval
 *  it off the live mic even when the transport clock is paused. */
export function referencesAudio(str) {
  return typeof str === 'string' && AUDIO_RE.test(str)
}

/**
 * Round a numeric value, but pass an expression string through untouched.
 * Use in slider onChange wrappers that previously did `Math.round(v)` — so an
 * integer param can still accept an expression without `Math.round` → NaN.
 */
export function roundIfNum(v) {
  return isExpr(v) ? v : Math.round(v)
}

/** Evaluate a single expression at time `t` (seconds). Safe; never throws.
 *  `a` defaults to the live audio bands so `bass`/`mid`/`high`/`level` resolve
 *  in scope with no call-site change. */
export function evalExpr(str, t, a = readAudio()) {
  return compileExprParam(str).fn(t, a)
}

/**
 * True if any field of `params` is a REAL (valid) numeric expression. Colors /
 * enums / half-typed strings don't count — so engines only pay the per-frame
 * re-resolve cost when there's actually something to animate.
 */
export function hasExpr(params) {
  if (!params || typeof params !== 'object') return false
  for (const k in params) { const v = params[k]; if (isExpr(v) && isValidExpr(v)) return true }
  return false
}

/**
 * Resolve a value that drives a TIME accumulator (e.g. speed/tempo). Guarantees
 * a finite number: an invalid/half-typed expression falls back to `dflt` (so the
 * engine keeps moving instead of freezing or going NaN). A valid expression that
 * genuinely evaluates to 0 still returns 0.
 */
export function resolveRate(v, t, dflt = 1, a = readAudio()) {
  if (isExpr(v)) {
    if (!isValidExpr(v)) return dflt
    const r = evalExpr(v, t, a)
    return Number.isFinite(r) ? r : dflt
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : dflt
}

/**
 * Return a copy of `params` with every expression-valued field evaluated at
 * time `t`. Non-expression fields pass through untouched. Allocates a new
 * object only when at least one field is an expression, so the no-expression
 * case is zero-cost.
 */
export function resolveParams(params, t, a = readAudio()) {
  if (!params || typeof params !== 'object') return params
  let out = null
  for (const k in params) {
    const v = params[k]
    if (isExpr(v)) {
      const c = compileExprParam(v)
      if (!c.ok) continue // color / enum / half-typed expr — leave untouched
      if (!out) out = Array.isArray(params) ? params.slice() : { ...params }
      out[k] = c.fn(t, a)
    }
  }
  return out || params
}

/**
 * Like resolveParams but recurses into nested objects/arrays — for engines whose
 * params hold sub-objects (e.g. moiré's `grids: [{ freq, angle, … }]`). Allocates
 * a new container only along branches that actually contain an expression, so the
 * no-expression case returns the same reference (zero-cost).
 */
export function resolveDeep(value, t, a = readAudio()) {
  if (typeof value === 'string') {
    if (!isExpr(value)) return value
    const c = compileExprParam(value)
    return c.ok ? c.fn(t, a) : value
  }
  if (Array.isArray(value)) {
    let out = null
    for (let i = 0; i < value.length; i++) {
      const r = resolveDeep(value[i], t, a)
      if (r !== value[i]) { if (!out) out = value.slice(); out[i] = r }
    }
    return out || value
  }
  if (value && typeof value === 'object') {
    let out = null
    for (const k in value) {
      const r = resolveDeep(value[k], t, a)
      if (r !== value[k]) { if (!out) out = { ...value }; out[k] = r }
    }
    return out || value
  }
  return value
}

/** True if any string anywhere in the tree references an audio band — so a
 *  consumer can keep its render loop alive (off the mic) while paused. */
export function treeReferencesAudio(value) {
  if (typeof value === 'string') return referencesAudio(value)
  if (Array.isArray(value)) return value.some((v) => treeReferencesAudio(v))
  if (value && typeof value === 'object') {
    for (const k in value) if (treeReferencesAudio(value[k])) return true
  }
  return false
}
