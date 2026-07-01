// @kol/funcgen — compile a text expression into a fast numeric function.
//
//   compile(expr) -> (t, n, f) => number
//
// Variables available inside an expression:
//   t  — animation clock, seconds
//   n  — index / harmonic number (the variable swept to draw a curve)
//   f  — frame counter
//
// Everything below is injected as a local so expressions read clean:
//   constants : PI TAU PHI E SQRT2 SQRT3 SQRT5 LN2 LN10 DEG FEIGENBAUM
//   raw math  : sin cos tan asin acos atan atan2 sinh cosh tanh
//               abs sign floor ceil round trunc sqrt cbrt exp log log2 log10
//               pow hypot min max
//   helpers   : mod clamp lerp smooth frac
//   oscillators (unit range, compose with explicit scaling):
//               wave(x) saw(x) tri(x) pulse(x,w) ease(x,c) bell(x) step(x,k) rand()
//
// This is the geometry-oriented evolution of the oscilloscope DSL in
// apps/mirror + apps/monitor: index `n` is first-class and `exp`/`log`/`pow`
// are the raw Math versions (not unipolar curve helpers), so expressions like
// `pow(n, 1.5) / (n + 1000)` work as written.

export const CONSTANTS = [
  { name: 'PI', value: Math.PI, label: 'π — 3.14159…' },
  { name: 'TAU', value: Math.PI * 2, label: '2π — 6.28318…' },
  { name: 'PHI', value: 1.618033988749895, label: 'golden ratio φ — 1.61803…' },
  { name: 'E', value: Math.E, label: "Euler's e — 2.71828…" },
  { name: 'SQRT2', value: Math.SQRT2, label: '√2 — 1.41421…' },
  { name: 'SQRT3', value: 1.7320508075688772, label: '√3 — 1.73205…' },
  { name: 'SQRT5', value: 2.23606797749979, label: '√5 — 2.23607…' },
  { name: 'LN2', value: Math.LN2, label: 'ln 2 — 0.69314…' },
  { name: 'LN10', value: Math.LN10, label: 'ln 10 — 2.30258…' },
  { name: 'DEG', value: Math.PI / 180, label: 'degrees → radians' },
  { name: 'FEIGENBAUM', value: 4.66920160910299, label: 'δ — period-doubling' },
]

export const FUNCTIONS = [
  { name: 'sin', label: 'sine' },
  { name: 'cos', label: 'cosine' },
  { name: 'tan', label: 'tangent' },
  { name: 'atan2', label: 'angle of (y, x)' },
  { name: 'abs', label: 'absolute value' },
  { name: 'sign', label: 'sign (-1/0/1)' },
  { name: 'floor', label: 'round down' },
  { name: 'ceil', label: 'round up' },
  { name: 'round', label: 'nearest' },
  { name: 'sqrt', label: '√ square root' },
  { name: 'cbrt', label: '∛ cube root' },
  { name: 'pow', label: 'power(base, exp)' },
  { name: 'exp', label: 'eˣ' },
  { name: 'log', label: 'natural log' },
  { name: 'hypot', label: 'length(x, y)' },
  { name: 'min', label: 'minimum' },
  { name: 'max', label: 'maximum' },
  { name: 'mod', label: 'true modulo(a, b)' },
  { name: 'clamp', label: 'clamp(x, a, b)' },
  { name: 'lerp', label: 'mix(a, b, t)' },
  { name: 'frac', label: 'fractional part' },
  { name: 'wave', label: 'sine 0…1' },
  { name: 'saw', label: 'ramp 0…1' },
  { name: 'tri', label: 'triangle 0…1' },
  { name: 'pulse', label: 'pulse(x, width)' },
  { name: 'ease', label: 'ease(x, curve)' },
  { name: 'bell', label: 'gaussian bump' },
  { name: 'step', label: 'staircase(x, steps)' },
  { name: 'rand', label: 'random 0…1' },
]

const PRELUDE = `
  "use strict";
  var s=t, θ=t, k=n;
  var PI=Math.PI, TAU=6.283185307179586, PHI=1.618033988749895, E=Math.E,
      SQRT2=Math.SQRT2, SQRT3=1.7320508075688772, SQRT5=2.23606797749979,
      LN2=Math.LN2, LN10=Math.LN10, DEG=0.017453292519943295, FEIGENBAUM=4.66920160910299;
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
  function wave(x){return sin(x)*0.5+0.5;}
  function saw(x){return frac(x);}
  function tri(x){var p=frac(x);return p<0.5?p*2:(1-p)*2;}
  function pulse(x,w){w=(w===undefined?0.5:w);return frac(x)<w?1:0;}
  function ease(x,c){c=(c===undefined?2:c);var p=frac(x);var v=p<0.5?p*2:(1-p)*2;return pow(v,c);}
  function bell(x){var p=frac(x);return exp(-pow((p-0.5)*6,2));}
  function step(x,k){k=(k===undefined?4:k);return floor(frac(x)*k)/k;}
  function rand(){return Math.random();}
`

// Every identifier the PRELUDE defines (constants + math fns + helpers) plus the
// bound variables/aliases (t n f s θ k). Any other identifier — `fetch`,
// `constructor`, `window`, a property name after `.` — is not math and is rejected.
const ALLOWED_IDENTS = new Set([
  't', 'n', 'f', 's', 'θ', 'k',
  'PI', 'TAU', 'PHI', 'E', 'SQRT2', 'SQRT3', 'SQRT5', 'LN2', 'LN10', 'DEG', 'FEIGENBAUM',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
  'abs', 'sign', 'floor', 'ceil', 'round', 'trunc', 'sqrt', 'cbrt', 'exp', 'log', 'log2', 'log10',
  'pow', 'hypot', 'min', 'max', 'frac', 'mod', 'clamp', 'lerp', 'smooth',
  'wave', 'saw', 'tri', 'pulse', 'ease', 'bell', 'step', 'rand',
])

// Guard the `new Function` sink. Expressions arrive from shareable URL params
// (`/math/animate?expr=…&x=…&y=…`), so a raw string would be reflected code
// execution; confine it to math syntax + known identifiers. `(?<!\w)` skips the
// `e` in `1e5` exponents but still checks property names after `.`, so
// `sin.constructor(...)` is rejected.
function isSafeExpr(expr) {
  if (/[^\w\s.+\-*/%^(),θ]/.test(expr)) return false
  const ids = expr.match(/(?<!\w)[A-Za-zθ_][\w]*/g) || []
  return ids.every((id) => ALLOWED_IDENTS.has(id))
}

/**
 * Compile an expression string to `(t, n, f) => number`.
 * Returns null if the expression is empty, unsafe, throws, or doesn't yield a
 * number — so callers can fail at edit time instead of mid-animation.
 */
export function compile(expr) {
  if (expr == null || String(expr).trim() === '') return null
  if (!isSafeExpr(String(expr))) return null
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('t', 'n', 'f', `${PRELUDE}return (${expr});`)
    const probe = fn(0, 1, 0) // n=1 avoids log(0)/div-by-zero false negatives
    if (typeof probe !== 'number') return null
    return fn
  } catch {
    return null
  }
}
