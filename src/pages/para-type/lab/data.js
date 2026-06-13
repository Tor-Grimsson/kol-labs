/* Lab data — parameter definitions, presets, relationships, anatomy.
 * Pure data + the resolver. No React. */

import * as math from 'mathjs'

export const ANATOMY = {
  baseline:  { type: 'metric', desc: 'Line that letters sit on' },
  xHeight:   { type: 'metric', desc: 'Top of lowercase round letters' },
  capHeight: { type: 'metric', desc: 'Top of capitals' },
  ascender:  { type: 'metric', desc: 'Top of l, h, b, d, k, f, t' },
  descender: { type: 'metric', desc: 'Bottom of p, q, g, y, j' },
  overshoot: { type: 'metric', desc: 'How far rounds extend past metrics' },
  stem:      { type: 'part',   desc: 'Main vertical stroke' },
  bowl:      { type: 'part',   desc: 'Closed curved part of d, b, p, q, o' },
  counter:   { type: 'part',   desc: 'Negative space inside a bowl' },
  shoulder:  { type: 'part',   desc: 'Curve where stem meets arch (n, m, h)' },
  arch:      { type: 'part',   desc: 'Top curve of n, m, h' },
  crossbar:  { type: 'part',   desc: 'Horizontal cross stroke (t, f, e)' },
  terminal:  { type: 'part',   desc: 'End of a stroke' },
  tittle:    { type: 'part',   desc: 'Dot of i, j' },
  contrast:  { type: 'prop',   desc: 'Thin-to-thick ratio across a stroke' },
  stress:    { type: 'prop',   desc: 'Axis on which strokes are thinnest' },
  aperture:  { type: 'prop',   desc: 'How open a counter is (c, e)' },
  superness: { type: 'prop',   desc: 'Roundness vs squareness of bowls' },
}

export const PARAM_DEFS = {
  /* metrics */
  xHeight:    { def: 100,  min: 40,  max: 220,  group: 'metrics',    label: 'x-height' },
  capHeight:  { def: 140,  min: 60,  max: 260,  group: 'metrics',    label: 'cap-height' },
  ascender:   { def: 150,  min: 60,  max: 260,  group: 'metrics',    label: 'ascender' },
  descender:  { def: 40,   min: 5,   max: 100,  group: 'metrics',    label: 'descender' },
  overshoot:  { def: 4,    min: 0,   max: 20,   group: 'metrics',    label: 'overshoot' },
  /* weights */
  stemWidth:  { def: 18,   min: 2,   max: 60,   group: 'weights',    label: 'stem width' },
  oWidth:     { def: 95,   min: 30,  max: 220,  group: 'weights',    label: 'round width' },
  bowlWidth:  { def: 88,   min: 30,  max: 220,  group: 'weights',    label: 'bowl width' },
  hairWidth:  { def: 6,    min: 0.5, max: 30,   group: 'weights',    label: 'hairline',    step: 0.5 },
  /* expressive (METAFONT/Amstelvar/Prototypo lineage) */
  contrast:   { def: 0.35, min: 0,   max: 1,    group: 'expressive', label: 'contrast',    step: 0.01 },
  aperture:   { def: 0.7,  min: 0.1, max: 1,    group: 'expressive', label: 'aperture',    step: 0.01 },
  archHeight: { def: 0.92, min: 0.5, max: 1.05, group: 'expressive', label: 'arch height', step: 0.01 },
  shoulder:   { def: 0.12, min: 0,   max: 0.4,  group: 'expressive', label: 'shoulder',    step: 0.01 },
  superness:  { def: 0.5,  min: 0.1, max: 1.5,  group: 'expressive', label: 'superness',   step: 0.01 },
  spacing:    { def: 22,   min: 0,   max: 90,   group: 'expressive', label: 'side-bearing' },
  serif:      { def: 0,    min: 0,   max: 1,    group: 'expressive', label: 'serif',       step: 0.01 },
  jut:        { def: 0,    min: 0,   max: 1,    group: 'expressive', label: 'jut length',  step: 0.01 },
  /* effects */
  roughen:    { def: 0,    min: 0,   max: 1,    group: 'effects',    label: 'roughen',     step: 0.01 },
  noiseFreq:  { def: 0.05, min: 0.005, max: 0.4, group: 'effects',   label: 'noise freq',  step: 0.005 },
  noiseSeed:  { def: 1,    min: 0,   max: 99,   group: 'effects',    label: 'seed' },
  weightFx:   { def: 0,    min: -10, max: 10,   group: 'effects',    label: 'fx weight',   step: 0.1 },
  warpBend:   { def: 0,    min: -1,  max: 1,    group: 'effects',    label: 'warp bend',   step: 0.01 },
  warpDh:     { def: 0,    min: -1,  max: 1,    group: 'effects',    label: 'warp dh',     step: 0.01 },
  warpDv:     { def: 0,    min: -1,  max: 1,    group: 'effects',    label: 'warp dv',     step: 0.01 },
  /* resolution */
  flatness:   { def: 0,    min: 0,   max: 1,    group: 'resolution', label: 'flatness',    step: 0.01 },
  simplify:   { def: 0,    min: 0,   max: 1,    group: 'resolution', label: 'simplify',    step: 0.01 },
  segments:   { def: 48,   min: 6,   max: 200,  group: 'resolution', label: 'segments' },
  perlinAmt:  { def: 0,    min: 0,   max: 1,    group: 'resolution', label: 'perlin warp', step: 0.01 },
  perlinFreq: { def: 0.05, min: 0.005, max: 0.4, group: 'resolution', label: 'perlin freq', step: 0.005 },
}

