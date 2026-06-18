// Reference library for the oscilloscope rail — the EXAMPLES / WAVES / FUNCTIONS
// / VARIABLES / CURVES / RANGE / SPEED panels from kol-mirror, as data. Each row
// is { code, desc }; click a code to load it into the expression input
// (Cmd/Ctrl+click to append). `code` may be an array for multi-token rows.

export const EXAMPLES = [
  { code: 'wave(t*2)', desc: 'Fast sine' },
  { code: 'saw(t)*0.8', desc: 'Ramp to 80' },
  { code: 'tri(t*0.5)', desc: 'Slow bounce' },
  { code: 'ease(t*2, 4)', desc: 'Fast + punchy' },
  { code: 'pulse(t*3)', desc: 'Fast toggle' },
  { code: 'pulse(t, 0.3)', desc: 'PWM 30%' },
  { code: 'sin(t)*30+50', desc: 'Sine 20–80' },
  { code: 'abs(sin(t*3))*max', desc: 'Bouncing' },
  { code: 'rand()', desc: 'Noise' },
  { code: 't*20 % max', desc: 'Linear ramp' },
  { code: 'exp(t)', desc: 'Exponential' },
  { code: 'log(t)', desc: 'Logarithmic' },
  { code: 'bell(t)', desc: 'Bell curve' },
  { code: 'step(t, 4)', desc: '4 steps' },
  { code: 'step(t, 8)', desc: '8 steps' },
  { code: 'exp(t)*0.5+25', desc: 'Exp 25–75' },
  { code: 'bell(t*2)', desc: 'Fast bell' },
  { code: 'wave(t)+saw(t*2)*0.3', desc: 'Layered' },
  { code: 'tri(t)*pulse(t*4)', desc: 'Gated bounce' },
  { code: 'step(t, 6)*0.8+10', desc: 'Steps 10–90' },
  { code: 'ease(t*0.3, 3)*0.6+20', desc: 'Slow dramatic' },
]

export const WAVES = [
  { code: 'wave(t)', desc: 'Smooth up and down' },
  { code: 'saw(t)', desc: 'Ramp up, jump back' },
  { code: 'tri(t)', desc: 'Ramp up, ramp down' },
  { code: 'pulse(t)', desc: 'Snap on/off' },
  { code: 'rand()', desc: 'Random every frame' },
  { code: 'bell(t)', desc: 'Bell curve' },
  { code: 'exp(t)', desc: 'Exponential ramp' },
  { code: 'log(t)', desc: 'Logarithmic ramp' },
  { code: 'step(t, 4)', desc: 'Staircase' },
]

export const FUNCTIONS = [
  { code: 'sin', desc: '-1 to 1' },
  { code: 'cos', desc: '-1 to 1' },
  { code: 'abs', desc: 'Absolute' },
  { code: 'floor', desc: '↓ Round' },
  { code: 'ceil', desc: '↑ Round' },
  { code: 'round', desc: 'Nearest' },
  { code: 'sqrt', desc: '√' },
  { code: 'pow', desc: 'Power' },
  { code: 'PI', desc: '3.14159' },
  { code: 'PHI', desc: '1.61803' },
]

export const VARIABLES = [
  { code: ['t', 'f'], desc: 'Second / Frame count' },
  { code: 'min', desc: 'Knob minimum' },
  { code: 'max', desc: 'Knob maximum' },
]

export const CURVES = [
  { code: 'ease(t)', desc: 'Gentle breath' },
  { code: 'ease(t, 1)', desc: 'Linear, no curve' },
  { code: 'ease(t, 5)', desc: 'Dramatic punch' },
  { code: 'ease(t, 0.5)', desc: 'Quick flick' },
]

export const RANGES = [
  { code: 'saw(t)*0.8', desc: '0 to 80' },
  { code: 'wave(t)*0.5+25', desc: '25 to 75' },
  { code: 'tri(t)*0.3+70', desc: '70 to 100' },
  { code: 'ease(t)*0.2', desc: '0 to 20' },
]

export const SPEED = [
  { code: 'wave(t*0.5)', desc: 'Half speed' },
  { code: 'saw(t*2)', desc: 'Double speed' },
  { code: 'tri(t*3)', desc: '3x faster' },
  { code: 'ease(t*5)', desc: '5x faster' },
  { code: 'pulse(t*0.1)', desc: 'Very slow' },
]
