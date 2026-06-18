// Compile an expression over named variables into a fast numeric function —
// `compileVars('sin(x)*cos(y)', ['x','y','t']) -> (x,y,t)=>number`. Same raw-math
// prelude as funcgen (sin/cos/exp/log/pow + constants + helpers), but the caller
// names the variables, so it serves the surface (x,y,t) and field (x,y,t) pages.
// Returns null on empty / parse error / non-number (so callers fail at edit time).

const PRELUDE = `
  "use strict";
  var PI=Math.PI, TAU=6.283185307179586, PHI=1.618033988749895, E=Math.E,
      SQRT2=Math.SQRT2, SQRT3=1.7320508075688772, DEG=0.017453292519943295;
  var sin=Math.sin, cos=Math.cos, tan=Math.tan,
      asin=Math.asin, acos=Math.acos, atan=Math.atan, atan2=Math.atan2,
      sinh=Math.sinh, cosh=Math.cosh, tanh=Math.tanh,
      abs=Math.abs, sign=Math.sign, floor=Math.floor, ceil=Math.ceil,
      round=Math.round, trunc=Math.trunc, sqrt=Math.sqrt, cbrt=Math.cbrt,
      exp=Math.exp, log=Math.log, log2=Math.log2, log10=Math.log10,
      pow=Math.pow, hypot=Math.hypot, min=Math.min, max=Math.max;
  function frac(v){return v-floor(v);}
  function mod(a,b){return ((a%b)+b)%b;}
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function lerp(a,b,u){return a+(b-a)*u;}
  function smooth(u){u=clamp(u,0,1);return u*u*(3-2*u);}
`

export function compileVars(expr, args) {
  if (expr == null || String(expr).trim() === '') return null
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...args, `${PRELUDE}return (${expr});`)
    const probe = fn(...args.map(() => 0.5))
    if (typeof probe !== 'number') return null
    return fn
  } catch {
    return null
  }
}