export const PARAM_GROUPS = ['metrics', 'weights', 'expressive', 'effects', 'resolution']

export const RELATIONSHIPS = [
  { param: 'oWidth',     glyphs: ['o','c','e'],                              note: 'canonical round width' },
  { param: 'bowlWidth',  glyphs: ['d','b','p','q'],                          note: 'stem+bowl letters' },
  { param: 'stemWidth',  glyphs: ['l','i','d','b','p','q','h','n','m','t'], note: 'every stem stroke' },
  { param: 'hairWidth',  glyphs: ['o','c','e','d','b','p','q'],              note: 'horizontal thin strokes' },
  { param: 'xHeight',    glyphs: ['o','c','e','n','m','i','p','q'],          note: 'all lowercase tops' },
  { param: 'ascender',   glyphs: ['l','d','b','h','t','f','k'],              note: 'ascending letters' },
  { param: 'descender',  glyphs: ['p','q','j','g','y'],                      note: 'descending letters' },
  { param: 'contrast',   glyphs: ['o','c','e','d','b','p','q'],              note: 'thick/thin on curves' },
  { param: 'archHeight', glyphs: ['n','m','h','u'],                          note: 'arch family' },
  { param: 'shoulder',   glyphs: ['n','m','h','u'],                          note: 'arch shoulder drop' },
  { param: 'aperture',   glyphs: ['c','e','a','s'],                          note: 'open letters' },
  { param: 'superness',  glyphs: ['o','c','e','d','b','p','q'],              note: 'bowl roundness vs squareness' },
  { param: 'overshoot',  glyphs: ['o','c','e','d','b','p','q'],              note: 'round overshoot at top/bottom' },
  { param: 'serif',      glyphs: ['l','i','d','b','p','q','h','n','m','t'], note: 'small slab at stem feet' },
  { param: 'jut',        glyphs: ['l','i','d','b','p','q','h','n','m','t'], note: 'serif horizontal extension' },
]

export const envelopes = {
  adsr: (t, a = 0.1, d = 0.2, s = 0.6, r = 0.3) => {
    t = Math.max(0, Math.min(1, Number(t)))
    a = Number(a); d = Number(d); s = Number(s); r = Number(r)
    if (t < a) return t / a
    if (t < a + d) return 1 - (1 - s) * ((t - a) / d)
    if (t < 1 - r) return s
    if (r > 0) return s * (1 - (t - (1 - r)) / r)
    return 0
  },
  smooth: (t) => { t = Math.max(0, Math.min(1, Number(t))); return t * t * (3 - 2 * t) },
  tri:    (t) => { t = Number(t); return 1 - Math.abs(2 * (t - Math.floor(t + 0.5))) },
  saw:    (t) => { t = Number(t); return t - Math.floor(t) },
  pulse:  (t, duty = 0.5) => ((Number(t) - Math.floor(Number(t))) < Number(duty) ? 1 : 0),
  bounce: (t) => Math.abs(Math.sin(Number(t) * Math.PI)),
  srqf:   (t, peak = 0.7) => {
    t = Math.max(0, Math.min(1, Number(t))); peak = Number(peak)
    return t < peak ? t / peak : 1 - (t - peak) / (1 - peak)
  },
}

