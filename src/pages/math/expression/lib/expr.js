// Oscilloscope expression evaluator — a hand-rolled `new Function()` compiler
// ported from kol-mirror / kol-monitor. The wave helpers are UNIPOLAR: they
// scale 0→max, so a bare `wave(t)` / `saw(t)` / `ease(t)` reads 0–100 against
// the knob range (matching the red 0/100 reference lines on the scope).
//
// Distinct from uzumaki's funcgen (geometry-oriented: t/θ/k/n, raw exp/log/pow).
// The two engines intentionally coexist — different variable sets and scaling.
//
//   compile(expr) -> (t, f, min, max, __bus) => number   (null on parse error)

const MATH_HELPERS = `
  var sin=Math.sin,cos=Math.cos,abs=Math.abs,floor=Math.floor,ceil=Math.ceil,
      round=Math.round,sqrt=Math.sqrt,pow=Math.pow,PI=Math.PI,PHI=1.618033988749895,
      wave=function(x){return(sin(x)*0.5+0.5)*max},
      saw=function(x){return(x%1)*max},
      pulse=function(x,w){w=w||0.5;var p=((x%1)+1)%1;return p<w?max:0},
      rand=function(){return Math.random()*max},
      tri=function(x){var p=((x%1)+1)%1;return(p<0.5?p*2:(1-p)*2)*max},
      ease=function(x,c){c=c||2;var p=((x%1)+1)%1;var v=p<0.5?p*2:(1-p)*2;return pow(v,c)*max},
      bell=function(x){var p=((x%1)+1)%1;return Math.exp(-pow((p-0.5)*6,2))*max},
      exp=function(x){var p=((x%1)+1)%1;return(Math.exp(p*3)-1)/(Math.exp(3)-1)*max},
      log=function(x){var p=((x%1)+1)%1;return Math.log(1+p*9)/Math.log(10)*max},
      step=function(x,n){n=n||4;var p=((x%1)+1)%1;return floor(p*n)/n*max};
`

export function compile(expr) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('t', 'f', 'min', 'max', '__bus', `var bus=__bus||{};${MATH_HELPERS}return (${expr})`)
  } catch {
    return null
  }
}