export const PRESETS = {
  Neutral:   {},
  Didone:    { contrast: 0.85, oWidth: 95,  stemWidth: 26, archHeight: 0.95, shoulder: 0.05, superness: 0.55 },
  Geometric: { contrast: 0,    oWidth: 110, stemWidth: 18, archHeight: 0.98, shoulder: 0,    aperture: 0.5, superness: 0.5 },
  Humanist:  { contrast: 0.45, oWidth: 92,  stemWidth: 16, archHeight: 0.88, shoulder: 0.18, aperture: 0.85, superness: 0.6 },
  Heavy:     { stemWidth: 42,  oWidth: 110, bowlWidth: 105, contrast: 0.15, xHeight: 130 },
  Spindly:   { stemWidth: 4,   oWidth: 80,  bowlWidth: 78,  contrast: 0.6,  xHeight: 110, hairWidth: 2 },
  Tall:      { xHeight: 70,    ascender: 220, descender: 70 },
  Square:    { superness: 1.3, aperture: 0.4, archHeight: 0.7, shoulder: 0 },
  Rounded:   { superness: 0.35, aperture: 0.95, archHeight: 1.0 },
}

export const GLYPH_ORDER = ['o','l','i','d','b','p','q','c','e','n','h','m','t']

/* Character-set filter chips — for viewport scoping. */
export const FILTER_SETS = {
  All:        GLYPH_ORDER,
  Rounds:     ['o','c','e'],
  Stems:      ['l','i','t'],
  Bowls:      ['d','b','p','q'],
  Arches:     ['n','m','h'],
  Ascenders:  ['l','d','b','h','t'],
  Descenders: ['p','q'],
}

/* Param resolver — handles cross-referenced expressions in N passes. */
export function resolveParams(paramConfigs, t) {
  const result = {}
  Object.entries(paramConfigs).forEach(([k, cfg]) => {
    result[k] = cfg.mode === 'number' ? cfg.value : PARAM_DEFS[k].def
  })
  for (let pass = 0; pass < 4; pass++) {
    Object.entries(paramConfigs).forEach(([k, cfg]) => {
      if (cfg.mode === 'expr') {
        try {
          const scope = { t, i: 0, count: 1, pi: Math.PI, e: Math.E, ...result, ...envelopes }
          const v = math.evaluate(cfg.expr, scope)
          if (typeof v === 'number' && Number.isFinite(v)) result[k] = v
        } catch { /* keep prior value */ }
      }
    })
  }
  Object.keys(result).forEach((k) => {
    const def = PARAM_DEFS[k]
    if (def && Number.isFinite(result[k])) {
      result[k] = Math.max(def.min * 0.5, Math.min(def.max * 1.5, result[k]))
    }
  })
  return result
}

/* Resolve per-glyph FX expressions: same as resolveParams but with i/count
 * scope so the user can write `scale: 1 + sin(i / count * pi) * 0.3`. */
export function resolveParamsForGlyph(paramConfigs, t, i, count) {
  const result = {}
  Object.entries(paramConfigs).forEach(([k, cfg]) => {
    result[k] = cfg.mode === 'number' ? cfg.value : PARAM_DEFS[k].def
  })
  for (let pass = 0; pass < 4; pass++) {
    Object.entries(paramConfigs).forEach(([k, cfg]) => {
      if (cfg.mode === 'expr') {
        try {
          const scope = { t, i, count, pi: Math.PI, e: Math.E, ...result, ...envelopes }
          const v = math.evaluate(cfg.expr, scope)
          if (typeof v === 'number' && Number.isFinite(v)) result[k] = v
        } catch { /* keep prior value */ }
      }
    })
  }
  Object.keys(result).forEach((k) => {
    const def = PARAM_DEFS[k]
    if (def && Number.isFinite(result[k])) {
      result[k] = Math.max(def.min * 0.5, Math.min(def.max * 1.5, result[k]))
    }
  })
  return result
}
