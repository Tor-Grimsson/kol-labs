 I think you should plan this out with ultracode then we switch to x-high for the
  code implementation, make sense?

⏺ Makes sense — plan now with the multi-agent fan-out, then you flip to x-high and I
  execute against the plan. Launching the planning workflow. It deep-reads the actual
  code contracts (the field/ substrate, patternLoop kernels, the UI/state/deep-link
  wiring), blueprints each work unit against those real signatures, synthesizes one
  ordered implementation plan, then runs three adversarial critics (contract accuracy /
  seamless+deep-link integrity / buildability) and revises before handing it back.

⏺ Workflow(Produce a decision-grade, file-by-file implementation plan for the 5-family
          Pattern redesign (render dispatch + field harness +
          Stripes/Tartan/Organic/Interlace), grounded in real code contracts and
          adversarially verified)
  ⎿  /workflows to view dynamic workflow runs

⏺ Planning workflow is running — 17 agents across Inspect → Blueprint → Synthesize →
  Verify → Revise. It'll deliver one file-by-file implementation plan, adversarially
  checked for contract accuracy, seamless-loop/deep-link integrity, and buildability.

  I'll present the plan when it lands. Then you flip to x-high and I implement Phase 1
  against it.

✻ Waiting for 1 dynamic workflow to finish

❯ ok thats enough you dont need 17 agents do you

⏺ Right, that's overkill for a plan. Killing it — I already have the design proposal
  and confirmed the substrate exists; I'll read the few real contracts myself and write
  the plan directly.

⏺ Stopping the workflow and reading the real contracts myself:

⏺ Stop Task
  ⎿  Produce a decision-grade, file-by-file implementation plan for the 5-family
     Pattern redesign (render dispatch + field harness +
     Stripes/Tartan/Organic/Interlace… · stopped

  Read 3 files (ctrl+o to expand)

⏺ Killed it — and confirmed the real contracts, which is all I actually needed:

  - Field module shape: { id, label, group:'field', kind:'2d', duration,
  camera:CAMERA_SCHEMA, params, draw(ctx,u,w,h,p) } — same draw signature as
  patternLoop.
  - raster(ctx, w, h, colorAt) where colorAt(i,j,W,H) → [r,g,b] 0–255; sample
  screen-space via (i/W)*w.
  - makeCam(u,p,w,h) → {cos,sin,zoom,cx,cy,phase}, phase = u·TAU·round(camFlow)
  (seamless); sample(cam,x,y) → [rx,ry]; mix2/mix3 ramps. All keyed on
  camZoom/camFlow/camAngle — the same names pattern already uses.
  - A real field/stripes.js exists (sine bands) — good math reference, but too thin for
  the family, so Pattern gets its own field modules that read pattern's
  color/color2/color3/bg.

  Here's the plan.

  ---
  Pattern Five-Family Redesign — Implementation Plan

  Architecture: render dispatch

  One new param drives everything. patternLoop.draw branches at the top; the tile loop
  (Blocks) is untouched.

  // patternLoop.js defaults
  render: 'tiles',          // 'tiles' | 'field' | 'weave'   (structural)
  field: 'stripes',         // 'stripes' | 'tartan' | 'organic' (when render==='field')

  // patternLoop.draw(ctx,u,w,h,p)
  ctx.fillStyle = p.bg; ctx.fillRect(0,0,w,h)        // keep — weave/field draw over it
  const kind = p.render || 'tiles'
  if (kind === 'field') return drawField(ctx, u, w, h, p)
  if (kind === 'weave') return drawWeave(ctx, u, w, h, p)
  // …existing tile loop unchanged → Blocks

  Field harness (drawField): build cam = makeCam(u,p,w,h), look up the family's colorAt
  factory, hand it to raster:

  import { makeCam, sample } from '../field/camera.js'
  import { raster, mix2, mix3 } from '../field/raster.js'
  import { stripeColorAt } from './fields/stripeField.js'   // etc.
  const FIELD = { stripes: stripeColorAt, tartan: tartanColorAt, organic:
  metaballColorAt }
  function drawField(ctx,u,w,h,p) {
    const cam = makeCam(u,p,w,h)
    raster(ctx, w, h, FIELD[p.field || 'stripes'](p, cam, w, h, u))
  }

  Each family is export function xColorAt(p, cam, w, h, u) → (i,j,W,H) => [r,g,b]
  (factory closes over precomputed values; returns the per-sample fn). Files live in
  new dir src/loops/pattern/fields/ so they read pattern's params, not the standalone
  field engines'.

  Invariants every path preserves: the p.bg fill, seamless whole-cycle u (only
  u·TAU·round(n) / integer-block terms), the params metadata array (lines 75–87) for
  theming/Randomise, no regression to tiles, and no WebGL — port the math to CPU
  colorAt.

  Phase 1 — Foundation + Stripes (the proof)

  File: src/loops/pattern/patternLoop.js
  Action: edit
  Change: Add render/field to defaults; add the dispatch branch + drawField (above).
    Import camera/raster + the stripe factory.
  ────────────────────────────────────────
  File: src/loops/pattern/fields/stripeField.js
  Action: new
  Change: stripeColorAt(p,cam,w,h,u): per sample [rx,ry]=sample(cam, (i/W)*w,(j/H)*h);
  s
     = rx*cos(θ)+ry*sin(θ) (θ=stripeAngle); ph = s/pitch + cam.phase/TAU*flow;
    n=floor(ph), palette walk ((n%bandCount)+bandCount)%bandCount over
    [color,color2,color3]; edge frac=ph-n, hard step(duty,frac) vs soft smoothstep over

    edgeSoftness; return mix2/picked colour.
  ────────────────────────────────────────
  File: src/pages/pattern/categories/stripes.js
  Action: edit
  Change: Re-author all 19 presets onto render:'field', field:'stripes' +
    stripeAngle/pitch/duty/bandCount/edgeSoftness. Real variety: pinstripe, awning,
    barber (18°), ombré.
  ────────────────────────────────────────
  File: src/pages/loops/PatternControls.jsx
  Action: edit
  Change: Pattern-tab becomes render-aware: if v.render==='field' → show the field
    section for v.field (Stripes: Angle/Pitch/Duty/Bands/Softness) instead of
    Shape/Grid/Rules. Skeleton dispatch added here (Tartan/Organic slot in next phase).

  New params (render, field, stripe*) are structural → NOT added to MOTION_KEYS (they
  swap with the preset; motion camFlow/camAngle/camZoom already preserved).

  Phase-1 acceptance: /pattern (stripes index) renders continuous directional bands,
  any angle, hard+soft edges; Flow drifts them (barber-pole); switch to a Blocks route
  → identical to today; seam test: u=0 frame === u=1 frame for every stripe preset.

  Phase 2 — Tartan + Organic (reuse the harness)

  File: src/loops/pattern/fields/tartanField.js
  Action: new
  Change: sett(t) step fn over a {width,colorIndex}[] threadcount table;
    warpC=ramp(sett(worldX)), weftC=ramp(sett(worldY)); out=[warpC*weftC/255 …] per
    channel (analytic multiply — no compositing API); +6–8% diagonal sawtooth for
  twill.
  ────────────────────────────────────────
  File: src/loops/pattern/fields/setts.js
  Action: new
  Change: A few real setts: Black Watch, Royal Stewart, Burberry, Gun Club. This data
  is
    the actual labour.
  ────────────────────────────────────────
  File: src/loops/pattern/fields/metaballField.js
  Action: new
  Change: Seeds (8–16) via a seamless orbit helper cx=ox+A·cos(u·TAU·round(cyc)+φ); per

    sample F=Σ r²/((x-cx)²+(y-cy)²+ε); iso-threshold T with ~2px AA rim → mix3(F-ish)
    inside, bg outside; one domain-warp line lifted from gradientField.js. Static u=0
    already shows fused blobs (no-autoplay honoured).
  ────────────────────────────────────────
  File: categories/tartan.js, categories/organic.js
  Action: edit
  Change: Re-author presets onto render:'field', field:'tartan'|'organic' + family
    params.
  ────────────────────────────────────────
  File: PatternControls.jsx
  Action: edit
  Change: Add the Tartan (sett picker, scale, twill) and Organic (blob
    count/radius/threshold/warp/drift) field sections to the render-aware dispatch.

  Acceptance: Tartan shows crossing setts with the muddy third tones; Organic blobs
  visibly fuse/pinch; both seamless.

  Phase 3 — Interlace weave + Blocks discipline

  File: src/loops/pattern/patternLoop.js
  Action: edit
  Change: drawWeave(ctx,u,w,h,p) reusing the camera frame (143–163), world window
    (170–175), block-wrap (181–183), MAX_CELLS verbatim. Per crossing cell: two
    axis-aligned ribbon rects (strandWidth≈0.7·period); a parity fn (plain  (col+row)&1

    / twill / satin / basket 2×2) picks which strand draws second (over) → real
    over/under. 3-stop transverse gradient + dark edge stroke. Crossing colour =
    over-strand's (occlusion, not blend).
  ────────────────────────────────────────
  File: categories/interlace.js
  Action: edit
  Change: Split: true-weave presets → render:'weave' + weaveType/strandWidth; keep
    herringbone/trellis/lattice/chainlink/netting as honest tiles.
  ────────────────────────────────────────
  File: categories/blocks.js
  Action: edit
  Change: Animation-discipline pass: stepped re-tile cascade (animCurveExpr:'round(k)',

    animWaves 4–8); add groupW/groupH super-cell presets (Mondrian). No pulse/swing.
  ────────────────────────────────────────
  File: patternLoop.js (optional)
  Action: edit
  Change: 1-liner at colorMix lerp (~217–221): step the lerp target across
  {_c1,_c2,_c3}
    so the wave cycles all three roles. Ship without it first.
  ────────────────────────────────────────
  File: PatternControls.jsx
  Action: edit
  Change: Weave section (type, strand width) in the render-aware dispatch.

  Acceptance: Interlace strands pass over/under and the boundary travels diagonally;
  Blocks reads as crisp modular grid with snapping re-tile waves; all seamless.

  Cross-cutting

  - Animation tab vs render kind: Frame (Flow/Angle/Zoom) maps to the field camera
  as-is (Direction/panDir is tiles-only → hide for field/weave). The Form axis
  (per-cell sweep) is a tiles concept — for field/weave its presets are inert;
  family-specific motion (stripe shimmer, organic drift, weave travel, tartan scroll)
  lives in each family's own section. Worth surfacing a short note or hiding Form for
  non-tile kinds.
  - Settings/deep-link: new params ride the existing preset patch → routes +
  getSettings carry them for free; just confirm none get dropped.
  - Shared consumers: LoopsShell + kinetic/DesignControls use PatternControls with the
  tile model — the render-aware dispatch must default to tiles so they're untouched.

  Risks (non-negotiable)

  Seamless seam (whole-cycle terms only — test u=0↔1 per preset) · don't port WebGL,
  port the math · keep tiles the default so shared consumers don't regress · field cost
  is bounded by raster's CAP=1000 buffer (fine).

  ---
  That's the plan, grounded in the actual signatures. Flip to x-high and I'll build
  Phase 1 (dispatch + field harness + Stripes) as the proof, then we look before
  Tartan/Organic/Interlace. Want it as-is, or adjust anything first?

✻ Cooked for 13m 6s

❯ /effort
  ⎿  Set effort level to xhigh (saved as your default for new sessions): Deeper
     reasoning than high, just below maximum (Fable 5, Opus 4.7+)

❯ perfect lets go

⏺ Building Phase 1. Let me re-read the current patternLoop.js head (imports + the draw
  entry) so my edits land exactly:

  Read 1 file (ctrl+o to expand)

⏺ Dispatch contracts confirmed. Now let me read the current Stripes presets + their
  helper so I re-author them onto the field model correctly:

  Read 2 files (ctrl+o to expand)

⏺ All contracts confirmed. Implementing Phase 1 — dispatch + field harness + Stripes.
  Starting with the new field module:

⏺ Write(src/loops/pattern/fields/stripeField.js)
  ⎿  Wrote 52 lines to src/loops/pattern/fields/stripeField.js
       2 import { sample } from '../../field/camera.js'js'
       3 import { mix2 } from '../../field/raster.js'
       5 // Stripes — a continuous directional band FIELD (no tiles). Reads the
         pattern
       6 // palette: color/color2/color3 are the bands, bg is the ground for pin
       7 // Two looks from one model:
       8 //   · duty >= 1  → solid colour bands cycling the palette; edgeSoftnes
       9 //                  adjacent band colours (ombré).
      10 //   · duty <  1  → an ink band of width `duty` (the band colour) on th
         e bg
     … +51 lines (ctrl+o to expand)

⏺ Now wire the dispatch into patternLoop.js — imports, defaults, the branch, and
  drawField:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines
       2  import { resolveShape, DEFAULT_SHAPE_ID } from './shapes.js'
       3  import { composeCell, compileRules } from './rules.js'
       4  import { glyphShape, ensureGlyphFontUrl } from '../../lib/glyphPath.js
          '
       5 +import { makeCam } from '../field/camera.js'
       6 +import { raster } from '../field/raster.js'
       7 +import { stripeColorAt } from './fields/stripeField.js'
       8
       9  // Pattern — the ported kol-client rule/tiling system, rendered to Can
          vas2D so it
      10  // animates + outputs a texture. The cols×rows rule-block TILES infini
          tely; the

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 11 lines
      69    diag: [1, 1], anti: [1, -1],
      70  }
      71
      72 +// Field families (render:'field') — continuous per-pixel renderers th
         +at bypass
      73 +// the tile loop and reuse the shared field rasterizer + camera. Each
         +maps the
      74 +// pattern palette (color/color2/color3 + bg) to a colorAt. Seamlessne
         +ss is the
      75 +// colorAt's job (periodic phase via cam.phase).
      76 +const FIELD_COLOR_AT = { stripes: stripeColorAt }
      77 +function drawField(ctx, u, w, h, p) {
      78 +  const make = FIELD_COLOR_AT[p.field] || FIELD_COLOR_AT.stripes
      79 +  const cam = makeCam(u, p, w, h)
      80 +  raster(ctx, w, h, make(p, cam, w, h))
      81 +}
      82 +
      83  export default {
      84    id: 'pattern-rules',
      85    label: 'Pattern',

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 10 lines
      126      // "test grid" substrate. none | checker (2-col) | cols | rows |
           diag (3-col).
      127      colorRule: 'none',
      128      rules: [],
      129 +    // ── Field render (render:'field') — continuous per-pixel patter
          +n families
      130 +    // that bypass the tile loop (Stripes now; Tartan/Organic later).
          + `field`
      131 +    // picks the family; each reads the palette (color/color2/color3
          ++ bg).
      132 +    render: 'tiles',     // 'tiles' (tile loop) | 'field' (continuous
          + field)
      133 +    field: 'stripes',    // active field family when render==='field'
      134 +    stripeAngle: 0,      // band direction (deg): 0 vertical · 90 hor
          +izontal · 45 diagonal
      135 +    stripePitch: 60,     // field units per band (band width)
      136 +    bandCount: 2,        // palette colours walked (1 single · 2 A/B
          +· 3 A/B/C)
      137 +    duty: 1,             // 1 = solid bands; <1 = ink band width on t
          +he bg ground (pinstripe)
      138 +    edgeSoftness: 0,     // 0 = hard edge; >0 = soft / ombré blend
      139      camZoom: 1,
      140      camFlow: 1,
      141      camAngle: 0,

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 4 lines
      160      ctx.fillStyle = p.bg
      161      ctx.fillRect(0, 0, w, h)
      162
      163 +    // Render dispatch: field families bypass the tile loop entirely.
          + 'tiles'
      164 +    // (default) falls through to the original engine below — Blocks'
          + native case.
      165 +    if ((p.render || 'tiles') === 'field') return drawField(ctx, u, w
          +, h, p)
      166 +
      167      const shp = shapeFor(p.shape, p.customSvg, p)
      168      if (!shp.paths.length) return
      169

⏺ Now re-author the Stripes presets onto the field model:

⏺ Write(src/pages/pattern/categories/stripes.js)
  ⎿  Added 72 lines, removed 84 lines
       1 -import { R, PAL } from './_helpers.js'
       1 +import { PAL } from './_helpers.js'
       2
       3 -// STRIPES — directional bar fields. Two reliable techniques:
       4 -//   · solid stripes  = a `square` field + colorRule cols/rows/diag (c
         -ontinuous,
       5 -//     crisp colour bands; cell sets thickness, cols/rows the repeat)
       6 -//   · spaced lines   = a `bar` shape rotated, with gap, for slats / p
         -instripes
       7 -// Scale is varied on purpose: big-and-few (cols 2–3, big cells) → sma
         -ll-and-many
       8 -// (cols 18+, fine cells). A gentle sweep is set so the gallery breath
         -es on play.
       3 +// STRIPES — a continuous directional band FIELD (render:'field', fiel
         +d:'stripes'),
       4 +// not tiles. The stripe engine (src/loops/pattern/fields/stripeField.
         +js) reads the
       5 +// palette: color/color2/color3 are the bands, bg is the ground for pi
         +nstripes.
       6 +//   stripeAngle  0 vertical · 90 horizontal · 45 diagonal
       7 +//   stripePitch  band width (field units)        bandCount  1 single
         +· 2 A/B · 3 A/B/C
       8 +//   duty         1 = solid bands · <1 = ink band of that width on the
         + bg ground
       9 +//   edgeSoftness 0 = hard · >0 = soft / ombré blend
      10 +// camFlow drifts the bands (barber-pole) — whole cycles ⇒ seamless; p
         +age loads
      11 +// paused, so it only moves on play. Scale is varied on purpose (wide
         +awnings →
      12 +// fine corduroy). `stripe()` stamps the render kind so every preset i
         +s a field.
      13
      14 +const stripe = (o) => ({ render: 'field', field: 'stripes', ...o })
      15 +
      16  export default [
      17    // ── solid colour bands ──
      12 -  { id: 'awning', label: 'Awning', params: {
      13 -    shape: 'prim:square', cols: 2, rows: 1, cell: 200, gap: 0, stretch
         -: true,
      14 -    colorRule: 'cols', color: PAL.red, color2: PAL.cream, color3: PAL.
         -cream, bg: PAL.ink,
      15 -    animAxis: 'col', animWaves: 1, fade: 0.25 } },
      16 -  { id: 'deckchair', label: 'Deckchair', params: {
      17 -    shape: 'prim:square', cols: 3, rows: 1, cell: 150, gap: 0, stretch
         -: true,
      18 -    colorRule: 'cols', color: PAL.teal, color2: PAL.amber, color3: PAL
         -.coral, bg: PAL.ink,
      19 -    animAxis: 'col', animWaves: 1.5, colorMix: 0.18 } },
      20 -  { id: 'horizon', label: 'Horizon', params: {
      21 -    shape: 'prim:square', cols: 1, rows: 2, cell: 110, gap: 0, stretch
         -: true,
      22 -    colorRule: 'rows', color: PAL.navy, color2: PAL.cream, color3: PAL
         -.cream, bg: PAL.ink,
      23 -    animAxis: 'row', animWaves: 1, fade: 0.3 } },
      24 -  { id: 'ticking', label: 'Ticking', params: {
      25 -    shape: 'prim:square', cols: 8, rows: 1, cell: 90, gap: 0, stretch:
         - true,
      26 -    colorRule: 'cols', color: PAL.navy, color2: PAL.cream, color3: PAL
         -.navy, bg: PAL.cream,
      27 -    animAxis: 'col', animWaves: 3, fade: 0.2 } },
      28 -  { id: 'corduroy', label: 'Corduroy', params: {
      29 -    shape: 'prim:square', cols: 20, rows: 1, cell: 60, gap: 0, stretch
         -: true,
      30 -    colorRule: 'cols', color: PAL.rust, color2: PAL.brick, color3: PAL
         -.coral, bg: PAL.noir,
      31 -    animAxis: 'col', animWaves: 5, pulse: 0.0, fade: 0.35 } },
      32 -  { id: 'candy', label: 'Candy', params: {
      33 -    shape: 'prim:square', cols: 3, rows: 3, cell: 100, gap: 0, stretch
         -: true,
      34 -    colorRule: 'diag', color: PAL.red, color2: PAL.bone, color3: PAL.r
         -ose, bg: PAL.ink,
      35 -    animAxis: 'diag', animWaves: 2, colorMix: 0.2, animCurveExpr: 'pow
         -(sin(PI*k),2)' } },
      36 -  { id: 'liquorice', label: 'Liquorice', params: {
      37 -    shape: 'prim:square', cols: 6, rows: 1, cell: 96, gap: 0, stretch:
         - true,
      38 -    colorRule: 'cols', color: PAL.ink, color2: PAL.amber, color3: PAL.
         -ink, bg: PAL.amber,
      39 -    animAxis: 'col', animWaves: 2, fade: 0.25 } },
      40 -  { id: 'gradient-bands', label: 'Gradient bands', params: {
      41 -    shape: 'prim:square', cols: 14, rows: 1, cell: 70, gap: 0, stretch
         -: true,
      42 -    colorRule: 'none', color: PAL.violet, color2: PAL.sky, bg: PAL.noi
         -r,
      43 -    animAxis: 'col', animCycles: 1, animWaves: 1.4, colorMix: 0.9 } },
      18 +  { id: 'awning', label: 'Awning', params: stripe({
      19 +    stripeAngle: 0, stripePitch: 96, bandCount: 2, duty: 1,
      20 +    color: PAL.red, color2: PAL.cream, bg: PAL.ink }) },
      21 +  { id: 'deckchair', label: 'Deckchair', params: stripe({
      22 +    stripeAngle: 0, stripePitch: 64, bandCount: 3, duty: 1,
      23 +    color: PAL.teal, color2: PAL.amber, color3: PAL.coral, bg: PAL.ink
         + }) },
      24 +  { id: 'horizon', label: 'Horizon', params: stripe({
      25 +    stripeAngle: 90, stripePitch: 80, bandCount: 2, duty: 1,
      26 +    color: PAL.navy, color2: PAL.cream, bg: PAL.ink }) },
      27 +  { id: 'ticking', label: 'Ticking', params: stripe({
      28 +    stripeAngle: 0, stripePitch: 22, bandCount: 2, duty: 1,
      29 +    color: PAL.navy, color2: PAL.cream, bg: PAL.cream }) },
      30 +  { id: 'corduroy', label: 'Corduroy', params: stripe({
      31 +    stripeAngle: 0, stripePitch: 16, bandCount: 3, duty: 1,
      32 +    color: PAL.rust, color2: PAL.brick, color3: PAL.coral, bg: PAL.noi
         +r }) },
      33 +  { id: 'candy', label: 'Candy', params: stripe({
      34 +    stripeAngle: 45, stripePitch: 48, bandCount: 3, duty: 1,
      35 +    color: PAL.red, color2: PAL.bone, color3: PAL.rose, bg: PAL.ink })
         + },
      36 +  { id: 'liquorice', label: 'Liquorice', params: stripe({
      37 +    stripeAngle: 0, stripePitch: 40, bandCount: 2, duty: 1,
      38 +    color: PAL.ink, color2: PAL.amber, bg: PAL.amber }) },
      39 +  { id: 'gradient-bands', label: 'Gradient bands', params: stripe({
      40 +    stripeAngle: 0, stripePitch: 64, bandCount: 2, duty: 1, edgeSoftne
         +ss: 1,
      41 +    color: PAL.violet, color2: PAL.sky, bg: PAL.noir }) },
      42
      43    // ── diagonal ──
      46 -  { id: 'twill', label: 'Twill', params: {
      47 -    shape: 'prim:square', cols: 4, rows: 4, cell: 90, gap: 0, stretch:
         - true,
      48 -    colorRule: 'diag', color: PAL.forest, color2: PAL.oat, color3: PAL
         -.moss, bg: PAL.ink,
      49 -    camAngle: 0, animAxis: 'diag', animWaves: 3, colorMix: 0.15 } },
      50 -  { id: 'barber', label: 'Barber', params: {
      51 -    shape: 'prim:square', cols: 3, rows: 3, cell: 110, gap: 0, stretch
         -: true,
      52 -    colorRule: 'diag', color: PAL.red, color2: PAL.bone, color3: PAL.b
         -lue, bg: PAL.ink,
      53 -    camAngle: 18, animAxis: 'diag', animCycles: 1, animWaves: 2, color
         -Mix: 0.1 } },
      54 -  { id: 'bias-bold', label: 'Bias bold', params: {
      55 -    shape: 'prim:square', cols: 2, rows: 2, cell: 180, gap: 0, stretch
         -: true,
      56 -    colorRule: 'diag', color: PAL.char, color2: PAL.gold, color3: PAL.
         -char, bg: PAL.gold,
      57 -    camAngle: 45, animAxis: 'diag', animWaves: 1, fade: 0.2 } },
      44 +  { id: 'twill', label: 'Twill', params: stripe({
      45 +    stripeAngle: 45, stripePitch: 28, bandCount: 3, duty: 1,
      46 +    color: PAL.forest, color2: PAL.oat, color3: PAL.moss, bg: PAL.ink
         +}) },
      47 +  { id: 'barber', label: 'Barber', params: stripe({
      48 +    stripeAngle: 72, stripePitch: 40, bandCount: 3, duty: 1,
      49 +    color: PAL.red, color2: PAL.bone, color3: PAL.blue, bg: PAL.ink })
         + },
      50 +  { id: 'bias-bold', label: 'Bias bold', params: stripe({
      51 +    stripeAngle: 45, stripePitch: 120, bandCount: 2, duty: 1,
      52 +    color: PAL.char, color2: PAL.gold, bg: PAL.gold }) },
      53
      59 -  // ── spaced lines (bars) ──
      60 -  { id: 'pinstripe', label: 'Pinstripe', params: {
      61 -    shape: 'prim:bar', cols: 10, rows: 8, cell: 120, gap: -24, color:
         -PAL.cream, bg: PAL.navy,
      62 -    rules: [R({ rotate: 90 })], animAxis: 'col', animWaves: 4, fade: 0
         -.3 } },
      63 -  { id: 'double-pin', label: 'Double pin', params: {
      64 -    shape: 'prim:bar', cols: 12, rows: 8, cell: 110, gap: -22, color:
         -PAL.bone, bg: PAL.ink,
      65 -    rules: [R({ rotate: 90 }), R({ selectKind: 'every-col', n: 2, hide
         -: true })],
      66 -    animAxis: 'col', animWaves: 5, fade: 0.25 } },
      67 -  { id: 'venetian', label: 'Venetian', params: {
      68 -    shape: 'prim:bar', cols: 6, rows: 10, cell: 120, gap: -18, color:
         -PAL.oat, bg: PAL.slate,
      69 -    rules: [], animAxis: 'row', animWaves: 4, fade: 0.45 } },
      70 -  { id: 'ladder', label: 'Ladder', params: {
      71 -    shape: 'prim:bar', cols: 8, rows: 8, cell: 120, gap: 10, color: PA
         -L.amber, bg: PAL.noir,
      72 -    rules: [R({ rotate: 90 })], animAxis: 'col', animWaves: 4, pulse:
         -0.25 } },
      73 -  { id: 'morse', label: 'Morse', params: {
      74 -    shape: 'prim:bar', cols: 9, rows: 9, cell: 110, gap: 6, color: PAL
         -.sky, bg: PAL.ink,
      75 -    rules: [R({ rotate: 90 }), R({ selectKind: 'expression', expressio
         -n: 'sin(row * 1.7 + col)', hide: true })],
      76 -    animAxis: 'row', animWaves: 3, fade: 0.4, animCurveExpr: 'round(k)
         -' } },
      77 -  { id: 'thick-thin', label: 'Thick / thin', params: {
      78 -    shape: 'prim:bar', cols: 12, rows: 6, cell: 110, gap: -16, color:
         -PAL.coral, bg: PAL.char,
      79 -    rules: [R({ rotate: 90 }), R({ selectKind: 'every-col', n: 2, flip
         -V: false, groupW: 1, opacity: 0.5 })],
      80 -    animAxis: 'col', animWaves: 4, fade: 0.3 } },
      54 +  // ── pinstripe / lines (ink band on a ground) ──
      55 +  { id: 'pinstripe', label: 'Pinstripe', params: stripe({
      56 +    stripeAngle: 0, stripePitch: 40, bandCount: 1, duty: 0.12,
      57 +    color: PAL.cream, bg: PAL.navy }) },
      58 +  { id: 'double-pin', label: 'Double pin', params: stripe({
      59 +    stripeAngle: 0, stripePitch: 28, bandCount: 2, duty: 0.24,
      60 +    color: PAL.bone, color2: PAL.grey, bg: PAL.ink }) },
      61 +  { id: 'venetian', label: 'Venetian', params: stripe({
      62 +    stripeAngle: 90, stripePitch: 46, bandCount: 1, duty: 0.62,
      63 +    color: PAL.oat, bg: PAL.slate }) },
      64 +  { id: 'ladder', label: 'Ladder', params: stripe({
      65 +    stripeAngle: 0, stripePitch: 52, bandCount: 1, duty: 0.3,
      66 +    color: PAL.amber, bg: PAL.noir }) },
      67 +  { id: 'morse', label: 'Morse', params: stripe({
      68 +    stripeAngle: 0, stripePitch: 22, bandCount: 1, duty: 0.45,
      69 +    color: PAL.sky, bg: PAL.ink }) },
      70 +  { id: 'thick-thin', label: 'Thick / thin', params: stripe({
      71 +    stripeAngle: 0, stripePitch: 44, bandCount: 1, duty: 0.55, edgeSof
         +tness: 0.15,
      72 +    color: PAL.coral, bg: PAL.char }) },
      73
      82 -  // ── shape stripes ──
      83 -  { id: 'chevron', label: 'Chevron', params: {
      84 -    shape: 'prim:triangle', cols: 8, rows: 6, cell: 110, gap: 0, stret
         -ch: true,
      85 -    colorRule: 'rows', color: PAL.teal, color2: PAL.cream, color3: PAL
         -.navy, bg: PAL.ink,
      86 -    rules: [R({ selectKind: 'every-row', n: 2, flipV: true })],
      87 -    animAxis: 'row', animWaves: 2, swing: 0, fade: 0.25 } },
      88 -  { id: 'sawtooth', label: 'Sawtooth', params: {
      89 -    shape: 'prim:triangle', cols: 10, rows: 4, cell: 100, gap: 0, stre
         -tch: true,
      90 -    colorRule: 'cols', color: PAL.gold, color2: PAL.rust, color3: PAL.
         -amber, bg: PAL.noir,
      91 -    rules: [R({ selectKind: 'every-col', n: 2, flipH: true })],
      92 -    animAxis: 'col', animWaves: 3, colorMix: 0.2 } },
      74 +  // ── diagonal accents ──
      75 +  { id: 'chevron', label: 'Chevron', params: stripe({
      76 +    stripeAngle: 60, stripePitch: 40, bandCount: 3, duty: 1,
      77 +    color: PAL.teal, color2: PAL.cream, color3: PAL.navy, bg: PAL.ink
         +}) },
      78 +  { id: 'sawtooth', label: 'Sawtooth', params: stripe({
      79 +    stripeAngle: 30, stripePitch: 36, bandCount: 3, duty: 1,
      80 +    color: PAL.gold, color2: PAL.rust, color3: PAL.amber, bg: PAL.noir
         + }) },
      81  ]

⏺ Now make PatternControls render-aware. Let me locate the exact seam between the
  animation branch and the tile structure:

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Hide the tiles-only Direction control when rendering a field, and add the
  render-aware field section before the tile structure:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 6 lines, removed 3 lines
      142          {animTab === 'frame' && (
      143          <Section label="Frame">
      144            <Slider labeled label="Flow" min={0} max={4} step={1} value
           ={v.camFlow} onChange={(x) => onFrame('camFlow', roundIfNum(x))} vari
           ant="default" />
      145 -          <LabeledControl inline label="Direction">
      146 -            <Dropdown variant="subtle" size="sm" className="w-full" o
          -ptions={PAN_DIRS} value={v.panDir ?? 'diag'} onChange={(val) => onFra
          -me('panDir', val)} />
      147 -          </LabeledControl>
      145 +          {/* Direction is a tile-grid pan; fields drift along their
          +own axis via Flow. */}
      146 +          {(v.render ?? 'tiles') === 'tiles' && (
      147 +            <LabeledControl inline label="Direction">
      148 +              <Dropdown variant="subtle" size="sm" className="w-full"
          + options={PAN_DIRS} value={v.panDir ?? 'diag'} onChange={(val) => onF
          +rame('panDir', val)} />
      149 +            </LabeledControl>
      150 +          )}
      151            <Slider labeled label="Zoom" min={0.3} max={3} step={0.05}
           value={v.camZoom} onChange={(x) => onChange('camZoom', x)} variant="d
           efault" />
      152            <Slider labeled label="Angle" min={0} max={360} step={1} va
           lue={v.camAngle} onChange={(x) => onChange('camAngle', roundIfNum(x))
           } variant="default" />
      153          </Section>

⏺ Reading 1 file… (ctrl+o to expand)
  ⎿  src/pages/loops/PatternControls.jsx

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 23 lines
      187    }
      188
      189    // tab === 'pattern' — structure
      190 +  // Field render kinds replace the tile Shape/Grid/Rules with the fa
          +mily's own
      191 +  // section (those tile controls don't apply to a continuous field).
          + Colour is
      192 +  // shared — the field reads the palette (color/color2/color3 + bg g
          +round).
      193 +  if (v.render === 'field') {
      194 +    return (
      195 +      <>
      196 +        <Section label="Stripes">
      197 +          <Slider labeled label="Angle" min={0} max={180} step={1} va
          +lue={v.stripeAngle ?? 0} onChange={(x) => onChange('stripeAngle', rou
          +ndIfNum(x))} variant="default" />
      198 +          <Slider labeled label="Pitch" min={8} max={240} step={1} va
          +lue={v.stripePitch ?? 60} onChange={(x) => onChange('stripePitch', ro
          +undIfNum(x))} variant="default" />
          +e={v.bandCount ?? 2} onChange={(x) => onChange('bandCount', roundIfNu
          +m(x))} variant="default" />
          +} value={v.edgeSoftness ?? 0} onChange={(x) => onChange('edgeSoftness
          +', x)} variant="default" />
      202 +        </Section>
      203 +        <Section label="Colour">
      204 +          {colorCtl('Colour A', 'color')}
      205 +          {(v.bandCount ?? 2) >= 2 && colorCtl('Colour B', 'color2')}
      206 +          {(v.bandCount ?? 2) >= 3 && colorCtl('Colour C', 'color3')}
      207 +          {(v.duty ?? 1) < 1 && colorCtl('Ground', 'bg')}
      208 +        </Section>
      209 +      </>
      210 +    )
      211 +  }
      212 +
      213    const rules = v.rules || []
      214    const setRules = (r) => onChange('rules', r)
      215    const addRule = () => setRules([...rules, newRule()])

⏺ Build, then verify the stripe field actually renders bands and is seamless (u=0 ≡
  u=1):

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|✗|Could not resolve" | tail -5)
  ⎿  ✓ built in 2.93s
  ⎿  Allowed by auto mode classifier

⏺ Bash(node --input-type=module -e '
      import { stripeColorAt } from "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  solid drift seam u0==u1: true
     solid distinct colours across row: 2 (expect ~2)
     pinstripe ink frac: 0.13 (expect ~0.12)
     ombré distinct colours across row: 168 (expect many)
  ⎿  Allowed by auto mode classifier

⏺ Phase 1 is in and verified at the engine level (all four checks pass):

  - Seamless — u=0 frame ≡ u=1 frame even with drift (camFlow=2). ✓
  - Real bands — solid stripes resolve to distinct colour bands across a row, not
  boxes. ✓
  - Pinstripe — ink coverage 0.13 ≈ duty 0.12 (thin line on ground). ✓
  - Ombré — edgeSoftness produces 168 blended colours across a row. ✓

  Build green (2.93s).

  What shipped

  File: src/loops/pattern/fields/stripeField.js
  Change: new — stripeColorAt(p,cam,w,h) factory: directional bands (any angle), solid
    multi-colour or pinstripe-on-ground, hard/soft edges, seamless Flow drift. Reuses
    field/camera + field/raster + mix2.
  ────────────────────────────────────────
  File: src/loops/pattern/patternLoop.js
  Change: render dispatch at top of draw() ('field' → drawField, else the untouched
  tile
    loop); drawField + FIELD_COLOR_AT map; render/field/stripe* defaults.
  ────────────────────────────────────────
  File: src/pages/pattern/categories/stripes.js
  Change: all 19 presets re-authored as real stripes (awnings, ticking, corduroy,
    barber, pinstripe, venetian, ombré…).
  ────────────────────────────────────────
  File: src/pages/loops/PatternControls.jsx
  Change: render-aware: field presets show a Stripes section
    (Angle/Pitch/Bands/Duty/Softness) + palette instead of Shape/Grid/Rules; Direction
    hidden for fields.

  The architecture is proven: dispatch → field harness → colorAt, sitting beside the
  tile engine. Blocks (tiles) is byte-for-byte untouched. Tartan/Organic now drop into
  FIELD_COLOR_AT the same way; Interlace gets the weave pass.
  One honest Phase-1 limitation: the Animation tab's Form axis (per-cell
  pulse/fade/sway) is a tiles concept, so it's inert for field render — Stripes' motion
  is the Frame → Flow drift. When we do per-family motion (stripe shimmer, organic
  drift) I'll make the Form axis render-aware so it's not a dead tab on fields.

  Not eyeballed live — check /pattern (stripes) on :5173: bands should read as genuine
  stripes, and Flow should drift them on play.

  Ready for Phase 2 (Tartan + Organic) when you are.

✻ Baked for 7m 20s

❯ go ahead with phase 2 and all the other phases, /goal finish the phases consequtivly

⏺ On it — Phase 2 then 3, consecutively, building + verifying each. Let me read the
  Tartan and Organic preset files I'm re-authoring:

  Read 2 files (ctrl+o to expand)

⏺ Now Phase 2. Writing the Tartan field (sett tables + analytic average-weave) and the
  Organic metaball field:

⏺ Write(src/loops/pattern/fields/setts.js)
  ⎿  Wrote 23 lines to src/loops/pattern/fields/setts.js
         hreadCount];readcount setts. Each sett = ordered bands [paletteIndex, t
         ndromic, sondex 0..3 → [color, color2, color3, bg]. Real setts are pali
       3 // sym() mirrors a half-sett (drop the shared end thread on the reflect
       4 // come from the preset (so a tartan stays retintable); the sett owns o
         nly the
       6 const sym = (half) => [...half, ...half.slice(1, -1).reverse()]
       8 export const SETTS = {
       9   gingham:       [[3, 8], [0, 8]],
      10   buffalo:       [[0, 12], [1, 12]],
           // two bold colours
     … +27 lines (ctrl+o to expand)

⏺ Write(src/loops/pattern/fields/tartanField.js)
  ⎿  Wrote 34 lines to src/loops/pattern/fields/tartanField.js
       2 import { sample } from '../../field/camera.js'js'
       3 import { mix2 } from '../../field/raster.js'
       5 import { SETTS } from './setts.js'
       6 // Tartan — crossing warp + weft threads (no tiles). Each axis walks th
       7 // threadcount of palette-indexed bands); the cell colour is the AVERAG
         E of the
         ⇒ that solidft thread — the woven "mix" tone. Same colour on both axes
       9 // colour; different colours ⇒ the muddy crossing third. A small twill
      10 // more warp or weft along alternating diagonals (the 2/2-twill grain).
          Seamless:
     … +35 lines (ctrl+o to expand)

⏺ Write(src/loops/pattern/fields/metaballField.js)
  ⎿  Wrote 56 lines to src/loops/pattern/fields/metaballField.js
       2 import { sample } from '../../field/camera.js'js'
       4 import { mix2, mix3 } from '../../field/raster.js'
       5 // Organic — a summed metaball iso-field (no tiles). N seeds orbit (sea
       6 // contributing r²/dist²; where the summed field F exceeds `threshold`
         the surface
          (bg). Becausea depth ramp (color→color2→color3), outside is the ground
          definingeld is SUMMED, neighbouring blobs fuse with smooth necks — the
       9 // organic move a grid of dots can never make. A domain-warp wobbles th
      10 // Seamless: seeds orbit on cam.phase (whole cycles); static u=0 alread
         y shows blobs.
     … +57 lines (ctrl+o to expand)

⏺ Register the two new families + add their defaults in patternLoop.js:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 2 lines
       5  import { makeCam } from '../field/camera.js'
       6  import { raster } from '../field/raster.js'
       7  import { stripeColorAt } from './fields/stripeField.js'
       8 +import { tartanColorAt } from './fields/tartanField.js'
       9 +import { metaballColorAt } from './fields/metaballField.js'
      10
      11  // Pattern — the ported kol-client rule/tiling system, rendered to Can
          vas2D so it
      12  // animates + outputs a texture. The cols×rows rule-block TILES infini
          tely; the

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 1 line, removed 1 line
      75  // the tile loop and reuse the shared field rasterizer + camera. Each
          maps the
      76  // pattern palette (color/color2/color3 + bg) to a colorAt. Seamlessne
          ss is the
      77  // colorAt's job (periodic phase via cam.phase).
      78 -const FIELD_COLOR_AT = { stripes: stripeColorAt }
      78 +const FIELD_COLOR_AT = { stripes: stripeColorAt, tartan: tartanColorAt
         +, organic: metaballColorAt }
      79  function drawField(ctx, u, w, h, p) {
      80    const make = FIELD_COLOR_AT[p.field] || FIELD_COLOR_AT.stripes
      81    const cam = makeCam(u, p, w, h)

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 9 lines
      138      bandCount: 2,        // palette colours walked (1 single · 2 A/B
           · 3 A/B/C)
      139      duty: 1,             // 1 = solid bands; <1 = ink band width on t
           he bg ground (pinstripe)
      140      edgeSoftness: 0,     // 0 = hard edge; >0 = soft / ombré blend
      141 +    // Tartan field (field:'tartan')
      142 +    sett: 'black-watch', // threadcount table (src/loops/pattern/fiel
          +ds/setts.js)
      143 +    settScale: 5,        // px per thread unit
      144 +    twill: 0.18,         // 2/2-twill diagonal bias (0 = flat average
          +)
      145 +    // Organic field (field:'organic') — summed metaball iso-surface
      146 +    blobCount: 9,        // number of orbiting seeds
      147 +    blobRadius: 0.5,     // seed influence radius (× canvas)
      148 +    threshold: 1,        // iso level — higher = tighter blobs
      149 +    warp: 0.2,           // domain-warp wobble
      150      camZoom: 1,
      151      camFlow: 1,
      152      camAngle: 0,

⏺ Re-author the Tartan presets — true woven plaids onto the field, keeping
  argyle/houndstooth as genuine tile tessellations:

⏺ Write(src/pages/pattern/categories/tartan.js)
  ⎿  Added 67 lines, removed 83 lines
       1  import { R, PAL } from './_helpers.js'
       2
       3 -// TARTAN — woven plaid / check. The reliable recipe:
       4 -//   · a `square` field with `stretch:true` = solid colour blocks
       5 -//   · a SMALL POSITIVE gap + `bg` set to the thread colour ⇒ thin lin
         -es show
       6 -//     between the blocks → the woven "thread" lattice that reads as p
         -laid
       7 -//   · `colorRule` interleaves the blocks: checker (2-col) → gingham/b
         -uffalo;
       8 -//     diag/cols/rows (3-col) → madras/tartan colourways
       9 -//   · `showGrid:true` lays an extra thread lattice over the gaps (win
         -dowpane,
      10 -//     tattersall, argyle cross-lines)
      11 -// Scale runs big-and-few (buffalo, 2–4 cells) → fine-and-many (tartan
         --fine 18+).
      12 -// The static read must stay crisp, so the sweep is kept subtle / most
         -ly off.
       3 +// TARTAN — woven plaid. The true thread-based plaids are a FIELD (ren
         +der:'field',
       4 +// field:'tartan'): warp+weft threads from a `sett` (threadcount table
         + in
       5 +// fields/setts.js) AVERAGE at each crossing into the woven "mix" tone
         +. Colours come
       6 +// from the preset (retintable): sett indices 0..3 → color/color2/colo
         +r3/bg.
       7 +//   sett        which threadcount table       settScale   px per thre
         +ad
       8 +//   twill       diagonal 2/2 grain (0 = flat average)
       9 +// camFlow scrolls the sett (whole repeats ⇒ seamless; paused on load)
         +.
      10 +// Argyle + houndstooth are genuine TILE tessellations, not thread ave
         +rages, so they
      11 +// stay on the tile engine (no `render` ⇒ 'tiles').
      12
      13 +const tartan = (o) => ({ render: 'field', field: 'tartan', ...o })
      14 +
      15  export default [
      15 -  // ── the icons ──
      16 -  { id: 'burberry', label: 'Burberry', params: {
      17 -    shape: 'prim:square', cols: 6, rows: 6, cell: 96, gap: 5, stretch:
         - true, showGrid: true,
      18 -    colorRule: 'diag', color: PAL.beige, color2: PAL.tan, color3: PAL.
         -camel, bg: PAL.ink,
      19 -    rules: [R({ selectKind: 'both', n: 6, n2: 6, offset: 2, offset2: 2
         - })],
      20 -    animAxis: 'diag', animWaves: 2, colorMix: 0.12 } },
      21 -  { id: 'gingham', label: 'Gingham', params: {
      22 -    shape: 'prim:square', cols: 8, rows: 8, cell: 80, gap: 4, stretch:
         - true,
      23 -    colorRule: 'checker', color: PAL.bone, color2: PAL.red, bg: PAL.cr
         -eam,
      24 -    animAxis: 'diag', animWaves: 2, fade: 0.18 } },
      25 -  { id: 'buffalo-check', label: 'Buffalo check', params: {
      26 -    shape: 'prim:square', cols: 4, rows: 4, cell: 160, gap: 6, stretch
         -: true,
      27 -    colorRule: 'checker', color: PAL.red, color2: PAL.ink, bg: PAL.bri
         -ck,
      28 -    animAxis: 'diag', animWaves: 1, fade: 0.16 } },
      29 -  { id: 'madras', label: 'Madras', params: {
      30 -    shape: 'prim:square', cols: 7, rows: 7, cell: 84, gap: 5, stretch:
         - true,
      31 -    colorRule: 'diag', color: PAL.green, color2: PAL.gold, color3: PAL
         -.red, bg: PAL.ink,
      32 -    animAxis: 'diag', animCycles: 1, animWaves: 3, colorMix: 0.18 } },
      33 -  { id: 'windowpane', label: 'Windowpane', params: {
      34 -    shape: 'prim:square', cols: 3, rows: 3, cell: 200, gap: 3, stretch
         -: true, showGrid: true,
      35 -    colorRule: 'none', color: PAL.navy, color2: PAL.sky, bg: PAL.sky,
      36 -    animAxis: 'radial', animWaves: 1, fade: 0.2 } },
      16 +  // ── the icons (field) ──
      17 +  { id: 'burberry', label: 'Burberry', params: tartan({
      18 +    sett: 'royal', settScale: 5, twill: 0.16,
      19 +    color: PAL.camel, color2: PAL.red, color3: PAL.ink, bg: PAL.bone }
         +) },
      20 +  { id: 'gingham', label: 'Gingham', params: tartan({
      21 +    sett: 'gingham', settScale: 6, twill: 0,
      22 +    color: PAL.red, bg: PAL.cream }) },
      23 +  { id: 'buffalo-check', label: 'Buffalo check', params: tartan({
      24 +    sett: 'buffalo', settScale: 9, twill: 0.1,
      25 +    color: PAL.red, color2: PAL.ink }) },
      26 +  { id: 'madras', label: 'Madras', params: tartan({
      27 +    sett: 'madras', settScale: 5, twill: 0.2,
      28 +    color: PAL.green, color2: PAL.gold, color3: PAL.red }) },
      29 +  { id: 'windowpane', label: 'Windowpane', params: tartan({
      30 +    sett: 'windowpane', settScale: 6, twill: 0,
      31 +    color: PAL.navy, color2: PAL.sky }) },
      32
      38 -  // ── argyle / houndstooth ──
      33 +  // ── classic tartans (field) ──
      34 +  { id: 'black-watch', label: 'Black Watch', params: tartan({
      35 +    sett: 'black-watch', settScale: 5, twill: 0.2,
      36 +    color: PAL.navy, color2: PAL.forest, color3: PAL.ink }) },
      37 +  { id: 'royal-stewart', label: 'Royal Stewart', params: tartan({
      38 +    sett: 'royal', settScale: 5, twill: 0.2,
      39 +    color: PAL.red, color2: PAL.navy, color3: PAL.forest, bg: PAL.bone
         + }) },
      40 +  { id: 'dress-tartan', label: 'Dress tartan', params: tartan({
      41 +    sett: 'tattersall', settScale: 5, twill: 0.16,
      42 +    color: PAL.red, color2: PAL.navy, bg: PAL.cream }) },
      43 +  { id: 'blackwatch-bold', label: 'Black Watch bold', params: tartan({
      44 +    sett: 'black-watch', settScale: 9, twill: 0.2,
      45 +    color: PAL.navy, color2: PAL.forest, color3: PAL.ink }) },
      46 +  { id: 'hunting-tartan', label: 'Hunting tartan', params: tartan({
      47 +    sett: 'hunting', settScale: 5, twill: 0.2,
      48 +    color: PAL.navy, color2: PAL.moss, color3: PAL.ink }) },
      49 +
      50 +  // ── fine grids / shirting (field) ──
      51 +  { id: 'tattersall', label: 'Tattersall', params: tartan({
      52 +    sett: 'tattersall', settScale: 5, twill: 0,
      53 +    color: PAL.red, color2: PAL.navy, bg: PAL.bone }) },
      54 +  { id: 'glen-plaid', label: 'Glen plaid', params: tartan({
      55 +    sett: 'glen', settScale: 4, twill: 0.22,
      56 +    color: PAL.slate, bg: PAL.cream }) },
      57 +  { id: 'prince-of-wales', label: 'Prince of Wales', params: tartan({
      58 +    sett: 'glen', settScale: 5, twill: 0.24,
      59 +    color: PAL.ink, color2: PAL.ochre, bg: PAL.oat }) },
      60 +  { id: 'tartan-fine', label: 'Tartan fine', params: tartan({
      61 +    sett: 'madras', settScale: 3, twill: 0.2,
      62 +    color: PAL.teal, color2: PAL.navy, color3: PAL.coral }) },
      63 +
      64 +  // ── bold scale (field) ──
      65 +  { id: 'tartan-bold', label: 'Tartan bold', params: tartan({
      66 +    sett: 'madras', settScale: 11, twill: 0.18,
      67 +    color: PAL.plum, color2: PAL.amber, color3: PAL.teal }) },
      68 +  { id: 'picnic-check', label: 'Picnic check', params: tartan({
      69 +    sett: 'gingham', settScale: 9, twill: 0,
      70 +    color: PAL.teal, bg: PAL.cream }) },
      71 +
      72 +  // ── argyle / houndstooth — genuine TILE tessellations (kept on the
         + tile engine) ──
      73    { id: 'argyle', label: 'Argyle', params: {
      74      shape: 'prim:diamond', cols: 4, rows: 4, cell: 130, gap: -10, stre
          tch: true, showGrid: true,
      75      colorRule: 'diag', color: PAL.forest, color2: PAL.oat, color3: PAL
          .brick, bg: PAL.cream,
     ...
       88      colorRule: 'checker', color: PAL.brick, color2: PAL.cream, bg: PA
           L.brick,
       89      rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ se
           lectKind: 'every-row', n: 2, flipV: true })],
       90      animAxis: 'diag', animWaves: 4, fade: 0.12 } },
       57 -
       58 -  // ── classic tartans / colourways ──
       59 -  { id: 'black-watch', label: 'Black Watch', params: {
       60 -    shape: 'prim:square', cols: 6, rows: 6, cell: 96, gap: 5, stretch
          -: true, showGrid: true,
       61 -    colorRule: 'diag', color: PAL.navy, color2: PAL.forest, color3: P
          -AL.ink, bg: PAL.ink,
       62 -    animAxis: 'diag', animWaves: 2, colorMix: 0.12 } },
       63 -  { id: 'royal-stewart', label: 'Royal Stewart', params: {
       64 -    shape: 'prim:square', cols: 7, rows: 7, cell: 84, gap: 5, stretch
          -: true, showGrid: true,
       65 -    colorRule: 'diag', color: PAL.red, color2: PAL.navy, color3: PAL.
          -forest, bg: PAL.bone,
       66 -    animAxis: 'diag', animCycles: 1, animWaves: 3, colorMix: 0.16 } }
          -,
       67 -  { id: 'dress-tartan', label: 'Dress tartan', params: {
       68 -    shape: 'prim:square', cols: 8, rows: 8, cell: 80, gap: 4, stretch
          -: true, showGrid: true,
       69 -    colorRule: 'diag', color: PAL.bone, color2: PAL.red, color3: PAL.
          -navy, bg: PAL.cream,
       70 -    animAxis: 'diag', animWaves: 3, colorMix: 0.14 } },
       71 -  { id: 'blackwatch-bold', label: 'Black Watch bold', params: {
       72 -    shape: 'prim:square', cols: 4, rows: 4, cell: 150, gap: 6, stretc
          -h: true,
       73 -    colorRule: 'checker', color: PAL.forest, color2: PAL.navy, bg: PA
          -L.ink,
       74 -    animAxis: 'diag', animWaves: 1, fade: 0.16 } },
       75 -  { id: 'hunting-tartan', label: 'Hunting tartan', params: {
       76 -    shape: 'prim:square', cols: 6, rows: 6, cell: 100, gap: 5, stretc
          -h: true, showGrid: true,
       77 -    colorRule: 'diag', color: PAL.moss, color2: PAL.forest, color3: P
          -AL.ochre, bg: PAL.ink,
       78 -    animAxis: 'diag', animWaves: 2, colorMix: 0.12 } },
       79 -
       80 -  // ── fine grids / shirting ──
       81 -  { id: 'tattersall', label: 'Tattersall', params: {
       82 -    shape: 'prim:square', cols: 10, rows: 10, cell: 70, gap: 6, stret
          -ch: true, showGrid: true,
       83 -    colorRule: 'none', color: PAL.bone, color2: PAL.red, bg: PAL.bric
          -k,
       84 -    animAxis: 'radial', animWaves: 2, fade: 0.16 } },
       85 -  { id: 'glen-plaid', label: 'Glen plaid', params: {
       86 -    shape: 'prim:square', cols: 12, rows: 12, cell: 60, gap: 3, stret
          -ch: true,
       87 -    colorRule: 'checker', color: PAL.oat, color2: PAL.slate, bg: PAL.
          -cream,
       88 -    animAxis: 'diag', animWaves: 4, fade: 0.14 } },
       89 -  { id: 'prince-of-wales', label: 'Prince of Wales', params: {
       90 -    shape: 'prim:square', cols: 16, rows: 16, cell: 50, gap: 2, stret
          -ch: true, showGrid: true,
       91 -    colorRule: 'diag', color: PAL.bone, color2: PAL.slate, color3: PA
          -L.ochre, bg: PAL.oat,
       92 -    animAxis: 'diag', animWaves: 5, colorMix: 0.12 } },
       93 -  { id: 'tartan-fine', label: 'Tartan fine', params: {
       94 -    shape: 'prim:square', cols: 18, rows: 18, cell: 46, gap: 3, stret
          -ch: true, showGrid: true,
       95 -    colorRule: 'diag', color: PAL.teal, color2: PAL.navy, color3: PAL
          -.coral, bg: PAL.ink,
       96 -    animAxis: 'diag', animWaves: 5, colorMix: 0.14 } },
       97 -
       98 -  // ── bold scale ──
       99 -  { id: 'tartan-bold', label: 'Tartan bold', params: {
      100 -    shape: 'prim:square', cols: 3, rows: 3, cell: 210, gap: 8, stretc
          -h: true, showGrid: true,
      101 -    colorRule: 'diag', color: PAL.plum, color2: PAL.amber, color3: PA
          -L.teal, bg: PAL.noir,
      102 -    animAxis: 'diag', animWaves: 1, colorMix: 0.16 } },
      103 -  { id: 'picnic-check', label: 'Picnic check', params: {
      104 -    shape: 'prim:square', cols: 4, rows: 4, cell: 150, gap: 6, stretc
          -h: true,
      105 -    colorRule: 'checker', color: PAL.bone, color2: PAL.teal, bg: PAL.
          -cream,
      106 -    animAxis: 'diag', animWaves: 2, fade: 0.18 } },
       91  ]

⏺ Now Organic — metaball field families as the headline, keeping the genuine
  dot/abstract tile patterns:

⏺ Write(src/pages/pattern/categories/organic.js)
  ⎿  Added 51 lines, removed 72 lines
       1  import { R, PAL } from './_helpers.js'
       2
       3 -// ORGANIC — soft natural marks, not hard grids. Reliable techniques:
       4 -//   · dots/bubbles  = a `circle` field; gap sets density (positive =
         -polka spacing,
       5 -//     negative = overlapping cells/foam); colorRule checker/diag for
         -two-tone fills
       6 -//   · scatter       = an expression rule with hide:true thins a dense
         - field to a
       7 -//     sparse confetti/spore field (composeCell can only hide, never u
         -n-hide)
       8 -//   · honeycomb     = a `hexagon` field with a small positive gap so
         -cells near-tile
       9 -//   · petals/blossom= the abstract:* blob marks, given life via spin
         -/ swing
      10 -// Organic is the one category where slightly MORE life is good — radi
         -al sweeps with
      11 -// gentle fade/pulse breathe; still seamless (whole-int spin/flow, pau
         -sed on load).
       3 +// ORGANIC — soft natural marks. The headline is the metaball FIELD (r
         +ender:'field',
       4 +// field:'organic'): orbiting seeds sum into an iso-surface so blobs F
         +USE with smooth
       5 +// necks (color→color2→color3 depth ramp on the bg ground). camFlow dr
         +ives the orbit
       6 +// (whole cycles ⇒ seamless; paused on load).
       7 +//   blobCount  seed count    blobRadius  influence (× canvas)
       8 +//   threshold  iso level (higher = tighter)   warp  domain wobble
       9 +// Regular dot/abstract marks (polka, halftone, honeycomb, petals…) ar
         +e genuine TILE
      10 +// patterns, kept on the tile engine (no `render` ⇒ 'tiles').
      11
      12 +const blob = (o) => ({ render: 'field', field: 'organic', ...o })
      13 +
      14  export default [
      14 -  // ── dots & polka ──
      15 +  // ── metaballs (field) ──
      16 +  { id: 'blobs', label: 'Blobs', params: blob({
      17 +    blobCount: 9, blobRadius: 0.5, threshold: 1, warp: 0.2,
      18 +    color: PAL.sky, color2: PAL.teal, color3: PAL.navy, bg: PAL.ink })
         + },
      19 +  { id: 'lava', label: 'Lava', params: blob({
      20 +    blobCount: 7, blobRadius: 0.7, threshold: 0.9, warp: 0.3,
      21 +    color: PAL.gold, color2: PAL.rust, color3: PAL.brick, bg: PAL.noir
         + }) },
      22 +  { id: 'mercury', label: 'Mercury', params: blob({
      23 +    blobCount: 10, blobRadius: 0.5, threshold: 1.3, warp: 0.1,
      24 +    color: PAL.bone, color2: PAL.grey, color3: PAL.slate, bg: PAL.ink
         +}) },
      25 +  { id: 'foam', label: 'Foam', params: blob({
      26 +    blobCount: 16, blobRadius: 0.36, threshold: 1.1, warp: 0.25,
      27 +    color: PAL.bone, color2: PAL.oat, color3: PAL.cream, bg: PAL.teal
         +}) },
      28 +  { id: 'cells', label: 'Cells', params: blob({
      29 +    blobCount: 12, blobRadius: 0.5, threshold: 1.1, warp: 0.15,
      30 +    color: PAL.teal, color2: PAL.green, color3: PAL.forest, bg: PAL.in
         +k }) },
      31 +  { id: 'goo', label: 'Goo', params: blob({
      32 +    blobCount: 6, blobRadius: 0.8, threshold: 0.8, warp: 0.35,
      33 +    color: PAL.green, color2: PAL.moss, color3: PAL.olive, bg: PAL.noi
         +r }) },
      34 +  { id: 'magma', label: 'Magma', params: blob({
      35 +    blobCount: 8, blobRadius: 0.6, threshold: 0.95, warp: 0.4,
      36 +    color: PAL.amber, color2: PAL.coral, color3: PAL.red, bg: PAL.char
         + }) },
      37 +  { id: 'ooze', label: 'Ooze', params: blob({
      38 +    blobCount: 9, blobRadius: 0.6, threshold: 1, warp: 0.3,
      39 +    color: PAL.purple, color2: PAL.violet, color3: PAL.plum, bg: PAL.n
         +oir }) },
      40 +  { id: 'droplets', label: 'Droplets', params: blob({
      41 +    blobCount: 14, blobRadius: 0.42, threshold: 1.2, warp: 0.15,
      42 +    color: PAL.sky, color2: PAL.blue, color3: PAL.navy, bg: PAL.ink2 }
         +) },
      43 +  { id: 'nuclei', label: 'Nuclei', params: blob({
      44 +    blobCount: 5, blobRadius: 0.7, threshold: 0.85, warp: 0.2,
      45 +    color: PAL.amber, color2: PAL.gold, color3: PAL.ochre, bg: PAL.ink
         + }) },
      46 +
      47 +  // ── dots & polka (tiles) ──
      48    { id: 'polka', label: 'Polka', params: {
      49      shape: 'prim:circle', cols: 6, rows: 6, cell: 120, gap: 14,
      50      colorRule: 'checker', color: PAL.cream, color2: PAL.red, bg: PAL.i
          nk,
     ...
      57      shape: 'prim:circle', cols: 24, rows: 24, cell: 46, gap: 10,
      58      color: PAL.ink, bg: PAL.oat,
      59      animAxis: 'radial', animWaves: 4, fade: 0.2 } },
      27 -  { id: 'moons', label: 'Moons', params: {
      28 -    shape: 'prim:circle', cols: 8, rows: 6, cell: 110, gap: 16,
      29 -    colorRule: 'checker', color: PAL.amber, color2: PAL.ochre, bg: PAL
         -.noir,
      30 -    rules: [R({ selectKind: 'every-col', n: 2, opacity: 0.55 })],
      31 -    animAxis: 'col', animWaves: 2, fade: 0.3 } },
      32 -
      33 -  // ── bubbles & foam (overlap) ──
      34 -  { id: 'bubbles', label: 'Bubbles', params: {
      35 -    shape: 'prim:circle', cols: 7, rows: 7, cell: 140, gap: -28,
      36 -    color: PAL.sky, bg: PAL.ink2,
      37 -    rules: [R({ selectKind: 'checker', opacity: 0.6 })],
      38 -    animAxis: 'radial', animWaves: 2, pulse: 0.35, fade: 0.3, animCurv
         -eExpr: '1-(1-k)*(1-k)' } },
      39 -  { id: 'foam', label: 'Foam', params: {
      40 -    shape: 'prim:circle', cols: 18, rows: 18, cell: 70, gap: -22,
      41 -    color: PAL.bone, bg: PAL.teal,
      42 -    rules: [R({ selectKind: 'expression', expression: 'sin(col*3.1 + r
         -ow*1.7)', opacity: 0.5 })],
      43 -    animAxis: 'radial', animWaves: 4, pulse: 0.2, fade: 0.35 } },
      44 -  { id: 'pebbles', label: 'Pebbles', params: {
      45 -    shape: 'prim:circle', cols: 9, rows: 9, cell: 120, gap: -10,
      46 -    colorRule: 'checker', color: PAL.camel, color2: PAL.tan, bg: PAL.c
         -har,
      47 -    rules: [R({ selectKind: 'expression', expression: 'cos(col*2.3 + r
         -ow*4.1)', opacity: 0.7 })],
      48 -    animAxis: 'diag', animWaves: 2, fade: 0.25 } },
      49 -
      50 -  // ── halftone & screen ──
      60    { id: 'halftone', label: 'Halftone', params: {
      61      shape: 'prim:circle', cols: 22, rows: 22, cell: 52, gap: 6,
      62      color: PAL.ink, bg: PAL.bone,
      63      animAxis: 'radial', animWaves: 3, pulse: 0.4, animCurveExpr: 'pow(
          sin(PI*k),2)' } },
      55 -  { id: 'dot-screen', label: 'Dot screen', params: {
      56 -    shape: 'prim:circle', cols: 20, rows: 20, cell: 54, gap: 8,
      57 -    color: PAL.coral, bg: PAL.noir,
      58 -    animAxis: 'radial', animCycles: 1, animWaves: 4, pulse: 0.35, fade
         -: 0.3 } },
      59 -  { id: 'dappled', label: 'Dappled', params: {
      60 -    shape: 'prim:circle', cols: 10, rows: 10, cell: 100, gap: 8,
      61 -    colorRule: 'diag', color: PAL.green, color2: PAL.moss, color3: PAL
         -.olive, bg: PAL.forest,
      62 -    animAxis: 'diag', animWaves: 2, colorMix: 0.3, fade: 0.2 } },
      64
      64 -  // ── scatter & confetti ──
      65 +  // ── honeycomb & cells (tiles) ──
      66 +  { id: 'honeycomb', label: 'Honeycomb', params: {
      67 +    shape: 'prim:hexagon', cols: 8, rows: 8, cell: 120, gap: 6,
      68 +    color: PAL.gold, bg: PAL.ochre,
      69 +    animAxis: 'radial', animWaves: 2, fade: 0.2 } },
      70 +
      71 +  // ── scatter & confetti (tiles) ──
      72    { id: 'scatter', label: 'Scatter', params: {
      73      shape: 'prim:circle', cols: 16, rows: 16, cell: 80, gap: 8,
      74      color: PAL.gold, bg: PAL.ink,
     ...
       79      colorRule: 'diag', color: PAL.coral, color2: PAL.amber, color3: P
           AL.sky, bg: PAL.noir,
       80      rules: [R({ selectKind: 'expression', expression: 'cos(col*9.7 +
           row*4.3) - 0.1', hide: true })],
       81      animAxis: 'diag', animWaves: 3, swing: 30, colorMix: 0.3 } },
       75 -  { id: 'spores', label: 'Spores', params: {
       76 -    shape: 'prim:circle', cols: 20, rows: 20, cell: 56, gap: 12,
       77 -    color: PAL.purple, bg: PAL.plum,
       78 -    rules: [R({ selectKind: 'expression', expression: 'sin(col*8.3 +
          -row*11.1) - 0.3', hide: true })],
       79 -    animAxis: 'radial', animWaves: 4, pulse: 0.3, fade: 0.4 } },
       80 -  { id: 'sparkle', label: 'Sparkle', params: {
       81 -    shape: 'prim:star', cols: 18, rows: 18, cell: 64, gap: 12,
       82 -    color: PAL.amber, bg: PAL.ink2,
       83 -    rules: [R({ selectKind: 'expression', expression: 'sin(col*6.1 +
          -row*9.7) - 0.4', hide: true })],
       84 -    animAxis: 'radial', animWaves: 4, pulse: 0.4, swing: 25, animCurv
          -eExpr: 'pow(sin(PI*k),2)' } },
       82
       86 -  // ── honeycomb & cells ──
       87 -  { id: 'honeycomb', label: 'Honeycomb', params: {
       88 -    shape: 'prim:hexagon', cols: 8, rows: 8, cell: 120, gap: 6,
       89 -    color: PAL.gold, bg: PAL.ochre,
       90 -    animAxis: 'radial', animWaves: 2, fade: 0.2 } },
       91 -  { id: 'cells', label: 'Cells', params: {
       92 -    shape: 'prim:hexagon', cols: 6, rows: 6, cell: 140, gap: 4,
       93 -    colorRule: 'checker', color: PAL.teal, color2: PAL.green, bg: PAL
          -.ink,
       94 -    animAxis: 'radial', animWaves: 2, fade: 0.4, colorMix: 0.25 } },
       95 -
       96 -  // ── petals, blossom, coral (abstract blobs) ──
       83 +  // ── petals & blossom (abstract-blob tiles) ──
       84    { id: 'petals', label: 'Petals', params: {
       85      shape: 'abstract:abstract-01', cols: 6, rows: 6, cell: 150, gap:
           8,
       86      colorRule: 'checker', color: PAL.pink, color2: PAL.rose, bg: PAL.
           plum,
       87      spin: 1, animAxis: 'diag', animWaves: 2, swing: 35, fade: 0.25 }
           },
      101 -  { id: 'blossom', label: 'Blossom', params: {
      102 -    shape: 'abstract:abstract-06', cols: 5, rows: 5, cell: 170, gap:
          -10,
      103 -    colorRule: 'checker', color: PAL.coral, color2: PAL.amber, bg: PA
          -L.brick,
      104 -    animAxis: 'radial', animWaves: 2, pulse: 0.4, swing: 30, fade: 0.
          -3 } },
      105 -  { id: 'coral', label: 'Coral', params: {
      106 -    shape: 'abstract:abstract-03', cols: 7, rows: 7, cell: 130, gap:
          --8,
      107 -    colorRule: 'diag', color: PAL.rose, color2: PAL.red, color3: PAL.
          -coral, bg: PAL.noir,
      108 -    spin: 1, animAxis: 'radial', animWaves: 3, swing: 20, colorMix: 0
          -.3 } },
       88    { id: 'lily-pads', label: 'Lily pads', params: {
       89      shape: 'abstract:abstract-02', cols: 4, rows: 4, cell: 200, gap:
           12,
       90      colorRule: 'checker', color: PAL.green, color2: PAL.forest, bg: P
           AL.ink2,

⏺ Now make PatternControls aware of all three field families. Adding the sett-options
  import and the multi-family section:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 1 line
      11  import ColorField from '../../components/color/ColorField.jsx'
      12  import RuleRow from './RuleRow.jsx'
      13  import { SHAPE_OPTIONS } from '../../loops/pattern/shapes.js'
      14 +import { SETT_OPTIONS } from '../../loops/pattern/fields/setts.js'
      15  import { newRule, randomRule } from '../../loops/pattern/rules.js'
      16  import { FONT_OPTIONS, fontByKey } from '../kinetic/lib/vfAxes.js'
      17

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 45 lines, removed 11 lines
      192    // section (those tile controls don't apply to a continuous field).
            Colour is
      193    // shared — the field reads the palette (color/color2/color3 + bg g
           round).
      194    if (v.render === 'field') {
      195 +    const field = v.field || 'stripes'
      196      return (
      197        <>
      197 -        <Section label="Stripes">
      198 -          <Slider labeled label="Angle" min={0} max={180} step={1} va
          -lue={v.stripeAngle ?? 0} onChange={(x) => onChange('stripeAngle', rou
          -ndIfNum(x))} variant="default" />
      199 -          <Slider labeled label="Pitch" min={8} max={240} step={1} va
          -lue={v.stripePitch ?? 60} onChange={(x) => onChange('stripePitch', ro
          -undIfNum(x))} variant="default" />
      200 -          <Slider labeled label="Bands" min={1} max={3} step={1} valu
          -e={v.bandCount ?? 2} onChange={(x) => onChange('bandCount', roundIfNu
          -m(x))} variant="default" />
      201 -          <Slider labeled label="Duty" min={0.05} max={1} step={0.05}
          - value={v.duty ?? 1} onChange={(x) => onChange('duty', x)} variant="d
          -efault" />
      202 -          <Slider labeled label="Softness" min={0} max={1} step={0.05
          -} value={v.edgeSoftness ?? 0} onChange={(x) => onChange('edgeSoftness
          -', x)} variant="default" />
      203 -        </Section>
      198 +        {field === 'stripes' && (
      199 +          <Section label="Stripes">
      200 +            <Slider labeled label="Angle" min={0} max={180} step={1}
          +value={v.stripeAngle ?? 0} onChange={(x) => onChange('stripeAngle', r
          +oundIfNum(x))} variant="default" />
      201 +            <Slider labeled label="Pitch" min={8} max={240} step={1}
          +value={v.stripePitch ?? 60} onChange={(x) => onChange('stripePitch',
          +roundIfNum(x))} variant="default" />
      202 +            <Slider labeled label="Bands" min={1} max={3} step={1} va
          +lue={v.bandCount ?? 2} onChange={(x) => onChange('bandCount', roundIf
          +Num(x))} variant="default" />
      203 +            <Slider labeled label="Duty" min={0.05} max={1} step={0.0
          +5} value={v.duty ?? 1} onChange={(x) => onChange('duty', x)} variant=
          +"default" />
      204 +            <Slider labeled label="Softness" min={0} max={1} step={0.
          +05} value={v.edgeSoftness ?? 0} onChange={(x) => onChange('edgeSoftne
          +ss', x)} variant="default" />
      205 +          </Section>
      206 +        )}
      207 +        {field === 'tartan' && (
      208 +          <Section label="Tartan">
      209 +            <LabeledControl inline label="Sett">
      210 +              <Dropdown variant="subtle" size="sm" className="w-full"
          + options={SETT_OPTIONS} value={v.sett ?? 'black-watch'} onChange={(va
          +l) => onChange('sett', val)} />
      211 +            </LabeledControl>
      212 +            <Slider labeled label="Scale" min={2} max={20} step={1} v
          +alue={v.settScale ?? 5} onChange={(x) => onChange('settScale', roundI
          +fNum(x))} variant="default" />
      213 +            <Slider labeled label="Twill" min={0} max={0.4} step={0.0
          +2} value={v.twill ?? 0.18} onChange={(x) => onChange('twill', x)} var
          +iant="default" />
      214 +          </Section>
      215 +        )}
      216 +        {field === 'organic' && (
      217 +          <Section label="Organic">
      218 +            <Slider labeled label="Blobs" min={2} max={16} step={1} v
          +alue={v.blobCount ?? 9} onChange={(x) => onChange('blobCount', roundI
          +fNum(x))} variant="default" />
      219 +            <Slider labeled label="Radius" min={0.2} max={1.2} step={
          +0.05} value={v.blobRadius ?? 0.5} onChange={(x) => onChange('blobRadi
          +us', x)} variant="default" />
      220 +            <Slider labeled label="Threshold" min={0.5} max={2} step=
          +{0.05} value={v.threshold ?? 1} onChange={(x) => onChange('threshold'
          +, x)} variant="default" />
      221 +            <Slider labeled label="Warp" min={0} max={1} step={0.05}
          +value={v.warp ?? 0.2} onChange={(x) => onChange('warp', x)} variant="
          +default" />
      222 +          </Section>
      223 +        )}
      224          <Section label="Colour">
      205 -          {colorCtl('Colour A', 'color')}
      206 -          {(v.bandCount ?? 2) >= 2 && colorCtl('Colour B', 'color2')}
      207 -          {(v.bandCount ?? 2) >= 3 && colorCtl('Colour C', 'color3')}
      208 -          {(v.duty ?? 1) < 1 && colorCtl('Ground', 'bg')}
      225 +          {field === 'stripes' && <>
      226 +            {colorCtl('Colour A', 'color')}
      227 +            {(v.bandCount ?? 2) >= 2 && colorCtl('Colour B', 'color2'
          +)}
      228 +            {(v.bandCount ?? 2) >= 3 && colorCtl('Colour C', 'color3'
          +)}
      229 +            {(v.duty ?? 1) < 1 && colorCtl('Ground', 'bg')}
      230 +          </>}
      231 +          {field === 'tartan' && <>
      232 +            {colorCtl('Colour 1', 'color')}
      233 +            {colorCtl('Colour 2', 'color2')}
      234 +            {colorCtl('Colour 3', 'color3')}
      235 +            {colorCtl('Ground', 'bg')}
      236 +          </>}
      237 +          {field === 'organic' && <>
      238 +            {colorCtl('Surface', 'color')}
      239 +            {colorCtl('Mid', 'color2')}
      240 +            {colorCtl('Deep', 'color3')}
      241 +            {colorCtl('Ground', 'bg')}
      242 +          </>}
      243          </Section>
      244        </>
      245      )

⏺ Build, then verify Tartan + Organic fields render and stay seamless:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could not resolve" | tail -5)
  ⎿  ✓ built in 2.71s
  ⎿  Allowed by auto mode classifier

⏺ Bash(node --input-type=module -e '
      import { tartanColorAt } from "./src/loops/pattern/fields/tartanField.js";…)
  ⎿  tartan seam u0==u1: true
     tartan distinct tones: 9 (expect several — solids + crossings)
     organic seam u0==u1: false
     … +2 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Tartan is clean (seamless, 9 distinct tones). Organic blobs render and fuse (inside
  frac 0.56), but the exact u=0 vs u=1 check failed — likely float epsilon at the iso
  rim (the metaball orbits via cos(cam.phase), and cos(2π)≠cos(0) bit-exactly), not a
  real tear. Let me confirm it's tiny edge-only differences, since the live loop wraps
  u%1 and never renders u=1:

⏺ Bash(node --input-type=module -e '
      import { metaballColorAt } from "./src/loops/pattern/fields/metaballField.js";…)
  ⎿  u=0 vs u=1 (exact):    {"pct":"25.750","maxd":"0.0"}
     u=0 vs u=0.999 (live): {"pct":"32.098","maxd":"7.8"}
     continuity u=0 vs u=0.001: {"pct":"32.100","maxd":"7.7"}
  ⎿  Allowed by auto mode classifier

⏺ Resolved: u=0 vs u=1 max delta is 0.0 (the 25% "differ" is ~1e-14 float noise), and
  the motion is continuous across the wrap (u=0.999→0→0.001 all within ~7.8). The live
  loop wraps u%1 so it's genuinely seamless. Phase 2 done, build green.

  Now Phase 3 — Interlace weave. Let me re-read the current draw() kernels I need to
  reuse verbatim in drawWeave:

  Read 1 file (ctrl+o to expand)

⏺ Got the kernel. Now let me read the Interlace and Blocks preset files for Phase 3:

  Read 2 files (ctrl+o to expand)

⏺ Phase 3. Adding the weave engine to patternLoop.js — drawWeave (reusing the
  camera/window/wrap kernels) + the parity function + dispatch + defaults:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 63 lines
       82    raster(ctx, w, h, make(p, cam, w, h))
       83  }
       84
       85 +// Weave (render:'weave') — true over/under interlacing. Per crossing
          + the warp
       86 +// (vertical) and weft (horizontal) ribbons overlap; a parity fn deci
          +des which is
       87 +// drawn SECOND (on top), so strands genuinely pass over and under ac
          +ross the field.
       88 +const parityWeave = (type, col, row) => {
       89 +  switch (type) {
       90 +    case 'twill':  return ((((col - row) % 4) + 4) % 4) < 2     // di
          +agonal wales
       91 +    case 'satin':  return (((col * 2 + row * 3) % 5) + 5) % 5 === 0 /
          +/ sparse floats
       92 +    case 'basket': return ((Math.floor(col / 2) + Math.floor(row / 2)
          +) & 1) === 0
       93 +    default:       return ((col + row) & 1) === 0                // p
          +lain
       94 +  }
       95 +}
       96 +function drawWeave(ctx, u, w, h, p) {
       97 +  const cols = Math.max(1, p.cols | 0)
       98 +  const rows = Math.max(1, p.rows | 0)
       99 +  const cell = Math.max(8, p.cell)
      100 +  const period = cell + (p.gap || 0)
      101 +  if (period <= 0) return
      102 +  const z = p.camZoom || 1
      103 +  const ang = (p.camAngle || 0) * Math.PI / 180
      104 +  const flow = Math.round(p.camFlow || 0)
      105 +  const half = Math.max(1, (p.strandWidth ?? 0.7) * cell) / 2
      106 +  const weave = p.weaveType || 'plain'
      107 +  const warpCol = p.color, weftCol = p.color2 || p.color
      108 +  const warpLit = mixHex(warpCol, '#ffffff', 0.2), weftLit = mixHex(w
          +eftCol, '#ffffff', 0.2)
      109 +  const len = period // ribbons span the full cell so strands read co
          +ntinuous
      110 +
      111 +  ctx.save()
      112 +  ctx.translate(w / 2, h / 2)
      113 +  ctx.rotate(ang)
      114 +  ctx.scale(z, z)
      115 +
      116 +  const reach = (Math.hypot(w, h) / 2) / z + period * 2
      117 +  const g0 = Math.floor(-reach / period), g1 = Math.ceil(reach / peri
          +od)
      118 +
      119 +  // ribbon = base fill + a centre sheen (tube/cord read).
      120 +  const ribbon = (cx, cy, vert, base, lit) => {
      121 +    ctx.fillStyle = base
      122 +    if (vert) ctx.fillRect(cx - half, cy - len / 2, half * 2, len)
      123 +    else ctx.fillRect(cx - len / 2, cy - half, len, half * 2)
      124 +    ctx.fillStyle = lit
      125 +    const sh = half * 0.6
      126 +    if (vert) ctx.fillRect(cx - sh, cy - len / 2, sh * 2, len)
      127 +    else ctx.fillRect(cx - len / 2, cy - sh, len, sh * 2)
      128 +  }
      129 +
      130 +  let count = 0
      131 +  for (let gy = g0; gy <= g1; gy++) {
      132 +    for (let gx = g0; gx <= g1; gx++) {
      133 +      if (++count > MAX_CELLS) { ctx.restore(); return }
      134 +      const col = ((gx % cols) + cols) % cols
      135 +      const row = ((gy % rows) + rows) % rows
      136 +      const cx = gx * period, cy = gy * period
      137 +      let warpOver = parityWeave(weave, col, row)
      138 +      // travel: the over/under boundary sweeps diagonally on play (w
          +hole cycles
      139 +      // ⇒ seamless). flow=0 ⇒ static weave.
      140 +      if (flow) warpOver = warpOver !== (Math.sin(u * TAU * flow - (g
          +x + gy) * 0.6) > 0)
      141 +      if (warpOver) { ribbon(cx, cy, false, weftCol, weftLit); ribbon
          +(cx, cy, true, warpCol, warpLit) }
      142 +      else { ribbon(cx, cy, true, warpCol, warpLit); ribbon(cx, cy, f
          +alse, weftCol, weftLit) }
      143 +    }
      144 +  }
      145 +  ctx.restore()
      146 +}
      147 +
      148  export default {
      149    id: 'pattern-rules',
      150    label: 'Pattern',

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 1 line
      237      // Render dispatch: field families bypass the tile loop entirely.
            'tiles'
      238      // (default) falls through to the original engine below — Blocks'
            native case.
           , h, p)
      240 +    if (p.render === 'weave') return drawWeave(ctx, u, w, h, p)
      241
      242      const shp = shapeFor(p.shape, p.customSvg, p)
      243      if (!shp.paths.length) return

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines
      210      blobRadius: 0.5,     // seed influence radius (× canvas)
      211      threshold: 1,        // iso level — higher = tighter blobs
      212      warp: 0.2,           // domain-warp wobble
      213 +    // Weave render (render:'weave') — interlaced over/under strands
      214 +    weaveType: 'plain',  // plain | twill | satin | basket (which str
          +and goes over)
      215 +    strandWidth: 0.7,    // ribbon width (× cell)
      216      camZoom: 1,
      217      camFlow: 1,
      218      camAngle: 0,

⏺ Re-author Interlace — true over/under weaves onto the weave engine, keeping
  herringbone/lattice/chainlink as genuine tiles:

⏺ Write(src/pages/pattern/categories/interlace.js)
  ⎿  Added 51 lines, removed 115 lines
        1  import { R, PAL } from './_helpers.js'
        2
        3 -// INTERLACE — woven, crossing, and knotted structures. Three reliabl
          -e techniques:
        4 -//   · warp/weft  = `prim:bar` base; an every-col:2 rule rotates alte
          -rnate columns
        5 -//     90° → vertical strips cross horizontal ones. A checker opacity
          - rule creates
        6 -//     the over/under depth illusion. Works for plain weave, twill, b
          -asketweave.
        7 -//   · lattice    = `prim:plus` with a positive gap + showGrid. Plus
          -marks at each
        8 -//     cell node + the showGrid lattice line = a two-layer trellis re
          -ad.
        9 -//   · chainlink  = `prim:diamond` with negative gap (overlap) so dia
          -mond edges
       10 -//     interlock. colorRule:checker or diag gives the link separation
          -.
       11 -// Scale: big-and-few (trellis cols:4) → fine mesh (cols:20+).
        3 +// INTERLACE — woven, crossing, knotted structures. The true over/und
          +er weaves are a
        4 +// dedicated WEAVE pass (render:'weave'): warp (vertical) + weft (hor
          +izontal) ribbons
        5 +// cross, and a `weaveType` parity decides which passes OVER at each
          +crossing — real
        6 +// z-ordering, not a fake opacity check.
        7 +//   weaveType   plain · twill · satin · basket       strandWidth  ri
          +bbon width (× cell)
        8 +//   color = warp · color2 = weft · bg = gaps         cols/rows/cell/
          +gap = the lattice
        9 +// camFlow travels the over/under boundary diagonally (whole cycles ⇒
          + seamless).
       10 +// Herringbone, lattice/trellis and chainlink are genuine TILE tessel
          +lations (not
       11 +// over/under weaves), so they stay on the tile engine (no `render` ⇒
          + 'tiles').
       12
       13 +const weave = (o) => ({ render: 'weave', ...o })
       14 +
       15  export default [
       14 -  // ── plain weave family ──
       15 -  { id: 'plain-weave', label: 'Plain weave', params: {
       16 -    shape: 'prim:bar', cols: 8, rows: 8, cell: 90, gap: 6,
       17 -    color: PAL.camel, bg: PAL.tan,
       18 -    rules: [
       19 -      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
       20 -      R({ selectKind: 'checker', opacity: 0.65 }),
       21 -    ],
       22 -    animAxis: 'diag', animWaves: 2, fade: 0.2, animCurveExpr: 'k<0.5?
          -2*k*k:1-2*(1-k)*(1-k)' } },
       16 +  // ── true weaves (over/under) ──
       17 +  { id: 'plain-weave', label: 'Plain weave', params: weave({
       18 +    weaveType: 'plain', cols: 8, rows: 8, cell: 90, gap: 4, strandWid
          +th: 0.74,
       19 +    color: PAL.camel, color2: PAL.tan, bg: PAL.char }) },
       20 +  { id: 'linen-weave', label: 'Linen weave', params: weave({
       21 +    weaveType: 'plain', cols: 12, rows: 12, cell: 66, gap: 4, strandW
          +idth: 0.72,
       22 +    color: PAL.oat, color2: PAL.bone, bg: PAL.slate }) },
       23 +  { id: 'twill-weave', label: 'Twill weave', params: weave({
       24 +    weaveType: 'twill', cols: 10, rows: 10, cell: 78, gap: 4, strandW
          +idth: 0.76,
       25 +    color: PAL.navy, color2: PAL.blue, bg: PAL.ink }) },
       26 +  { id: 'basketweave', label: 'Basketweave', params: weave({
       27 +    weaveType: 'basket', cols: 8, rows: 8, cell: 88, gap: 4, strandWi
          +dth: 0.8,
       28 +    color: PAL.amber, color2: PAL.ochre, bg: PAL.noir }) },
       29 +  { id: 'satin-weave', label: 'Satin weave', params: weave({
       30 +    weaveType: 'satin', cols: 10, rows: 10, cell: 76, gap: 3, strandW
          +idth: 0.78,
       31 +    color: PAL.gold, color2: PAL.amber, bg: PAL.ink }) },
       32 +  { id: 'mesh', label: 'Mesh', params: weave({
       33 +    weaveType: 'plain', cols: 16, rows: 16, cell: 60, gap: 5, strandW
          +idth: 0.5,
       34 +    color: PAL.ink, color2: PAL.slate, bg: PAL.bone }) },
       35 +  { id: 'loom', label: 'Loom', params: weave({
       36 +    weaveType: 'plain', cols: 8, rows: 10, cell: 84, gap: 4, strandWi
          +dth: 0.78,
       37 +    color: PAL.red, color2: PAL.amber, bg: PAL.ink }) },
       38 +  { id: 'cable', label: 'Cable', params: weave({
       39 +    weaveType: 'basket', cols: 6, rows: 6, cell: 120, gap: 6, strandW
          +idth: 0.82,
       40 +    color: PAL.cream, color2: PAL.coral, bg: PAL.brick }) },
       41
       24 -  { id: 'linen-weave', label: 'Linen weave', params: {
       25 -    shape: 'prim:bar', cols: 12, rows: 12, cell: 68, gap: 4,
       26 -    color: PAL.oat, bg: PAL.bone,
       27 -    rules: [
       28 -      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
       29 -      R({ selectKind: 'checker', opacity: 0.6 }),
       30 -    ],
       31 -    animAxis: 'diag', animWaves: 3, fade: 0.18 } },
       32 -
       33 -  { id: 'twill-weave', label: 'Twill weave', params: {
       34 -    shape: 'prim:bar', cols: 10, rows: 10, cell: 78, gap: 5,
       35 -    colorRule: 'diag', color: PAL.navy, color2: PAL.blue, color3: PAL
          -.sky, bg: PAL.ink,
       36 -    rules: [
       37 -      R({ selectKind: 'every-col', n: 3, offset: 0, rotate: 90 }),
       38 -      R({ selectKind: 'every-col', n: 3, offset: 1, rotate: 90 }),
       39 -      R({ selectKind: 'checker', opacity: 0.7 }),
       40 -    ],
       41 -    animAxis: 'diag', animWaves: 3, colorMix: 0.15, fade: 0.2 } },
       42 -
       43 -  { id: 'basketweave', label: 'Basketweave', params: {
       44 -    shape: 'prim:bar', cols: 8, rows: 8, cell: 88, gap: 6,
       45 -    color: PAL.amber, bg: PAL.ochre,
       46 -    rules: [
       47 -      R({ selectKind: 'checker', groupW: 2, groupH: 2, rotate: 90 }),
       48 -      R({ selectKind: 'every-nth', n: 5, offset: 0, opacity: 0.65 }),
       49 -    ],
       50 -    animAxis: 'diag', animWaves: 2, fade: 0.2 } },
       51 -
       52 -  { id: 'satin-weave', label: 'Satin weave', params: {
       53 -    shape: 'prim:bar', cols: 10, rows: 10, cell: 76, gap: 5,
       54 -    colorRule: 'diag', color: PAL.gold, color2: PAL.amber, color3: PA
          -L.ochre, bg: PAL.ink,
       55 -    rules: [
       56 -      R({ selectKind: 'every-col', n: 5, offset: 0, rotate: 90 }),
       57 -      R({ selectKind: 'every-row', n: 5, offset: 2, opacity: 0.55 }),
       58 -    ],
       59 -    animAxis: 'diag', animWaves: 2, colorMix: 0.18, fade: 0.22 } },
       60 -
       61 -  // ── herringbone & chevron ──
       42 +  // ── herringbone & chevron — genuine triangle tessellations (tiles
          +) ──
       43    { id: 'herringbone', label: 'Herringbone', params: {
       44      shape: 'prim:triangle', cols: 10, rows: 10, cell: 76, gap: -2,
       45      colorRule: 'checker', color: PAL.camel, color2: PAL.tan, bg: PAL.
           char,
       65 -    rules: [
       66 -      R({ selectKind: 'every-col', n: 2, flipH: true }),
       67 -      R({ selectKind: 'every-row', n: 2, flipV: true }),
       68 -    ],
       46 +    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ se
          +lectKind: 'every-row', n: 2, flipV: true })],
       47      animAxis: 'diag', animWaves: 3, fade: 0.18 } },
       70 -
       48    { id: 'herringbone-bold', label: 'Herringbone bold', params: {
       49      shape: 'prim:triangle', cols: 6, rows: 6, cell: 120, gap: -4,
       50      colorRule: 'checker', color: PAL.navy, color2: PAL.bone, bg: PAL.
           ink,
       74 -    rules: [
       75 -      R({ selectKind: 'every-col', n: 2, flipH: true }),
       76 -      R({ selectKind: 'every-row', n: 2, flipV: true }),
       77 -    ],
       51 +    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ se
          +lectKind: 'every-row', n: 2, flipV: true })],
       52      animAxis: 'diag', animWaves: 2, fade: 0.16 } },
       79 -
       53    { id: 'chevron-weave', label: 'Chevron weave', params: {
       54      shape: 'prim:triangle', cols: 8, rows: 8, cell: 90, gap: 0,
       55      colorRule: 'rows', color: PAL.teal, color2: PAL.sky, color3: PAL.
           navy, bg: PAL.ink2,
       83 -    rules: [
       84 -      R({ selectKind: 'every-col', n: 2, flipH: true }),
       85 -      R({ selectKind: 'every-row', n: 2, flipV: true }),
       86 -    ],
       56 +    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ se
          +lectKind: 'every-row', n: 2, flipV: true })],
       57      animAxis: 'diag', animWaves: 3, colorMix: 0.15, fade: 0.2 } },
       58
       89 -  // ── lattice & trellis ──
       59 +  // ── lattice & trellis (tiles) ──
       60    { id: 'trellis', label: 'Trellis', params: {
       61      shape: 'prim:plus', cols: 4, rows: 4, cell: 170, gap: 10, showGri
           d: true,
       62      color: PAL.forest, bg: PAL.moss,
       63      animAxis: 'radial', animWaves: 1, fade: 0.2 } },
       94 -
       64    { id: 'lattice', label: 'Lattice', params: {
       65      shape: 'prim:plus', cols: 8, rows: 8, cell: 90, gap: 6, showGrid:
            true,
       66      colorRule: 'checker', color: PAL.cream, color2: PAL.oat, bg: PAL.
           brick,
       67      animAxis: 'diag', animWaves: 2, fade: 0.2 } },
       99 -
       68    { id: 'diamond-lattice', label: 'Diamond lattice', params: {
       69      shape: 'prim:diamond', cols: 6, rows: 6, cell: 110, gap: -6, show
           Grid: true,
       70      colorRule: 'checker', color: PAL.sky, color2: PAL.teal, bg: PAL.i
           nk,
       71      animAxis: 'diag', animWaves: 2, fade: 0.22 } },
      104 -
       72    { id: 'caning', label: 'Caning', params: {
       73      shape: 'prim:plus', cols: 16, rows: 16, cell: 62, gap: 4, showGri
           d: true,
       74      color: PAL.camel, bg: PAL.tan,
       75      animAxis: 'radial', animWaves: 4, fade: 0.18 } },
       76 +  { id: 'grid-weave', label: 'Grid weave', params: {
       77 +    shape: 'prim:plus', cols: 20, rows: 20, cell: 55, gap: 5, showGri
          +d: true,
       78 +    color: PAL.bone, bg: PAL.char,
       79 +    animAxis: 'diag', animWaves: 5, fade: 0.18 } },
       80
      110 -  // ── chainlink & reef ──
       81 +  // ── chainlink & netting (tiles) ──
       82    { id: 'chainlink', label: 'Chainlink', params: {
       83      shape: 'prim:diamond', cols: 8, rows: 8, cell: 96, gap: -12,
       84      colorRule: 'checker', color: PAL.slate, color2: PAL.bone, bg: PAL
           .ink,
       85      animAxis: 'diag', animWaves: 2, fade: 0.2, animCurveExpr: 'k<0.5?
           2*k*k:1-2*(1-k)*(1-k)' } },
      115 -
       86    { id: 'chainlink-gold', label: 'Chainlink gold', params: {
       87      shape: 'prim:diamond', cols: 6, rows: 6, cell: 120, gap: -14,
       88      colorRule: 'checker', color: PAL.gold, color2: PAL.amber, bg: PAL
           .ink,
       89      animAxis: 'diag', animWaves: 2, fade: 0.22 } },
      120 -
      121 -  { id: 'reef-knot', label: 'Reef knot', params: {
      122 -    shape: 'prim:square', cols: 6, rows: 6, cell: 110, gap: 0, stretc
          -h: true, showGrid: true,
      123 -    colorRule: 'checker', color: PAL.teal, color2: PAL.navy, bg: PAL.
          -ink,
      124 -    rules: [R({ selectKind: 'checker', rotate: 45 })],
      125 -    animAxis: 'diag', animWaves: 2, fade: 0.18 } },
      126 -
      127 -  // ── mesh & netting ──
      128 -  { id: 'mesh', label: 'Mesh', params: {
      129 -    shape: 'prim:bar', cols: 16, rows: 16, cell: 62, gap: 4,
      130 -    color: PAL.ink, bg: PAL.bone,
      131 -    rules: [
      132 -      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
      133 -    ],
      134 -    animAxis: 'diag', animWaves: 4, fade: 0.2 } },
      135 -
       90    { id: 'netting', label: 'Netting', params: {
       91      shape: 'prim:diamond', cols: 10, rows: 10, cell: 78, gap: -4,
       92      color: PAL.sky, bg: PAL.ink2,
       93      rules: [R({ selectKind: 'every-nth', n: 3, offset: 1, opacity: 0.
           55 })],
       94      animAxis: 'radial', animWaves: 3, fade: 0.25 } },
      141 -
      142 -  { id: 'grid-weave', label: 'Grid weave', params: {
      143 -    shape: 'prim:plus', cols: 20, rows: 20, cell: 55, gap: 5, showGri
          -d: true,
      144 -    color: PAL.bone, bg: PAL.char,
      145 -    animAxis: 'diag', animWaves: 5, fade: 0.18 } },
      146 -
      147 -  // ── loom / cable (bold textile feel) ──
      148 -  { id: 'loom', label: 'Loom', params: {
      149 -    shape: 'prim:bar', cols: 8, rows: 10, cell: 84, gap: 6,
      150 -    colorRule: 'cols', color: PAL.red, color2: PAL.amber, color3: PAL
          -.navy, bg: PAL.ink,
      151 -    rules: [
      152 -      R({ selectKind: 'every-row', n: 2, offset: 0, rotate: 90, opaci
          -ty: 0.7 }),
      153 -    ],
      154 -    animAxis: 'col', animWaves: 3, colorMix: 0.15, fade: 0.2 } },
      155 -
      156 -  { id: 'cable', label: 'Cable', params: {
      157 -    shape: 'prim:bar', cols: 6, rows: 6, cell: 120, gap: 8,
      158 -    colorRule: 'checker', color: PAL.cream, color2: PAL.coral, bg: PA
          -L.brick,
      159 -    rules: [
      160 -      R({ selectKind: 'every-col', n: 2, offset: 0, rotate: 90 }),
      161 -      R({ selectKind: 'checker', groupW: 2, groupH: 2, opacity: 0.7 }
          -),
      162 -    ],
      163 -    animAxis: 'diag', animWaves: 2, fade: 0.2 } },
       95 +  { id: 'reef-knot', label: 'Reef knot', params: {
       96 +    shape: 'prim:square', cols: 6, rows: 6, cell: 110, gap: 0, stretc
          +h: true, showGrid: true,
       97 +    colorRule: 'checker', color: PAL.teal, color2: PAL.navy, bg: PAL.
          +ink,
       98 +    rules: [R({ selectKind: 'checker', rotate: 45 })],
       99 +    animAxis: 'diag', animWaves: 2, fade: 0.18 } },
      100  ]

⏺ Now the weave controls in PatternControls (a new render === 'weave' branch, before
  the tile structure):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 22 lines
      245      )
      246    }
      247
      248 +  // Weave render — interlaced over/under strands (no tile Shape/Grid
          +/Rules).
      249 +  if (v.render === 'weave') {
      250 +    return (
      251 +      <>
      252 +        <Section label="Weave">
      253 +          <LabeledControl inline label="Type">
      254 +            <Dropdown variant="subtle" size="sm" className="w-full" o
          +ptions={WEAVE_OPTIONS} value={v.weaveType ?? 'plain'} onChange={(val)
          + => onChange('weaveType', val)} />
      255 +          </LabeledControl>
      256 +          <Slider labeled label="Columns" min={2} max={28} step={1} v
          +alue={v.cols} onChange={(x) => onChange('cols', roundIfNum(x))} varia
          +nt="default" />
      257 +          <Slider labeled label="Rows" min={2} max={28} step={1} valu
          +e={v.rows} onChange={(x) => onChange('rows', roundIfNum(x))} variant=
          +"default" />
      258 +          <Slider labeled label="Cell" min={40} max={240} step={1} va
          +lue={v.cell} onChange={(x) => onChange('cell', roundIfNum(x))} varian
          +t="default" />
      259 +          <Slider labeled label="Strand" min={0.3} max={0.95} step={0
          +.02} value={v.strandWidth ?? 0.7} onChange={(x) => onChange('strandWi
          +dth', x)} variant="default" />
      260 +        </Section>
      261 +        <Section label="Colour">
      262 +          {colorCtl('Warp', 'color')}
      263 +          {colorCtl('Weft', 'color2')}
      264 +          {colorCtl('Ground', 'bg')}
      265 +        </Section>
      266 +      </>
      267 +    )
      268 +  }
      269 +
      270    const rules = v.rules || []
      271    const setRules = (r) => onChange('rules', r)
      272    const addRule = () => setRules([...rules, newRule()])

⏺ I referenced WEAVE_OPTIONS — let me define it alongside the other option consts:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 7 lines
      67    { id: 'ripple',     label: 'Ripple',       params: { spin: 0, animAx
          is: 'radial', animCycles: 1, animWaves: 4, animCurveExpr: '',
                  pulse: 0.5, fade: 0.5, swing: 0,  colorMix: 0 } },
      68  ]
      69
      70 +const WEAVE_OPTIONS = [
      71 +  { value: 'plain', label: 'Plain' },
      72 +  { value: 'twill', label: 'Twill' },
      73 +  { value: 'satin', label: 'Satin' },
      74 +  { value: 'basket', label: 'Basket' },
      75 +]
      76 +
      77  const SWEEP_AXES = [
      78    { value: 'none', label: 'None' },
      79    { value: 'diag', label: 'Diagonal' },

⏺ Phase 3 wired. Blocks needs no engine change (the stepped re-tile cascade it wants is
  already exemplified in pixel-check/static-field, and you confirmed it's good — I'm
  not churning what works). Build:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could not resolve|is not
      defined" | tail -5)
  ⎿  ✓ built in 2.82s
  ⎿  Allowed by auto mode classifier

⏺ Build green. The weave draws to a canvas (no node Canvas2D), so let me verify via a
  mock ctx that draw() runs the weave path and produces strands, plus check the parity
  logic gives real over/under variation per weave type:

⏺ Bash(node --input-type=module -e '
      import patternLoop from "./src/loops/pattern/patternLoop.js";…)
  ⎿  Error: Exit code 1
     file:///Users/biskup/dev/projects/kol-apparat/kol-labs-single/src/loops/pattern/sh
     apes.js:6
     const abstractModules = import.meta.glob('./shapes/*.svg', { eager: true, query:
     '?raw', import: 'default' })
                                         ^

     TypeError: (intermediate value).glob is not a function
         at file:///Users/biskup/dev/projects/kol-apparat/kol-labs-single/src/loops/pat
     tern/shapes.js:6:37
         at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
         at async onImport.tracePromise.__proto__
     (node:internal/modules/esm/loader:227:26)
         at async ModuleLoader.executeModuleJob
     (node:internal/modules/esm/loader:224:20)
     … +3 lines (ctrl+o to expand)

⏺ patternLoop pulls in Vite-only import.meta.glob, so node can't import it. Let me
  verify the parity logic standalone (the over/under correctness) — drawWeave rendering
  itself needs the live eyeball:

⏺ Bash(node --input-type=module -e '
      const par=(t,c,r)=>{switch(t){case "twill":return ((((c-r)%4)+4)%4)<2;case
      "satin":return (((c*2+r*3)%5)+5)%5===0;case "basket":re…)
  ⎿  parity plain: 72/144 warp-over (both >0 = real over/under interlace)
     parity twill: 72/144 warp-over (both >0 = real over/under interlace)
     parity satin: 30/144 warp-over (both >0 = real over/under interlace)
     … +2 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Weave verified: all four types give real over/under (plain/twill/basket 50/50, satin
  sparse floats), and travel has 0 parity flips u=0→u=1 (seamless). Final consolidated
  build:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error" | tail -3)
  ⎿  ✓ built in 2.94s
  ⎿  Allowed by auto mode classifier

⏺ All phases build green. Let me finish the one cross-cutting item I flagged — gate the
  inert Form axis for field/weave renders (their motion lives on Frame→Flow), so it's
  not a dead tab. Reading the current animation branch to make precise edits:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 4 lines
      133        const opts = presets.map((p) => ({ value: p.id, label: p.label
           }))
      134        return (val == null || val === 'custom') ? [{ value: 'custom',
           label: 'Custom' }, ...opts] : opts
      135      }
      136 +    // Form (the per-cell sweep) is a TILE concept — field/weave rend
          +ers move on the
      137 +    // Frame axis only (stripe drift · tartan scroll · organic orbit
          +· weave travel,
      138 +    // all driven by Frame → Flow). So hide the whole Form axis when
          +not on tiles.
      139 +    const tilesRender = (v.render ?? 'tiles') === 'tiles'
      140      return (
      141        <>
      142          {/* Quick-select layer: pick the Frame + Pattern motion prese
           ts without

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 10 lines, removed 6 lines
      146            <LabeledControl inline label="Frame">
      147              <Dropdown variant="subtle" size="sm" className="w-full" o
           ptions={presetOpts(FRAME_PRESETS, v.framePreset)} value={v.framePrese
           t ?? 'custom'} onChange={applyPreset('framePreset', FRAME_PRESETS)} /
           >
      148            </LabeledControl>
      149 -          <LabeledControl inline label="Form">
      150 -            <Dropdown variant="subtle" size="sm" className="w-full" o
          -ptions={presetOpts(FORM_PRESETS, v.formPreset)} value={v.formPreset ?
          -? 'custom'} onChange={applyPreset('formPreset', FORM_PRESETS)} />
      151 -          </LabeledControl>
      149 +          {tilesRender && (
      150 +            <LabeledControl inline label="Form">
      151 +              <Dropdown variant="subtle" size="sm" className="w-full"
          + options={presetOpts(FORM_PRESETS, v.formPreset)} value={v.formPreset
          + ?? 'custom'} onChange={applyPreset('formPreset', FORM_PRESETS)} />
      152 +            </LabeledControl>
      153 +          )}
      154          </Section>
      153 -        <SegmentedToggle value={animTab} onChange={setAnimTab} classN
          -ame="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: '
          -form', label: 'Form' }]} />
      154 -        {animTab === 'frame' && (
      155 +        {tilesRender && (
      156 +          <SegmentedToggle value={animTab} onChange={setAnimTab} clas
          +sName="w-full" options={[{ value: 'frame', label: 'Frame' }, { value:
          + 'form', label: 'Form' }]} />
      157 +        )}
      158 +        {(!tilesRender || animTab === 'frame') && (
      159          <Section label="Frame">
      160            <Slider labeled label="Flow" min={0} max={4} step={1} value
           ={v.camFlow} onChange={(x) => onFrame('camFlow', roundIfNum(x))} vari
           ant="default" />
      161            {/* Direction is a tile-grid pan; fields drift along their
           own axis via Flow. */}
      158 -          {(v.render ?? 'tiles') === 'tiles' && (
      162 +          {tilesRender && (
      163              <LabeledControl inline label="Direction">
      164                <Dropdown variant="subtle" size="sm" className="w-full"
            options={PAN_DIRS} value={v.panDir ?? 'diag'} onChange={(val) => onF
           rame('panDir', val)} />
      165              </LabeledControl>

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 1 line, removed 1 line
      169          </Section>
      170          )}
      171
      172 -        {animTab === 'form' && (
      172 +        {tilesRender && animTab === 'form' && (
      173          <Section label="Form">
      174            <Slider labeled label="Spin" min={0} max={3} step={1} value
           ={v.spin} onChange={(x) => onForm('spin', roundIfNum(x))} variant="de
           fault" />
      175            <LabeledControl inline label="Axis">

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error" | tail -3)
  ⎿  ✓ built in 2.74s
  ⎿  Allowed by auto mode classifier

⏺ All phases done, build green (2.74s). Here's the whole arc:

  Pattern studio — five genuinely distinct families

  The engine went from one shape per grid cell to a pluggable render dispatch
  (patternLoop.draw branches on render): 'tiles' (the original loop, untouched) ·
  'field' (continuous per-pixel via the existing field/ rasterizer + camera) · 'weave'
  (a strand pass reusing the tile kernels). Each family leads with its true form but
  keeps genuine tile members where the pattern really is a tile tessellation.

  ┌───────────┬────────────────────────────────────────┬────────┬──────────────────┐
  │  Family   │             Now renders as             │ Engine │    Animation     │
  │           │                                        │        │   (Frame→Flow)   │
  ├───────────┼────────────────────────────────────────┼────────┼──────────────────┤
  │ Stripes   │ directional band field — any angle,    │ field  │ barber-pole      │
  │           │ solid/pinstripe/ombré                  │        │ drift            │
  ├───────────┼────────────────────────────────────────┼────────┼──────────────────┤
  │ Tartan    │ crossing warp×weft setts, averaged     │ field  │ sett scroll      │
  │           │ into the woven mix tone                │        │                  │
  ├───────────┼────────────────────────────────────────┼────────┼──────────────────┤
  │ Blocks    │ the tile engine (unchanged — it was    │ tiles  │ stepped re-tile  │
  │           │ right)                                 │        │                  │
  ├───────────┼────────────────────────────────────────┼────────┼──────────────────┤
  │ Organic   │ summed metaball iso-field — blobs that │ field  │ orbiting /       │
  │           │  fuse                                  │        │ merging          │
  ├───────────┼────────────────────────────────────────┼────────┼──────────────────┤
  │ Interlace │ real over/under strands with           │ weave  │ the weave        │
  │           │ per-crossing z-order                   │        │ travels          │
  └───────────┴────────────────────────────────────────┴────────┴──────────────────┘

  Mixed where honest: argyle/houndstooth stay tiles under Tartan; polka/halftone/petals
  stay tiles under Organic; herringbone/lattice/chainlink stay tiles under Interlace.

  Verified (not just built)

  - Stripes — seam, real bands, pinstripe ratio, ombré blend ✓
  - Tartan — seamless, distinct crossing tones ✓
  - Organic — seamless (Δ≈0), fused blobs (56% fill), continuous motion ✓
  - Interlace — over/under mix per type (plain/twill/basket 50/50, satin sparse),
  travel seam 0 flips ✓

  Files

  New: fields/stripeField.js, fields/tartanField.js, fields/metaballField.js,
  fields/setts.js.
  Edited: patternLoop.js (dispatch, drawField, drawWeave, parityWeave, defaults),
  PatternControls.jsx (render-aware sections per family + Form axis hidden for
  field/weave), and re-authored stripes/tartan/organic/interlace.js.

  UI cleanup included

  The Animation tab is now render-aware: field/weave presets show only the Frame axis
  (their motion is Flow-driven) — the tiles-only Form sweep and Direction controls are
  hidden, no dead tabs.

  Honest caveats

  - Not eyeballed live — all coefficients (stripe pitch, sett scales, metaball
  threshold/radius, strand width) are first-calibration; they'll want tuning by eye on
  :5173.
  - Setts are plausible, not museum-accurate threadcounts.
  - New params persist via getSettings and ride the preset patches for deep-links;
  they're classified structural, so they swap with the preset while your camera motion
  carries over.

  Switch to :5173 and look — especially Tartan crossings, Organic fusion, and Interlace
  over/under. Tell me what needs tuning.

✻ Sautéed for 17m 20s

❯ I noticed on the first page, first example that it was 1. not smooth (little jerky)
  and 2. not a loop, animation has to be a loop -- find out why this is

⏺ Good catch — and you're right. Let me find the cause. The first example is Stripes →
  Awning (the /pattern index), animating via Flow drift. Let me look at exactly how the
  stripe drift advances per loop:

  Read 1 file (ctrl+o to expand)

⏺ Found it. drift = cam.phase / TAU advances by round(camFlow) bands per loop — but a
  stripe's repeat period is bandCount bands. Awning is bandCount: 2, camFlow: 1, so
  over the loop it shifts one band = the half-phase (colours swapped), not a whole
  period → at u=1 the pattern doesn't match u=0, so it snaps at the wrap. That snap is
  both "not a loop" and the per-loop hitch you read as jerky.

  (My Phase-1 seam test passed only because I happened to use camFlow: 2 = exactly 2
  bands = one full period for bandCount: 2 — a false positive. Good catch.)

  Fix: drift whole periods, not whole bands — multiply by bands:

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 4 lines, removed 1 line
      28    const pitch = Math.max(2, p.stripePitch || 60)
      29    const duty = p.duty == null ? 1 : p.duty
      30    const soft = p.edgeSoftness || 0
      31 -  const drift = cam.phase / TAU // whole cycles ⇒ seamless
      31 +  // Drift whole PERIODS per loop, not whole bands: the palette repeat
         +s every
      32 +  // `bands` bands, so a 1-band shift (camFlow=1, bands=2) lands on th
         +e half-phase
      33 +  // and the loop snaps. ×bands ⇒ camFlow full periods per loop ⇒ trul
         +y seamless.
      34 +  const drift = (cam.phase / TAU) * bands
      35    const solid = duty >= 0.999
      36
      37    return (i, j, W, H) => {

⏺ Bash(node --input-type=module -e '
      import { stripeColorAt } from "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  camFlow=1 bands=1: mismatchPx=0 maxΔ=0.0
     camFlow=1 bands=2: mismatchPx=0 maxΔ=0.0
     camFlow=1 bands=3: mismatchPx=0 maxΔ=0.0
     moves mid-loop (u0 vs u0.25): true (199 px changed)
  ⎿  Allowed by auto mode classifier

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error" | tail -2)
  ⎿  ✓ built in 2.87s
  ⎿  Allowed by auto mode classifier

⏺ Fixed and verified — build green.

  Cause: the stripe drift advanced by round(camFlow) bands per loop, but the colour
  pattern repeats every bandCount bands. Awning (bandCount 2, camFlow 1) drifted
  exactly one band over the loop → it ended on the half-phase (colours swapped), so u=1
  ≠ u=0 and the loop snapped back. That snap is what you saw as "not a loop," and the
  once-per-cycle jump is the hitch that reads as "jerky."

  Fix: drift by whole periods (× bandCount), so camFlow=1 = one full period per loop.
  Now verified seamless at camFlow=1 for 1/2/3 bands (0-pixel mismatch u=0↔u=1) and it
  still moves mid-loop. This was stripes-only — tartan (scrolls whole setts), organic
  (full orbits), and weave (period-1 travel) were already whole-period and tested clean
  at camFlow=1.

  If any continuous jerkiness remains after this (separate from the loop snap), the
  likely suspect is the per-pixel field raster cost at a large stage size — tell me and
  I'll profile it rather than guess. But the loop itself is now correct.

✻ Sautéed for 3m 16s

❯ simple red white animation in stripe is only 21 fps? whats dragging it down? (even
  when everything is off the frame rate is 17-19 fps idle) -- what is causing this?

⏺ Two separate things here, and "17-19 fps even when idle/paused" is the key clue —
  that says the render loop is doing heavy work every frame regardless of play state.
  Let me confirm by reading the tick loop and measuring the actual per-pixel field
  cost:

  Read 1 file (ctrl+o to expand)

⏺ Bash(node --input-type=module -e '
      import { stripeColorAt } from "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  1Mpx stripe colorAt loop: 49.7 ms/frame  -> 20 fps ceiling (JS only, excl put
     ImageData/drawImage)
     1Mpx stripe colorAt loop: 43.5 ms/frame  -> 23 fps ceiling (JS only, excl put
     … +3 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier
  ⎿  Interrupted · What should Claude do instead?

❯ [Image #3] are you making stripes from million boxes?? that must be the reson, why
  are you not just making it from 1 box?
  ⎿  [Image #3]

⏺ You're right, and that's exactly the cause — let me show the numbers and fix the real
  problem.

  The bench confirms it: the stripe was being rendered by computing a colour for ~1
  million pixels every frame (a full per-pixel raster) — ~43–50ms/frame on its own =
  ~20fps ceiling. Not literally a million boxes, but just as dumb: stripes are flat
  bands, so painting them pixel-by-pixel is absurd. They should be a few fillRects (one
  per visible band ≈ 20–40 rects), which is sub-millisecond.

  Two compounding bugs:
  1. The over-engineered renderer — stripes (and tartan) used the per-pixel field meant
  for organic blobs. Wrong tool.
  2. It redrew every frame even when paused — that's your 17–19fps idle: the loop
  re-rasterized the whole field on every rAF regardless of play state.

  Fixing both. First, redraw stripes as vector bands instead of per-pixel:

⏺ Write(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 39 lines, removed 44 lines
       1 -import { TAU, hexToRgb } from '../../lib/util.js'
       2 -import { sample } from '../../field/camera.js'
       3 -import { mix2 } from '../../field/raster.js'
       1 +import { TAU } from '../../lib/util.js'
       2
       5 -// Stripes — a continuous directional band FIELD (no tiles). Reads the
         - pattern
       6 -// palette: color/color2/color3 are the bands, bg is the ground for pi
         -nstripes.
       7 -// Two looks from one model:
       8 -//   · duty >= 1  → solid colour bands cycling the palette; edgeSoftne
         -ss blends
       9 -//                  adjacent band colours (ombré).
      10 -//   · duty <  1  → an ink band of width `duty` (the band colour) on t
         -he bg
      11 -//                  ground (pinstripe / slats); edgeSoftness softens t
         -he edges.
      12 -// Direction is `stripeAngle` (0 vertical · 90 horizontal · 45 diagona
         -l). Seamless:
      13 -// drift is whole cycles (cam.phase = u·TAU·round(camFlow)), so u=0 ≡
         -u=1.
      14 -
      15 -const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
      16 -const smoothstep = (e0, e1, x) => {
      17 -  const t = clamp01((x - e0) / (e1 - e0 || 1e-6))
      18 -  return t * t * (3 - 2 * t)
      19 -}
      20 -
      21 -// Factory: returns a colorAt(i,j,W,H) → [r,g,b] for the shared raster
         -izer.
      22 -export function stripeColorAt(p, cam, w, h) {
      23 -  const cols = [hexToRgb(p.color), hexToRgb(p.color2 || p.color), hexT
         -oRgb(p.color3 || p.color2 || p.color)]
      24 -  const ground = hexToRgb(p.bg)
       3 +// Stripes — drawn as VECTOR bands (a handful of fillRects), NOT per-p
         +ixel. Stripes
       4 +// are flat geometry, so we transform into a stripe-local frame (camer
         +a angle+zoom,
       5 +// then the stripe angle) and fill one rect per visible band. Canvas a
         +nti-aliases
       6 +// the edges and sub-pixel positions, so motion is smooth. Reads the p
         +alette:
       7 +// color/color2/color3 are the bands, bg is the ground for pinstripes.
       8 +//   duty >= 1  → solid colour bands (edgeSoftness ⇒ ombré gradient pe
         +r band)
       9 +//   duty <  1  → an ink band of width `duty` on the bg ground (pinstr
         +ipe/slats)
      10 +// Seamless: drift advances whole PERIODS per loop (×bandCount), cam.p
         +hase whole cycles.
      11 +export function drawStripes(ctx, cam, w, h, p) {
      12 +  const cols = [p.color, p.color2 || p.color, p.color3 || p.color2 ||
         +p.color]
      13    const bands = Math.max(1, Math.round(p.bandCount || 2))
      14    const theta = (p.stripeAngle || 0) * Math.PI / 180
      27 -  const ct = Math.cos(theta), st = Math.sin(theta)
      15 +  const camAng = (p.camAngle || 0) * Math.PI / 180
      16    const pitch = Math.max(2, p.stripePitch || 60)
      17    const duty = p.duty == null ? 1 : p.duty
      18    const soft = p.edgeSoftness || 0
      31 -  // Drift whole PERIODS per loop, not whole bands: the palette repeat
         -s every
      32 -  // `bands` bands, so a 1-band shift (camFlow=1, bands=2) lands on th
         -e half-phase
      33 -  // and the loop snaps. ×bands ⇒ camFlow full periods per loop ⇒ trul
         -y seamless.
      34 -  const drift = (cam.phase / TAU) * bands
      35 -  const solid = duty >= 0.999
      19 +  const z = cam.zoom
      20 +  const drift = (cam.phase / TAU) * bands // whole periods ⇒ seamless
         +loop
      21
      37 -  return (i, j, W, H) => {
      38 -    const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      39 -    const ph = (rx * ct + ry * st) / pitch + drift
      40 -    const n = Math.floor(ph)
      41 -    const frac = ph - n
      22 +  ctx.save()
      23 +  ctx.translate(cam.cx, cam.cy)
      24 +  ctx.rotate(camAng)
      25 +  ctx.scale(z, z)
      26 +  ctx.rotate(theta)            // stripe-local frame: x = the stripe n
         +ormal
      27 +
      28 +  const reach = (Math.hypot(w, h) / 2) / z + pitch * 2
      29 +  const y0 = -reach, yH = reach * 2
      30 +  const nLo = Math.floor(-reach / pitch + drift) - 1
      31 +  const nHi = Math.ceil(reach / pitch + drift) + 1
      32 +  for (let n = nLo; n <= nHi; n++) {
      33      const idx = ((n % bands) + bands) % bands
      43 -    const ink = cols[idx]
      44 -    if (solid) {
      45 -      if (soft <= 0) return ink
      46 -      // blend toward the next band's colour across the boundary (ombr
         -é)
      47 -      return mix2(smoothstep(1 - soft, 1, frac), ink, cols[(idx + 1) %
         - bands])
      34 +    const x = (n - drift) * pitch
      35 +    if (duty < 0.999 && soft <= 0) {
      36 +      ctx.fillStyle = cols[idx]
      37 +      ctx.fillRect(x, y0, pitch * duty, yH) // ink band on the (alread
         +y-filled) bg
      38 +    } else if (soft > 0) {
      39 +      const g = ctx.createLinearGradient(x, 0, x + pitch, 0)
      40 +      g.addColorStop(0, cols[idx])
      41 +      g.addColorStop(1, cols[(idx + 1) % bands])
      42 +      ctx.fillStyle = g
      43 +      ctx.fillRect(x, y0, pitch, yH)
      44 +    } else {
      45 +      ctx.fillStyle = cols[idx]
      46 +      ctx.fillRect(x, y0, pitch, yH)
      47      }
      49 -    // ink band of width `duty` riding on the ground colour (pinstripe
         - / slats)
      50 -    const cov = soft <= 0
      51 -      ? (frac < duty ? 1 : 0)
      52 -      : clamp01(smoothstep(0, soft, frac) - smoothstep(duty, Math.min(
         -1, duty + soft), frac))
      53 -    return mix2(cov, ground, ink)
      48    }
      49 +  ctx.restore()
      50  }

❯ and 'organic' is not pattern? its just blobs, we dont need that, organic would be
  for example stripes with an organic 'profile' f.e. [Image #4]
  ⎿  [Image #4]

⏺ You're right on both counts — and message 2 actually makes the perf fix cleaner.
  "Organic" as metaball blobs isn't a pattern; organic = stripes/bands with a wavy
  organic edge profile (your image). That means none of the families need the per-pixel
  raster — stripes, tartan, and organic are all cheap vector geometry. I'm dropping
  the field-raster + metaball entirely.

  Let me redo all three as vector draws (self-contained, no cam/raster coupling).
  Stripes first:

⏺ Write(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 13 lines, removed 16 lines
       1  import { TAU } from '../../lib/util.js'
       2
       3 -// Stripes — drawn as VECTOR bands (a handful of fillRects), NOT per-p
         -ixel. Stripes
       4 -// are flat geometry, so we transform into a stripe-local frame (camer
         -a angle+zoom,
       5 -// then the stripe angle) and fill one rect per visible band. Canvas a
         -nti-aliases
       6 -// the edges and sub-pixel positions, so motion is smooth. Reads the p
         -alette:
       7 -// color/color2/color3 are the bands, bg is the ground for pinstripes.
       8 -//   duty >= 1  → solid colour bands (edgeSoftness ⇒ ombré gradient pe
         -r band)
       9 -//   duty <  1  → an ink band of width `duty` on the bg ground (pinstr
         -ipe/slats)
      10 -// Seamless: drift advances whole PERIODS per loop (×bandCount), cam.p
         -hase whole cycles.
      11 -export function drawStripes(ctx, cam, w, h, p) {
       3 +// Stripes — VECTOR bands (a handful of fillRects), NOT per-pixel. Tra
         +nsform into a
       4 +// stripe-local frame (camera angle + zoom, then the stripe angle) and
         + fill one rect
       5 +// per visible band; canvas anti-aliases edges + sub-pixel motion. Pal
         +ette:
       6 +// color/color2/color3 = bands, bg = ground for pinstripes.
       7 +//   duty >= 1 → solid bands (edgeSoftness ⇒ per-band ombré gradient)
       8 +//   duty <  1 → ink band of width `duty` on the bg ground (pinstripe
         +/ slats)
       9 +// Seamless: drift advances whole PERIODS per loop (×bandCount); phase
         + = u·TAU·round(camFlow).
      10 +export function drawStripes(ctx, u, w, h, p) {
      11    const cols = [p.color, p.color2 || p.color, p.color3 || p.color2 ||
          p.color]
      12    const bands = Math.max(1, Math.round(p.bandCount || 2))
      14 -  const theta = (p.stripeAngle || 0) * Math.PI / 180
      15 -  const camAng = (p.camAngle || 0) * Math.PI / 180
      13    const pitch = Math.max(2, p.stripePitch || 60)
      14    const duty = p.duty == null ? 1 : p.duty
      15    const soft = p.edgeSoftness || 0
      19 -  const z = cam.zoom
      20 -  const drift = (cam.phase / TAU) * bands // whole periods ⇒ seamless
         -loop
      16 +  const z = p.camZoom || 1
      17 +  const drift = u * Math.round(p.camFlow || 0) * bands // whole period
         +s ⇒ seamless
      18
      19    ctx.save()
      23 -  ctx.translate(cam.cx, cam.cy)
      24 -  ctx.rotate(camAng)
      20 +  ctx.translate(w / 2, h / 2)
      21 +  ctx.rotate((p.camAngle || 0) * Math.PI / 180)
      22    ctx.scale(z, z)
      26 -  ctx.rotate(theta)            // stripe-local frame: x = the stripe n
         -ormal
      23 +  ctx.rotate((p.stripeAngle || 0) * Math.PI / 180) // stripe-local: x
         += band normal
      24
      25    const reach = (Math.hypot(w, h) / 2) / z + pitch * 2
      26    const y0 = -reach, yH = reach * 2

⏺ Tartan as vector (solid weft + 50% warp = the average weave):

⏺ Write(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 40 lines, removed 27 lines
       1 -import { TAU, hexToRgb } from '../../lib/util.js'
       2 -import { sample } from '../../field/camera.js'
       3 -import { mix2 } from '../../field/raster.js'
       1 +import { TAU } from '../../lib/util.js'
       2  import { SETTS } from './setts.js'
       3
       6 -// Tartan — crossing warp + weft threads (no tiles). Each axis walks t
         -he sett (a
       7 -// threadcount of palette-indexed bands); the cell colour is the AVERA
         -GE of the
       8 -// warp + weft thread — the woven "mix" tone. Same colour on both axes
         - ⇒ that solid
       9 -// colour; different colours ⇒ the muddy crossing third. A small twill
         - bias shows
      10 -// more warp or weft along alternating diagonals (the 2/2-twill grain)
         -. Seamless:
      11 -// scroll advances by whole sett-repeats (cam.phase = u·TAU·round(camF
         -low)).
      12 -export function tartanColorAt(p, cam, w, h) {
      13 -  const pal = [hexToRgb(p.color), hexToRgb(p.color2 || p.color), hexTo
         -Rgb(p.color3 || p.color2 || p.color), hexToRgb(p.bg)]
       4 +// Tartan — VECTOR bands, not per-pixel. The woven "mix" tone comes fo
         +r free from
       5 +// alpha compositing: draw the weft (horizontal sett bands) solid, the
         +n the warp
       6 +// (vertical sett bands) at 50% → every cell is the AVERAGE of its war
         +p+weft thread
       7 +// (same colour ⇒ that colour; different ⇒ the muddy crossing third).
         +A few dozen
       8 +// rects total. Palette indices 0..3 → color/color2/color3/bg. Seamles
         +s: the sett
       9 +// scrolls whole repeats per loop (phase = u·TAU·round(camFlow)).
      10 +export function drawTartan(ctx, u, w, h, p) {
      11 +  const pal = [p.color, p.color2 || p.color, p.color3 || p.color2 || p
         +.color, p.bg]
      12    const sett = SETTS[p.sett] || SETTS['black-watch']
      13    const total = sett.reduce((s, b) => s + b[1], 0)
      16 -  const scale = Math.max(0.5, p.settScale || 5)   // px per thread uni
         -t
      17 -  const twill = p.twill == null ? 0.18 : p.twill
      18 -  const span = total * scale                       // one full repeat,
         - px
      19 -  const drift = (cam.phase / TAU) * span           // whole repeats ⇒
         -seamless
      14 +  const scale = Math.max(0.5, p.settScale || 5)
      15 +  const span = total * scale
      16 +  const z = p.camZoom || 1
      17 +  const drift = u * Math.round(p.camFlow || 0) * span // whole repeats
         + ⇒ seamless
      18
      21 -  const at = (t) => {
      22 -    let tt = (((t / scale) % total) + total) % total
      23 -    for (let b = 0; b < sett.length; b++) { if (tt < sett[b][1]) retur
         -n pal[sett[b][0]]; tt -= sett[b][1] }
      24 -    return pal[sett[sett.length - 1][0]]
      19 +  ctx.save()
      20 +  ctx.translate(w / 2, h / 2)
      21 +  ctx.rotate((p.camAngle || 0) * Math.PI / 180)
      22 +  ctx.scale(z, z)
      23 +  ctx.translate(-drift, -drift) // diagonal sett scroll
      24 +
      25 +  const reach = (Math.hypot(w, h) / 2) / z + span
      26 +  const lo = -reach + drift, hi = reach + drift
      27 +  const r0 = Math.floor(lo / span) - 1, r1 = Math.ceil(hi / span) + 1
      28 +  const long0 = lo - span, longLen = (hi - lo) + span * 2
      29 +
      30 +  const drawAxis = (horizontal, alpha) => {
      31 +    ctx.globalAlpha = alpha
      32 +    for (let r = r0; r <= r1; r++) {
      33 +      let pos = r * span
      34 +      for (let b = 0; b < sett.length; b++) {
      35 +        const wdt = sett[b][1] * scale
      36 +        ctx.fillStyle = pal[sett[b][0]]
      37 +        if (horizontal) ctx.fillRect(long0, pos, longLen, wdt)
      38 +        else ctx.fillRect(pos, long0, wdt, longLen)
      39 +        pos += wdt
      40 +      }
      41 +    }
      42 +    ctx.globalAlpha = 1
      43    }
      26 -  return (i, j, W, H) => {
      27 -    const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      28 -    const warp = at(rx + drift)
      29 -    const weft = at(ry + drift)
      30 -    const diag = Math.floor((rx - ry) / (scale * 2))
      31 -    const bias = (((diag % 2) + 2) % 2) ? twill : -twill  // alternate
         - which thread shows
      32 -    return mix2(0.5 + bias, warp, weft)                   // 0.5 = eve
         -n average (the weave)
      33 -  }
      44 +  drawAxis(true, 1)     // weft (horizontal) — solid
      45 +  drawAxis(false, 0.5)  // warp (vertical) at 50% ⇒ average over the w
         +eft
      46 +  ctx.restore()
      47  }

⏺ Now Organic redefined — wavy-profile bands (your image), not blobs. Creating the new
  vector renderer and removing the metaball:

⏺ Write(src/loops/pattern/fields/organicField.js)
  ⎿  Wrote 42 lines to src/loops/pattern/fields/organicField.js
       2 import { TAU } from '../../lib/util.js'
         e band model bands with a wavy/undulating edge PROFILE (not blobs). Sam
         s read as aes, but each boundary is a sine-displaced curve, so the band
       5 // flowing water/contour motif. Drawn as filled VECTOR paths (one per b
       6 // thousand line segments, not a per-pixel field. Boundaries share one
       7 // wave so bands tile with no gaps. Palette: color/color2/color3 cycle
         the bands.
         he fieldeAmp   undulation depth (× pitch)      waveFreq  waves across t
         (camFlow).s: bands are fixed; the wave undulates on phase = u·TAU·round
      10 export function drawOrganic(ctx, u, w, h, p) {
     … +45 lines (ctrl+o to expand)

⏺ Bash(rm /Users/biskup/dev/projects/kol-apparat/kol-labs-single/src/loops/pattern/fiel
      ds/metaballField.js && echo "deleted metaballField.js")
  ⎿  deleted metaballField.js

⏺ Now rewire patternLoop.js — all three families are vector draws, drop the
  raster/camera/metaball imports:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines, removed 5 lines
       2  import { resolveShape, DEFAULT_SHAPE_ID } from './shapes.js'
       3  import { composeCell, compileRules } from './rules.js'
       4  import { glyphShape, ensureGlyphFontUrl } from '../../lib/glyphPath.js
          '
       5 -import { makeCam } from '../field/camera.js'
       6 -import { raster } from '../field/raster.js'
       7 -import { stripeColorAt } from './fields/stripeField.js'
       8 -import { tartanColorAt } from './fields/tartanField.js'
       9 -import { metaballColorAt } from './fields/metaballField.js'
       5 +import { drawStripes } from './fields/stripeField.js'
       6 +import { drawTartan } from './fields/tartanField.js'
       7 +import { drawOrganic } from './fields/organicField.js'
       8
       9  // Pattern — the ported kol-client rule/tiling system, rendered to Can
          vas2D so it
      10  // animates + outputs a texture. The cols×rows rule-block TILES infini
          tely; the

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 7 lines, removed 8 lines
      69    diag: [1, 1], anti: [1, -1],
      70  }
      71
      72 -// Field families (render:'field') — continuous per-pixel renderers th
         -at bypass
      73 -// the tile loop and reuse the shared field rasterizer + camera. Each
         -maps the
      74 -// pattern palette (color/color2/color3 + bg) to a colorAt. Seamlessne
         -ss is the
      75 -// colorAt's job (periodic phase via cam.phase).
      76 -const FIELD_COLOR_AT = { stripes: stripeColorAt, tartan: tartanColorAt
         -, organic: metaballColorAt }
      72 +// Field families (render:'field') — continuous VECTOR renderers that
         +bypass the
      73 +// tile loop. All three are cheap geometry (rects / filled paths), NOT
         + per-pixel:
      74 +// stripes = bands · tartan = crossed sett bands · organic = bands wit
         +h a wavy edge.
      75 +// Each reads the pattern palette (color/color2/color3 + bg). Seamless
         + on whole-
      76 +// cycle phase (u·TAU·round(camFlow)).
      77 +const FIELD_DRAW = { stripes: drawStripes, tartan: drawTartan, organic
         +: drawOrganic }
      78  function drawField(ctx, u, w, h, p) {
      78 -  const make = FIELD_COLOR_AT[p.field] || FIELD_COLOR_AT.stripes
      79 -  const cam = makeCam(u, p, w, h)
      80 -  raster(ctx, w, h, make(p, cam, w, h))
      79 +  (FIELD_DRAW[p.field] || drawStripes)(ctx, u, w, h, p)
      80  }
      81
      82  // Weave (render:'weave') — true over/under interlacing. Per crossing
          the warp

⏺ Update the Organic params in defaults (drop metaball, add wave):

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines, removed 5 lines
      202      sett: 'black-watch', // threadcount table (src/loops/pattern/fiel
           ds/setts.js)
      203      settScale: 5,        // px per thread unit
      204      twill: 0.18,         // 2/2-twill diagonal bias (0 = flat average
           )
      205 -    // Organic field (field:'organic') — summed metaball iso-surface
      206 -    blobCount: 9,        // number of orbiting seeds
      207 -    blobRadius: 0.5,     // seed influence radius (× canvas)
      208 -    threshold: 1,        // iso level — higher = tighter blobs
      209 -    warp: 0.2,           // domain-warp wobble
      205 +    // Organic field (field:'organic') — bands with a wavy edge profi
          +le
      206 +    waveAmp: 0.4,        // undulation depth (× pitch)
      207 +    waveFreq: 1.5,       // waves across the field
      208      // Weave render (render:'weave') — interlaced over/under strands
      209      weaveType: 'plain',  // plain | twill | satin | basket (which str
           and goes over)
      210      strandWidth: 0.7,    // ribbon width (× cell)

⏺ Re-author the Organic presets as wavy bands:

⏺ Write(src/pages/pattern/categories/organic.js)
  ⎿  Added 45 lines, removed 60 lines
       1  import { R, PAL } from './_helpers.js'
       2
       3 -// ORGANIC — soft natural marks. The headline is the metaball FIELD (r
         -ender:'field',
       4 -// field:'organic'): orbiting seeds sum into an iso-surface so blobs F
         -USE with smooth
       5 -// necks (color→color2→color3 depth ramp on the bg ground). camFlow dr
         -ives the orbit
       6 -// (whole cycles ⇒ seamless; paused on load).
       7 -//   blobCount  seed count    blobRadius  influence (× canvas)
       8 -//   threshold  iso level (higher = tighter)   warp  domain wobble
       9 -// Regular dot/abstract marks (polka, halftone, honeycomb, petals…) ar
         -e genuine TILE
      10 -// patterns, kept on the tile engine (no `render` ⇒ 'tiles').
       3 +// ORGANIC — bands with a wavy/undulating edge PROFILE (render:'field'
         +, field:'organic'):
       4 +// flowing water/contour stripes, drawn as cheap vector paths. Same ba
         +nd model as
       5 +// Stripes (angle/pitch/bands + palette) plus a wave:
       6 +//   waveAmp   undulation depth (× pitch)      waveFreq  waves across
         +the field
       7 +// camFlow undulates the wave (whole cycles ⇒ seamless; paused on load
         +).
       8 +// A few genuine dot/abstract tile marks are kept on the tile engine f
         +or variety.
       9
      12 -const blob = (o) => ({ render: 'field', field: 'organic', ...o })
      10 +const wave = (o) => ({ render: 'field', field: 'organic', ...o })
      11
      12  export default [
      15 -  // ── metaballs (field) ──
      16 -  { id: 'blobs', label: 'Blobs', params: blob({
      17 -    blobCount: 9, blobRadius: 0.5, threshold: 1, warp: 0.2,
      18 -    color: PAL.sky, color2: PAL.teal, color3: PAL.navy, bg: PAL.ink })
         - },
      19 -  { id: 'lava', label: 'Lava', params: blob({
      20 -    blobCount: 7, blobRadius: 0.7, threshold: 0.9, warp: 0.3,
      21 -    color: PAL.gold, color2: PAL.rust, color3: PAL.brick, bg: PAL.noir
         - }) },
      22 -  { id: 'mercury', label: 'Mercury', params: blob({
      23 -    blobCount: 10, blobRadius: 0.5, threshold: 1.3, warp: 0.1,
      24 -    color: PAL.bone, color2: PAL.grey, color3: PAL.slate, bg: PAL.ink
         -}) },
      25 -  { id: 'foam', label: 'Foam', params: blob({
      26 -    blobCount: 16, blobRadius: 0.36, threshold: 1.1, warp: 0.25,
      27 -    color: PAL.bone, color2: PAL.oat, color3: PAL.cream, bg: PAL.teal
         -}) },
      28 -  { id: 'cells', label: 'Cells', params: blob({
      29 -    blobCount: 12, blobRadius: 0.5, threshold: 1.1, warp: 0.15,
      30 -    color: PAL.teal, color2: PAL.green, color3: PAL.forest, bg: PAL.in
         -k }) },
      31 -  { id: 'goo', label: 'Goo', params: blob({
      32 -    blobCount: 6, blobRadius: 0.8, threshold: 0.8, warp: 0.35,
      33 -    color: PAL.green, color2: PAL.moss, color3: PAL.olive, bg: PAL.noi
         -r }) },
      34 -  { id: 'magma', label: 'Magma', params: blob({
      35 -    blobCount: 8, blobRadius: 0.6, threshold: 0.95, warp: 0.4,
      36 -    color: PAL.amber, color2: PAL.coral, color3: PAL.red, bg: PAL.char
         - }) },
      37 -  { id: 'ooze', label: 'Ooze', params: blob({
      38 -    blobCount: 9, blobRadius: 0.6, threshold: 1, warp: 0.3,
      39 -    color: PAL.purple, color2: PAL.violet, color3: PAL.plum, bg: PAL.n
         -oir }) },
      40 -  { id: 'droplets', label: 'Droplets', params: blob({
      41 -    blobCount: 14, blobRadius: 0.42, threshold: 1.2, warp: 0.15,
      42 -    color: PAL.sky, color2: PAL.blue, color3: PAL.navy, bg: PAL.ink2 }
         -) },
      43 -  { id: 'nuclei', label: 'Nuclei', params: blob({
      44 -    blobCount: 5, blobRadius: 0.7, threshold: 0.85, warp: 0.2,
      45 -    color: PAL.amber, color2: PAL.gold, color3: PAL.ochre, bg: PAL.ink
         - }) },
      13 +  // ── wavy bands ──
      14 +  { id: 'waves', label: 'Waves', params: wave({
      15 +    stripeAngle: 90, stripePitch: 90, bandCount: 2, waveAmp: 0.4, wave
         +Freq: 1.4,
      16 +    color: PAL.sky, color2: PAL.ink2 }) },
      17 +  { id: 'tide', label: 'Tide', params: wave({
      18 +    stripeAngle: 90, stripePitch: 110, bandCount: 3, waveAmp: 0.5, wav
         +eFreq: 1,
      19 +    color: PAL.teal, color2: PAL.navy, color3: PAL.sky }) },
      20 +  { id: 'dunes', label: 'Dunes', params: wave({
      21 +    stripeAngle: 90, stripePitch: 120, bandCount: 3, waveAmp: 0.6, wav
         +eFreq: 0.8,
      22 +    color: PAL.gold, color2: PAL.ochre, color3: PAL.amber }) },
      23 +  { id: 'ripple', label: 'Ripple', params: wave({
      24 +    stripeAngle: 90, stripePitch: 60, bandCount: 2, waveAmp: 0.35, wav
         +eFreq: 2.4,
      25 +    color: PAL.bone, color2: PAL.teal }) },
      26 +  { id: 'contour', label: 'Contour', params: wave({
      27 +    stripeAngle: 90, stripePitch: 70, bandCount: 3, waveAmp: 0.45, wav
         +eFreq: 1.6,
      28 +    color: PAL.moss, color2: PAL.forest, color3: PAL.olive }) },
      29 +  { id: 'strata', label: 'Strata', params: wave({
      30 +    stripeAngle: 90, stripePitch: 100, bandCount: 3, waveAmp: 0.3, wav
         +eFreq: 1.1,
      31 +    color: PAL.rust, color2: PAL.brick, color3: PAL.coral }) },
      32 +  { id: 'current', label: 'Current', params: wave({
      33 +    stripeAngle: 90, stripePitch: 80, bandCount: 2, waveAmp: 0.55, wav
         +eFreq: 1.8,
      34 +    color: PAL.blue, color2: PAL.navy }) },
      35 +  { id: 'swell', label: 'Swell', params: wave({
      36 +    stripeAngle: 90, stripePitch: 140, bandCount: 2, waveAmp: 0.7, wav
         +eFreq: 0.7,
      37 +    color: PAL.sky, color2: PAL.ink2 }) },
      38 +  { id: 'marble', label: 'Marble', params: wave({
      39 +    stripeAngle: 70, stripePitch: 64, bandCount: 3, waveAmp: 0.5, wave
         +Freq: 2,
      40 +    color: PAL.bone, color2: PAL.slate, color3: PAL.oat }) },
      41 +  { id: 'lava-flow', label: 'Lava flow', params: wave({
      42 +    stripeAngle: 90, stripePitch: 96, bandCount: 3, waveAmp: 0.65, wav
         +eFreq: 1.2,
      43 +    color: PAL.amber, color2: PAL.red, color3: PAL.brick }) },
      44 +  { id: 'aurora', label: 'Aurora', params: wave({
      45 +    stripeAngle: 80, stripePitch: 110, bandCount: 3, waveAmp: 0.6, wav
         +eFreq: 1.3,
      46 +    color: PAL.teal, color2: PAL.purple, color3: PAL.sky }) },
      47 +  { id: 'sand', label: 'Sand', params: wave({
      48 +    stripeAngle: 90, stripePitch: 48, bandCount: 2, waveAmp: 0.3, wave
         +Freq: 2.6,
      49 +    color: PAL.oat, color2: PAL.camel }) },
      50
      47 -  // ── dots & polka (tiles) ──
      51 +  // ── dot & abstract marks (genuine tiles) ──
      52    { id: 'polka', label: 'Polka', params: {
      53      shape: 'prim:circle', cols: 6, rows: 6, cell: 120, gap: 14,
      54      colorRule: 'checker', color: PAL.cream, color2: PAL.red, bg: PAL.i
          nk,
     ...
      57      shape: 'prim:circle', cols: 14, rows: 14, cell: 70, gap: 18,
      58      color: PAL.bone, bg: PAL.navy,
      59      animAxis: 'radial', animWaves: 3, fade: 0.3 } },
      56 -  { id: 'caviar', label: 'Caviar', params: {
      57 -    shape: 'prim:circle', cols: 24, rows: 24, cell: 46, gap: 10,
      58 -    color: PAL.ink, bg: PAL.oat,
      59 -    animAxis: 'radial', animWaves: 4, fade: 0.2 } },
      60    { id: 'halftone', label: 'Halftone', params: {
      61      shape: 'prim:circle', cols: 22, rows: 22, cell: 52, gap: 6,
      62      color: PAL.ink, bg: PAL.bone,
      63      animAxis: 'radial', animWaves: 3, pulse: 0.4, animCurveExpr: 'pow(
          sin(PI*k),2)' } },
      64 -
      65 -  // ── honeycomb & cells (tiles) ──
      64    { id: 'honeycomb', label: 'Honeycomb', params: {
      65      shape: 'prim:hexagon', cols: 8, rows: 8, cell: 120, gap: 6,
      66      color: PAL.gold, bg: PAL.ochre,
      67      animAxis: 'radial', animWaves: 2, fade: 0.2 } },
      70 -
      71 -  // ── scatter & confetti (tiles) ──
      68    { id: 'scatter', label: 'Scatter', params: {
      69      shape: 'prim:circle', cols: 16, rows: 16, cell: 80, gap: 8,
      70      color: PAL.gold, bg: PAL.ink,
      71      rules: [R({ selectKind: 'expression', expression: 'sin(col*12.9 +
          row*7.3) - 0.2', hide: true })],
      72      animAxis: 'radial', animWaves: 3, fade: 0.35, animCurveExpr: 'roun
          d(k)' } },
      77 -  { id: 'confetti', label: 'Confetti', params: {
      78 -    shape: 'prim:star', cols: 12, rows: 12, cell: 90, gap: 10,
      79 -    colorRule: 'diag', color: PAL.coral, color2: PAL.amber, color3: PA
         -L.sky, bg: PAL.noir,
      80 -    rules: [R({ selectKind: 'expression', expression: 'cos(col*9.7 + r
         -ow*4.3) - 0.1', hide: true })],
      81 -    animAxis: 'diag', animWaves: 3, swing: 30, colorMix: 0.3 } },
      82 -
      83 -  // ── petals & blossom (abstract-blob tiles) ──
      73    { id: 'petals', label: 'Petals', params: {
      74      shape: 'abstract:abstract-01', cols: 6, rows: 6, cell: 150, gap: 8
          ,
      75      colorRule: 'checker', color: PAL.pink, color2: PAL.rose, bg: PAL.p
          lum,
      76      spin: 1, animAxis: 'diag', animWaves: 2, swing: 35, fade: 0.25 } }
          ,
      88 -  { id: 'lily-pads', label: 'Lily pads', params: {
      89 -    shape: 'abstract:abstract-02', cols: 4, rows: 4, cell: 200, gap: 1
         -2,
      90 -    colorRule: 'checker', color: PAL.green, color2: PAL.forest, bg: PA
         -L.ink2,
      91 -    spin: 1, animAxis: 'radial', animWaves: 2, pulse: 0.3, fade: 0.35
         -} },
      77  ]

⏺ Now the Organic controls in PatternControls — swap metaball sliders for wave/band
  controls:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 5 lines, removed 4 lines
      230          )}
      231          {field === 'organic' && (
      232            <Section label="Organic">
      233 -            <Slider labeled label="Blobs" min={2} max={16} step={1} v
          -alue={v.blobCount ?? 9} onChange={(x) => onChange('blobCount', roundI
          -fNum(x))} variant="default" />
      234 -            <Slider labeled label="Radius" min={0.2} max={1.2} step={
          -0.05} value={v.blobRadius ?? 0.5} onChange={(x) => onChange('blobRadi
          -us', x)} variant="default" />
      235 -            <Slider labeled label="Threshold" min={0.5} max={2} step=
          -{0.05} value={v.threshold ?? 1} onChange={(x) => onChange('threshold'
          -, x)} variant="default" />
      236 -            <Slider labeled label="Warp" min={0} max={1} step={0.05}
          -value={v.warp ?? 0.2} onChange={(x) => onChange('warp', x)} variant="
          -default" />
      233 +            <Slider labeled label="Angle" min={0} max={180} step={1}
          +value={v.stripeAngle ?? 90} onChange={(x) => onChange('stripeAngle',
          +roundIfNum(x))} variant="default" />
      234 +            <Slider labeled label="Pitch" min={20} max={240} step={1}
          + value={v.stripePitch ?? 90} onChange={(x) => onChange('stripePitch',
          + roundIfNum(x))} variant="default" />
      235 +            <Slider labeled label="Bands" min={1} max={3} step={1} va
          +lue={v.bandCount ?? 2} onChange={(x) => onChange('bandCount', roundIf
          +Num(x))} variant="default" />
      236 +            <Slider labeled label="Amplitude" min={0} max={1} step={0
          +.05} value={v.waveAmp ?? 0.4} onChange={(x) => onChange('waveAmp', x)
          +} variant="default" />
      237 +            <Slider labeled label="Frequency" min={0.3} max={4} step=
          +{0.1} value={v.waveFreq ?? 1.5} onChange={(x) => onChange('waveFreq',
          + x)} variant="default" />
      238            </Section>
      239          )}
      240          <Section label="Colour">

  ⎿  Added 3 lines, removed 4 lines
      251              {colorCtl('Ground', 'bg')}
      252            </>}
      253            {field === 'organic' && <>
      254 -            {colorCtl('Surface', 'color')}
      255 -            {colorCtl('Mid', 'color2')}
      256 -            {colorCtl('Deep', 'color3')}
      257 -            {colorCtl('Ground', 'bg')}
      254 +            {colorCtl('Colour A', 'color')}
      255 +            {(v.bandCount ?? 2) >= 2 && colorCtl('Colour B', 'color2'
          +)}
      256 +            {(v.bandCount ?? 2) >= 3 && colorCtl('Colour C', 'color3'
          +)}
      257            </>}
      258          </Section>
      259        </>

⏺ Now the idle-redraw fix in PatternEditor — only render when playing or something
  changed. Let me read the exact tick:

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 3 lines
      55    const uRef = useRef(0)
      56    const lastRef = useRef(0)
      57    const sizeRef = useRef({ w: 0, h: 0 })
      58 +  // Redraw-on-demand: when PAUSED, only re-render when something chan
         +ged (dirty).
      59 +  // The old loop re-rendered every rAF even paused — wasted full fram
         +es at idle.
      60 +  const dirtyRef = useRef(true)
      61
      62    const onChange = (k, v) => setValues((s) => ({ ...s, [k]: v }))
      63

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      113      cv.width = Math.floor(fw * dpr); cv.height = Math.floor(fh * dpr)
      114      cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
      115      sizeRef.current = { w: fw, h: fh }
      116 +    dirtyRef.current = true
      117    }, [aspect])
      118
      119    useEffect(() => {

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 7 lines, removed 1 line
      127        const dur = patternLoop.duration || 8
      128        if (playingRef.current) uRef.current = (uRef.current + dt * (te
           mpoRef.current / 120) / dur) % 1
      129        const { w, h } = sizeRef.current
      130 -      if (w && h) {
      130 +      // Render only while playing OR when marked dirty (a control/si
          +ze changed).
      131 +      // Paused + unchanged ⇒ skip the frame entirely → ~0 idle cost.
      132 +      if (w && h && (playingRef.current || dirtyRef.current)) {
      133          patternLoop.draw(cv.getContext('2d'), uRef.current, w, h, res
           olveParams(valuesRef.current, uRef.current * dur))
      134          if (fxChainRef.current.length) applyCanvasFx(cv, fxChainRef.c
           urrent)
      135 +        dirtyRef.current = false
      136        }
      137      }
      138      raf = requestAnimationFrame(tick)
      139      return () => cancelAnimationFrame(raf)
      140    }, [])
      141
      142 +  // Mark dirty on any control/aspect/scale/fx change so the paused c
          +anvas repaints once.
      143 +  useEffect(() => { dirtyRef.current = true }, [values, aspect, scale
          +, fxChain])
      144 +
      145    useEffect(() => {
      146      sizeStage()
      147      const ro = new ResizeObserver(() => sizeStage())

⏺ Check for any stale references to the removed colorAt exports, then build:

⏺ Bash(echo "=== stale colorAt refs (should be empty) ==="; grep -rn
      "ColorAt\|FIELD_COLOR_AT\|metaballField" src/ 2>/dev/null; echo "(empty =
      clean)"; echo; pnpm buil…)
  ⎿  === stale colorAt refs (should be empty) ===
     (empty = clean)

     ✓ built in 3.20s
  ⎿  Allowed by auto mode classifier

⏺ Clean, build green. Let me verify the vector draws are cheap (tens of ops, not a
  million) and seamless, via a mock canvas:

⏺ Bash(node --input-type=module -e '
      import { drawStripes } from "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  stripes(solid): 29 ops, 29 fills/frame | seam u0==u1: true
     stripes(pin): 41 ops, 41 fills/frame | seam u0==u1: true
     tartan: 132 ops, 132 fills/frame | seam u0==u1: false
     organic: 3450 ops, 23 fills/frame | seam u0==u1: true
  ⎿  Allowed by auto mode classifier

⏺ Stripes (29 rects vs 1,000,000 pixel evals!) and organic (vector paths) are cheap and
  seamless. Tartan's "seam: false" is a mock artifact — it uses ctx.translate(-drift)
  which my mock ignores. Let me re-check with a translate-aware mock:

⏺ Bash(node --input-type=module -e '
      import { drawTartan } from "./src/loops/pattern/fields/tartanField.js";…)
  ⎿  tartan: 132 rects/frame | visible-rect mismatch u0 vs u1: 0 (0 = seamless)
  ⎿  Allowed by auto mode classifier

⏺ Confirmed — all four field families are now cheap vector geometry and seamless:

  ┌─────────┬─────────────────────────────┬────────────────────────────────────────┐
  │ Family  │           Before            │                 After                  │
  ├─────────┼─────────────────────────────┼────────────────────────────────────────┤
  │ Stripes │ ~1,000,000 pixel            │ 29 fillRects                           │
  │         │ evals/frame (~45ms)         │                                        │
  ├─────────┼─────────────────────────────┼────────────────────────────────────────┤
  │ Tartan  │ ~1M pixel evals             │ 132 rects (solid weft + 50% warp = the │
  │         │                             │  average weave)                        │
  ├─────────┼─────────────────────────────┼────────────────────────────────────────┤
  │ Organic │ ~1M pixel evals (metaball)  │ 23 filled paths (wavy bands)           │
  └─────────┴─────────────────────────────┴────────────────────────────────────────┘

  Build green, all verified seamless (u=0 ≡ u=1).

  What changed (both your points)

  1. Perf — you were right, it was painting stripes pixel-by-pixel. The whole per-pixel
  field raster is gone from the pattern engine. Stripes/tartan/organic now draw as a
  handful of rects/paths in a rotated frame — canvas anti-aliases the edges and
  sub-pixel motion, so it's smooth and fast. Plus the idle bug: the loop re-rendered
  every frame even when paused — now it only redraws when playing or when a
  control/size changed, so paused = ~0 cost (that was your 17-19fps idle).

  2. Organic = wavy bands, not blobs. Metaball deleted (metaballField.js gone). Organic
  is now bands with an undulating sine edge profile — the water/contour motif from
  your image. Controls: Angle · Pitch · Bands · Amplitude · Frequency. Presets: Waves,
  Tide, Dunes, Ripple, Contour, Strata, Current, Swell, Marble, Lava flow, Aurora, Sand
  (+ a few genuine dot/abstract tile marks kept for variety). Flow undulates the wave.

  Net: every pattern family (tiles, stripes, tartan, organic, weave) is now light
  vector drawing — should sit at 60fps animating and cost nothing idle.

  Not eyeballed live — check /pattern on :5173: the stripe fps, and that Organic reads
  as flowing wavy bands. Tell me if the wave profile or speed needs tuning.

✻ Cooked for 10m 44s

❯ in stripes why are there no 'stripe' animation options, f.e. width scale, color or
  whatever?

  same in organic, missing 'stripe' animation , also we could expose organic profile?

  in blocks, there seems to be a limit to how close the blocks can get, there should
  be bipolarity there, from 'a big gap' to  'negative gap'

⏺ Three good calls. Let me knock them out.

  Blocks gap — make it bipolar. Widen the Grid gap range so blocks go from a big gap to
  heavy overlap:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 1 line, removed 1 line
      329          <Slider labeled label="Columns" min={1} max={32} step={1} val
           ue={v.cols} onChange={(x) => onChange('cols', roundIfNum(x))} variant
           ="default" />
      330          <Slider labeled label="Rows" min={1} max={32} step={1} value=
           {v.rows} onChange={(x) => onChange('rows', roundIfNum(x))} variant="d
           efault" />
      331          <Slider labeled label="Cell size" min={40} max={280} step={1}
            value={v.cell} onChange={(x) => onChange('cell', roundIfNum(x))} var
           iant="default" />
      332 -        <Slider labeled label="Gap" min={-40} max={80} step={1} value
          -={v.gap} onChange={(x) => onChange('gap', roundIfNum(x))} variant="de
          -fault" />
      332 +        <Slider labeled label="Gap" min={-120} max={120} step={1} val
          +ue={v.gap} onChange={(x) => onChange('gap', roundIfNum(x))} variant="
          +default" />
      333          <ToggleSwitch variant="plain" label="Stretch" checked={v.stre
           tch} onChange={(c) => onChange('stretch', c)} />
      334          <ToggleSwitch variant="plain" label="Grid lines" checked={!!v
           .showGrid} onChange={(c) => onChange('showGrid', c)} />
      335        </Section>

⏺ Field animation. Add the params (Pulse = width/scale breathe, Shimmer = colour,
  Cycles), driven seamlessly:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 5 lines
      205      // Organic field (field:'organic') — bands with a wavy edge profi
           le
      206      waveAmp: 0.4,        // undulation depth (× pitch)
      207      waveFreq: 1.5,       // waves across the field
      208 +    // Field animation (stripes/tartan/organic) — modulations over th
          +e loop, all
      209 +    // seamless on whole `fieldCycles`. 0 = off. (Flow/camFlow stays
          +the drift.)
      210 +    fieldPulse: 0,       // breathe the scale (stripe/tartan pitch ·
          +organic amplitude)
      211 +    fieldShimmer: 0,     // oscillate band colours toward their neigh
          +bour
      212 +    fieldCycles: 1,      // whole cycles per loop for the above
      213      // Weave render (render:'weave') — interlaced over/under strands
      214      weaveType: 'plain',  // plain | twill | satin | basket (which str
           and goes over)
      215      strandWidth: 0.7,    // ribbon width (× cell)

⏺ Now wire the animation into the three field draws. Stripes (pitch breathe + colour
  shimmer):

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.js'
      2
      3  // Stripes — VECTOR bands (a handful of fillRects), NOT per-pixel. Tran
         sform into a
      4  // stripe-local frame (camera angle + zoom, then the stripe angle) and
         fill one rect

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 17 lines, removed 12 lines
      15    const soft = p.edgeSoftness || 0
      16    const z = p.camZoom || 1
      17    const drift = u * Math.round(p.camFlow || 0) * bands // whole period
          s ⇒ seamless
      18 +  // Field animation (seamless on whole fieldCycles): pitch breathe +
         +colour shimmer.
      19 +  const tphase = u * TAU * Math.round(p.fieldCycles || 1)
      20 +  const pitchA = pitch * (1 + (p.fieldPulse || 0) * 0.4 * Math.sin(tph
         +ase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5 - 0.5 * Math.cos(tphase))
         +// 0→1→0
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHex(cols[idx], cols[(idx + 1
         +) % bands], cmix) : cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)
     ...
      27    ctx.scale(z, z)
      28    ctx.rotate((p.stripeAngle || 0) * Math.PI / 180) // stripe-local: x
          = band normal
      29
      25 -  const reach = (Math.hypot(w, h) / 2) / z + pitch * 2
      30 +  const reach = (Math.hypot(w, h) / 2) / z + pitchA * 2
      31    const y0 = -reach, yH = reach * 2
      27 -  const nLo = Math.floor(-reach / pitch + drift) - 1
      28 -  const nHi = Math.ceil(reach / pitch + drift) + 1
      32 +  const nLo = Math.floor(-reach / pitchA + drift) - 1
      33 +  const nHi = Math.ceil(reach / pitchA + drift) + 1
      34    for (let n = nLo; n <= nHi; n++) {
      35      const idx = ((n % bands) + bands) % bands
      31 -    const x = (n - drift) * pitch
      36 +    const x = (n - drift) * pitchA
      37      if (duty < 0.999 && soft <= 0) {
      33 -      ctx.fillStyle = cols[idx]
      34 -      ctx.fillRect(x, y0, pitch * duty, yH) // ink band on the (alread
         -y-filled) bg
      38 +      ctx.fillStyle = bandCol(idx)
      39 +      ctx.fillRect(x, y0, pitchA * duty, yH) // ink band on the (alrea
         +dy-filled) bg
      40      } else if (soft > 0) {
      36 -      const g = ctx.createLinearGradient(x, 0, x + pitch, 0)
      37 -      g.addColorStop(0, cols[idx])
      38 -      g.addColorStop(1, cols[(idx + 1) % bands])
      41 +      const g = ctx.createLinearGradient(x, 0, x + pitchA, 0)
      42 +      g.addColorStop(0, bandCol(idx))
      43 +      g.addColorStop(1, bandCol((idx + 1) % bands))
      44        ctx.fillStyle = g
      40 -      ctx.fillRect(x, y0, pitch, yH)
      45 +      ctx.fillRect(x, y0, pitchA, yH)
      46      } else {
      42 -      ctx.fillStyle = cols[idx]
      43 -      ctx.fillRect(x, y0, pitch, yH)
      47 +      ctx.fillStyle = bandCol(idx)
      48 +      ctx.fillRect(x, y0, pitchA, yH)
      49      }
      50    }
      51    ctx.restore()

⏺ Organic (wave-amplitude breathe + colour shimmer):

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.js'
      2
      3  // Organic — bands with a wavy/undulating edge PROFILE (not blobs). Sam
         e band model
      4  // as stripes, but each boundary is a sine-displaced curve, so the band
         s read as a

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 6 lines, removed 1 line
      11    const cols = [p.color, p.color2 || p.color, p.color3 || p.color2 ||
          p.color]
      12    const bands = Math.max(1, Math.round(p.bandCount || 2))
      13    const pitch = Math.max(8, p.stripePitch || 90)
      14 -  const amp = (p.waveAmp == null ? 0.4 : p.waveAmp) * pitch
      14    const freq = p.waveFreq == null ? 1.5 : p.waveFreq
      15    const z = p.camZoom || 1
      16    const wavePhase = u * TAU * Math.round(p.camFlow || 0) // undulation
          , whole cycles ⇒ seamless
      17 +  // Field animation (seamless on whole fieldCycles): the profile ampl
         +itude breathes,
      18 +  // band colours shimmer toward their neighbour.
      19 +  const tphase = u * TAU * Math.round(p.fieldCycles || 1)
      20 +  const amp = (p.waveAmp == null ? 0.4 : p.waveAmp) * pitch * (1 + (p.
         +fieldPulse || 0) * 0.6 * Math.sin(tphase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5 - 0.5 * Math.cos(tphase))
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHex(cols[idx], cols[(idx + 1
         +) % bands], cmix) : cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      35    const nLo = Math.floor(-reach / pitch) - 1
      36    const nHi = Math.ceil(reach / pitch) + 1
      37    for (let n = nLo; n <= nHi; n++) {
      38 -    ctx.fillStyle = cols[((n % bands) + bands) % bands]
      38 +    ctx.fillStyle = bandCol(((n % bands) + bands) % bands)
      39      ctx.beginPath()
      40      ctx.moveTo(bx(n, -reach), -reach)
      41      for (let y = -reach; y <= reach; y += step) ctx.lineTo(bx(n, y), y
          )

⏺ Tartan (sett-scale breathe + weave shimmer):

⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 5 lines, removed 1 line
      11    const pal = [p.color, p.color2 || p.color, p.color3 || p.color2 || p
          .color, p.bg]
      12    const sett = SETTS[p.sett] || SETTS['black-watch']
      13    const total = sett.reduce((s, b) => s + b[1], 0)
      14 -  const scale = Math.max(0.5, p.settScale || 5)
      14 +  // Field animation (seamless on whole fieldCycles): the sett breathe
         +s its scale,
      15 +  // the warp/weft balance shimmers.
      16 +  const tphase = u * TAU * Math.round(p.fieldCycles || 1)
      17 +  const scale = Math.max(0.5, p.settScale || 5) * (1 + (p.fieldPulse |
      19    const span = total * scale
      20    const z = p.camZoom || 1
      21    const drift = u * Math.round(p.camFlow || 0) * span // whole repeats
           ⇒ seamless

⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 2 lines, removed 2 lines
      45      }
      46      ctx.globalAlpha = 1
      47    }
      48 -  drawAxis(true, 1)     // weft (horizontal) — solid
      49 -  drawAxis(false, 0.5)  // warp (vertical) at 50% ⇒ average over the w
         -eft
      48 +  drawAxis(true, 1)         // weft (horizontal) — solid
      49 +  drawAxis(false, warpAlpha) // warp (vertical) ~50% ⇒ average over th
         +e weft
      50    ctx.restore()
      51  }

⏺ Add the field-animation params to the preserved motion set so they survive preset
  switches:

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      26    'camZoom', 'camFlow', 'camAngle', 'panDir', 'spin',
      27    'animAxis', 'animCycles', 'animWaves', 'animCurveExpr',
      28    'pulse', 'fade', 'swing', 'colorMix', 'framePreset', 'formPreset',
      29 +  'fieldPulse', 'fieldShimmer', 'fieldCycles',
      30  ]
      31
      32  // Pattern studio — the kolkrabbi rule/tiling system (Image #4 from th
          e brand

⏺ Now add the Animate section (Pulse · Shimmer · Cycles) to the Animation tab for field
  renders. Let me read the exact spot:

⏺ Reading 1 file… (ctrl+o to expand)
  ⎿  src/pages/loops/PatternControls.jsx

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 10 lines
      169          </Section>
      170          )}
      171
      172 +        {/* Field families animate their own form: scale breathe + co
          +lour shimmer
      173 +            (organic's Pulse breathes the wave profile). Driven on wh
          +ole Cycles. */}
      174 +        {!tilesRender && (
      175 +        <Section label="Animate">
      176 +          <Slider labeled label="Pulse" min={0} max={1} step={0.05} v
          +alue={v.fieldPulse ?? 0} onChange={(x) => onFrame('fieldPulse', x)} v
          +ariant="default" />
      177 +          <Slider labeled label="Shimmer" min={0} max={1} step={0.05}
          + value={v.fieldShimmer ?? 0} onChange={(x) => onFrame('fieldShimmer',
          + x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min={1} max={4} step={1} val
          +ue={v.fieldCycles ?? 1} onChange={(x) => onFrame('fieldCycles', round
          +IfNum(x))} variant="default" />
      179 +        </Section>
      180 +        )}
      181 +
      182          {tilesRender && animTab === 'form' && (
      183          <Section label="Form">
      184            <Slider labeled label="Spin" min={0} max={3} step={1} value
           ={v.spin} onChange={(x) => onForm('spin', roundIfNum(x))} variant="de
           fault" />

⏺ fieldPulse/Shimmer/Cycles aren't part of the Frame preset, so they should use plain
  onChange (no preset-revert):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 3 lines
      173              (organic's Pulse breathes the wave profile). Driven on wh
           ole Cycles. */}
      174          {!tilesRender && (
      175          <Section label="Animate">
      176 -          <Slider labeled label="Pulse" min={0} max={1} step={0.05} v
          -alue={v.fieldPulse ?? 0} onChange={(x) => onFrame('fieldPulse', x)} v
          -ariant="default" />
      177 -          <Slider labeled label="Shimmer" min={0} max={1} step={0.05}
          - value={v.fieldShimmer ?? 0} onChange={(x) => onFrame('fieldShimmer',
          - x)} variant="default" />
      178 -          <Slider labeled label="Cycles" min={1} max={4} step={1} val
          -ue={v.fieldCycles ?? 1} onChange={(x) => onFrame('fieldCycles', round
          -IfNum(x))} variant="default" />
      176 +          <Slider labeled label="Pulse" min={0} max={1} step={0.05} v
          +alue={v.fieldPulse ?? 0} onChange={(x) => onChange('fieldPulse', x)}
          +variant="default" />
      177 +          <Slider labeled label="Shimmer" min={0} max={1} step={0.05}
          + value={v.fieldShimmer ?? 0} onChange={(x) => onChange('fieldShimmer'
          +, x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min={1} max={4} step={1} val
          +ue={v.fieldCycles ?? 1} onChange={(x) => onChange('fieldCycles', roun
          +dIfNum(x))} variant="default" />
      179          </Section>
      180          )}
      181

⏺ Build and verify the new animations stay seamless with Pulse/Shimmer on:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could not resolve" | tail -3
      echo "--- seam check with field animation on (pulse+shimmer) ---"…)
  ⎿  ✓ built in 2.90s
     --- seam check with field animation on (pulse+shimmer) ---
     stripes pulse: 29 fills, seam u0==u1: true
     … +4 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Done — all three, build green, animations verified seamless.

  1 & 2 — Field animation (Stripes + Organic + Tartan). The Animation tab now has an
  Animate section for field renders (it was hidden — fields only had Flow). Three
  modulations, all seamless and off by default:
  - Pulse — breathes the scale: stripe/tartan band width, organic wave amplitude
  (animates the profile depth).
⏺ Done — all three, build green, animations verified seamless.

  1 & 2 — Field animation (Stripes + Organic + Tartan). The Animation tab now has an Animate section for field renders (it
  was hidden — fields only had Flow). Three modulations, all seamless and off by default:
  - Pulse — breathes the scale: stripe/tartan band width, organic wave amplitude (animates the profile depth).
  - Shimmer — oscillates each band's colour toward its neighbour.
  - Cycles — whole cycles per loop for both.

  So Stripes now animates width + colour (your "width scale, colour"); Organic animates its wavy profile + colour. They only
  run on play (no autoplay), and persist across preset switches like the other motion.

  Organic's profile is already exposed as controls in the Pattern tab — Amplitude + Frequency sliders. If you also want to
  pick the profile shape (sine vs sawtooth/steeper curves), say so and I'll add a curve selector.

  3 — Blocks gap is now bipolar. Widened the Grid Gap range from -40…80 to -120…120, so blocks go from a big mortar gap all
  the way into heavy overlap. (The engine blanks if cell + gap ≤ 0, so at very small cells the extreme-negative end has a
  floor — back off the gap or raise the cell.)


⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 10 lines
      169          </Section>
      170          )}
      171
      172 +        {/* Field families animate their own form: scale breathe + colour shimmer
      173 +            (organic's Pulse breathes the wave profile). Driven on whole Cycles. */}
      174 +        {!tilesRender && (
      175 +        <Section label="Animate">
      176 +          <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={v.fieldPulse ?? 0} onChange={(x)
          + => onFrame('fieldPulse', x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" min={0} max={1} step={0.05} value={v.fieldShimmer ?? 0} onChange=
          +{(x) => onFrame('fieldShimmer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min={1} max={4} step={1} value={v.fieldCycles ?? 1} onChange={(x)
          +=> onFrame('fieldCycles', roundIfNum(x))} variant="default" />
      179 +        </Section>
      180 +        )}
      181 +
      182          {tilesRender && animTab === 'form' && (
      183          <Section label="Form">
      184            <Slider labeled label="Spin" min={0} max={3} step={1} value={v.spin} onChange={(x) => onForm('spi
           n', roundIfNum(x))} variant="default" />







⏺ fieldPulse/Shimmer/Cycles aren't part of the Frame preset, so they should use plain
  onChange (no preset-revert):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 3 lines
      173              (organic's Pulse breathes the wave profile). Driven on whole Cycles. */}
      174          {!tilesRender && (
      175          <Section label="Animate">
      176 -          <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={v.fieldPulse ?? 0} onChange={(x)
          - => onFrame('fieldPulse', x)} variant="default" />
      177 -          <Slider labeled label="Shimmer" min={0} max={1} step={0.05} value={v.fieldShimmer ?? 0} onChange=
          -{(x) => onFrame('fieldShimmer', x)} variant="default" />
      178 -          <Slider labeled label="Cycles" min={1} max={4} step={1} value={v.fieldCycles ?? 1} onChange={(x)
          -=> onFrame('fieldCycles', roundIfNum(x))} variant="default" />
      176 +          <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={v.fieldPulse ?? 0} onChange={(x)
          + => onChange('fieldPulse', x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" min={0} max={1} step={0.05} value={v.fieldShimmer ?? 0} onChange=
          +{(x) => onChange('fieldShimmer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min={1} max={4} step={1} value={v.fieldCycles ?? 1} onChange={(x)
          +=> onChange('fieldCycles', roundIfNum(x))} variant="default" />
      179          </Section>
      180          )}
      181








⏺ Build and verify the new animations stay seamless with Pulse/Shimmer on:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could not resolve" | tail -3
      echo "--- seam check with field animation on (pulse+shimmer) ---"…)
  ⎿  ✓ built in 2.90s
     --- seam check with field animation on (pulse+shimmer) ---
     stripes pulse: 29 fills, seam u0==u1: true
     … +4 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Done — all three, build green, animations verified seamless.

  1 & 2 — Field animation (Stripes + Organic + Tartan). The Animation tab now has an Animate section for field renders (it
  was hidden — fields only had Flow). Three modulations, all seamless and off by default:
  - Pulse — breathes the scale: stripe/tartan band width, organic wave amplitude (animates the profile depth).
  - Shimmer — oscillates each band's colour toward its neighbour.
  - Cycles — whole cycles per loop for both.

  So Stripes now animates width + colour (your "width scale, colour"); Organic animates its wavy profile + colour. They only
  run on play (no autoplay), and persist across preset switches like the other motion.

  Organic's profile is already exposed as controls in the Pat
      41 +    }
      42 +    ctx.globalAlpha = 1
      43    }
      26 -  return (i, j, W, H) => {
      27 -    const [rx, ry] = sample(cam, (i / W) * w
         -, (j / H) * h)
      28 -    const warp = at(rx + drift)
      29 -    const weft = at(ry + drift)
p ≤ 0 30o- t vconstmdiagc=lMath.floor((rx--ery)i/e(sca has a
  flo r —-lec* 2)) the gap or raise the cell.)
      31 -    const bias = (((diag % 2) + 2) % 2) ? tw
  Not eye-ille: -twill o//:alternatecwhich threadeshowders on a st ipe-s ganic preset (Pulse/Shimmer with play), and the
  Blo 32 - p sreturnnmix2(0.5a+.bias, warp, weft)ulse depth or shi mer- eel needs tun//g0.5 = even average (the wea
         -ve)
✻ Chu 33d- o} 6m 17s
      44 +  drawAxis(true, 1)     // weft (horizontal)
───── ───+ —─solid ─────────────────────────────────────────────── 45─+ ─drawAxis(false,─0.5)──//─warp─(vertical)─a──────────      +t 50% ⇒ average over the weft
❯ 1.  46 + rctx.restore()he slider center to 0
  2.  47  }op still doesnt loop, I think it has to have something to do with the curve, what does k  k*k
⏺─Now─Organic─redefined─—─wavy-profile─bands─(your─image),─────not─blobs.─Creating─the─new─vector─renderer─and─removing─────the metaball:
  ⏵⏵ auto mode on (shift+tab to cycle)
⏺ Write(src/loops/pattern/fields/organicField.js)
  ⎿  Wrote 42 lines to
     src/loops/pattern/fields/organicField.js
      2 import { TAU } from '../../lib/util.js'
      3 // Organic — bands with a wavy/undulating edge
      4 // as stripes, but each boundary is a
         read as ad curve, so the bands
      5 // flowing water/contour motif. Drawn as filled
        nd) — a fewone per ba
      6 // thousand line segments, not a per-pixel
      7 // wave so bands tile with no gaps. Palette:
        he bands./color3 cycle t
      8 //   waveAmp   undulation depth (× pitch)
     … +53 lines (ctrl+o to expand)

⏺ Bash(rm /Users/biskup/dev/projects/kol-apparat/kol-labs-sin
      gle/src/loops/pattern/fields/metaballField.js && echo
      "deleted metaballField.js")
  ⎿  deleted metaballField.js

⏺ Now rewire patternLoop.js — all three families are vector
  draws, drop the raster/camera/metaball imports:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines, removed 5 lines
       2  import { resolveShape, DEFAULT_SHAPE_ID } fr
          om './shapes.js'
       3  import { composeCell, compileRules } from '.
          /rules.js'
       4  import { glyphShape, ensureGlyphFontUrl } fr
          om '../../lib/glyphPath.js'
       5 -import { makeCam } from '../field/camera.js'
       6 -import { raster } from '../field/raster.js'
       7 -import { stripeColorAt } from './fields/stri
         -peField.js'
       8 -import { tartanColorAt } from './fields/tart
         -anField.js'
       9 -import { metaballColorAt } from './fields/me
         -taballField.js'
       5 +import { drawStripes } from './fields/stripe
         +Field.js'
       6 +import { drawTartan } from './fields/tartanF
         +ield.js'
       7 +import { drawOrganic } from './fields/organi
         +cField.js'
       8
       9  // Pattern — the ported kol-client rule/tili
          ng system, rendered to Canvas2D so it
      10  // animates + outputs a texture. The cols×ro
          ws rule-block TILES infinitely; the

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 7 lines, removed 8 lines
      69    diag: [1, 1], anti: [1, -1],
      70  }
      71
      72 -// Field families (render:'field') — continu
         -ous per-pixel renderers that bypass
      73 -// the tile loop and reuse the shared field
         -rasterizer + camera. Each maps the
      74 -// pattern palette (color/color2/color3 + bg
         -) to a colorAt. Seamlessness is the
      75 -// colorAt's job (periodic phase via cam.pha
         -se).
      76 -const FIELD_COLOR_AT = { stripes: stripeColo
         -rAt, tartan: tartanColorAt, organic: metabal
         -lColorAt }
      72 +// Field families (render:'field') — continu
         +ous VECTOR renderers that bypass the
      73 +// tile loop. All three are cheap geometry (
         +rects / filled paths), NOT per-pixel:
      74 +// stripes = bands · tartan = crossed sett b
         +ands · organic = bands with a wavy edge.
      75 +// Each reads the pattern palette (color/col
         +or2/color3 + bg). Seamless on whole-
      76 +// cycle phase (u·TAU·round(camFlow)).
      77 +const FIELD_DRAW = { stripes: drawStripes, t
         +artan: drawTartan, organic: drawOrganic }
      78  function drawField(ctx, u, w, h, p) {
      78 -  const make = FIELD_COLOR_AT[p.field] || FI
         -ELD_COLOR_AT.stripes
      79 -  const cam = makeCam(u, p, w, h)
      80 -  raster(ctx, w, h, make(p, cam, w, h))
      79 +  (FIELD_DRAW[p.field] || drawStripes)(ctx,
         +u, w, h, p)
      80  }
      81
      82  // Weave (render:'weave') — true over/under
          interlacing. Per crossing the warp

⏺ Update the Organic params in defaults (drop metaball, add
  wave):

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines, removed 5 lines
      202      sett: 'black-watch', // threadcount tab
           le (src/loops/pattern/fields/setts.js)
      203      settScale: 5,        // px per thread u
           nit
      204      twill: 0.18,         // 2/2-twill diago
           nal bias (0 = flat average)
      205 -    // Organic field (field:'organic') — su
          -mmed metaball iso-surface
      206 -    blobCount: 9,        // number of orbit
          -ing seeds
      207 -    blobRadius: 0.5,     // seed influence
          -radius (× canvas)
      208 -    threshold: 1,        // iso level — hig
          -her = tighter blobs
      209 -    warp: 0.2,           // domain-warp wob
          -ble
      205 +    // Organic field (field:'organic') — ba
          +nds with a wavy edge profile
      206 +    waveAmp: 0.4,        // undulation dept
          +h (× pitch)
      207 +    waveFreq: 1.5,       // waves across th
          +e field
      208      // Weave render (render:'weave') — inte
           rlaced over/under strands
      209      weaveType: 'plain',  // plain | twill |
            satin | basket (which strand goes over)
      210      strandWidth: 0.7,    // ribbon width (×
            cell)

⏺ Re-author the Organic presets as wavy bands:

⏺ Write(src/pages/pattern/categories/organic.js)
  ⎿  Added 45 lines, removed 60 lines
       1  import { R, PAL } from './_helpers.js'
       2
       3 -// ORGANIC — soft natural marks. The headlin
         -e is the metaball FIELD (render:'field',
       4 -// field:'organic'): orbiting seeds sum into
         - an iso-surface so blobs FUSE with smooth
       5 -// necks (color→color2→color3 depth ramp on
         -the bg ground). camFlow drives the orbit
       6 -// (whole cycles ⇒ seamless; paused on load)
         -.
       7 -//   blobCount  seed count    blobRadius  in
         -fluence (× canvas)
       8 -//   threshold  iso level (higher = tighter)
         -   warp  domain wobble
       9 -// Regular dot/abstract marks (polka, halfto
         -ne, honeycomb, petals…) are genuine TILE
      10 -// patterns, kept on the tile engine (no `re
         -nder` ⇒ 'tiles').
       3 +// ORGANIC — bands with a wavy/undulating ed
         +ge PROFILE (render:'field', field:'organic')
         +:
       4 +// flowing water/contour stripes, drawn as c
         +heap vector paths. Same band model as
       5 +// Stripes (angle/pitch/bands + palette) plu
         +s a wave:
       6 +//   waveAmp   undulation depth (× pitch)
         +   waveFreq  waves across the field
       7 +// camFlow undulates the wave (whole cycles
         +⇒ seamless; paused on load).
       8 +// A few genuine dot/abstract tile marks are
         + kept on the tile engine for variety.
       9
      12 -const blob = (o) => ({ render: 'field', fiel
         -d: 'organic', ...o })
      10 +const wave = (o) => ({ render: 'field', fiel
         +d: 'organic', ...o })
      11
      12  export default [
      15 -  // ── metaballs (field) ──
      16 -  { id: 'blobs', label: 'Blobs', params: blo
         -b({
      17 -    blobCount: 9, blobRadius: 0.5, threshold
         -: 1, warp: 0.2,
      18 -    color: PAL.sky, color2: PAL.teal, color3
         -: PAL.navy, bg: PAL.ink }) },
      19 -  { id: 'lava', label: 'Lava', params: blob(
         -{
      20 -    blobCount: 7, blobRadius: 0.7, threshold
         -: 0.9, warp: 0.3,
      21 -    color: PAL.gold, color2: PAL.rust, color
         -3: PAL.brick, bg: PAL.noir }) },
      22 -  { id: 'mercury', label: 'Mercury', params:
         - blob({
      23 -    blobCount: 10, blobRadius: 0.5, threshol
         -d: 1.3, warp: 0.1,
      24 -    color: PAL.bone, color2: PAL.grey, color
         -3: PAL.slate, bg: PAL.ink }) },
      25 -  { id: 'foam', label: 'Foam', params: blob(
         -{
      26 -    blobCount: 16, blobRadius: 0.36, thresho
         -ld: 1.1, warp: 0.25,
      27 -    color: PAL.bone, color2: PAL.oat, color3
         -: PAL.cream, bg: PAL.teal }) },
      28 -  { id: 'cells', label: 'Cells', params: blo
         -b({
      29 -    blobCount: 12, blobRadius: 0.5, threshol
         -d: 1.1, warp: 0.15,
      30 -    color: PAL.teal, color2: PAL.green, colo
         -r3: PAL.forest, bg: PAL.ink }) },
      31 -  { id: 'goo', label: 'Goo', params: blob({
      32 -    blobCount: 6, blobRadius: 0.8, threshold
         -: 0.8, warp: 0.35,
      33 -    color: PAL.green, color2: PAL.moss, colo
         -r3: PAL.olive, bg: PAL.noir }) },
      34 -  { id: 'magma', label: 'Magma', params: blo
         -b({
      35 -    blobCount: 8, blobRadius: 0.6, threshold
         -: 0.95, warp: 0.4,
      36 -    color: PAL.amber, color2: PAL.coral, col
         -or3: PAL.red, bg: PAL.char }) },
      37 -  { id: 'ooze', label: 'Ooze', params: blob(
         -{
      38 -    blobCount: 9, blobRadius: 0.6, threshold
         -: 1, warp: 0.3,
      39 -    color: PAL.purple, color2: PAL.violet, c
         -olor3: PAL.plum, bg: PAL.noir }) },
      40 -  { id: 'droplets', label: 'Droplets', param
         -s: blob({
      41 -    blobCount: 14, blobRadius: 0.42, thresho
         -ld: 1.2, warp: 0.15,
      42 -    color: PAL.sky, color2: PAL.blue, color3
         -: PAL.navy, bg: PAL.ink2 }) },
      43 -  { id: 'nuclei', label: 'Nuclei', params: b
         -lob({
      44 -    blobCount: 5, blobRadius: 0.7, threshold
         -: 0.85, warp: 0.2,
      45 -    color: PAL.amber, color2: PAL.gold, colo
         -r3: PAL.ochre, bg: PAL.ink }) },
      13 +  // ── wavy bands ──
      14 +  { id: 'waves', label: 'Waves', params: wav
         +e({
      15 +    stripeAngle: 90, stripePitch: 90, bandCo
         +unt: 2, waveAmp: 0.4, waveFreq: 1.4,
      16 +    color: PAL.sky, color2: PAL.ink2 }) },
      17 +  { id: 'tide', label: 'Tide', params: wave(
         +{
      18 +    stripeAngle: 90, stripePitch: 110, bandC
         +ount: 3, waveAmp: 0.5, waveFreq: 1,
      19 +    color: PAL.teal, color2: PAL.navy, color
         +3: PAL.sky }) },
      20 +  { id: 'dunes', label: 'Dunes', params: wav
         +e({
      21 +    stripeAngle: 90, stripePitch: 120, bandC
         +ount: 3, waveAmp: 0.6, waveFreq: 0.8,
      22 +    color: PAL.gold, color2: PAL.ochre, colo
         +r3: PAL.amber }) },
      23 +  { id: 'ripple', label: 'Ripple', params: w
         +ave({
      24 +    stripeAngle: 90, stripePitch: 60, bandCo
         +unt: 2, waveAmp: 0.35, waveFreq: 2.4,
      25 +    color: PAL.bone, color2: PAL.teal }) },
      26 +  { id: 'contour', label: 'Contour', params:
         + wave({
      27 +    stripeAngle: 90, stripePitch: 70, bandCo
         +unt: 3, waveAmp: 0.45, waveFreq: 1.6,
      28 +    color: PAL.moss, color2: PAL.forest, col
         +or3: PAL.olive }) },
      29 +  { id: 'strata', label: 'Strata', params: w
         +ave({
      30 +    stripeAngle: 90, stripePitch: 100, bandC
         +ount: 3, waveAmp: 0.3, waveFreq: 1.1,
      31 +    color: PAL.rust, color2: PAL.brick, colo
         +r3: PAL.coral }) },
      32 +  { id: 'current', label: 'Current', params:
         + wave({
      33 +    stripeAngle: 90, stripePitch: 80, bandCo
         +unt: 2, waveAmp: 0.55, waveFreq: 1.8,
      34 +    color: PAL.blue, color2: PAL.navy }) },
      35 +  { id: 'swell', label: 'Swell', params: wav
         +e({
      36 +    stripeAngle: 90, stripePitch: 140, bandC
         +ount: 2, waveAmp: 0.7, waveFreq: 0.7,
      37 +    color: PAL.sky, color2: PAL.ink2 }) },
      38 +  { id: 'marble', label: 'Marble', params: w
         +ave({
      39 +    stripeAngle: 70, stripePitch: 64, bandCo
         +unt: 3, waveAmp: 0.5, waveFreq: 2,
      40 +    color: PAL.bone, color2: PAL.slate, colo
         +r3: PAL.oat }) },
      41 +  { id: 'lava-flow', label: 'Lava flow', par
         +ams: wave({
      42 +    stripeAngle: 90, stripePitch: 96, bandCo
         +unt: 3, waveAmp: 0.65, waveFreq: 1.2,
      43 +    color: PAL.amber, color2: PAL.red, color
         +3: PAL.brick }) },
      44 +  { id: 'aurora', label: 'Aurora', params: w
         +ave({
      45 +    stripeAngle: 80, stripePitch: 110, bandC
         +ount: 3, waveAmp: 0.6, waveFreq: 1.3,
      46 +    color: PAL.teal, color2: PAL.purple, col
         +or3: PAL.sky }) },
      47 +  { id: 'sand', label: 'Sand', params: wave(
         +{
      48 +    stripeAngle: 90, stripePitch: 48, bandCo
         +unt: 2, waveAmp: 0.3, waveFreq: 2.6,
      49 +    color: PAL.oat, color2: PAL.camel }) },
      50
      47 -  // ── dots & polka (tiles) ──
      51 +  // ── dot & abstract marks (genuine tiles)
         + ──
      52    { id: 'polka', label: 'Polka', params: {
      53      shape: 'prim:circle', cols: 6, rows: 6,
          cell: 120, gap: 14,
      54      colorRule: 'checker', color: PAL.cream,
          color2: PAL.red, bg: PAL.ink,
     ...
      57      shape: 'prim:circle', cols: 14, rows: 14
          , cell: 70, gap: 18,
      58      color: PAL.bone, bg: PAL.navy,
      59      animAxis: 'radial', animWaves: 3, fade:
          0.3 } },
      56 -  { id: 'caviar', label: 'Caviar', params: {
      57 -    shape: 'prim:circle', cols: 24, rows: 24
         -, cell: 46, gap: 10,
      58 -    color: PAL.ink, bg: PAL.oat,
      59 -    animAxis: 'radial', animWaves: 4, fade:
         -0.2 } },
      60    { id: 'halftone', label: 'Halftone', param
          s: {
      61      shape: 'prim:circle', cols: 22, rows: 22
          , cell: 52, gap: 6,
      62      color: PAL.ink, bg: PAL.bone,
      63      animAxis: 'radial', animWaves: 3, pulse:
           0.4, animCurveExpr: 'pow(sin(PI*k),2)' } },
      64 -
      65 -  // ── honeycomb & cells (tiles) ──
      64    { id: 'honeycomb', label: 'Honeycomb', par
          ams: {
      65      shape: 'prim:hexagon', cols: 8, rows: 8,
           cell: 120, gap: 6,
      66      color: PAL.gold, bg: PAL.ochre,
      67      animAxis: 'radial', animWaves: 2, fade:
          0.2 } },
      70 -
      71 -  // ── scatter & confetti (tiles) ──
      68    { id: 'scatter', label: 'Scatter', params:
           {
      69      shape: 'prim:circle', cols: 16, rows: 16
          , cell: 80, gap: 8,
      70      color: PAL.gold, bg: PAL.ink,
      71      rules: [R({ selectKind: 'expression', ex
          pression: 'sin(col*12.9 + row*7.3) - 0.2', h
          ide: true })],
      72      animAxis: 'radial', animWaves: 3, fade:
          0.35, animCurveExpr: 'round(k)' } },
      77 -  { id: 'confetti', label: 'Confetti', param
         -s: {
      78 -    shape: 'prim:star', cols: 12, rows: 12,
         -cell: 90, gap: 10,
      79 -    colorRule: 'diag', color: PAL.coral, col
         -or2: PAL.amber, color3: PAL.sky, bg: PAL.noi
         -r,
      80 -    rules: [R({ selectKind: 'expression', ex
         -pression: 'cos(col*9.7 + row*4.3) - 0.1', hi
         -de: true })],
      81 -    animAxis: 'diag', animWaves: 3, swing: 3
         -0, colorMix: 0.3 } },
      82 -
      83 -  // ── petals & blossom (abstract-blob tile
         -s) ──
      73    { id: 'petals', label: 'Petals', params: {
      74      shape: 'abstract:abstract-01', cols: 6,
          rows: 6, cell: 150, gap: 8,
      75      colorRule: 'checker', color: PAL.pink, c
          olor2: PAL.rose, bg: PAL.plum,
      76      spin: 1, animAxis: 'diag', animWaves: 2,
           swing: 35, fade: 0.25 } },
      88 -  { id: 'lily-pads', label: 'Lily pads', par
         -ams: {
      89 -    shape: 'abstract:abstract-02', cols: 4,
         -rows: 4, cell: 200, gap: 12,
      90 -    colorRule: 'checker', color: PAL.green,
         -color2: PAL.forest, bg: PAL.ink2,
      91 -    spin: 1, animAxis: 'radial', animWaves:
         -2, pulse: 0.3, fade: 0.35 } },
      77  ]

⏺ Now the Organic controls in PatternControls — swap metaball
  sliders for wave/band controls:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 5 lines, removed 4 lines
      230          )}
      231          {field === 'organic' && (
      232            <Section label="Organic">
      233 -            <Slider labeled label="Blobs" m
          -in={2} max={16} step={1} value={v.blobCount
          - ?? 9} onChange={(x) => onChange('blobCount
          -', roundIfNum(x))} variant="default" />
      234 -            <Slider labeled label="Radius"
          -min={0.2} max={1.2} step={0.05} value={v.bl
          -obRadius ?? 0.5} onChange={(x) => onChange(
          -'blobRadius', x)} variant="default" />
      235 -            <Slider labeled label="Threshol
          -d" min={0.5} max={2} step={0.05} value={v.t
          -hreshold ?? 1} onChange={(x) => onChange('t
          -hreshold', x)} variant="default" />
      236 -            <Slider labeled label="Warp" mi
          -n={0} max={1} step={0.05} value={v.warp ??
          -0.2} onChange={(x) => onChange('warp', x)}
          -variant="default" />
      233 +            <Slider labeled label="Angle" m
          +in={0} max={180} step={1} value={v.stripeAn
          +gle ?? 90} onChange={(x) => onChange('strip
          +eAngle', roundIfNum(x))} variant="default"
          +/>
      234 +            <Slider labeled label="Pitch" m
          +in={20} max={240} step={1} value={v.stripeP
          +itch ?? 90} onChange={(x) => onChange('stri
          +pePitch', roundIfNum(x))} variant="default"
          + />
      235 +            <Slider labeled label="Bands" m
          +in={1} max={3} step={1} value={v.bandCount
          +?? 2} onChange={(x) => onChange('bandCount'
          +, roundIfNum(x))} variant="default" />
      236 +            <Slider labeled label="Amplitud
          +e" min={0} max={1} step={0.05} value={v.wav
          +eAmp ?? 0.4} onChange={(x) => onChange('wav
          +eAmp', x)} variant="default" />
      237 +            <Slider labeled label="Frequenc
          +y" min={0.3} max={4} step={0.1} value={v.wa
          +veFreq ?? 1.5} onChange={(x) => onChange('w
          +aveFreq', x)} variant="default" />
      238            </Section>
      239          )}
      240          <Section label="Colour">

⏺ Fix the Organic colour labels (wavy bands cycle the
  palette, no ground):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 4 lines
      251              {colorCtl('Ground', 'bg')}
      252            </>}
      253            {field === 'organic' && <>
      254 -            {colorCtl('Surface', 'color')}
      255 -            {colorCtl('Mid', 'color2')}
      256 -            {colorCtl('Deep', 'color3')}
      257 -            {colorCtl('Ground', 'bg')}
      254 +            {colorCtl('Colour A', 'color')}
      255 +            {(v.bandCount ?? 2) >= 2 && col
          +orCtl('Colour B', 'color2')}
      256 +            {(v.bandCount ?? 2) >= 3 && col
          +orCtl('Colour C', 'color3')}
      257            </>}
      258          </Section>
      259        </>

⏺ Now the idle-redraw fix in PatternEditor — only render when
  playing or something changed. Let me read the exact tick:

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 3 lines
      55    const uRef = useRef(0)
      56    const lastRef = useRef(0)
      57    const sizeRef = useRef({ w: 0, h: 0 })
      58 +  // Redraw-on-demand: when PAUSED, only re-
         +render when something changed (dirty).
      59 +  // The old loop re-rendered every rAF even
         + paused — wasted full frames at idle.
      60 +  const dirtyRef = useRef(true)
      61
      62    const onChange = (k, v) => setValues((s) =
          > ({ ...s, [k]: v }))
      63

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      113      cv.width = Math.floor(fw * dpr); cv.hei
           ght = Math.floor(fh * dpr)
      114      cv.getContext('2d').setTransform(dpr, 0
           , 0, dpr, 0, 0)
      115      sizeRef.current = { w: fw, h: fh }
      116 +    dirtyRef.current = true
      117    }, [aspect])
      118
      119    useEffect(() => {

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 7 lines, removed 1 line
      127        const dur = patternLoop.duration || 8
      128        if (playingRef.current) uRef.current
           = (uRef.current + dt * (tempoRef.current /
           120) / dur) % 1
      129        const { w, h } = sizeRef.current
      130 -      if (w && h) {
      130 +      // Render only while playing OR when
          +marked dirty (a control/size changed).
      131 +      // Paused + unchanged ⇒ skip the fram
          +e entirely → ~0 idle cost.
      132 +      if (w && h && (playingRef.current ||
          +dirtyRef.current)) {
      133          patternLoop.draw(cv.getContext('2d'
           ), uRef.current, w, h, resolveParams(values
           Ref.current, uRef.current * dur))
      134          if (fxChainRef.current.length) appl
           yCanvasFx(cv, fxChainRef.current)
      135 +        dirtyRef.current = false
      136        }
      137      }
      138      raf = requestAnimationFrame(tick)
      139      return () => cancelAnimationFrame(raf)
      140    }, [])
      141
      142 +  // Mark dirty on any control/aspect/scale
          +/fx change so the paused canvas repaints on
          +ce.
      143 +  useEffect(() => { dirtyRef.current = true
          + }, [values, aspect, scale, fxChain])
      144 +
      145    useEffect(() => {
      146      sizeStage()
      147      const ro = new ResizeObserver(() => siz
           eStage())

⏺ Check for any stale references to the removed colorAt
  exports, then build:

⏺ Bash(echo "=== stale colorAt refs (should be empty) ===";
      grep -rn "ColorAt\|FIELD_COLOR_AT\|metaballField" src/
      2>/dev/null; echo "(empty = clean)"; echo; pnpm buil…)
  ⎿  === stale colorAt refs (should be empty) ===
     (empty = clean)

     ✓ built in 3.20s
  ⎿  Allowed by auto mode classifier

⏺ Clean, build green. Let me verify the vector draws are
  cheap (tens of ops, not a million) and seamless, via a mock
  canvas:

⏺ Bash(node --input-type=module -e '
      import { drawStripes } from
      "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  stripes(solid): 29 ops, 29 fills/frame | seam u0==u
     1: true
     stripes(pin): 41 ops, 41 fills/frame | seam u0==u1:
     … +5 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Stripes (29 rects vs 1,000,000 pixel evals!) and organic
  (vector paths) are cheap and seamless. Tartan's "seam:
  false" is a mock artifact — it uses ctx.translate(-drift)
  which my mock ignores. Let me re-check with a
  translate-aware mock:

⏺ Bash(node --input-type=module -e '
      import { drawTartan } from
      "./src/loops/pattern/fields/tartanField.js";…)
  ⎿  tartan: 132 rects/frame | visible-rect mismatch u0
     vs u1: 0 (0 = seamless)
  ⎿  Allowed by auto mode classifier

⏺ Confirmed — all four field families are now cheap vector
  geometry and seamless:

  ┌─────────┬────────────────────┬───────────────────────┐
  │ Family  │       Before       │         After         │
  ├─────────┼────────────────────┼───────────────────────┤
  │         │ ~1,000,000 pixel   │                       │
  │ Stripes │ evals/frame        │ 29 fillRects          │
  │         │ (~45ms)            │                       │
  ├─────────┼────────────────────┼───────────────────────┤
  │         │                    │ 132 rects (solid weft │
  │ Tartan  │ ~1M pixel evals    │  + 50% warp = the     │
  │         │                    │ average weave)        │
  ├─────────┼────────────────────┼───────────────────────┤
  │ Organic │ ~1M pixel evals    │ 23 filled paths (wavy │
  │         │ (metaball)         │  bands)               │
  └─────────┴────────────────────┴───────────────────────┘

  Build green, all verified seamless (u=0 ≡ u=1).

  What changed (both your points)

  1. Perf — you were right, it was painting stripes
  pixel-by-pixel. The whole per-pixel field raster is gone
  from the pattern engine. Stripes/tartan/organic now draw as
  a handful of rects/paths in a rotated frame — canvas
  anti-aliases the edges and sub-pixel motion, so it's smooth
  and fast. Plus the idle bug: the loop re-rendered every
  frame even when paused — now it only redraws when playing
  or when a control/size changed, so paused = ~0 cost (that
  was your 17-19fps idle).

  2. Organic = wavy bands, not blobs. Metaball deleted
  (metaballField.js gone). Organic is now bands with an
  undulating sine edge profile — the water/contour motif from
  your image. Controls: Angle · Pitch · Bands · Amplitude ·
  Frequency. Presets: Waves, Tide, Dunes, Ripple, Contour,
  Strata, Current, Swell, Marble, Lava flow, Aurora, Sand (+
  a few genuine dot/abstract tile marks kept for variety).
  Flow undulates the wave.

  Net: every pattern family (tiles, stripes, tartan, organic,
  weave) is now light vector drawing — should sit at 60fps
  animating and cost nothing idle.

  Not eyeballed live — check /pattern on :5173: the stripe
  fps, and that Organic reads as flowing wavy bands. Tell me
  if the wave profile or speed needs tuning.

✻ Cooked for 10m 44s

❯ in stripes why are there no 'stripe' animation options,
  f.e. width scale, color or whatever?

  same in organic, missing 'stripe' animation , also we
  could expose organic profile?

  in blocks, there seems to be a limit to how close the
  blocks can get, there should be bipolarity there, from 'a
  big gap' to  'negative gap'

⏺ Three good calls. Let me knock them out.

  Blocks gap — make it bipolar. Widen the Grid gap range so
  blocks go from a big gap to heavy overlap:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 1 line, removed 1 line
      329          <Slider labeled label="Columns" min
           ={1} max={32} step={1} value={v.cols} onCha
           nge={(x) => onChange('cols', roundIfNum(x))
           } variant="default" />
      330          <Slider labeled label="Rows" min={1
           } max={32} step={1} value={v.rows} onChange
           ={(x) => onChange('rows', roundIfNum(x))} v
           ariant="default" />
      331          <Slider labeled label="Cell size" m
           in={40} max={280} step={1} value={v.cell} o
           nChange={(x) => onChange('cell', roundIfNum
           (x))} variant="default" />
      332 -        <Slider labeled label="Gap" min={-4
          -0} max={80} step={1} value={v.gap} onChange
          -={(x) => onChange('gap', roundIfNum(x))} va
          -riant="default" />
      332 +        <Slider labeled label="Gap" min={-1
          +20} max={120} step={1} value={v.gap} onChan
          +ge={(x) => onChange('gap', roundIfNum(x))}
          +variant="default" />
      333          <ToggleSwitch variant="plain" label
           ="Stretch" checked={v.stretch} onChange={(c
           ) => onChange('stretch', c)} />
      334          <ToggleSwitch variant="plain" label
           ="Grid lines" checked={!!v.showGrid} onChan
           ge={(c) => onChange('showGrid', c)} />
      335        </Section>

⏺ Field animation. Add the params (Pulse = width/scale
  breathe, Shimmer = colour, Cycles), driven seamlessly:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 5 lines
      205      // Organic field (field:'organic') — ba
           nds with a wavy edge profile
      206      waveAmp: 0.4,        // undulation dept
           h (× pitch)
      207      waveFreq: 1.5,       // waves across th
           e field
      208 +    // Field animation (stripes/tartan/orga
          +nic) — modulations over the loop, all
      209 +    // seamless on whole `fieldCycles`. 0 =
          + off. (Flow/camFlow stays the drift.)
      210 +    fieldPulse: 0,       // breathe the sca
          +le (stripe/tartan pitch · organic amplitude
          +)
      211 +    fieldShimmer: 0,     // oscillate band
          +colours toward their neighbour
      212 +    fieldCycles: 1,      // whole cycles pe
          +r loop for the above
      213      // Weave render (render:'weave') — inte
           rlaced over/under strands
      214      weaveType: 'plain',  // plain | twill |
            satin | basket (which strand goes over)
      215      strandWidth: 0.7,    // ribbon width (×
            cell)

⏺ Now wire the animation into the three field draws. Stripes
  (pitch breathe + colour shimmer):

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.j
        +s'
      2
      3  // Stripes — VECTOR bands (a handful of fillR
         ects), NOT per-pixel. Transform into a
      4  // stripe-local frame (camera angle + zoom, t
         hen the stripe angle) and fill one rect

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 17 lines, removed 12 lines
      15    const soft = p.edgeSoftness || 0
      16    const z = p.camZoom || 1
      17    const drift = u * Math.round(p.camFlow ||
          0) * bands // whole periods ⇒ seamless
      18 +  // Field animation (seamless on whole fiel
         +dCycles): pitch breathe + colour shimmer.
      19 +  const tphase = u * TAU * Math.round(p.fiel
         +dCycles || 1)
      20 +  const pitchA = pitch * (1 + (p.fieldPulse
         +|| 0) * 0.4 * Math.sin(tphase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5
         +- 0.5 * Math.cos(tphase)) // 0→1→0
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHe
         +x(cols[idx], cols[(idx + 1) % bands], cmix)
         +: cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)
     ...
      27    ctx.scale(z, z)
      28    ctx.rotate((p.stripeAngle || 0) * Math.PI
          / 180) // stripe-local: x = band normal
      29
      25 -  const reach = (Math.hypot(w, h) / 2) / z +
         - pitch * 2
      30 +  const reach = (Math.hypot(w, h) / 2) / z +
         + pitchA * 2
      31    const y0 = -reach, yH = reach * 2
      27 -  const nLo = Math.floor(-reach / pitch + dr
         -ift) - 1
      28 -  const nHi = Math.ceil(reach / pitch + drif
         -t) + 1
      32 +  const nLo = Math.floor(-reach / pitchA + d
         +rift) - 1
      33 +  const nHi = Math.ceil(reach / pitchA + dri
         +ft) + 1
      34    for (let n = nLo; n <= nHi; n++) {
      35      const idx = ((n % bands) + bands) % band
          s
      31 -    const x = (n - drift) * pitch
      36 +    const x = (n - drift) * pitchA
      37      if (duty < 0.999 && soft <= 0) {
      33 -      ctx.fillStyle = cols[idx]
      34 -      ctx.fillRect(x, y0, pitch * duty, yH)
         -// ink band on the (already-filled) bg
      38 +      ctx.fillStyle = bandCol(idx)
      39 +      ctx.fillRect(x, y0, pitchA * duty, yH)
         + // ink band on the (already-filled) bg
      40      } else if (soft > 0) {
      36 -      const g = ctx.createLinearGradient(x,
         -0, x + pitch, 0)
      37 -      g.addColorStop(0, cols[idx])
      38 -      g.addColorStop(1, cols[(idx + 1) % ban
         -ds])
      41 +      const g = ctx.createLinearGradient(x,
         +0, x + pitchA, 0)
      42 +      g.addColorStop(0, bandCol(idx))
      43 +      g.addColorStop(1, bandCol((idx + 1) %
         +bands))
      44        ctx.fillStyle = g
      40 -      ctx.fillRect(x, y0, pitch, yH)
      45 +      ctx.fillRect(x, y0, pitchA, yH)
      46      } else {
      42 -      ctx.fillStyle = cols[idx]
      43 -      ctx.fillRect(x, y0, pitch, yH)
      47 +      ctx.fillStyle = bandCol(idx)
      48 +      ctx.fillRect(x, y0, pitchA, yH)
      49      }
      50    }
      51    ctx.restore()

⏺ Organic (wave-amplitude breathe + colour shimmer):

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.j
        +s'
      2
      3  // Organic — bands with a wavy/undulating edg
         e PROFILE (not blobs). Same band model
      4  // as stripes, but each boundary is a sine-di
         splaced curve, so the bands read as a

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 6 lines, removed 1 line
      11    const cols = [p.color, p.color2 || p.color
          , p.color3 || p.color2 || p.color]
      12    const bands = Math.max(1, Math.round(p.ban
          dCount || 2))
      13    const pitch = Math.max(8, p.stripePitch ||
           90)
      14 -  const amp = (p.waveAmp == null ? 0.4 : p.w
         -aveAmp) * pitch
      14    const freq = p.waveFreq == null ? 1.5 : p.
          waveFreq
      15    const z = p.camZoom || 1
      16    const wavePhase = u * TAU * Math.round(p.c
          amFlow || 0) // undulation, whole cycles ⇒ s
          eamless
      17 +  // Field animation (seamless on whole fiel
         +dCycles): the profile amplitude breathes,
      18 +  // band colours shimmer toward their neigh
         +bour.
      19 +  const tphase = u * TAU * Math.round(p.fiel
         +dCycles || 1)
      20 +  const amp = (p.waveAmp == null ? 0.4 : p.w
         +aveAmp) * pitch * (1 + (p.fieldPulse || 0) *
         + 0.6 * Math.sin(tphase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5
         +- 0.5 * Math.cos(tphase))
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHe
         +x(cols[idx], cols[(idx + 1) % bands], cmix)
         +: cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      35    const nLo = Math.floor(-reach / pitch) - 1
      36    const nHi = Math.ceil(reach / pitch) + 1
      37    for (let n = nLo; n <= nHi; n++) {
      38 -    ctx.fillStyle = cols[((n % bands) + band
         -s) % bands]
      38 +    ctx.fillStyle = bandCol(((n % bands) + b
         +ands) % bands)
      39      ctx.beginPath()
      40      ctx.moveTo(bx(n, -reach), -reach)
      41      for (let y = -reach; y <= reach; y += st
          ep) ctx.lineTo(bx(n, y), y)

⏺ Tartan (sett-scale breathe + weave shimmer):

⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 5 lines, removed 1 line
      11    const pal = [p.color, p.color2 || p.color,
           p.color3 || p.color2 || p.color, p.bg]
      12    const sett = SETTS[p.sett] || SETTS['black
          -watch']
      13    const total = sett.reduce((s, b) => s + b[
          1], 0)
      14 -  const scale = Math.max(0.5, p.settScale ||
         - 5)
      14 +  // Field animation (seamless on whole fiel
         +dCycles): the sett breathes its scale,
      15 +  // the warp/weft balance shimmers.
      16 +  const tphase = u * TAU * Math.round(p.fiel
         +dCycles || 1)
      17 +  const scale = Math.max(0.5, p.settScale ||
         + 5) * (1 + (p.fieldPulse || 0) * 0.3 * Math.
         +sin(tphase))
      18 +  const warpAlpha = 0.5 + (p.fieldShimmer ||
         + 0) * 0.3 * Math.sin(tphase)
      19    const span = total * scale
      20    const z = p.camZoom || 1
      21    const drift = u * Math.round(p.camFlow ||
          0) * span // whole repeats ⇒ seamless

⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 2 lines, removed 2 lines
      45      }
      46      ctx.globalAlpha = 1
      47    }
      48 -  drawAxis(true, 1)     // weft (horizontal)
         - — solid
      49 -  drawAxis(false, 0.5)  // warp (vertical) a
         -t 50% ⇒ average over the weft
      48 +  drawAxis(true, 1)         // weft (horizon
         +tal) — solid
      49 +  drawAxis(false, warpAlpha) // warp (vertic
         +al) ~50% ⇒ average over the weft
      50    ctx.restore()
      51  }

⏺ Add the field-animation params to the preserved motion set
  so they survive preset switches:

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      26    'camZoom', 'camFlow', 'camAngle', 'panDir'
          , 'spin',
      27    'animAxis', 'animCycles', 'animWaves', 'an
          imCurveExpr',
      28    'pulse', 'fade', 'swing', 'colorMix', 'fra
          mePreset', 'formPreset',
      29 +  'fieldPulse', 'fieldShimmer', 'fieldCycles
         +',
      30  ]
      31
      32  // Pattern studio — the kolkrabbi rule/tilin
          g system (Image #4 from the brand

⏺ Now add the Animate section (Pulse · Shimmer · Cycles) to
  the Animation tab for field renders. Let me read the exact
  spot:

  Reading 1 file… (ctrl+o to expand)
  ⎿  src/pages/loops/PatternControls.jsx

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 10 lines
      169          </Section>
      170          )}
      171
      172 +        {/* Field families animate their ow
          +n form: scale breathe + colour shimmer
      173 +            (organic's Pulse breathes the w
          +ave profile). Driven on whole Cycles. */}
      174 +        {!tilesRender && (
      175 +        <Section label="Animate">
      176 +          <Slider labeled label="Pulse" min
          +={0} max={1} step={0.05} value={v.fieldPuls
          +e ?? 0} onChange={(x) => onFrame('fieldPuls
          +e', x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" m
          +in={0} max={1} step={0.05} value={v.fieldSh
          +immer ?? 0} onChange={(x) => onFrame('field
          +Shimmer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" mi
          +n={1} max={4} step={1} value={v.fieldCycles
          + ?? 1} onChange={(x) => onFrame('fieldCycle
          +s', roundIfNum(x))} variant="default" />
      179 +        </Section>
      180 +        )}
      181 +
      182          {tilesRender && animTab === 'form'
           && (
      183          <Section label="Form">
      184            <Slider labeled label="Spin" min=
           {0} max={3} step={1} value={v.spin} onChang
           e={(x) => onForm('spin', roundIfNum(x))} va
           riant="default" />

⏺ fieldPulse/Shimmer/Cycles aren't part of the Frame preset,
  so they should use plain onChange (no preset-revert):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 3 lines
      173              (organic's Pulse breathes the w
           ave profile). Driven on whole Cycles. */}
      174          {!tilesRender && (
      175          <Section label="Animate">
      176 -          <Slider labeled label="Pulse" min
          -={0} max={1} step={0.05} value={v.fieldPuls
          -e ?? 0} onChange={(x) => onFrame('fieldPuls
          -e', x)} variant="default" />
      177 -          <Slider labeled label="Shimmer" m
          -in={0} max={1} step={0.05} value={v.fieldSh
          -immer ?? 0} onChange={(x) => onFrame('field
          -Shimmer', x)} variant="default" />
      178 -          <Slider labeled label="Cycles" mi
          -n={1} max={4} step={1} value={v.fieldCycles
          - ?? 1} onChange={(x) => onFrame('fieldCycle
          -s', roundIfNum(x))} variant="default" />
      176 +          <Slider labeled label="Pulse" min
          +={0} max={1} step={0.05} value={v.fieldPuls
          +e ?? 0} onChange={(x) => onChange('fieldPul
          +se', x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" m
          +in={0} max={1} step={0.05} value={v.fieldSh
          +immer ?? 0} onChange={(x) => onChange('fiel
          +dShimmer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" mi
          +n={1} max={4} step={1} value={v.fieldCycles
          + ?? 1} onChange={(x) => onChange('fieldCycl
          +es', roundIfNum(x))} variant="default" />
      179          </Section>
      180          )}
      181

⏺ Build and verify the new animations stay seamless with
  Pulse/Shimmer on:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could
      not resolve" | tail -3
      echo "--- seam check with field animation on
      (pulse+shimmer) ---"…)
  ⎿  ✓ built in 2.90s
     --- seam check with field animation on (pulse+shimm
     er) ---
     … +5 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Done — all three, build green, animations verified
  seamless.

  1 & 2 — Field animation (Stripes + Organic + Tartan). The
  Animation tab now has an Animate section for field renders
  (it was hidden — fields only had Flow). Three modulations,
  all seamless and off by default:
  - Pulse — breathes the scale: stripe/tartan band width,
  organic wave amplitude (animates the profile depth).
  - Shimmer — oscillates each band's colour toward its
  neighbour.
  - Cycles — whole cycles per loop for both.

  So Stripes now animates width + colour (your "width scale,
  profile depth).
  - Shimmer — oscillates each band's colour toward its neighbour.
  - Cycles — whole cycles per loop for both.

  So Stripes now animates width + colour (your "width scale, colour"); Organic animates its wavy
  profile + colour. They only run on play (no autoplay), and persist across preset switches like
  the other motion.

  Organic's profile is already exposed as controls in the Pattern tab — Amplitude + Frequency
  sliders. If you also want to pick the profile shape (sine vs sawtooth/steeper curves), say so
  and I'll add a curve selector.

  3 — Blocks gap is now bipolar. Widened the Grid Gap range from -40…80 to -120…120, so blocks go
  from a big mortar gap all the way into heavy overlap. (The engine blanks if cell
           ariant="subtle" size="s
           m" className="w-full" o
           ptions={presetOpts(FRAM
           E_PRESETS, v.framePrese
           t)} value={v.framePrese
           t ?? 'custom'} onChange
           ={applyPreset('framePre
           set', FRAME_PRESETS)} /
           >
      148            </LabeledCont
           rol>
      149 -          <LabeledContr
          -ol inline label="Form">
      150 -            <Dropdown v
          -ariant="subtle" size="s
          -m" className="w-full" o
          -ptions={presetOpts(FORM
          -_PRESETS, v.formPreset)
          -} value={v.formPreset ?
          -? 'custom'} onChange={a
          -pplyPreset('formPreset'
          -, FORM_PRESETS)} />
      151 -          </LabeledCont
          -rol>
      149 +          {tilesRender
          +&& (
      150 +            <LabeledCon
          +trol inline label="Form
          +">
      151 +              <Dropdown
          + variant="subtle" size=
          +"sm" className="w-full"
          + options={presetOpts(FO
          +RM_PRESETS, v.formPrese
          +t)} value={v.formPreset
          + ?? 'custom'} onChange=
          +{applyPreset('formPrese
          +t', FORM_PRESETS)} />
      152 +            </LabeledCo
          +ntrol>
      153 +          )}
      154          </Section>
      153 -        <SegmentedToggl
          -e value={animTab} onCha
          -nge={setAnimTab} classN
          -ame="w-full" options={[
          -{ value: 'frame', label
          -: 'Frame' }, { value: '
          -form', label: 'Form' }]
          -} />
      154 -        {animTab === 'f
          -rame' && (
      155 +        {tilesRender &&
          + (
      156 +          <SegmentedTog
          +gle value={animTab} onC
          +hange={setAnimTab} clas
          +sName="w-full" options=
          +{[{ value: 'frame', lab
          +el: 'Frame' }, { value:
          + 'form', label: 'Form'
          +}]} />
      157 +        )}
      158 +        {(!tilesRender
          +|| animTab === 'frame')
          + && (
      159          <Section label=
           "Frame">
      160            <Slider label
           ed label="Flow" min={0}
            max={4} step={1} value
           ={v.camFlow} onChange={
           (x) => onFrame('camFlow
           ', roundIfNum(x))} vari
           ant="default" />
      161            {/* Direction
            is a tile-grid pan; fi
           elds drift along their
           own axis via Flow. */}
      158 -          {(v.render ??
          - 'tiles') === 'tiles' &
          -& (
      162 +          {tilesRender
          +&& (
      163              <LabeledCon
           trol inline label="Dire
           ction">
      164                <Dropdown
            variant="subtle" size=
           "sm" className="w-full"
            options={PAN_DIRS} val
           ue={v.panDir ?? 'diag'}
            onChange={(val) => onF
           rame('panDir', val)} />
      165              </LabeledCo
           ntrol>

⏺ Update(src/pages/loops/PatternControls.
        jsx)
  ⎿  Added 1 line, removed 1 line
      169          </Section>
      170          )}
      171
      172 -        {animTab === 'f
          -orm' && (
      172 +        {tilesRender &&
          + animTab === 'form' &&
          +(
      173          <Section label=
           "Form">
      174            <Slider label
           ed label="Spin" min={0}
            max={3} step={1} value
           ={v.spin} onChange={(x)
            => onForm('spin', roun
           dIfNum(x))} variant="de
           fault" />
      175            <LabeledContr
           ol inline label="Axis">

⏺ Bash(pnpm build 2>&1 | grep -E "built
      in|error|Error" | tail -3)
  ⎿  ✓ built in 2.74s
  ⎿  Allowed by auto mode classifier

⏺ All phases done, build green (2.74s).
  Here's the whole arc:

  Pattern studio — five genuinely
  distinct families

  The engine went from one shape per grid
  cell to a pluggable render dispatch
  (patternLoop.draw branches on render):
  'tiles' (the original loop, untouched)
  · 'field' (continuous per-pixel via the
  existing field/ rasterizer + camera) ·
  'weave' (a strand pass reusing the
  tile kernels). Each family leads with
  its true form but keeps genuine tile
  members where the pattern really is a
  tile tessellation.

  Family: Stripes
  Now renders as: directional band field
  —
    any angle, solid/pinstripe/ombré
  Engine: field
  Animation (Frame→Flow): barber-pole
    drift
  ───────────────────────────────────────
  ─
  Family: Tartan
  Now renders as: crossing warp×weft
    setts, averaged into the woven mix
    tone
  Engine: field
  Animation (Frame→Flow): sett scroll
  ───────────────────────────────────────
  ─
  Family: Blocks
  Now renders as: the tile engine
    (unchanged — it was right)
  Engine: tiles
  Animation (Frame→Flow): stepped re-tile
  ───────────────────────────────────────
  ─
  Family: Organic
  Now renders as: summed metaball
    iso-field — blobs that fuse
  Engine: field
  Animation (Frame→Flow): orbiting /
    merging
  ───────────────────────────────────────
  ─
  Family: Interlace
  Now renders as: real over/under strands

    with per-crossing z-order
  Engine: weave
  Animation (Frame→Flow): the weave
    travels

  Mixed where honest: argyle/houndstooth
  stay tiles under Tartan;
  polka/halftone/petals stay tiles under
  Organic; herringbone/lattice/chainlink
  stay tiles under Interlace.

  Verified (not just built)

  - Stripes — seam, real bands, pinstripe
  ratio, ombré blend ✓
  - Tartan — seamless, distinct crossing
  tones ✓
  - Organic — seamless (Δ≈0), fused blobs
  (56% fill), continuous motion ✓
  - Interlace — over/under mix per type
  (plain/twill/basket 50/50, satin
  sparse), travel seam 0 flips ✓

  Files

  New: fields/stripeField.js,
  fields/tartanField.js,
  fields/metaballField.js,
  fields/setts.js.
  Edited: patternLoop.js (dispatch,
  drawField, drawWeave, parityWeave,
  defaults), PatternControls.jsx
  (render-aware sections per family +
  Form axis hidden for field/weave), and
  re-authored
  stripes/tartan/organic/interlace.js.

  UI cleanup included

  The Animation tab is now render-aware:
  field/weave presets show only the Frame
  axis (their motion is Flow-driven) —
  the tiles-only Form sweep and Direction
  controls are hidden, no dead tabs.

  Honest caveats

  - Not eyeballed live — all coefficients
  (stripe pitch, sett scales, metaball
  threshold/radius, strand width) are
  first-calibration; they'll want tuning
  by eye on :5173.
  - Setts are plausible, not
  museum-accurate threadcounts.
  - New params persist via getSettings
  and ride the preset patches for
  deep-links; they're classified
  structural, so they swap with the
  preset while your camera motion carries
  over.

  Switch to :5173 and look — especially
  Tartan crossings, Organic fusion, and
  Interlace over/under. Tell me what
  needs tuning.

✻ Sautéed for 17m 20s

❯ I noticed on the first page, first
  example that it was 1. not smooth
  (little jerky) and 2. not a loop,
  animation has to be a loop -- find out
  why this is

⏺ Good catch — and you're right. Let me
  find the cause. The first example is
  Stripes → Awning (the /pattern index),
  animating via Flow drift. Let me look
  at exactly how the stripe drift
  advances per loop:

  Read 1 file (ctrl+o to expand)

⏺ Found it. drift = cam.phase / TAU
  advances by round(camFlow) bands per
  loop — but a stripe's repeat period is
  bandCount bands. Awning is bandCount:
  2, camFlow: 1, so over the loop it
  shifts one band = the half-phase
  (colours swapped), not a whole period →
  at u=1 the pattern doesn't match u=0,
  so it snaps at the wrap. That snap is
  both "not a loop" and the per-loop
  hitch you read as jerky.

  (My Phase-1 seam test passed only
  because I happened to use camFlow: 2 =
  exactly 2 bands = one full period for
  bandCount: 2 — a false positive. Good
  catch.)

  Fix: drift whole periods, not whole
  bands — multiply by bands:

⏺ Update(src/loops/pattern/fields/stripeF
        ield.js)
  ⎿  Added 4 lines, removed 1 line
      28    const pitch = Math.max
          (2, p.stripePitch || 60)
      29    const duty = p.duty ==
           null ? 1 : p.duty
      30    const soft = p.edgeSof
          tness || 0
      31 -  const drift = cam.phas
         -e / TAU // whole cycles
         -⇒ seamless
      31 +  // Drift whole PERIODS
         + per loop, not whole ban
         +ds: the palette repeats
         +every
      32 +  // `bands` bands, so a
         + 1-band shift (camFlow=1
         +, bands=2) lands on the
         +half-phase
      33 +  // and the loop snaps.
         + ×bands ⇒ camFlow full p
         +eriods per loop ⇒ truly
         +seamless.
      34 +  const drift = (cam.pha
         +se / TAU) * bands
      35    const solid = duty >=
          0.999
      36
      37    return (i, j, W, H) =>
           {

⏺ Bash(node --input-type=module -e '
      import { stripeColorAt } from
      "./src/loops/pattern/fields/stripeF
      ield.js";…)
  ⎿  camFlow=1 bands=1: mismatchPx=0
      maxΔ=0.0
     camFlow=1 bands=2: mismatchPx=0
     … +5 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Bash(pnpm build 2>&1 | grep -E "built
      in|error|Error" | tail -2)
  ⎿  ✓ built in 2.87s
  ⎿  Allowed by auto mode classifier

⏺ Fixed and verified — build green.

  Cause: the stripe drift advanced by
  round(camFlow) bands per loop, but the
  colour pattern repeats every bandCount
  bands. Awning (bandCount 2, camFlow 1)
  drifted exactly one band over the loop
  → it ended on the half-phase (colours
  swapped), so u=1 ≠ u=0 and the loop
  snapped back. That snap is what you saw
  as "not a loop," and the
  once-per-cycle jump is the hitch that
  reads as "jerky."

  Fix: drift by whole periods (×
  bandCount), so camFlow=1 = one full
  period per loop. Now verified seamless
  at camFlow=1 for 1/2/3 bands (0-pixel
  mismatch u=0↔u=1) and it still moves
  mid-loop. This was stripes-only —
  tartan (scrolls whole setts), organic
  (full orbits), and weave (period-1
  travel) were already whole-period and
  tested clean at camFlow=1.

  If any continuous jerkiness remains
  after this (separate from the loop
  snap), the likely suspect is the
  per-pixel field raster cost at a large
  stage size — tell me and I'll profile
  it rather than guess. But the loop
  itself is now correct.

✻ Sautéed for 3m 16s

❯ simple red white animation in stripe
  is only 21 fps? whats dragging it
  down? (even when everything is off the
  frame rate is 17-19 fps idle) -- what
  is causing this?

⏺ Two separate things here, and "17-19
  fps even when idle/paused" is the key
  clue — that says the render loop is
  doing heavy work every frame regardless
  of play state. Let me confirm by
  reading the tick loop and measuring the
  actual per-pixel field cost:

  Read 1 file (ctrl+o to expand)

⏺ Bash(node --input-type=module -e '
      import { stripeColorAt } from
      "./src/loops/pattern/fields/stripeF
      ield.js";…)
  ⎿  1Mpx stripe colorAt loop: 49.7
     ms/frame  -> 20 fps ceiling (JS
      only, excl putImageData/drawIm
     … +9 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier
  ⎿  Interrupt· What should Claude do

❯ [Image #3] are you making stripes from
  million boxes?? that must be the
  reson, why are you not just making it
  from 1 box?
  ⎿  [Image #3]

⏺ You're right, and that's exactly the
  cause — let me show the numbers and fix
  the real problem.

  The bench confirms it: the stripe was
  being rendered by computing a colour
  for ~1 million pixels every frame (a
  full per-pixel raster) — ~43–50ms/frame
  on its own = ~20fps ceiling. Not
  literally a million boxes, but just as
  dumb: stripes are flat bands, so
  painting them pixel-by-pixel is absurd.
  They should be a few fillRects (one
  per visible band ≈ 20–40 rects), which
  is sub-millisecond.

  Two compounding bugs:
  1. The over-engineered renderer —
  stripes (and tartan) used the per-pixel
  field meant for organic blobs. Wrong
  tool.
  2. It redrew every frame even when
  paused — that's your 17–19fps idle: the
  loop re-rasterized the whole field on
  every rAF regardless of play state.

  Fixing both. First, redraw stripes as
  vector bands instead of per-pixel:

⏺ Write(src/loops/pattern/fields/stripeFi
       eld.js)
  ⎿  Added 39 lines, removed 44
     lines
       1 -import { TAU, hexToRgb }
         - from '../../lib/util.js
         -'
       2 -import { sample } from '
         -../../field/camera.js'
       3 -import { mix2 } from '..
         -/../field/raster.js'
       1 +import { TAU } from '../
         +../lib/util.js'
       2
       5 -// Stripes — a continuou
         -s directional band FIELD
         - (no tiles). Reads the p
         -attern
       6 -// palette: color/color2
         -/color3 are the bands, b
         -g is the ground for pins
         -tripes.
       7 -// Two looks from one mo
         -del:
       8 -//   · duty >= 1  → soli
         -d colour bands cycling t
         -he palette; edgeSoftness
         - blends
       9 -//                  adja
         -cent band colours (ombré
         -).
      10 -//   · duty <  1  → an i
         -nk band of width `duty`
         -(the band colour) on the
         - bg
      11 -//                  grou
         -nd (pinstripe / slats);
         -edgeSoftness softens the
         - edges.
      12 -// Direction is `stripeA
         -ngle` (0 vertical · 90 h
         -orizontal · 45 diagonal)
         -. Seamless:
      13 -// drift is whole cycles
         - (cam.phase = u·TAU·roun
         -d(camFlow)), so u=0 ≡ u=
         -1.
      14 -
      15 -const clamp01 = (x) => (
         -x < 0 ? 0 : x > 1 ? 1 :
         -x)
      16 -const smoothstep = (e0,
         -e1, x) => {
      17 -  const t = clamp01((x -
         - e0) / (e1 - e0 || 1e-6)
         -)
      18 -  return t * t * (3 - 2
         -* t)
      19 -}
      20 -
      21 -// Factory: returns a co
         -lorAt(i,j,W,H) → [r,g,b]
         - for the shared rasteriz
         -er.
      22 -export function stripeCo
         -lorAt(p, cam, w, h) {
      23 -  const cols = [hexToRgb
         -(p.color), hexToRgb(p.co
         -lor2 || p.color), hexToR
         -gb(p.color3 || p.color2
         -|| p.color)]
      24 -  const ground = hexToRg
         -b(p.bg)
       3 +// Stripes — drawn as VE
         +CTOR bands (a handful of
         + fillRects), NOT per-pix
         +el. Stripes
       4 +// are flat geometry, so
         + we transform into a str
         +ipe-local frame (camera
         +angle+zoom,
       5 +// then the stripe angle
         +) and fill one rect per
         +visible band. Canvas ant
         +i-aliases
       6 +// the edges and sub-pix
         +el positions, so motion
         +is smooth. Reads the pal
         +ette:
       7 +// color/color2/color3 a
         +re the bands, bg is the
         +ground for pinstripes.
       8 +//   duty >= 1  → solid
         +colour bands (edgeSoftne
         +ss ⇒ ombré gradient per
         +band)
       9 +//   duty <  1  → an ink
         + band of width `duty` on
         + the bg ground (pinstrip
         +e/slats)
      10 +// Seamless: drift advan
         +ces whole PERIODS per lo
         +op (×bandCount), cam.pha
         +se whole cycles.
      11 +export function drawStri
         +pes(ctx, cam, w, h, p) {
      12 +  const cols = [p.color,
         + p.color2 || p.color, p.
         +color3 || p.color2 || p.
         +color]
      13    const bands = Math.max
          (1, Math.round(p.bandCou
          nt || 2))
      14    const theta = (p.strip
          eAngle || 0) * Math.PI /
           180
      27 -  const ct = Math.cos(th
         -eta), st = Math.sin(thet
         -a)
      15 +  const camAng = (p.camA
         +ngle || 0) * Math.PI / 1
         +80
      16    const pitch = Math.max
          (2, p.stripePitch || 60)
      17    const duty = p.duty ==
           null ? 1 : p.duty
      18    const soft = p.edgeSof
          tness || 0
      31 -  // Drift whole PERIODS
         - per loop, not whole ban
         -ds: the palette repeats
         -every
      32 -  // `bands` bands, so a
         - 1-band shift (camFlow=1
         -, bands=2) lands on the
         -half-phase
      33 -  // and the loop snaps.
         - ×bands ⇒ camFlow full p
         -eriods per loop ⇒ truly
         -seamless.
      34 -  const drift = (cam.pha
         -se / TAU) * bands
      35 -  const solid = duty >=
         -0.999
      19 +  const z = cam.zoom
      20 +  const drift = (cam.pha
         +se / TAU) * bands // who
         +le periods ⇒ seamless lo
         +op
      21
      37 -  return (i, j, W, H) =>
         - {
      38 -    const [rx, ry] = sam
         -ple(cam, (i / W) * w, (j
         - / H) * h)
      39 -    const ph = (rx * ct
         -+ ry * st) / pitch + dri
         -ft
      40 -    const n = Math.floor
         -(ph)
      41 -    const frac = ph - n
      22 +  ctx.save()
      23 +  ctx.translate(cam.cx,
         +cam.cy)
      24 +  ctx.rotate(camAng)
      25 +  ctx.scale(z, z)
      26 +  ctx.rotate(theta)
         +       // stripe-local f
         +rame: x = the stripe nor
         +mal
      27 +
      28 +  const reach = (Math.hy
         +pot(w, h) / 2) / z + pit
         +ch * 2
      29 +  const y0 = -reach, yH
         += reach * 2
      30 +  const nLo = Math.floor
         +(-reach / pitch + drift)
         + - 1
      31 +  const nHi = Math.ceil(
         +reach / pitch + drift) +
         + 1
      32 +  for (let n = nLo; n <=
         + nHi; n++) {
      33      const idx = ((n % ba
          nds) + bands) % bands
      43 -    const ink = cols[idx
         -]
      44 -    if (solid) {
      45 -      if (soft <= 0) ret
         -urn ink
      46 -      // blend toward th
         -e next band's colour acr
         -oss the boundary (ombré)
      47 -      return mix2(smooth
         -step(1 - soft, 1, frac),
         - ink, cols[(idx + 1) % b
         -ands])
      34 +    const x = (n - drift
         +) * pitch
      35 +    if (duty < 0.999 &&
         +soft <= 0) {
      36 +      ctx.fillStyle = co
         +ls[idx]
      37 +      ctx.fillRect(x, y0
         +, pitch * duty, yH) // i
         +nk band on the (already-
         +filled) bg
      38 +    } else if (soft > 0)
         + {
      39 +      const g = ctx.crea
         +teLinearGradient(x, 0, x
         + + pitch, 0)
      40 +      g.addColorStop(0,
         +cols[idx])
      41 +      g.addColorStop(1,
         +cols[(idx + 1) % bands])
      42 +      ctx.fillStyle = g
      43 +      ctx.fillRect(x, y0
         +, pitch, yH)
      44 +    } else {
      45 +      ctx.fillStyle = co
         +ls[idx]
      46 +      ctx.fillRect(x, y0
         +, pitch, yH)
      47      }
      49 -    // ink band of width
         - `duty` riding on the gr
         -ound colour (pinstripe /
         - slats)
      50 -    const cov = soft <=
         -0
      51 -      ? (frac < duty ? 1
         - : 0)
      52 -      : clamp01(smoothst
         -ep(0, soft, frac) - smoo
         -thstep(duty, Math.min(1,
         - duty + soft), frac))
      53 -    return mix2(cov, gro
         -und, ink)
      48    }
      49 +  ctx.restore()
      50  }

❯ and 'organic' is not pattern? its just
  blobs, we dont need that, organic
  would be for example stripes with an
  organic 'profile' f.e. [Image #4]
  ⎿  [Image #4]

⏺ You're right on both counts — and
  message 2 actually makes the perf fix
  cleaner. "Organic" as metaball blobs
  isn't a pattern; organic =
  stripes/bands with a wavy organic edge
  profile (your image). That means none
  of the families need the per-pixel
  raster — stripes, tartan, and organic
  are all cheap vector geometry. I'm
  dropping the field-raster + metaball
  entirely.

  Let me redo all three as vector draws
  (self-contained, no cam/raster
  coupling). Stripes first:

⏺ Write(src/loops/pattern/fields/stripeFi
       eld.js)
  ⎿  Added 13 lines, removed 16
     lines
       1  import { TAU } from '../
          ../lib/util.js'
       2
       3 -// Stripes — drawn as VE
         -CTOR bands (a handful of
         - fillRects), NOT per-pix
         -el. Stripes
       4 -// are flat geometry, so
         - we transform into a str
         -ipe-local frame (camera
         -angle+zoom,
       5 -// then the stripe angle
         -) and fill one rect per
         -visible band. Canvas ant
         -i-aliases
       6 -// the edges and sub-pix
         -el positions, so motion
         -is smooth. Reads the pal
         -ette:
       7 -// color/color2/color3 a
         -re the bands, bg is the
         -ground for pinstripes.
       8 -//   duty >= 1  → solid
         -colour bands (edgeSoftne
         -ss ⇒ ombré gradient per
         -band)
       9 -//   duty <  1  → an ink
         - band of width `duty` on
         - the bg ground (pinstrip
         -e/slats)
      10 -// Seamless: drift advan
         -ces whole PERIODS per lo
         -op (×bandCount), cam.pha
         -se whole cycles.
      11 -export function drawStri
         -pes(ctx, cam, w, h, p) {
       3 +// Stripes — VECTOR band
         +s (a handful of fillRect
         +s), NOT per-pixel. Trans
         +form into a
       4 +// stripe-local frame (c
         +amera angle + zoom, then
         + the stripe angle) and f
         +ill one rect
       5 +// per visible band; can
         +vas anti-aliases edges +
         + sub-pixel motion. Palet
         +te:
       6 +// color/color2/color3 =
         + bands, bg = ground for
         +pinstripes.
       7 +//   duty >= 1 → solid b
         +ands (edgeSoftness ⇒ per
         +-band ombré gradient)
       8 +//   duty <  1 → ink ban
         +d of width `duty` on the
         + bg ground (pinstripe /
         +slats)
       9 +// Seamless: drift advan
         +ces whole PERIODS per lo
         +op (×bandCount); phase =
         + u·TAU·round(camFlow).
      10 +export function drawStri
         +pes(ctx, u, w, h, p) {
      11    const cols = [p.color,
           p.color2 || p.color, p.
          color3 || p.color2 || p.
          color]
      12    const bands = Math.max
          (1, Math.round(p.bandCou
          nt || 2))
      14 -  const theta = (p.strip
         -eAngle || 0) * Math.PI /
         - 180
      15 -  const camAng = (p.camA
         -ngle || 0) * Math.PI / 1
         -80
      13    const pitch = Math.max
          (2, p.stripePitch || 60)
      14    const duty = p.duty ==
           null ? 1 : p.duty
      15    const soft = p.edgeSof
          tness || 0
      19 -  const z = cam.zoom
      20 -  const drift = (cam.pha
         -se / TAU) * bands // who
         -le periods ⇒ seamless lo
         -op
      16 +  const z = p.camZoom ||
         + 1
      17 +  const drift = u * Math
         +.round(p.camFlow || 0) *
         + bands // whole periods
         +⇒ seamless
      18
      19    ctx.save()
      23 -  ctx.translate(cam.cx,
         -cam.cy)
      24 -  ctx.rotate(camAng)
      20 +  ctx.translate(w / 2, h
         + / 2)
      21 +  ctx.rotate((p.camAngle
         + || 0) * Math.PI / 180)
      22    ctx.scale(z, z)
      26 -  ctx.rotate(theta)
         -       // stripe-local f
         -rame: x = the stripe nor
         -mal
      23 +  ctx.rotate((p.stripeAn
         +gle || 0) * Math.PI / 18
         +0) // stripe-local: x =
         +band normal
      24
      25    const reach = (Math.hy
          pot(w, h) / 2) / z + pit
          ch * 2
      26    const y0 = -reach, yH
          = reach * 2

⏺ Tartan as vector (solid weft + 50% warp
  = the average weave):

⏺ Write(src/loops/pattern/fields/tartanFi
       eld.js)
  ⎿  Added 40 lines, removed 27
     lines
       1 -import { TAU, hexToRgb }
         - from '../../lib/util.js
         -'
       2 -import { sample } from '
         -../../field/camera.js'
       3 -import { mix2 } from '..
         -/../field/raster.js'
       1 +import { TAU } from '../
         +../lib/util.js'
       2  import { SETTS } from '.
          /setts.js'
       3
       6 -// Tartan — crossing war
         -p + weft threads (no til
         -es). Each axis walks the
         - sett (a
       7 -// threadcount of palett
         -e-indexed bands); the ce
         -ll colour is the AVERAGE
         - of the
       8 -// warp + weft thread —
         -the woven "mix" tone. Sa
         -me colour on both axes ⇒
         - that solid
       9 -// colour; different col
         -ours ⇒ the muddy crossin
         -g third. A small twill b
         -ias shows
      10 -// more warp or weft alo
         -ng alternating diagonals
         - (the 2/2-twill grain).
         -Seamless:
      11 -// scroll advances by wh
         -ole sett-repeats (cam.ph
         -ase = u·TAU·round(camFlo
         -w)).
      12 -export function tartanCo
         -lorAt(p, cam, w, h) {
      13 -  const pal = [hexToRgb(
         -p.color), hexToRgb(p.col
         -or2 || p.color), hexToRg
         -b(p.color3 || p.color2 |
         -| p.color), hexToRgb(p.b
         -g)]
       4 +// Tartan — VECTOR bands
         +, not per-pixel. The wov
         +en "mix" tone comes for
         +free from
       5 +// alpha compositing: dr
         +aw the weft (horizontal
         +sett bands) solid, then
         +the warp
       6 +// (vertical sett bands)
         + at 50% → every cell is
         +the AVERAGE of its warp+
         +weft thread
       7 +// (same colour ⇒ that c
         +olour; different ⇒ the m
         +uddy crossing third). A
         +few dozen
       8 +// rects total. Palette
         +indices 0..3 → color/col
         +or2/color3/bg. Seamless:
         + the sett
       9 +// scrolls whole repeats
         + per loop (phase = u·TAU
         +·round(camFlow)).
      10 +export function drawTart
         +an(ctx, u, w, h, p) {
      11 +  const pal = [p.color,
         +p.color2 || p.color, p.c
         +olor3 || p.color2 || p.c
         +olor, p.bg]
      12    const sett = SETTS[p.s
          ett] || SETTS['black-wat
          ch']
      13    const total = sett.red
          uce((s, b) => s + b[1],
          0)
      16 -  const scale = Math.max
         -(0.5, p.settScale || 5)
         -  // px per thread unit
      17 -  const twill = p.twill
         -== null ? 0.18 : p.twill
      18 -  const span = total * s
         -cale
         -   // one full repeat, p
         -x
      19 -  const drift = (cam.pha
         -se / TAU) * span
         -   // whole repeats ⇒ se
         -amless
      14 +  const scale = Math.max
         +(0.5, p.settScale || 5)
      15 +  const span = total * s
         +cale
      16 +  const z = p.camZoom ||
         + 1
      17 +  const drift = u * Math
         +.round(p.camFlow || 0) *
         + span // whole repeats ⇒
         + seamless
      18
      21 -  const at = (t) => {
      22 -    let tt = (((t / scal
         -e) % total) + total) % t
         -otal
      23 -    for (let b = 0; b <
         -sett.length; b++) { if (
         -tt < sett[b][1]) return
         -pal[sett[b][0]]; tt -= s
         -ett[b][1] }
      24 -    return pal[sett[sett
         -.length - 1][0]]
      19 +  ctx.save()
      20 +  ctx.translate(w / 2, h
         + / 2)
      21 +  ctx.rotate((p.camAngle
         + || 0) * Math.PI / 180)
      22 +  ctx.scale(z, z)
      23 +  ctx.translate(-drift,
         +-drift) // diagonal sett
         + scroll
      24 +
      25 +  const reach = (Math.hy
         +pot(w, h) / 2) / z + spa
         +n
      26 +  const lo = -reach + dr
         +ift, hi = reach + drift
      27 +  const r0 = Math.floor(
         +lo / span) - 1, r1 = Mat
         +h.ceil(hi / span) + 1
      28 +  const long0 = lo - spa
         +n, longLen = (hi - lo) +
         + span * 2
      29 +
      30 +  const drawAxis = (hori
         +zontal, alpha) => {
      31 +    ctx.globalAlpha = al
         +pha
      32 +    for (let r = r0; r <
         += r1; r++) {
      33 +      let pos = r * span
      34 +      for (let b = 0; b
         +< sett.length; b++) {
      35 +        const wdt = sett
         +[b][1] * scale
      36 +        ctx.fillStyle =
         +pal[sett[b][0]]
      37 +        if (horizontal)
         +ctx.fillRect(long0, pos,
         + longLen, wdt)
      38 +        else ctx.fillRec
         +t(pos, long0, wdt, longL
         +en)
      39 +        pos += wdt
      40 +      }
      41 +    }
      42 +    ctx.globalAlpha = 1
      43    }
      26 -  return (i, j, W, H) =>
         - {
      27 -    const [rx, ry] = sam
         -ple(cam, (i / W) * w, (j
         - / H) * h)
      28 -    const warp = at(rx +
         - drift)
      29 -    const weft = at(ry +
         - drift)
      30 -    const diag = Math.fl
         -oor((rx - ry) / (scale *
         - 2))
      31 -    const bias = (((diag
         - % 2) + 2) % 2) ? twill
         -: -twill  // alternate w
         -hich thread shows
      32 -    return mix2(0.5 + bi
         -as, warp, weft)
         -          // 0.5 = even
         -average (the weave)
      33 -  }
      44 +  drawAxis(true, 1)
         +// weft (horizontal) — s
         +olid
      45 +  drawAxis(false, 0.5)
         +// warp (vertical) at 50
         +% ⇒ average over the wef
         +t
      46 +  ctx.restore()
      47  }

⏺ Now Organic redefined — wavy-profile
  bands (your image), not blobs. Creating
  the new vector renderer and removing
  the metaball:

⏺ Write(src/loops/pattern/fields/organicF
       ield.js)
  ⎿  Wrote 42 lines to src/loops/pat
     tern/fields/organicField.js
      1 import { TAU } from
      3 // Organic — bands with a
     wavy/undulating edge PROFILE
         band modelame
      4 // as stripes, but each
     boundary is a sine-displaced
      5 // flowing water/contour
     motif. Drawn as filled VECTOR
        nd) — a few ba
      6 // thous
     … +81 lines (ctrl+o to expand)

⏺ Bash(rm /Users/biskup/dev/projects/kol-
      apparat/kol-labs-single/src/loops/p
      attern/fields/metaballField.js &&
      echo "deleted metaballField.js")
  ⎿  deleted metaballField.js

⏺ Now rewire patternLoop.js — all three
  families are vector draws, drop the
  raster/camera/metaball imports:

⏺ Update(src/loops/pattern/patternLoop.js
        )
  ⎿  Added 3 lines, removed 5 lines
       2  import { resolveShape, D
          EFAULT_SHAPE_ID } from '
          ./shapes.js'
       3  import { composeCell, co
          mpileRules } from './rul
          es.js'
       4  import { glyphShape, ens
          ureGlyphFontUrl } from '
          ../../lib/glyphPath.js'
       5 -import { makeCam } from
         -'../field/camera.js'
       6 -import { raster } from '
         -../field/raster.js'
       7 -import { stripeColorAt }
         - from './fields/stripeFi
         -eld.js'
       8 -import { tartanColorAt }
         - from './fields/tartanFi
         -eld.js'
       9 -import { metaballColorAt
         - } from './fields/metaba
         -llField.js'
       5 +import { drawStripes } f
         +rom './fields/stripeFiel
         +d.js'
       6 +import { drawTartan } fr
         +om './fields/tartanField
         +.js'
       7 +import { drawOrganic } f
         +rom './fields/organicFie
         +ld.js'
       8
       9  // Pattern — the ported
          kol-client rule/tiling s
          ystem, rendered to Canva
          s2D so it
      10  // animates + outputs a
          texture. The cols×rows r
          ule-block TILES infinite
          ly; the

⏺ Update(src/loops/pattern/patternLoop.js
        )
  ⎿  Added 7 lines, removed 8 lines
      69    diag: [1, 1], anti: [1
          , -1],
      70  }
      71
      72 -// Field families (rende
         -r:'field') — continuous
         -per-pixel renderers that
         - bypass
      73 -// the tile loop and reu
         -se the shared field rast
         -erizer + camera. Each ma
         -ps the
      74 -// pattern palette (colo
         -r/color2/color3 + bg) to
         - a colorAt. Seamlessness
         - is the
      75 -// colorAt's job (period
         -ic phase via cam.phase).
      76 -const FIELD_COLOR_AT = {
         - stripes: stripeColorAt,
         - tartan: tartanColorAt,
         -organic: metaballColorAt
         - }
      72 +// Field families (rende
         +r:'field') — continuous
         +VECTOR renderers that by
         +pass the
      73 +// tile loop. All three
         +are cheap geometry (rect
         +s / filled paths), NOT p
         +er-pixel:
      74 +// stripes = bands · tar
         +tan = crossed sett bands
         + · organic = bands with
         +a wavy edge.
      75 +// Each reads the patter
         +n palette (color/color2/
         +color3 + bg). Seamless o
         +n whole-
      76 +// cycle phase (u·TAU·ro
         +und(camFlow)).
      77 +const FIELD_DRAW = { str
         +ipes: drawStripes, tarta
         +n: drawTartan, organic:
         +drawOrganic }
      78  function drawField(ctx,
          u, w, h, p) {
      78 -  const make = FIELD_COL
         -OR_AT[p.field] || FIELD_
         -COLOR_AT.stripes
      79 -  const cam = makeCam(u,
         - p, w, h)
      80 -  raster(ctx, w, h, make
         -(p, cam, w, h))
      79 +  (FIELD_DRAW[p.field] |
         +| drawStripes)(ctx, u, w
         +, h, p)
      80  }
      81
      82  // Weave (render:'weave'
          ) — true over/under inte
          rlacing. Per crossing th
          e warp

⏺ Update the Organic params in defaults
  (drop metaball, add wave):

⏺ Update(src/loops/pattern/patternLoop.js
        )
  ⎿  Added 3 lines, removed 5 lines
      202      sett: 'black-watch'
           , // threadcount table
           (src/loops/pattern/fiel
           ds/setts.js)
      203      settScale: 5,
             // px per thread unit
      204      twill: 0.18,
             // 2/2-twill diagonal
            bias (0 = flat average
           )
      205 -    // Organic field (f
          -ield:'organic') — summe
          -d metaball iso-surface
      206 -    blobCount: 9,
          -  // number of orbiting
          - seeds
      207 -    blobRadius: 0.5,
          -  // seed influence rad
          -ius (× canvas)
      208 -    threshold: 1,
          -  // iso level — higher
          - = tighter blobs
      209 -    warp: 0.2,
          -  // domain-warp wobble
      205 +    // Organic field (f
          +ield:'organic') — bands
          + with a wavy edge profi
          +le
      206 +    waveAmp: 0.4,
          +  // undulation depth (
          +× pitch)
      207 +    waveFreq: 1.5,
          +  // waves across the f
          +ield
      208      // Weave render (re
           nder:'weave') — interla
           ced over/under strands
      209      weaveType: 'plain',
             // plain | twill | sa
           tin | basket (which str
           and goes over)
      210      strandWidth: 0.7,
             // ribbon width (× ce
           ll)

⏺ Re-author the Organic presets as wavy
  bands:

⏺ Write(src/pages/pattern/categories/orga
       nic.js)
  ⎿  Added 45 lines, removed 60
     lines
       1  import { R, PAL } from '
          ./_helpers.js'
       2
       3 -// ORGANIC — soft natura
         -l marks. The headline is
         - the metaball FIELD (ren
         -der:'field',
       4 -// field:'organic'): orb
         -iting seeds sum into an
         -iso-surface so blobs FUS
         -E with smooth
       5 -// necks (color→color2→c
         -olor3 depth ramp on the
         -bg ground). camFlow driv
         -es the orbit
       6 -// (whole cycles ⇒ seaml
         -ess; paused on load).
       7 -//   blobCount  seed cou
         -nt    blobRadius  influe
         -nce (× canvas)
       8 -//   threshold  iso leve
         -l (higher = tighter)   w
         -arp  domain wobble
       9 -// Regular dot/abstract
         -marks (polka, halftone,
         -honeycomb, petals…) are
         -genuine TILE
      10 -// patterns, kept on the
         - tile engine (no `render
         -` ⇒ 'tiles').
       3 +// ORGANIC — bands with
         +a wavy/undulating edge P
         +ROFILE (render:'field',
         +field:'organic'):
       4 +// flowing water/contour
         + stripes, drawn as cheap
         + vector paths. Same band
         + model as
       5 +// Stripes (angle/pitch/
         +bands + palette) plus a
         +wave:
       6 +//   waveAmp   undulatio
         +n depth (× pitch)      w
         +aveFreq  waves across th
         +e field
       7 +// camFlow undulates the
         + wave (whole cycles ⇒ se
         +amless; paused on load).
       8 +// A few genuine dot/abs
         +tract tile marks are kep
         +t on the tile engine for
         + variety.
       9
      12 -const blob = (o) => ({ r
         -ender: 'field', field: '
         -organic', ...o })
      10 +const wave = (o) => ({ r
         +ender: 'field', field: '
         +organic', ...o })
      11
      12  export default [
      15 -  // ── metaballs (field
         -) ──
      16 -  { id: 'blobs', label:
         -'Blobs', params: blob({
      17 -    blobCount: 9, blobRa
         -dius: 0.5, threshold: 1,
         - warp: 0.2,
      18 -    color: PAL.sky, colo
         -r2: PAL.teal, color3: PA
         -L.navy, bg: PAL.ink }) }
         -,
      19 -  { id: 'lava', label: '
         -Lava', params: blob({
      20 -    blobCount: 7, blobRa
         -dius: 0.7, threshold: 0.
         -9, warp: 0.3,
      21 -    color: PAL.gold, col
         -or2: PAL.rust, color3: P
         -AL.brick, bg: PAL.noir }
         -) },
      22 -  { id: 'mercury', label
         -: 'Mercury', params: blo
         -b({
      23 -    blobCount: 10, blobR
         -adius: 0.5, threshold: 1
         -.3, warp: 0.1,
      24 -    color: PAL.bone, col
         -or2: PAL.grey, color3: P
         -AL.slate, bg: PAL.ink })
         - },
      25 -  { id: 'foam', label: '
         -Foam', params: blob({
      26 -    blobCount: 16, blobR
         -adius: 0.36, threshold:
         -1.1, warp: 0.25,
      27 -    color: PAL.bone, col
         -or2: PAL.oat, color3: PA
         -L.cream, bg: PAL.teal })
         - },
      28 -  { id: 'cells', label:
         -'Cells', params: blob({
      29 -    blobCount: 12, blobR
         -adius: 0.5, threshold: 1
         -.1, warp: 0.15,
      30 -    color: PAL.teal, col
         -or2: PAL.green, color3:
         -PAL.forest, bg: PAL.ink
         -}) },
      31 -  { id: 'goo', label: 'G
         -oo', params: blob({
      32 -    blobCount: 6, blobRa
         -dius: 0.8, threshold: 0.
         -8, warp: 0.35,
      33 -    color: PAL.green, co
         -lor2: PAL.moss, color3:
         -PAL.olive, bg: PAL.noir
         -}) },
      34 -  { id: 'magma', label:
         -'Magma', params: blob({
      35 -    blobCount: 8, blobRa
         -dius: 0.6, threshold: 0.
         -95, warp: 0.4,
      36 -    color: PAL.amber, co
         -lor2: PAL.coral, color3:
         - PAL.red, bg: PAL.char }
         -) },
      37 -  { id: 'ooze', label: '
         -Ooze', params: blob({
      38 -    blobCount: 9, blobRa
         -dius: 0.6, threshold: 1,
         - warp: 0.3,
      39 -    color: PAL.purple, c
         -olor2: PAL.violet, color
         -3: PAL.plum, bg: PAL.noi
         -r }) },
      40 -  { id: 'droplets', labe
         -l: 'Droplets', params: b
         -lob({
      41 -    blobCount: 14, blobR
         -adius: 0.42, threshold:
         -1.2, warp: 0.15,
      42 -    color: PAL.sky, colo
         -r2: PAL.blue, color3: PA
         -L.navy, bg: PAL.ink2 })
         -},
      43 -  { id: 'nuclei', label:
         - 'Nuclei', params: blob(
         -{
      44 -    blobCount: 5, blobRa
         -dius: 0.7, threshold: 0.
         -85, warp: 0.2,
      45 -    color: PAL.amber, co
         -lor2: PAL.gold, color3:
         -PAL.ochre, bg: PAL.ink }
         -) },
      13 +  // ── wavy bands ──
      14 +  { id: 'waves', label:
         +'Waves', params: wave({
      15 +    stripeAngle: 90, str
         +ipePitch: 90, bandCount:
         + 2, waveAmp: 0.4, waveFr
         +eq: 1.4,
      16 +    color: PAL.sky, colo
         +r2: PAL.ink2 }) },
      17 +  { id: 'tide', label: '
         +Tide', params: wave({
      18 +    stripeAngle: 90, str
         +ipePitch: 110, bandCount
         +: 3, waveAmp: 0.5, waveF
         +req: 1,
      19 +    color: PAL.teal, col
         +or2: PAL.navy, color3: P
         +AL.sky }) },
      20 +  { id: 'dunes', label:
         +'Dunes', params: wave({
      21 +    stripeAngle: 90, str
         +ipePitch: 120, bandCount
         +: 3, waveAmp: 0.6, waveF
         +req: 0.8,
      22 +    color: PAL.gold, col
         +or2: PAL.ochre, color3:
         +PAL.amber }) },
      23 +  { id: 'ripple', label:
         + 'Ripple', params: wave(
         +{
      24 +    stripeAngle: 90, str
         +ipePitch: 60, bandCount:
         + 2, waveAmp: 0.35, waveF
         +req: 2.4,
      25 +    color: PAL.bone, col
         +or2: PAL.teal }) },
      26 +  { id: 'contour', label
         +: 'Contour', params: wav
         +e({
      27 +    stripeAngle: 90, str
         +ipePitch: 70, bandCount:
         + 3, waveAmp: 0.45, waveF
         +req: 1.6,
      28 +    color: PAL.moss, col
         +or2: PAL.forest, color3:
         + PAL.olive }) },
      29 +  { id: 'strata', label:
         + 'Strata', params: wave(
         +{
      30 +    stripeAngle: 90, str
         +ipePitch: 100, bandCount
         +: 3, waveAmp: 0.3, waveF
         +req: 1.1,
      31 +    color: PAL.rust, col
         +or2: PAL.brick, color3:
         +PAL.coral }) },
      32 +  { id: 'current', label
         +: 'Current', params: wav
         +e({
      33 +    stripeAngle: 90, str
         +ipePitch: 80, bandCount:
         + 2, waveAmp: 0.55, waveF
         +req: 1.8,
      34 +    color: PAL.blue, col
         +or2: PAL.navy }) },
      35 +  { id: 'swell', label:
         +'Swell', params: wave({
      36 +    stripeAngle: 90, str
         +ipePitch: 140, bandCount
         +: 2, waveAmp: 0.7, waveF
         +req: 0.7,
      37 +    color: PAL.sky, colo
         +r2: PAL.ink2 }) },
      38 +  { id: 'marble', label:
         + 'Marble', params: wave(
         +{
      39 +    stripeAngle: 70, str
         +ipePitch: 64, bandCount:
         + 3, waveAmp: 0.5, waveFr
         +eq: 2,
      40 +    color: PAL.bone, col
         +or2: PAL.slate, color3:
         +PAL.oat }) },
      41 +  { id: 'lava-flow', lab
         +el: 'Lava flow', params:
         + wave({
      42 +    stripeAngle: 90, str
         +ipePitch: 96, bandCount:
         + 3, waveAmp: 0.65, waveF
         +req: 1.2,
      43 +    color: PAL.amber, co
         +lor2: PAL.red, color3: P
         +AL.brick }) },
      44 +  { id: 'aurora', label:
         + 'Aurora', params: wave(
         +{
      45 +    stripeAngle: 80, str
         +ipePitch: 110, bandCount
         +: 3, waveAmp: 0.6, waveF
         +req: 1.3,
      46 +    color: PAL.teal, col
         +or2: PAL.purple, color3:
         + PAL.sky }) },
      47 +  { id: 'sand', label: '
         +Sand', params: wave({
      48 +    stripeAngle: 90, str
         +ipePitch: 48, bandCount:
         + 2, waveAmp: 0.3, waveFr
         +eq: 2.6,
      49 +    color: PAL.oat, colo
         +r2: PAL.camel }) },
      50
      47 -  // ── dots & polka (ti
         -les) ──
      51 +  // ── dot & abstract m
         +arks (genuine tiles) ──
      52    { id: 'polka', label:
          'Polka', params: {
      53      shape: 'prim:circle'
          , cols: 6, rows: 6, cell
          : 120, gap: 14,
      54      colorRule: 'checker'
          , color: PAL.cream, colo
          r2: PAL.red, bg: PAL.ink
          ,
     ...
      57      shape: 'prim:circle'
          , cols: 14, rows: 14, ce
          ll: 70, gap: 18,
      58      color: PAL.bone, bg:
           PAL.navy,
      59      animAxis: 'radial',
          animWaves: 3, fade: 0.3
          } },
      56 -  { id: 'caviar', label:
         - 'Caviar', params: {
      57 -    shape: 'prim:circle'
         -, cols: 24, rows: 24, ce
         -ll: 46, gap: 10,
      58 -    color: PAL.ink, bg:
         -PAL.oat,
      59 -    animAxis: 'radial',
         -animWaves: 4, fade: 0.2
         -} },
      60    { id: 'halftone', labe
          l: 'Halftone', params: {
      61      shape: 'prim:circle'
          , cols: 22, rows: 22, ce
          ll: 52, gap: 6,
      62      color: PAL.ink, bg:
          PAL.bone,
      63      animAxis: 'radial',
          animWaves: 3, pulse: 0.4
          , animCurveExpr: 'pow(si
          n(PI*k),2)' } },
      64 -
      65 -  // ── honeycomb & cell
         -s (tiles) ──
      64    { id: 'honeycomb', lab
          el: 'Honeycomb', params:
           {
      65      shape: 'prim:hexagon
          ', cols: 8, rows: 8, cel
          l: 120, gap: 6,
      66      color: PAL.gold, bg:
           PAL.ochre,
      67      animAxis: 'radial',
          animWaves: 2, fade: 0.2
          } },
      70 -
      71 -  // ── scatter & confet
         -ti (tiles) ──
      68    { id: 'scatter', label
          : 'Scatter', params: {
      69      shape: 'prim:circle'
          , cols: 16, rows: 16, ce
          ll: 80, gap: 8,
      70      color: PAL.gold, bg:
           PAL.ink,
      71      rules: [R({ selectKi
          nd: 'expression', expres
          sion: 'sin(col*12.9 + ro
          w*7.3) - 0.2', hide: tru
          e })],
      72      animAxis: 'radial',
          animWaves: 3, fade: 0.35
          , animCurveExpr: 'round(
          k)' } },
      77 -  { id: 'confetti', labe
         -l: 'Confetti', params: {
      78 -    shape: 'prim:star',
         -cols: 12, rows: 12, cell
         -: 90, gap: 10,
      79 -    colorRule: 'diag', c
         -olor: PAL.coral, color2:
         - PAL.amber, color3: PAL.
         -sky, bg: PAL.noir,
      80 -    rules: [R({ selectKi
         -nd: 'expression', expres
         -sion: 'cos(col*9.7 + row
         -*4.3) - 0.1', hide: true
         - })],
      81 -    animAxis: 'diag', an
         -imWaves: 3, swing: 30, c
         -olorMix: 0.3 } },
      82 -
      83 -  // ── petals & blossom
         - (abstract-blob tiles) ─
         -─
      73    { id: 'petals', label:
           'Petals', params: {
      74      shape: 'abstract:abs
          tract-01', cols: 6, rows
          : 6, cell: 150, gap: 8,
      75      colorRule: 'checker'
          , color: PAL.pink, color
          2: PAL.rose, bg: PAL.plu
          m,
      76      spin: 1, animAxis: '
          diag', animWaves: 2, swi
          ng: 35, fade: 0.25 } },
      88 -  { id: 'lily-pads', lab
         -el: 'Lily pads', params:
         - {
      89 -    shape: 'abstract:abs
         -tract-02', cols: 4, rows
         -: 4, cell: 200, gap: 12,
      90 -    colorRule: 'checker'
         -, color: PAL.green, colo
         -r2: PAL.forest, bg: PAL.
         -ink2,
      91 -    spin: 1, animAxis: '
         -radial', animWaves: 2, p
         -ulse: 0.3, fade: 0.35 }
         -},
      77  ]

⏺ Now the Organic controls in
  PatternControls — swap metaball sliders
  for wave/band controls:

⏺ Update(src/pages/loops/PatternControls.
        jsx)
  ⎿  Added 5 lines, removed 4 lines
      230          )}
      231          {field === 'org
           anic' && (
      232            <Section labe
           l="Organic">
      233 -            <Slider lab
          -eled label="Blobs" min=
          -{2} max={16} step={1} v
          -alue={v.blobCount ?? 9}
          - onChange={(x) => onCha
          -nge('blobCount', roundI
          -fNum(x))} variant="defa
          -ult" />
      234 -            <Slider lab
          -eled label="Radius" min
          -={0.2} max={1.2} step={
          -0.05} value={v.blobRadi
          -us ?? 0.5} onChange={(x
          -) => onChange('blobRadi
          -us', x)} variant="defau
          -lt" />
      235 -            <Slider lab
          -eled label="Threshold"
          -min={0.5} max={2} step=
          -{0.05} value={v.thresho
          -ld ?? 1} onChange={(x)
          -=> onChange('threshold'
          -, x)} variant="default"
          - />
      236 -            <Slider lab
          -eled label="Warp" min={
          -0} max={1} step={0.05}
          -value={v.warp ?? 0.2} o
          -nChange={(x) => onChang
          -e('warp', x)} variant="
          -default" />
      233 +            <Slider lab
          +eled label="Angle" min=
          +{0} max={180} step={1}
          +value={v.stripeAngle ??
          + 90} onChange={(x) => o
          +nChange('stripeAngle',
          +roundIfNum(x))} variant
          +="default" />
      234 +            <Slider lab
          +eled label="Pitch" min=
          +{20} max={240} step={1}
          + value={v.stripePitch ?
          +? 90} onChange={(x) =>
          +onChange('stripePitch',
          + roundIfNum(x))} varian
          +t="default" />
      235 +            <Slider lab
          +eled label="Bands" min=
          +{1} max={3} step={1} va
          +lue={v.bandCount ?? 2}
          +onChange={(x) => onChan
          +ge('bandCount', roundIf
          +Num(x))} variant="defau
          +lt" />
      236 +            <Slider lab
          +eled label="Amplitude"
          +min={0} max={1} step={0
          +.05} value={v.waveAmp ?
          +? 0.4} onChange={(x) =>
          + onChange('waveAmp', x)
          +} variant="default" />
      237 +            <Slider lab
          +eled label="Frequency"
          +min={0.3} max={4} step=
          +{0.1} value={v.waveFreq
          + ?? 1.5} onChange={(x)
          +=> onChange('waveFreq',
          + x)} variant="default"
          +/>
      238            </Section>
      239          )}
      240          <Section label=
           "Colour">

⏺ Fix the Organic colour labels (wavy
  bands cycle the palette, no ground):

⏺ Update(src/pages/loops/PatternControls.
        jsx)
  ⎿  Added 3 lines, removed 4 lines
      251              {colorCtl('
           Ground', 'bg')}
      252            </>}
      253            {field === 'o
           rganic' && <>
      254 -            {colorCtl('
          -Surface', 'color')}
      255 -            {colorCtl('
          -Mid', 'color2')}
      256 -            {colorCtl('
          -Deep', 'color3')}
      257 -            {colorCtl('
          -Ground', 'bg')}
      254 +            {colorCtl('
          +Colour A', 'color')}
      255 +            {(v.bandCou
          +nt ?? 2) >= 2 && colorC
          +tl('Colour B', 'color2'
          +)}
      256 +            {(v.bandCou
          +nt ?? 2) >= 3 && colorC
          +tl('Colour C', 'color3'
          +)}
      257            </>}
      258          </Section>
      259        </>

⏺ Now the idle-redraw fix in
  PatternEditor — only render when
  playing or something changed. Let me
  read the exact tick:

  Searched for 1 pattern, read 1 file
  (ctrl+o to expand)

⏺ Update(src/pages/pattern/PatternEditor.
        jsx)
  ⎿  Added 3 lines
      55    const uRef = useRef(0)
      56    const lastRef = useRef
          (0)
      57    const sizeRef = useRef
          ({ w: 0, h: 0 })
      58 +  // Redraw-on-demand: w
         +hen PAUSED, only re-rend
         +er when something change
         +d (dirty).
      59 +  // The old loop re-ren
         +dered every rAF even pau
         +sed — wasted full frames
         + at idle.
      60 +  const dirtyRef = useRe
         +f(true)
      61
      62    const onChange = (k, v
          ) => setValues((s) => ({
           ...s, [k]: v }))
      63

⏺ Update(src/pages/pattern/PatternEditor.
        jsx)
  ⎿  Added 1 line
      113      cv.width = Math.flo
           or(fw * dpr); cv.height
            = Math.floor(fh * dpr)
      114      cv.getContext('2d')
           .setTransform(dpr, 0, 0
           , dpr, 0, 0)
      115      sizeRef.current = {
            w: fw, h: fh }
      116 +    dirtyRef.current =
          +true
      117    }, [aspect])
      118
      119    useEffect(() => {

⏺ Update(src/pages/pattern/PatternEditor.
        jsx)
  ⎿  Added 7 lines, removed 1 line
      127        const dur = patte
           rnLoop.duration || 8
      128        if (playingRef.cu
           rrent) uRef.current = (
           uRef.current + dt * (te
           mpoRef.current / 120) /
            dur) % 1
      129        const { w, h } =
           sizeRef.current
      130 -      if (w && h) {
      130 +      // Render only wh
          +ile playing OR when mar
          +ked dirty (a control/si
          +ze changed).
      131 +      // Paused + uncha
          +nged ⇒ skip the frame e
          +ntirely → ~0 idle cost.
      132 +      if (w && h && (pl
          +ayingRef.current || dir
          +tyRef.current)) {
      133          patternLoop.dra
           w(cv.getContext('2d'),
           uRef.current, w, h, res
           olveParams(valuesRef.cu
           rrent, uRef.current * d
           ur))
      134          if (fxChainRef.
           current.length) applyCa
           nvasFx(cv, fxChainRef.c
           urrent)
      135 +        dirtyRef.curren
          +t = false
      136        }
      137      }
      138      raf = requestAnimat
           ionFrame(tick)
      139      return () => cancel
           AnimationFrame(raf)
      140    }, [])
      141
      142 +  // Mark dirty on any
          +control/aspect/scale/fx
          + change so the paused c
          +anvas repaints once.
      143 +  useEffect(() => { dir
          +tyRef.current = true },
          + [values, aspect, scale
          +, fxChain])
      144 +
      145    useEffect(() => {
      146      sizeStage()
      147      const ro = new Resi
           zeObserver(() => sizeSt
           age())

⏺ Check for any stale references to the
  removed colorAt exports, then build:

⏺ Bash(echo "=== stale colorAt refs
      (should be empty) ==="; grep -rn
      "ColorAt\|FIELD_COLOR_AT\|metaballF
      ield" src/ 2>/dev/null; echo
      "(empty = clean)"; echo; pnpm
      buil…)
  ⎿  === stale colorAt refs (should
     be empty) ===
     (empty = clean)
     … +2 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Clean, build green. Let me verify the
  vector draws are cheap (tens of ops,
  not a million) and seamless, via a mock
  canvas:

⏺ Bash(node --input-type=module -e '
      import { drawStripes } from
      "./src/loops/pattern/fields/stripeF
      ield.js";…)
  ⎿  stripes(solid): 29 ops, 29 fill
     s/frame | seam u0==u1: true
     stripes(pin): 41 ops, 41 fills/
     … +5 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Stripes (29 rects vs 1,000,000 pixel
  evals!) and organic (vector paths) are
  cheap and seamless. Tartan's "seam:
  false" is a mock artifact — it uses
  ctx.translate(-drift) which my mock
  ignores. Let me re-check with a
  translate-aware mock:

⏺ Bash(node --input-type=module -e '
      import { drawTartan } from
      "./src/loops/pattern/fields/tartanF
      ield.js";…)
  ⎿  tartan: 132 rects/frame | visib
     le-rect mismatch u0 vs u1: 0 (0
      = seamless)
  ⎿  Allowed by auto mode classifier

⏺ Confirmed — all four field families are
  now cheap vector geometry and
  seamless:

  Family: Stripes
  Before: ~1,000,000 pixel evals/frame
    (~45ms)
  After: 29 fillRects
  ───────────────────────────────────────
  ─
  Family: Tartan
  Before: ~1M pixel evals
  After: 132 rects (solid weft + 50% warp

    = the average weave)
  ───────────────────────────────────────
  ─
  Family: Organic
  Before: ~1M pixel evals (metaball)
  After: 23 filled paths (wavy bands)

  Build green, all verified seamless (u=0
  ≡ u=1).

  What changed (both your points)

  1. Perf — you were right, it was
  painting stripes pixel-by-pixel. The
  whole per-pixel field raster is gone
  from the pattern engine.
  Stripes/tartan/organic now draw as a
  handful of rects/paths in a rotated
  frame — canvas anti-aliases the edges
  and sub-pixel motion, so it's smooth
  and fast. Plus the idle bug: the loop
  re-rendered every frame even when
  paused — now it only redraws when
  playing or when a control/size changed,
  so paused = ~0 cost (that was your
  17-19fps idle).

  2. Organic = wavy bands, not blobs.
  Metaball deleted (metaballField.js
  gone). Organic is now bands with an
  undulating sine edge profile — the
  water/contour motif from your image.
  Controls: Angle · Pitch · Bands ·
  Amplitude · Frequency. Presets: Waves,
  Tide, Dunes, Ripple, Contour, Strata,
  Current, Swell, Marble, Lava flow,
  Aurora, Sand (+ a few genuine
  dot/abstract tile marks kept for
  variety). Flow undulates the wave.

  Net: every pattern family (tiles,
  stripes, tartan, organic, weave) is now
  light vector drawing — should sit at
  60fps animating and cost nothing idle.

  Not eyeballed live — check /pattern on
  :5173: the stripe fps, and that Organic
  reads as flowing wavy bands. Tell me
  if the wave profile or speed needs
  tuning.

✻ Cooked for 10m 44s

❯ in stripes why are there no 'stripe'
  animation options, f.e. width scale,
  color or whatever?

  same in organic, missing 'stripe'
  animation , also we could expose
  organic profile?

  in blocks, there seems to be a limit
  to how close the blocks can get, there
  should be bipolarity there, from 'a
  big gap' to  'negative gap'

⏺ Three good calls. Let me knock them
  out.

  Blocks gap — make it bipolar. Widen the
  Grid gap range so blocks go from a big
  gap to heavy overlap:

⏺ Update(src/pages/loops/PatternControls.
        jsx)
  ⎿  Added 1 line, removed 1 line
      329          <Slider labeled
            label="Columns" min={1
           } max={32} step={1} val
           ue={v.cols} onChange={(
           x) => onChange('cols',
           roundIfNum(x))} variant
           ="default" />
      330          <Slider labeled
            label="Rows" min={1} m
           ax={32} step={1} value=
           {v.rows} onChange={(x)
           => onChange('rows', rou
           ndIfNum(x))} variant="d
           efault" />
      331          <Slider labeled
            label="Cell size" min=
           {40} max={280} step={1}
            value={v.cell} onChang
           e={(x) => onChange('cel
           l', roundIfNum(x))} var
           iant="default" />
      332 -        <Slider labeled
          - label="Gap" min={-40}
          -max={80} step={1} value
          -={v.gap} onChange={(x)
          -=> onChange('gap', roun
          -dIfNum(x))} variant="de
          -fault" />
      332 +        <Slider labeled
          + label="Gap" min={-120}
          + max={120} step={1} val
          +ue={v.gap} onChange={(x
          +) => onChange('gap', ro
          +undIfNum(x))} variant="
          +default" />
      333          <ToggleSwitch v
           ariant="plain" label="S
           tretch" checked={v.stre
           tch} onChange={(c) => o
           nChange('stretch', c)}
           />
      334          <ToggleSwitch v
           ariant="plain" label="G
           rid lines" checked={!!v
           .showGrid} onChange={(c
           ) => onChange('showGrid
           ', c)} />
      335        </Section>

⏺ Field animation. Add the params (Pulse
  = width/scale breathe, Shimmer =
  colour, Cycles), driven seamlessly:

⏺ Update(src/loops/pattern/patternLoop.js
        )
  ⎿  Added 5 lines
      205      // Organic field (f
           ield:'organic') — bands
            with a wavy edge profi
           le
      206      waveAmp: 0.4,
             // undulation depth (
           × pitch)
      207      waveFreq: 1.5,
             // waves across the f
           ield
      208 +    // Field animation
          +(stripes/tartan/organic
          +) — modulations over th
          +e loop, all
      209 +    // seamless on whol
          +e `fieldCycles`. 0 = of
          +f. (Flow/camFlow stays
          +the drift.)
      210 +    fieldPulse: 0,
          +  // breathe the scale
          +(stripe/tartan pitch ·
          +organic amplitude)
      211 +    fieldShimmer: 0,
          +  // oscillate band col
          +ours toward their neigh
          +bour
      212 +    fieldCycles: 1,
          +  // whole cycles per l
          +oop for the above
      213      // Weave render (re
           nder:'weave') — interla
           ced over/under strands
      214      weaveType: 'plain',
             // plain | twill | sa
           tin | basket (which str
           and goes over)
      215      strandWidth: 0.7,
             // ribbon width (× ce
           ll)

⏺ Now wire the animation into the three
  field draws. Stripes (pitch breathe +
  colour shimmer):

⏺ Update(src/loops/pattern/fields/stripeF
        ield.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../.
        -./lib/util.js'
      1 +import { TAU, mixHex } fr
        +om '../../lib/util.js'
      2
      3  // Stripes — VECTOR bands
          (a handful of fillRects)
         , NOT per-pixel. Transfor
         m into a
      4  // stripe-local frame (ca
         mera angle + zoom, then t
         he stripe angle) and fill
          one rect

⏺ Update(src/loops/pattern/fields/stripeF
        ield.js)
  ⎿  Added 17 lines, removed 12
     lines
      15    const soft = p.edgeSof
          tness || 0
      16    const z = p.camZoom ||
           1
      17    const drift = u * Math
          .round(p.camFlow || 0) *
           bands // whole periods
          ⇒ seamless
      18 +  // Field animation (se
         +amless on whole fieldCyc
         +les): pitch breathe + co
         +lour shimmer.
      19 +  const tphase = u * TAU
         + * Math.round(p.fieldCyc
         +les || 1)
      20 +  const pitchA = pitch *
         + (1 + (p.fieldPulse || 0
         +) * 0.4 * Math.sin(tphas
         +e))
      21 +  const cmix = (p.fieldS
         +himmer || 0) * (0.5 - 0.
         +5 * Math.cos(tphase)) //
         + 0→1→0
      22 +  const bandCol = (idx)
         +=> (cmix > 0 ? mixHex(co
         +ls[idx], cols[(idx + 1)
         +% bands], cmix) : cols[i
         +dx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h
           / 2)
     ...
      27    ctx.scale(z, z)
      28    ctx.rotate((p.stripeAn
          gle || 0) * Math.PI / 18
          0) // stripe-local: x =
          band normal
      29
      25 -  const reach = (Math.hy
         -pot(w, h) / 2) / z + pit
         -ch * 2
      30 +  const reach = (Math.hy
         +pot(w, h) / 2) / z + pit
         +chA * 2
      31    const y0 = -reach, yH
          = reach * 2
      27 -  const nLo = Math.floor
         -(-reach / pitch + drift)
         - - 1
      28 -  const nHi = Math.ceil(
         -reach / pitch + drift) +
         - 1
      32 +  const nLo = Math.floor
         +(-reach / pitchA + drift
         +) - 1
      33 +  const nHi = Math.ceil(
         +reach / pitchA + drift)
         ++ 1
      34    for (let n = nLo; n <=
           nHi; n++) {
      35      const idx = ((n % ba
          nds) + bands) % bands
      31 -    const x = (n - drift
         -) * pitch
      36 +    const x = (n - drift
         +) * pitchA
      37      if (duty < 0.999 &&
          soft <= 0) {
      33 -      ctx.fillStyle = co
         -ls[idx]
      34 -      ctx.fillRect(x, y0
         -, pitch * duty, yH) // i
         -nk band on the (already-
         -filled) bg
      38 +      ctx.fillStyle = ba
         +ndCol(idx)
      39 +      ctx.fillRect(x, y0
         +, pitchA * duty, yH) //
         +ink band on the (already
         +-filled) bg
      40      } else if (soft > 0)
           {
      36 -      const g = ctx.crea
         -teLinearGradient(x, 0, x
         - + pitch, 0)
      37 -      g.addColorStop(0,
         -cols[idx])
      38 -      g.addColorStop(1,
         -cols[(idx + 1) % bands])
      41 +      const g = ctx.crea
         +teLinearGradient(x, 0, x
         + + pitchA, 0)
      42 +      g.addColorStop(0,
         +bandCol(idx))
      43 +      g.addColorStop(1,
         +bandCol((idx + 1) % band
         +s))
      44        ctx.fillStyle = g
      40 -      ctx.fillRect(x, y0
         -, pitch, yH)
      45 +      ctx.fillRect(x, y0
         +, pitchA, yH)
      46      } else {
      42 -      ctx.fillStyle = co
         -ls[idx]
      43 -      ctx.fillRect(x, y0
         -, pitch, yH)
      47 +      ctx.fillStyle = ba
         +ndCol(idx)
      48 +      ctx.fillRect(x, y0
         +, pitchA, yH)
      49      }
      50    }
      51    ctx.restore()

⏺ Organic (wave-amplitude breathe +
  colour shimmer):

⏺ Update(src/loops/pattern/fields/organic
        Field.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../.
        -./lib/util.js'
      1 +import { TAU, mixHex } fr
        +om '../../lib/util.js'
      2
      3  // Organic — bands with a
          wavy/undulating edge PRO
         FILE (not blobs). Same ba
         nd model
      4  // as stripes, but each b
         oundary is a sine-displac
         ed curve, so the bands re
         ad as a

⏺ Update(src/loops/pattern/fields/organic
        Field.js)
  ⎿  Added 6 lines, removed 1 line
      11    const cols = [p.color,
           p.color2 || p.color, p.
          color3 || p.color2 || p.
          color]
      12    const bands = Math.max
          (1, Math.round(p.bandCou
          nt || 2))
      13    const pitch = Math.max
          (8, p.stripePitch || 90)
      14 -  const amp = (p.waveAmp
         - == null ? 0.4 : p.waveA
         -mp) * pitch
      14    const freq = p.waveFre
          q == null ? 1.5 : p.wave
          Freq
      15    const z = p.camZoom ||
           1
      16    const wavePhase = u *
          TAU * Math.round(p.camFl
          ow || 0) // undulation,
          whole cycles ⇒ seamless
      17 +  // Field animation (se
         +amless on whole fieldCyc
         +les): the profile amplit
         +ude breathes,
      18 +  // band colours shimme
         +r toward their neighbour
         +.
      19 +  const tphase = u * TAU
         + * Math.round(p.fieldCyc
         +les || 1)
      20 +  const amp = (p.waveAmp
         + == null ? 0.4 : p.waveA
         +mp) * pitch * (1 + (p.fi
         +eldPulse || 0) * 0.6 * M
         +ath.sin(tphase))
      21 +  const cmix = (p.fieldS
         +himmer || 0) * (0.5 - 0.
         +5 * Math.cos(tphase))
      22 +  const bandCol = (idx)
         +=> (cmix > 0 ? mixHex(co
         +ls[idx], cols[(idx + 1)
         +% bands], cmix) : cols[i
         +dx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h
           / 2)

⏺ Update(src/loops/pattern/fields/organic
        Field.js)
  ⎿  Added 1 line, removed 1 line
      35    const nLo = Math.floor
          (-reach / pitch) - 1
      36    const nHi = Math.ceil(
          reach / pitch) + 1
      37    for (let n = nLo; n <=
           nHi; n++) {
      38 -    ctx.fillStyle = cols
         -[((n % bands) + bands) %
         - bands]
      38 +    ctx.fillStyle = band
         +Col(((n % bands) + bands
         +) % bands)
      39      ctx.beginPath()
      40      ctx.moveTo(bx(n, -re
          ach), -reach)
      41      for (let y = -reach;
           y <= reach; y += step)
          ctx.lineTo(bx(n, y), y)

⏺ Tartan (sett-scale breathe + weave
  shimmer):

⏺ Update(src/loops/pattern/fields/tartanF
        ield.js)
  ⎿  Added 5 lines, removed 1 line
      11    const pal = [p.color,
          p.color2 || p.color, p.c
          olor3 || p.color2 || p.c
          olor, p.bg]
      12    const sett = SETTS[p.s
          ett] || SETTS['black-wat
          ch']
      13    const total = sett.red
          uce((s, b) => s + b[1],
          0)
      14 -  const scale = Math.max
         -(0.5, p.settScale || 5)
      14 +  // Field animation (se
         +amless on whole fieldCyc
         +les): the sett breathes
         +its scale,
      15 +  // the warp/weft balan
         +ce shimmers.
      16 +  const tphase = u * TAU
         + * Math.round(p.fieldCyc
         +les || 1)
      17 +  const scale = Math.max
         +(0.5, p.settScale || 5)
         +* (1 + (p.fieldPulse ||
         +0) * 0.3 * Math.sin(tpha
         +se))
      18 +  const warpAlpha = 0.5
         ++ (p.fieldShimmer || 0)
         +* 0.3 * Math.sin(tphase)
      19    const span = total * s
          cale
      20    const z = p.camZoom ||
           1
      21    const drift = u * Math
          .round(p.camFlow || 0) *
           span // whole repeats ⇒
           seamless

⏺ Update(src/loops/pattern/fields/tartanF
        ield.js)
  ⎿  Added 2 lines, removed 2 lines
      45      }
      46      ctx.globalAlpha = 1
      47    }
      48 -  drawAxis(true, 1)
         -// weft (horizontal) — s
         -olid
      49 -  drawAxis(false, 0.5)
         -// warp (vertical) at 50
         -% ⇒ average over the wef
         -t
      48 +  drawAxis(true, 1)
         +    // weft (horizontal)
         + — solid
      49 +  drawAxis(false, warpAl
         +pha) // warp (vertical)
         +~50% ⇒ average over the
         +weft
      50    ctx.restore()
      51  }

⏺ Add the field-animation params to the
  preserved motion set so they survive
  preset switches:

⏺ Update(src/pages/pattern/PatternEditor.
        jsx)
  ⎿  Added 1 line
      26    'camZoom', 'camFlow',
          'camAngle', 'panDir', 's
          pin',
      27    'animAxis', 'animCycle
          s', 'animWaves', 'animCu
          rveExpr',
      28    'pulse', 'fade', 'swin
          g', 'colorMix', 'framePr
          eset', 'formPreset',
      29 +  'fieldPulse', 'fieldSh
         +immer', 'fieldCycles',
      30  ]
      31
      32  // Pattern studio — the
          kolkrabbi rule/tiling sy
          stem (Image #4 from the
          brand

⏺ Now add the Animate section (Pulse ·
  Shimmer · Cycles) to the Animation tab
  for field renders. Let me read the
  exact spot:

  Reading 1 file… (ctrl+o to expand)
  ⎿  src/pages/loops/PatternControls.jsx

⏺ Update(src/pages/loops/PatternControls.
        jsx)
  ⎿  Added 10 lines
      169          </Section>
      170          )}
      171
      172 +        {/* Field famil
          +ies animate their own f
          +orm: scale breathe + co
          +lour shimmer
      173 +            (organic's
          +Pulse breathes the wave
          + profile). Driven on wh
          +ole Cycles. */}
      174 +        {!tilesRender &
          +& (
      175 +        <Section label=
          +"Animate">
      176 +          <Slider label
          +ed label="Pulse" min={0
          +} max={1} step={0.05} v
          +alue={v.fieldPulse ?? 0
          +} onChange={(x) => onFr
          +ame('fieldPulse', x)} v
          +ariant="default" />
      177 +          <Slider label
          +ed label="Shimmer" min=
          +{0} max={1} step={0.05}
          + value={v.fieldShimmer
          +?? 0} onChange={(x) =>
          +onFrame('fieldShimmer',
          + x)} variant="default"
          +/>
      178 +          <Slider label
          +ed label="Cycles" min={
          +1} max={4} step={1} val
          +ue={v.fieldCycles ?? 1}
          + onChange={(x) => onFra
          +me('fieldCycles', round
          +IfNum(x))} variant="def
          +ault" />
      179 +        </Section>
      180 +        )}
      181 +
      182          {tilesRender &&
            animTab === 'form' &&
           (
      183          <Section label=
           "Form">
      184            <Slider label
           ed label="Spin" min={0}
            max={3} step={1} value
           ={v.spin} onChange={(x)
            => onForm('spin', roun
           dIfNum(x))} variant="de
           fault" />

⏺ fieldPulse/Shimmer/Cycles aren't part
  of the Frame preset, so they should use
  plain onChange (no preset-revert):

⏺ Update(src/pages/loops/PatternControls.
        jsx)
  ⎿  Added 3 lines, removed 3 lines
      173              (organic's
           Pulse breathes the wave
            profile). Driven on wh
           ole Cycles. */}
      174          {!tilesRender &
           & (
      175          <Section label=
           "Animate">
      176 -          <Slider label
          -ed label="Pulse" min={0
          -} max={1} step={0.05} v
          -alue={v.fieldPulse ?? 0
          -} onChange={(x) => onFr
          -ame('fieldPulse', x)} v
          -ariant="default" />
      177 -          <Slider label
          -ed label="Shimmer" min=
          -{0} max={1} step={0.05}
          - value={v.fieldShimmer
          -?? 0} onChange={(x) =>
          -onFrame('fieldShimmer',
          - x)} variant="default"
          -/>
      178 -          <Slider label
          -ed label="Cycles" min={
          -1} max={4} step={1} val
          -ue={v.fieldCycles ?? 1}
          - onChange={(x) => onFra
          -me('fieldCycles', round
          -IfNum(x))} variant="def
          -ault" />
      176 +          <Slider label
          +ed label="Pulse" min={0
          +} max={1} step={0.05} v
          +alue={v.fieldPulse ?? 0
          +} onChange={(x) => onCh
          +ange('fieldPulse', x)}
          +variant="default" />
      177 +          <Slider label
          +ed label="Shimmer" min=
          +{0} max={1} step={0.05}
          + value={v.fieldShimmer
          +?? 0} onChange={(x) =>
          +onChange('fieldShimmer'
          +, x)} variant="default"
          + />
      178 +          <Slider label
          +ed label="Cycles" min={
          +1} max={4} step={1} val
          +ue={v.fieldCycles ?? 1}
          + onChange={(x) => onCha
          +nge('fieldCycles', roun
          +dIfNum(x))} variant="de
          +fault" />
      179          </Section>
      180          )}
      181

⏺ Build and verify the new animations
  stay seamless with Pulse/Shimmer on:

⏺ Bash(pnpm build 2>&1 | grep -E "built
      in|error|Error|Could not resolve" |
      tail -3
      echo "--- seam check with field
      animation on (pulse+shimmer) ---"…)
  ⎿  ✓ built in 2.90s
     --- seam check with field anima
     tion on (pulse+shimmer) ---
     … +10 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Done — all three, build green,
  animations verified seamless.

  1 & 2 — Field animation (Stripes +
  Organic + Tartan). The Animation tab
  now has an Animate section for field
  renders (it was hidden — fields only
  had Flow). Three modulations, all
  seamless and off by default:
  - Pulse — breathes the scale:
  stripe/tartan band width, organic wave
  amplitude (animates the profile depth).
  - Shimmer — oscillates each band's
  colour toward its neighbour.
  - Cycles — whole cycles per loop for
  both.

  So Stripes now animates width + colour
  (your "width scale, colour"); Organic
  animates its wavy profile + colour.
  They only run on play (no autoplay),
  and persist across preset switches like
  the other motion.

  Organic's profile is already exposed as
  controls in the Pattern tab —
  Amplitude + Frequency sliders. If you
  also want to pick the profile shape
  (sine vs sawtooth/steeper curves), say
⏺ Done — all three, build green, animations verified seamless.

  1 & 2 — Field animation (Stripes + Organic + Tartan). The Animation tab now has an Animate section for field renders (it was
  hidden — fields only had Flow). Three modulations, all seamless and off by default:
  - Pulse — breathes the scale: stripe/tartan band width, organic wave amplitude (animates the profile depth).
  - Shimmer — oscillates each band's colour toward its neighbour.
  - Cycles — whole cycles per loop for both.

      18 -    color: PAL.sky, color2: PAL.teal, color3:
         - PAL.navy, bg: PAL.ink }) },
      19 -  { id: 'lava', label: 'Lava', params: blob({
      20 -    blobCount: 7, blobRadius: 0.7, threshold:
         - 0.9, warp: 0.3,
      21 -    color: PAL.gold, color2: PAL.rust, color3
         -: PAL.brick, bg: PAL.noir }) },
      22 -  { id: 'mercury', label: 'Mercury', params:
y so  nd -blob({d a curve selector.
      23 -    blobCount: 10, blobRadius: 0.5, threshold
  3 — Blo-:s1.3, warp:w0.1, lar. Widened the Grid Gap range from -4 240- o -color:0PAL.bone,kcolor2:oPAL.grey,ocolor3ap all
  the way-:nPAL.slate,vbg:aPAL.ink })g},e blanks if cell + gap ≤ 0, 25 -  {eid:s'foam',llabel: 'Foam',-params:eblob({as a
  flo 26—- ackblobCount:a16,rblobRadius:c0.36, threshol
         -d: 1.1, warp: 0.25,
✻ Chu 27d- or color: PAL.bone, color2: PAL.oat, color3:
         - PAL.cream, bg: PAL.teal }) },
───── 28─- ─{─id:─'cells',─label:─'Cells',─params:─blob──────────── ───-({ ───────────────────────────────────────────────────    29 -    blobCount: 12, blobRadius: 0.5, threshold
❯ 1.  ou -:r1.1,twarp:e0.15, lider center to 0
  2.  30 - op color:dPAL.teal,pcolor2:nPAL.green,ocolor something t  do-3:tPAL.forest,,bg:aPAL.inkk})k},
───── 31─- ─{─id:─'goo',─label:─'Goo',─params:─blob({────────────── 32─- ───blobCount:─6,─blobRadius:─0.8,─threshold:─────────       - 0.8, warp: 0.35,
  ⏵⏵  33o- odecolor:hPAL.green, color2: PAL.moss, color
         -3: PAL.olive, bg: PAL.noir }) },
      34 -  { id: 'magma', label: 'Magma', params: blob
         -({
      35 -    blobCount: 8, blobRadius: 0.6, threshold:
         - 0.95, warp: 0.4,
      36 -    color: PAL.amber, color2: PAL.coral, colo
         -r3: PAL.red, bg: PAL.char }) },
      37 -  { id: 'ooze', label: 'Ooze', params: blob({
      38 -    blobCount: 9, blobRadius: 0.6, threshold:
         - 1, warp: 0.3,
      39 -    color: PAL.purple, color2: PAL.violet, co
         -lor3: PAL.plum, bg: PAL.noir }) },
      40 -  { id: 'droplets', label: 'Droplets', params
         -: blob({
      41 -    blobCount: 14, blobRadius: 0.42, threshol
         -d: 1.2, warp: 0.15,
      42 -    color: PAL.sky, color2: PAL.blue, color3:
         - PAL.navy, bg: PAL.ink2 }) },
      43 -  { id: 'nuclei', label: 'Nuclei', params: bl
         -ob({
      44 -    blobCount: 5, blobRadius: 0.7, threshold:
         - 0.85, warp: 0.2,
      45 -    color: PAL.amber, color2: PAL.gold, color
         -3: PAL.ochre, bg: PAL.ink }) },
      13 +  // ── wavy bands ──
      14 +  { id: 'waves', label: 'Waves', params: wave
         +({
      15 +    stripeAngle: 90, stripePitch: 90, bandCou
         +nt: 2, waveAmp: 0.4, waveFreq: 1.4,
      16 +    color: PAL.sky, color2: PAL.ink2 }) },
      17 +  { id: 'tide', label: 'Tide', params: wave({
      18 +    stripeAngle: 90, stripePitch: 110, bandCo
         +unt: 3, waveAmp: 0.5, waveFreq: 1,
      19 +    color: PAL.teal, color2: PAL.navy, color3
         +: PAL.sky }) },
      20 +  { id: 'dunes', label: 'Dunes', params: wave
         +({
      21 +    stripeAngle: 90, stripePitch: 120, bandCo
         +unt: 3, waveAmp: 0.6, waveFreq: 0.8,
      22 +    color: PAL.gold, color2: PAL.ochre, color
         +3: PAL.amber }) },
      23 +  { id: 'ripple', label: 'Ripple', params: wa
         +ve({
      24 +    stripeAngle: 90, stripePitch: 60, bandCou
         +nt: 2, waveAmp: 0.35, waveFreq: 2.4,
      25 +    color: PAL.bone, color2: PAL.teal }) },
      26 +  { id: 'contour', label: 'Contour', params:
         +wave({
      27 +    stripeAngle: 90, stripePitch: 70, bandCou
         +nt: 3, waveAmp: 0.45, waveFreq: 1.6,
      28 +    color: PAL.moss, color2: PAL.forest, colo
         +r3: PAL.olive }) },
      29 +  { id: 'strata', label: 'Strata', params: wa
         +ve({
      30 +    stripeAngle: 90, stripePitch: 100, bandCo
         +unt: 3, waveAmp: 0.3, waveFreq: 1.1,
      31 +    color: PAL.rust, color2: PAL.brick, color
         +3: PAL.coral }) },
      32 +  { id: 'current', label: 'Current', params:
         +wave({
      33 +    stripeAngle: 90, stripePitch: 80, bandCou
         +nt: 2, waveAmp: 0.55, waveFreq: 1.8,
      34 +    color: PAL.blue, color2: PAL.navy }) },
      35 +  { id: 'swell', label: 'Swell', params: wave
         +({
      36 +    stripeAngle: 90, stripePitch: 140, bandCo
         +unt: 2, waveAmp: 0.7, waveFreq: 0.7,
      37 +    color: PAL.sky, color2: PAL.ink2 }) },
      38 +  { id: 'marble', label: 'Marble', params: wa
         +ve({
      39 +    stripeAngle: 70, stripePitch: 64, bandCou
         +nt: 3, waveAmp: 0.5, waveFreq: 2,
      40 +    color: PAL.bone, color2: PAL.slate, color
         +3: PAL.oat }) },
      41 +  { id: 'lava-flow', label: 'Lava flow', para
         +ms: wave({
      42 +    stripeAngle: 90, stripePitch: 96, bandCou
         +nt: 3, waveAmp: 0.65, waveFreq: 1.2,
      43 +    color: PAL.amber, color2: PAL.red, color3
         +: PAL.brick }) },
      44 +  { id: 'aurora', label: 'Aurora', params: wa
         +ve({
      45 +    stripeAngle: 80, stripePitch: 110, bandCo
         +unt: 3, waveAmp: 0.6, waveFreq: 1.3,
      46 +    color: PAL.teal, color2: PAL.purple, colo
         +r3: PAL.sky }) },
      47 +  { id: 'sand', label: 'Sand', params: wave({
      48 +    stripeAngle: 90, stripePitch: 48, bandCou
         +nt: 2, waveAmp: 0.3, waveFreq: 2.6,
      49 +    color: PAL.oat, color2: PAL.camel }) },
      50
      47 -  // ── dots & polka (tiles) ──
      51 +  // ── dot & abstract marks (genuine tiles)
         +──
      52    { id: 'polka', label: 'Polka', params: {
      53      shape: 'prim:circle', cols: 6, rows: 6, c
          ell: 120, gap: 14,
      54      colorRule: 'checker', color: PAL.cream, c
          olor2: PAL.red, bg: PAL.ink,
     ...
      57      shape: 'prim:circle', cols: 14, rows: 14,
           cell: 70, gap: 18,
      58      color: PAL.bone, bg: PAL.navy,
      59      animAxis: 'radial', animWaves: 3, fade: 0
          .3 } },
      56 -  { id: 'caviar', label: 'Caviar', params: {
      57 -    shape: 'prim:circle', cols: 24, rows: 24,
         - cell: 46, gap: 10,
      58 -    color: PAL.ink, bg: PAL.oat,
      59 -    animAxis: 'radial', animWaves: 4, fade: 0
         -.2 } },
      60    { id: 'halftone', label: 'Halftone', params
          : {
      61      shape: 'prim:circle', cols: 22, rows: 22,
           cell: 52, gap: 6,
      62      color: PAL.ink, bg: PAL.bone,
      63      animAxis: 'radial', animWaves: 3, pulse:
          0.4, animCurveExpr: 'pow(sin(PI*k),2)' } },
      64 -
      65 -  // ── honeycomb & cells (tiles) ──
      64    { id: 'honeycomb', label: 'Honeycomb', para
          ms: {
      65      shape: 'prim:hexagon', cols: 8, rows: 8,
          cell: 120, gap: 6,
      66      color: PAL.gold, bg: PAL.ochre,
      67      animAxis: 'radial', animWaves: 2, fade: 0
          .2 } },
      70 -
      71 -  // ── scatter & confetti (tiles) ──
      68    { id: 'scatter', label: 'Scatter', params:
          {
      69      shape: 'prim:circle', cols: 16, rows: 16,
           cell: 80, gap: 8,
      70      color: PAL.gold, bg: PAL.ink,
      71      rules: [R({ selectKind: 'expression', exp
          ression: 'sin(col*12.9 + row*7.3) - 0.2', hid
          e: true })],
      72      animAxis: 'radial', animWaves: 3, fade: 0
          .35, animCurveExpr: 'round(k)' } },
      77 -  { id: 'confetti', label: 'Confetti', params
         -: {
      78 -    shape: 'prim:star', cols: 12, rows: 12, c
         -ell: 90, gap: 10,
      79 -    colorRule: 'diag', color: PAL.coral, colo
         -r2: PAL.amber, color3: PAL.sky, bg: PAL.noir,
      80 -    rules: [R({ selectKind: 'expression', exp
         -ression: 'cos(col*9.7 + row*4.3) - 0.1', hide
         -: true })],
      81 -    animAxis: 'diag', animWaves: 3, swing: 30
         -, colorMix: 0.3 } },
      82 -
      83 -  // ── petals & blossom (abstract-blob tiles
         -) ──
      73    { id: 'petals', label: 'Petals', params: {
      74      shape: 'abstract:abstract-01', cols: 6, r
          ows: 6, cell: 150, gap: 8,
      75      colorRule: 'checker', color: PAL.pink, co
          lor2: PAL.rose, bg: PAL.plum,
      76      spin: 1, animAxis: 'diag', animWaves: 2,
          swing: 35, fade: 0.25 } },
      88 -  { id: 'lily-pads', label: 'Lily pads', para
         -ms: {
      89 -    shape: 'abstract:abstract-02', cols: 4, r
         -ows: 4, cell: 200, gap: 12,
      90 -    colorRule: 'checker', color: PAL.green, c
         -olor2: PAL.forest, bg: PAL.ink2,
      91 -    spin: 1, animAxis: 'radial', animWaves: 2
         -, pulse: 0.3, fade: 0.35 } },
      77  ]

⏺ Now the Organic controls in PatternControls — swap metaball
  sliders for wave/band controls:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 5 lines, removed 4 lines
      230          )}
      231          {field === 'organic' && (
      232            <Section label="Organic">
      233 -            <Slider labeled label="Blobs" mi
          -n={2} max={16} step={1} value={v.blobCount ?
          -? 9} onChange={(x) => onChange('blobCount',
          -roundIfNum(x))} variant="default" />
      234 -            <Slider labeled label="Radius" m
          -in={0.2} max={1.2} step={0.05} value={v.blob
          -Radius ?? 0.5} onChange={(x) => onChange('bl
          -obRadius', x)} variant="default" />
      235 -            <Slider labeled label="Threshold
          -" min={0.5} max={2} step={0.05} value={v.thr
          -eshold ?? 1} onChange={(x) => onChange('thre
          -shold', x)} variant="default" />
      236 -            <Slider labeled label="Warp" min
          -={0} max={1} step={0.05} value={v.warp ?? 0.
          -2} onChange={(x) => onChange('warp', x)} var
          -iant="default" />
      233 +            <Slider labeled label="Angle" mi
          +n={0} max={180} step={1} value={v.stripeAngl
          +e ?? 90} onChange={(x) => onChange('stripeAn
          +gle', roundIfNum(x))} variant="default" />
      234 +            <Slider labeled label="Pitch" mi
          +n={20} max={240} step={1} value={v.stripePit
          +ch ?? 90} onChange={(x) => onChange('stripeP
          +itch', roundIfNum(x))} variant="default" />
      235 +            <Slider labeled label="Bands" mi
          +n={1} max={3} step={1} value={v.bandCount ??
          + 2} onChange={(x) => onChange('bandCount', r
          +oundIfNum(x))} variant="default" />
      236 +            <Slider labeled label="Amplitude
          +" min={0} max={1} step={0.05} value={v.waveA
          +mp ?? 0.4} onChange={(x) => onChange('waveAm
          +p', x)} variant="default" />
      237 +            <Slider labeled label="Frequency
          +" min={0.3} max={4} step={0.1} value={v.wave
          +Freq ?? 1.5} onChange={(x) => onChange('wave
          +Freq', x)} variant="default" />
      238            </Section>
      239          )}
      240          <Section label="Colour">

⏺ Fix the Organic colour labels (wavy bands cycle the palette,
  no ground):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 4 lines
      251              {colorCtl('Ground', 'bg')}
      252            </>}
      253            {field === 'organic' && <>
      254 -            {colorCtl('Surface', 'color')}
      255 -            {colorCtl('Mid', 'color2')}
      256 -            {colorCtl('Deep', 'color3')}
      257 -            {colorCtl('Ground', 'bg')}
      254 +            {colorCtl('Colour A', 'color')}
      255 +            {(v.bandCount ?? 2) >= 2 && colo
          +rCtl('Colour B', 'color2')}
      256 +            {(v.bandCount ?? 2) >= 3 && colo
          +rCtl('Colour C', 'color3')}
      257            </>}
      258          </Section>
      259        </>












⏺ Now the idle-redraw fix in PatternEditor — only render when
  playing or something changed. Let me read the exact tick:

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 3 lines
      55    const uRef = useRef(0)
      56    const lastRef = useRef(0)
      57    const sizeRef = useRef({ w: 0, h: 0 })
      58 +  // Redraw-on-demand: when PAUSED, only re-r
         +ender when something changed (dirty).
      59 +  // The old loop re-rendered every rAF even
         +paused — wasted full frames at idle.
      60 +  const dirtyRef = useRef(true)
      61
      62    const onChange = (k, v) => setValues((s) =>
           ({ ...s, [k]: v }))
      63









⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      113      cv.width = Math.floor(fw * dpr); cv.heig
           ht = Math.floor(fh * dpr)
      114      cv.getContext('2d').setTransform(dpr, 0,
            0, dpr, 0, 0)
      115      sizeRef.current = { w: fw, h: fh }
      116 +    dirtyRef.current = true
      117    }, [aspect])
      118
      119    useEffect(() => {





⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 7 lines, removed 1 line
      127        const dur = patternLoop.duration || 8
      128        if (playingRef.current) uRef.current =
            (uRef.current + dt * (tempoRef.current / 12
           0) / dur) % 1
      129        const { w, h } = sizeRef.current
      130 -      if (w && h) {
      130 +      // Render only while playing OR when m
          +arked dirty (a control/size changed).
      131 +      // Paused + unchanged ⇒ skip the frame
          + entirely → ~0 idle cost.
      132 +      if (w && h && (playingRef.current || d
          +irtyRef.current)) {
      133          patternLoop.draw(cv.getContext('2d')
           , uRef.current, w, h, resolveParams(valuesRe
           f.current, uRef.current * dur))
      134          if (fxChainRef.current.length) apply
           CanvasFx(cv, fxChainRef.current)
      135 +        dirtyRef.current = false
      136        }
      137      }
      138      raf = requestAnimationFrame(tick)
      139      return () => cancelAnimationFrame(raf)
      140    }, [])
      141
      142 +  // Mark dirty on any control/aspect/scale/
          +fx change so the paused canvas repaints once
          +.
      143 +  useEffect(() => { dirtyRef.current = true
          +}, [values, aspect, scale, fxChain])
      144 +
      145    useEffect(() => {
      146      sizeStage()
      147      const ro = new ResizeObserver(() => size
           Stage())

⏺ Check for any stale references to the removed colorAt
  exports, then build:

⏺ Bash(echo "=== stale colorAt refs (should be empty) ===";
      grep -rn "ColorAt\|FIELD_COLOR_AT\|metaballField" src/
      2>/dev/null; echo "(empty = clean)"; echo; pnpm buil…)
  ⎿  === stale colorAt refs (should be empty) ===
     (empty = clean)

     ✓ built in 3.20s
  ⎿  Allowed by auto mode classifier

⏺ Clean, build green. Let me verify the vector draws are cheap
  (tens of ops, not a million) and seamless, via a mock
  canvas:

⏺ Bash(node --input-type=module -e '
      import { drawStripes } from
      "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  stripes(solid): 29 ops, 29 fills/frame | seam u0==u1
     : true
     stripes(pin): 41 ops, 41 fills/frame | seam u0==u1:
     … +5 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Stripes (29 rects vs 1,000,000 pixel evals!) and organic
  (vector paths) are cheap and seamless. Tartan's "seam:
  false" is a mock artifact — it uses ctx.translate(-drift)
  which my mock ignores. Let me re-check with a
  translate-aware mock:

⏺ Bash(node --input-type=module -e '
      import { drawTartan } from
      "./src/loops/pattern/fields/tartanField.js";…)
  ⎿  tartan: 132 rects/frame | visible-rect mismatch u0 v
     s u1: 0 (0 = seamless)

  ⎿  Allowed by auto mode classifier

⏺ Confirmed — all four field families are now cheap vector
  geometry and seamless:

  ┌─────────┬────────────────────┬────────────────────────┐
  │ Family  │       Before       │         After          │
  ├─────────┼────────────────────┼────────────────────────┤
  │         │ ~1,000,000 pixel   │                        │
  │ Stripes │ evals/frame        │ 29 fillRects           │
  │         │ (~45ms)            │                        │
  ├─────────┼────────────────────┼────────────────────────┤
  │         │                    │ 132 rects (solid weft  │
  │ Tartan  │ ~1M pixel evals    │ + 50% warp = the       │
  │         │                    │ average weave)         │
  ├─────────┼────────────────────┼────────────────────────┤
  │ Organic │ ~1M pixel evals    │ 23 filled paths (wavy  │
  │         │ (metaball)         │ bands)                 │
  └─────────┴────────────────────┴────────────────────────┘

  Build green, all verified seamless (u=0 ≡ u=1).

  What changed (both your points)

  1. Perf — you were right, it was painting stripes
  pixel-by-pixel. The whole per-pixel field raster is gone
  from the pattern engine. Stripes/tartan/organic now draw as
  a handful of rects/paths in a rotated frame — canvas
  anti-aliases the edges and sub-pixel motion, so it's smooth
  and fast. Plus the idle bug: the loop re-rendered every
  frame even when paused — now it only redraws when playing or
  when a control/size changed, so paused = ~0 cost (that was
  your 17-19fps idle).

  2. Organic = wavy bands, not blobs. Metaball deleted
  (metaballField.js gone). Organic is now bands with an
  undulating sine edge profile — the water/contour motif from
  your image. Controls: Angle · Pitch · Bands · Amplitude ·
  Frequency. Presets: Waves, Tide, Dunes, Ripple, Contour,
  Strata, Current, Swell, Marble, Lava flow, Aurora, Sand (+ a
  few genuine dot/abstract tile marks kept for variety). Flow
  undulates the wave.

  Net: every pattern family (tiles, stripes, tartan, organic,
  weave) is now light vector drawing — should sit at 60fps
  animating and cost nothing idle.

  Not eyeballed live — check /pattern on :5173: the stripe
  fps, and that Organic reads as flowing wavy bands. Tell me
  if the wave profile or speed needs tuning.

✻ Cooked for 10m 44s

❯ in stripes why are there no 'stripe' animation options,
  f.e. width scale, color or whatever?

  same in organic, missing 'stripe' animation , also we could
  expose organic profile?

  in blocks, there seems to be a limit to how close the
  blocks can get, there should be bipolarity there, from 'a
  big gap' to  'negative gap'

⏺ Three good calls. Let me knock them out.

  Blocks gap — make it bipolar. Widen the Grid gap range so
  blocks go from a big gap to heavy overlap:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 1 line, removed 1 line
      329          <Slider labeled label="Columns" min=
           {1} max={32} step={1} value={v.cols} onChang
           e={(x) => onChange('cols', roundIfNum(x))} v
           ariant="default" />
      330          <Slider labeled label="Rows" min={1}
            max={32} step={1} value={v.rows} onChange={
           (x) => onChange('rows', roundIfNum(x))} vari
           ant="default" />
      331          <Slider labeled label="Cell size" mi
           n={40} max={280} step={1} value={v.cell} onC
           hange={(x) => onChange('cell', roundIfNum(x)
           )} variant="default" />
      332 -        <Slider labeled label="Gap" min={-40
          -} max={80} step={1} value={v.gap} onChange={
          -(x) => onChange('gap', roundIfNum(x))} varia
          -nt="default" />
      332 +        <Slider labeled label="Gap" min={-12
          +0} max={120} step={1} value={v.gap} onChange
          +={(x) => onChange('gap', roundIfNum(x))} var
          +iant="default" />
      333          <ToggleSwitch variant="plain" label=
           "Stretch" checked={v.stretch} onChange={(c)
           => onChange('stretch', c)} />
      334          <ToggleSwitch variant="plain" label=
           "Grid lines" checked={!!v.showGrid} onChange
           ={(c) => onChange('showGrid', c)} />
      335        </Section>


⏺ Field animation. Add the params (Pulse = width/scale
  breathe, Shimmer = colour, Cycles), driven seamlessly:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 5 lines
      205      // Organic field (field:'organic') — ban
           ds with a wavy edge profile
      206      waveAmp: 0.4,        // undulation depth
            (× pitch)
      207      waveFreq: 1.5,       // waves across the
            field
      208 +    // Field animation (stripes/tartan/organ
          +ic) — modulations over the loop, all
      209 +    // seamless on whole `fieldCycles`. 0 =
          +off. (Flow/camFlow stays the drift.)
      210 +    fieldPulse: 0,       // breathe the scal
          +e (stripe/tartan pitch · organic amplitude)
      211 +    fieldShimmer: 0,     // oscillate band c
          +olours toward their neighbour
      212 +    fieldCycles: 1,      // whole cycles per
          + loop for the above
      213      // Weave render (render:'weave') — inter
           laced over/under strands
      214      weaveType: 'plain',  // plain | twill |
           satin | basket (which strand goes over)
      215      strandWidth: 0.7,    // ribbon width (×
           cell)







⏺ Now wire the animation into the three field draws. Stripes
  (pitch breathe + colour shimmer):

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.js
        +'
      2
      3  // Stripes — VECTOR bands (a handful of fillRe
         cts), NOT per-pixel. Transform into a
      4  // stripe-local frame (camera angle + zoom, th
         en the stripe angle) and fill one rect






⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 17 lines, removed 12 lines
      15    const soft = p.edgeSoftness || 0
      16    const z = p.camZoom || 1
      17    const drift = u * Math.round(p.camFlow || 0
          ) * bands // whole periods ⇒ seamless
      18 +  // Field animation (seamless on whole field
         +Cycles): pitch breathe + colour shimmer.
      19 +  const tphase = u * TAU * Math.round(p.field
         +Cycles || 1)
      20 +  const pitchA = pitch * (1 + (p.fieldPulse |
         +| 0) * 0.4 * Math.sin(tphase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5 -
         + 0.5 * Math.cos(tphase)) // 0→1→0
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHex
         +(cols[idx], cols[(idx + 1) % bands], cmix) :
         +cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)
     ...
      27    ctx.scale(z, z)
      28    ctx.rotate((p.stripeAngle || 0) * Math.PI /
           180) // stripe-local: x = band normal
      29
      25 -  const reach = (Math.hypot(w, h) / 2) / z +
         -pitch * 2
      30 +  const reach = (Math.hypot(w, h) / 2) / z +
         +pitchA * 2
      31    const y0 = -reach, yH = reach * 2
      27 -  const nLo = Math.floor(-reach / pitch + dri
         -ft) - 1
      28 -  const nHi = Math.ceil(reach / pitch + drift
         -) + 1
      32 +  const nLo = Math.floor(-reach / pitchA + dr
         +ift) - 1
      33 +  const nHi = Math.ceil(reach / pitchA + drif
         +t) + 1
      34    for (let n = nLo; n <= nHi; n++) {
      35      const idx = ((n % bands) + bands) % bands
      31 -    const x = (n - drift) * pitch
      36 +    const x = (n - drift) * pitchA
      37      if (duty < 0.999 && soft <= 0) {
      33 -      ctx.fillStyle = cols[idx]
      34 -      ctx.fillRect(x, y0, pitch * duty, yH) /
         -/ ink band on the (already-filled) bg
      38 +      ctx.fillStyle = bandCol(idx)
      39 +      ctx.fillRect(x, y0, pitchA * duty, yH)
         +// ink band on the (already-filled) bg
      40      } else if (soft > 0) {
      36 -      const g = ctx.createLinearGradient(x, 0
         -, x + pitch, 0)
      37 -      g.addColorStop(0, cols[idx])
      38 -      g.addColorStop(1, cols[(idx + 1) % band
         -s])
      41 +      const g = ctx.createLinearGradient(x, 0
         +, x + pitchA, 0)
      42 +      g.addColorStop(0, bandCol(idx))
      43 +      g.addColorStop(1, bandCol((idx + 1) % b
         +ands))
      44        ctx.fillStyle = g
      40 -      ctx.fillRect(x, y0, pitch, yH)
      45 +      ctx.fillRect(x, y0, pitchA, yH)
      46      } else {
      42 -      ctx.fillStyle = cols[idx]
      43 -      ctx.fillRect(x, y0, pitch, yH)
      47 +      ctx.fillStyle = bandCol(idx)
      48 +      ctx.fillRect(x, y0, pitchA, yH)
      49      }
      50    }
      51    ctx.restore()

⏺ Organic (wave-amplitude breathe + colour shimmer):

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.js
        +'
      2
      3  // Organic — bands with a wavy/undulating edge
          PROFILE (not blobs). Same band model
      4  // as stripes, but each boundary is a sine-dis
         placed curve, so the bands read as a






⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 6 lines, removed 1 line
      11    const cols = [p.color, p.color2 || p.color,
           p.color3 || p.color2 || p.color]
      12    const bands = Math.max(1, Math.round(p.band
          Count || 2))
      13    const pitch = Math.max(8, p.stripePitch ||
          90)
      14 -  const amp = (p.waveAmp == null ? 0.4 : p.wa
         -veAmp) * pitch
      14    const freq = p.waveFreq == null ? 1.5 : p.w
          aveFreq
      15    const z = p.camZoom || 1
      16    const wavePhase = u * TAU * Math.round(p.ca
          mFlow || 0) // undulation, whole cycles ⇒ sea
          mless
      17 +  // Field animation (seamless on whole field
         +Cycles): the profile amplitude breathes,
      18 +  // band colours shimmer toward their neighb
         +our.
      19 +  const tphase = u * TAU * Math.round(p.field
         +Cycles || 1)
      20 +  const amp = (p.waveAmp == null ? 0.4 : p.wa
         +veAmp) * pitch * (1 + (p.fieldPulse || 0) * 0
         +.6 * Math.sin(tphase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5 -
         + 0.5 * Math.cos(tphase))
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHex
         +(cols[idx], cols[(idx + 1) % bands], cmix) :
         +cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      35    const nLo = Math.floor(-reach / pitch) - 1
      36    const nHi = Math.ceil(reach / pitch) + 1
      37    for (let n = nLo; n <= nHi; n++) {
      38 -    ctx.fillStyle = cols[((n % bands) + bands
         -) % bands]
      38 +    ctx.fillStyle = bandCol(((n % bands) + ba
         +nds) % bands)
      39      ctx.beginPath()
      40      ctx.moveTo(bx(n, -reach), -reach)
      41      for (let y = -reach; y <= reach; y += ste
          p) ctx.lineTo(bx(n, y), y)








⏺ Tartan (sett-scale breathe + weave shimmer):

⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 5 lines, removed 1 line
      11    const pal = [p.color, p.color2 || p.color,
          p.color3 || p.color2 || p.color, p.bg]
      12    const sett = SETTS[p.sett] || SETTS['black-
          watch']
      13    const total = sett.reduce((s, b) => s + b[1
          ], 0)
      14 -  const scale = Math.max(0.5, p.settScale ||
         -5)
      14 +  // Field animation (seamless on whole field
         +Cycles): the sett breathes its scale,
      15 +  // the warp/weft balance shimmers.
      16 +  const tphase = u * TAU * Math.round(p.field
         +Cycles || 1)
      17 +  const scale = Math.max(0.5, p.settScale ||
         +5) * (1 + (p.fieldPulse || 0) * 0.3 * Math.si
         +n(tphase))
      18 +  const warpAlpha = 0.5 + (p.fieldShimmer ||
         +0) * 0.3 * Math.sin(tphase)
      19    const span = total * scale
      20    const z = p.camZoom || 1
      21    const drift = u * Math.round(p.camFlow || 0
          ) * span // whole repeats ⇒ seamless







⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 2 lines, removed 2 lines
      45      }
      46      ctx.globalAlpha = 1
      47    }
      48 -  drawAxis(true, 1)     // weft (horizontal)
         -— solid
      49 -  drawAxis(false, 0.5)  // warp (vertical) at
         - 50% ⇒ average over the weft
      48 +  drawAxis(true, 1)         // weft (horizont
         +al) — solid
      49 +  drawAxis(false, warpAlpha) // warp (vertica
         +l) ~50% ⇒ average over the weft
      50    ctx.restore()
      51  }







⏺ Add the field-animation params to the preserved motion set
  so they survive preset switches:

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      26    'camZoom', 'camFlow', 'camAngle', 'panDir',
           'spin',
      27    'animAxis', 'animCycles', 'animWaves', 'ani
          mCurveExpr',
      28    'pulse', 'fade', 'swing', 'colorMix', 'fram
          ePreset', 'formPreset',
      29 +  'fieldPulse', 'fieldShimmer', 'fieldCycles'
         +,
      30  ]
      31
      32  // Pattern studio — the kolkrabbi rule/tiling
           system (Image #4 from the brand






⏺ Now add the Animate section (Pulse · Shimmer · Cycles) to
  the Animation tab for field renders. Let me read the exact
  spot:

  Reading 1 file… (ctrl+o to expand)
  ⎿  src/pages/loops/PatternControls.jsx

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 10 lines
      169          </Section>
      170          )}
      171
      172 +        {/* Field families animate their own
          + form: scale breathe + colour shimmer
      173 +            (organic's Pulse breathes the wa
          +ve profile). Driven on whole Cycles. */}
      174 +        {!tilesRender && (
      175 +        <Section label="Animate">
      176 +          <Slider labeled label="Pulse" min=
          +{0} max={1} step={0.05} value={v.fieldPulse
          +?? 0} onChange={(x) => onFrame('fieldPulse',
          + x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" mi
          +n={0} max={1} step={0.05} value={v.fieldShim
          +mer ?? 0} onChange={(x) => onFrame('fieldShi
          +mmer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min
          +={1} max={4} step={1} value={v.fieldCycles ?
          +? 1} onChange={(x) => onFrame('fieldCycles',
          + roundIfNum(x))} variant="default" />
      179 +        </Section>
      180 +        )}
      181 +
      182          {tilesRender && animTab === 'form' &
           & (
      183          <Section label="Form">
      184            <Slider labeled label="Spin" min={
           0} max={3} step={1} value={v.spin} onChange=
           {(x) => onForm('spin', roundIfNum(x))} varia
           nt="default" />

⏺ fieldPulse/Shimmer/Cycles aren't part of the Frame preset,
  so they should use plain onChange (no preset-revert):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 3 lines
      173              (organic's Pulse breathes the wa
           ve profile). Driven on whole Cycles. */}
      174          {!tilesRender && (
      175          <Section label="Animate">
      176 -          <Slider labeled label="Pulse" min=
          -{0} max={1} step={0.05} value={v.fieldPulse
          -?? 0} onChange={(x) => onFrame('fieldPulse',
          - x)} variant="default" />
      177 -          <Slider labeled label="Shimmer" mi
          -n={0} max={1} step={0.05} value={v.fieldShim
          -mer ?? 0} onChange={(x) => onFrame('fieldShi
          -mmer', x)} variant="default" />
      178 -          <Slider labeled label="Cycles" min
          -={1} max={4} step={1} value={v.fieldCycles ?
          -? 1} onChange={(x) => onFrame('fieldCycles',
          - roundIfNum(x))} variant="default" />
      176 +          <Slider labeled label="Pulse" min=
          +{0} max={1} step={0.05} value={v.fieldPulse
          +?? 0} onChange={(x) => onChange('fieldPulse'
          +, x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" mi
          +n={0} max={1} step={0.05} value={v.fieldShim
          +mer ?? 0} onChange={(x) => onChange('fieldSh
          +immer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min
          +={1} max={4} step={1} value={v.fieldCycles ?
          +? 1} onChange={(x) => onChange('fieldCycles'
          +, roundIfNum(x))} variant="default" />
      179          </Section>
      180          )}
      181

⏺ Build and verify the new animations stay seamless with
  Pulse/Shimmer on:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could
      not resolve" | tail -3
      echo "--- seam check with field animation on
      (pulse+shimmer) ---"…)
  ⎿  ✓ built in 2.90s
     --- seam check with field animation on (pulse+shimme
     r) ---
     … +5 lines (ctrl+o to expand)
  ⎿  Allowed by auto mode classifier

⏺ Done — all three, build green, animations verified seamless.

  1 & 2 — Field animation (Stripes + Organic + Tartan). The
  Animation tab now has an Animate section for field renders
  (it was hidden — fields only had Flow). Three modulations,
  all seamless and off by default:
  - Pulse — breathes the scale: stripe/tartan band width,
  organic wave amplitude (animates the profile depth).
  - Shimmer — oscillates each band's colour toward its
  neighbour.
  - Cycles — whole cycles per loop for both.

  So Stripes now animates width + colour (your "width scale,
  colour"); Organic animates its wavy profile + colour. They
  only run on play (no autoplay), and persist across preset
  switches like the other motion.

  Organic's profile is already exposed as controls in the
  Pattern tab — Amplitude + Frequency sliders. If you also
  want to pick the profile shape (sine vs sawtooth/steeper
  curves), say so and I'll add a curve selector.

  3 — Blocks gap is now bipolar. Widened the Grid Gap range
  from -40…80 to -120…120, so blocks go from a big mortar gap
  all the way into heavy overlap. (The engine blanks if cell +
  gap ≤ 0, so at very small cells the extreme-negative end
  has a floor — back off the gap or raise the cell.)

  Not eyeballed live — on :5173, check the Animate sliders on
  a stripe/organic preset (Pulse/Shimmer with play), and the
  Blocks gap sweep into overlap. Tell me if the pulse depth or
  shimmer feel needs tuning.

✻ Churned for 6m 17s

❯ 1. you forgot to make the slider center to 0
  2. the loop still doesnt loop, I think it has to have
  something to do with the curve, what does k • k*k •
  1-(1-k)* (1.. (cant see any more of the expression) [Image
  #5]
  it feels like the in and out dont match
  ⎿  [Image #5]

⏺ API Error: 500 Internal server error. This is a
  server-side issue, usually temporary — try again in
  a moment. If it persists, check
  https://status.claude.com.

✻ Baked for 4s

❯ 1. you forgot to make the slider center to 0
  2. the loop still doesnt loop, I think it has to have
  something to do with the curve, what does k • k*k •
  1-(1-k)* (1.. (cant see any more of the expression) [Image
  #5]
  it feels like the in and out dont match

⏺ API Error: 500 Internal server error. This is a
  server-side issue, usually temporary — try again in
  a moment. If it persists, check
  https://status.claude.com.

✻ Cogitated for 5s

──────────────────────────────────────────────────────────────
❯ 
──────────────────────────────────────────────────────────────
  Press Ctrl-C again to exit

Resume this session with:
claude --resume 804fc2e7-6d31-40fe-b8fe-af6e106a5933
❯ claude
           Claude Code v2.1.186
 ▐▛███▜▌   Opus 4.8 (1M context) with xhigh effort
▝▜█████▛▘  Claude Max
  ▘▘ ▝▝    ~/dev/projects/kol-apparat/kol-labs-single

           Claude Code v2.1.186
 ▐▛███▜▌   Opus 4.8 (1M context) with xhigh effort
▝▜█████▛▘  Claude Max
  ▘▘ ▝▝    ~/dev/projects/kol-apparat/kol-labs-single


⏺ Tartan is clean (seamless, 9 distinct tones). Organic blobs
  render and fuse (inside frac 0.56), but the exact u=0 vs u=1
  check failed — likely float epsilon at the iso rim (the
  metaball orbits via cos(cam.phase), and cos(2π)≠cos(0)
  bit-exactly), not a real tear. Let me confirm it's tiny
  edge-only differences, since the live loop wraps u%1 and
  never renders u=1:

⏺ Bash(node --input-type=module -e '
      import { metaballColorAt } from
      "./src/loops/pattern/fields/metaballField.js";…)
  ⎿  u=0 vs u=1 (exact):    {"pct":"25.750","maxd":"0.0"}
     u=0 vs u=0.999 (live): {"pct":"32.098","maxd":"7.8"}
     continuity u=0 vs u=0.001: {"pct":"32.100","maxd":"7
     .7"}

⏺ Resolved: u=0 vs u=1 max delta is 0.0 (the 25% "differ" is
  ~1e-14 float noise), and the motion is continuous across the
  wrap (u=0.999→0→0.001 all within ~7.8). The live loop wraps
  u%1 so it's genuinely seamless. Phase 2 done, build green.

  Now Phase 3 — Interlace weave. Let me re-read the current
  draw() kernels I need to reuse verbatim in drawWeave:

  Read 1 file (ctrl+o to expand)

⏺ Got the kernel. Now let me read the Interlace and Blocks
  preset files for Phase 3:

  Read 2 files (ctrl+o to expand)

⏺ Phase 3. Adding the weave engine to patternLoop.js —
  drawWeave (reusing the camera/window/wrap kernels) + the
  parity function + dispatch + defaults:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 63 lines
       82    raster(ctx, w, h, make(p, cam, w, h))
       83  }
       84
       85 +// Weave (render:'weave') — true over/under
          +interlacing. Per crossing the warp
       86 +// (vertical) and weft (horizontal) ribbons
          +overlap; a parity fn decides which is
       87 +// drawn SECOND (on top), so strands genuine
          +ly pass over and under across the field.
       88 +const parityWeave = (type, col, row) => {
       89 +  switch (type) {
       90 +    case 'twill':  return ((((col - row) % 4
          +) + 4) % 4) < 2     // diagonal wales
       91 +    case 'satin':  return (((col * 2 + row *
          + 3) % 5) + 5) % 5 === 0 // sparse floats
       92 +    case 'basket': return ((Math.floor(col /
          + 2) + Math.floor(row / 2)) & 1) === 0
       93 +    default:       return ((col + row) & 1)
          +=== 0                // plain
       94 +  }
       95 +}
       96 +function drawWeave(ctx, u, w, h, p) {
       97 +  const cols = Math.max(1, p.cols | 0)
       98 +  const rows = Math.max(1, p.rows | 0)
       99 +  const cell = Math.max(8, p.cell)
      100 +  const period = cell + (p.gap || 0)
      101 +  if (period <= 0) return
      102 +  const z = p.camZoom || 1
      103 +  const ang = (p.camAngle || 0) * Math.PI /
          +180
      104 +  const flow = Math.round(p.camFlow || 0)
      105 +  const half = Math.max(1, (p.strandWidth ??
          + 0.7) * cell) / 2
      106 +  const weave = p.weaveType || 'plain'
      107 +  const warpCol = p.color, weftCol = p.color
          +2 || p.color
      108 +  const warpLit = mixHex(warpCol, '#ffffff',
          + 0.2), weftLit = mixHex(weftCol, '#ffffff',
          +0.2)
      109 +  const len = period // ribbons span the ful
          +l cell so strands read continuous
      110 +
      111 +  ctx.save()
      112 +  ctx.translate(w / 2, h / 2)
      113 +  ctx.rotate(ang)
      114 +  ctx.scale(z, z)
      115 +
      116 +  const reach = (Math.hypot(w, h) / 2) / z +
          + period * 2
      117 +  const g0 = Math.floor(-reach / period), g1
          + = Math.ceil(reach / period)
      118 +
      119 +  // ribbon = base fill + a centre sheen (tu
          +be/cord read).
      120 +  const ribbon = (cx, cy, vert, base, lit) =
          +> {
      121 +    ctx.fillStyle = base
      122 +    if (vert) ctx.fillRect(cx - half, cy - l
          +en / 2, half * 2, len)
      123 +    else ctx.fillRect(cx - len / 2, cy - hal
          +f, len, half * 2)
      124 +    ctx.fillStyle = lit
      125 +    const sh = half * 0.6
      126 +    if (vert) ctx.fillRect(cx - sh, cy - len
          + / 2, sh * 2, len)
      127 +    else ctx.fillRect(cx - len / 2, cy - sh,
          + len, sh * 2)
      128 +  }
      129 +
      130 +  let count = 0
      131 +  for (let gy = g0; gy <= g1; gy++) {
      132 +    for (let gx = g0; gx <= g1; gx++) {
      133 +      if (++count > MAX_CELLS) { ctx.restore
          +(); return }
      134 +      const col = ((gx % cols) + cols) % col
          +s
      135 +      const row = ((gy % rows) + rows) % row
          +s
      136 +      const cx = gx * period, cy = gy * peri
          +od
      137 +      let warpOver = parityWeave(weave, col,
          + row)
      138 +      // travel: the over/under boundary swe
          +eps diagonally on play (whole cycles
      139 +      // ⇒ seamless). flow=0 ⇒ static weave.
      140 +      if (flow) warpOver = warpOver !== (Mat
          +h.sin(u * TAU * flow - (gx + gy) * 0.6) > 0)
      141 +      if (warpOver) { ribbon(cx, cy, false,
          +weftCol, weftLit); ribbon(cx, cy, true, warp
          +Col, warpLit) }
      142 +      else { ribbon(cx, cy, true, warpCol, w
          +arpLit); ribbon(cx, cy, false, weftCol, weft
          +Lit) }
      143 +    }
      144 +  }
      145 +  ctx.restore()
      146 +}
      147 +
      148  export default {
      149    id: 'pattern-rules',
      150    label: 'Pattern',

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 1 line
      237      // Render dispatch: field families bypas
           s the tile loop entirely. 'tiles'
      238      // (default) falls through to the origin
           al engine below — Blocks' native case.
      239      if ((p.render || 'tiles') === 'field') r
           eturn drawField(ctx, u, w, h, p)
      240 +    if (p.render === 'weave') return drawWea
          +ve(ctx, u, w, h, p)
      241
      242      const shp = shapeFor(p.shape, p.customSv
           g, p)
      243      if (!shp.paths.length) return

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines
      210      blobRadius: 0.5,     // seed influence r
           adius (× canvas)
      211      threshold: 1,        // iso level — high
           er = tighter blobs
      212      warp: 0.2,           // domain-warp wobb
           le
      213 +    // Weave render (render:'weave') — inter
          +laced over/under strands
      214 +    weaveType: 'plain',  // plain | twill |
          +satin | basket (which strand goes over)
      215 +    strandWidth: 0.7,    // ribbon width (×
          +cell)
      216      camZoom: 1,
      217      camFlow: 1,
      218      camAngle: 0,

⏺ Re-author Interlace — true over/under weaves onto the weave
  engine, keeping herringbone/lattice/chainlink as genuine
  tiles:

⏺ Write(src/pages/pattern/categories/interlace.js)
  ⎿  Added 51 lines, removed 115 lines
        1  import { R, PAL } from './_helpers.js'
        2
        3 -// INTERLACE — woven, crossing, and knotted
          -structures. Three reliable techniques:
        4 -//   · warp/weft  = `prim:bar` base; an ever
          -y-col:2 rule rotates alternate columns
        5 -//     90° → vertical strips cross horizonta
          -l ones. A checker opacity rule creates
        6 -//     the over/under depth illusion. Works
          -for plain weave, twill, basketweave.
        7 -//   · lattice    = `prim:plus` with a posit
          -ive gap + showGrid. Plus marks at each
        8 -//     cell node + the showGrid lattice line
          - = a two-layer trellis read.
        9 -//   · chainlink  = `prim:diamond` with nega
          -tive gap (overlap) so diamond edges
       10 -//     interlock. colorRule:checker or diag
          -gives the link separation.
       11 -// Scale: big-and-few (trellis cols:4) → fin
          -e mesh (cols:20+).
        3 +// INTERLACE — woven, crossing, knotted stru
          +ctures. The true over/under weaves are a
        4 +// dedicated WEAVE pass (render:'weave'): wa
          +rp (vertical) + weft (horizontal) ribbons
        5 +// cross, and a `weaveType` parity decides w
          +hich passes OVER at each crossing — real
        6 +// z-ordering, not a fake opacity check.
        7 +//   weaveType   plain · twill · satin · bas
          +ket       strandWidth  ribbon width (× cell)
        8 +//   color = warp · color2 = weft · bg = gap
          +s         cols/rows/cell/gap = the lattice
        9 +// camFlow travels the over/under boundary d
          +iagonally (whole cycles ⇒ seamless).
       10 +// Herringbone, lattice/trellis and chainlin
          +k are genuine TILE tessellations (not
       11 +// over/under weaves), so they stay on the t
          +ile engine (no `render` ⇒ 'tiles').
       12
       13 +const weave = (o) => ({ render: 'weave', ...
          +o })
       14 +
       15  export default [
       14 -  // ── plain weave family ──
       15 -  { id: 'plain-weave', label: 'Plain weave',
          - params: {
       16 -    shape: 'prim:bar', cols: 8, rows: 8, cel
          -l: 90, gap: 6,
       17 -    color: PAL.camel, bg: PAL.tan,
       18 -    rules: [
       19 -      R({ selectKind: 'every-col', n: 2, off
          -set: 0, rotate: 90 }),
       20 -      R({ selectKind: 'checker', opacity: 0.
          -65 }),
       21 -    ],
       22 -    animAxis: 'diag', animWaves: 2, fade: 0.
          -2, animCurveExpr: 'k<0.5?2*k*k:1-2*(1-k)*(1-
          -k)' } },
       16 +  // ── true weaves (over/under) ──
       17 +  { id: 'plain-weave', label: 'Plain weave',
          + params: weave({
       18 +    weaveType: 'plain', cols: 8, rows: 8, ce
          +ll: 90, gap: 4, strandWidth: 0.74,
       19 +    color: PAL.camel, color2: PAL.tan, bg: P
          +AL.char }) },
       20 +  { id: 'linen-weave', label: 'Linen weave',
          + params: weave({
       21 +    weaveType: 'plain', cols: 12, rows: 12,
          +cell: 66, gap: 4, strandWidth: 0.72,
       22 +    color: PAL.oat, color2: PAL.bone, bg: PA
          +L.slate }) },
       23 +  { id: 'twill-weave', label: 'Twill weave',
          + params: weave({
       24 +    weaveType: 'twill', cols: 10, rows: 10,
          +cell: 78, gap: 4, strandWidth: 0.76,
       25 +    color: PAL.navy, color2: PAL.blue, bg: P
          +AL.ink }) },
       26 +  { id: 'basketweave', label: 'Basketweave',
          + params: weave({
       27 +    weaveType: 'basket', cols: 8, rows: 8, c
          +ell: 88, gap: 4, strandWidth: 0.8,
       28 +    color: PAL.amber, color2: PAL.ochre, bg:
          + PAL.noir }) },
       29 +  { id: 'satin-weave', label: 'Satin weave',
          + params: weave({
       30 +    weaveType: 'satin', cols: 10, rows: 10,
          +cell: 76, gap: 3, strandWidth: 0.78,
       31 +    color: PAL.gold, color2: PAL.amber, bg:
          +PAL.ink }) },
       32 +  { id: 'mesh', label: 'Mesh', params: weave
          +({
       33 +    weaveType: 'plain', cols: 16, rows: 16,
          +cell: 60, gap: 5, strandWidth: 0.5,
       34 +    color: PAL.ink, color2: PAL.slate, bg: P
          +AL.bone }) },
       35 +  { id: 'loom', label: 'Loom', params: weave
          +({
       36 +    weaveType: 'plain', cols: 8, rows: 10, c
          +ell: 84, gap: 4, strandWidth: 0.78,
       37 +    color: PAL.red, color2: PAL.amber, bg: P
          +AL.ink }) },
       38 +  { id: 'cable', label: 'Cable', params: wea
          +ve({
       39 +    weaveType: 'basket', cols: 6, rows: 6, c
          +ell: 120, gap: 6, strandWidth: 0.82,
       40 +    color: PAL.cream, color2: PAL.coral, bg:
          + PAL.brick }) },
       41
       24 -  { id: 'linen-weave', label: 'Linen weave',
          - params: {
       25 -    shape: 'prim:bar', cols: 12, rows: 12, c
          -ell: 68, gap: 4,
       26 -    color: PAL.oat, bg: PAL.bone,
       27 -    rules: [
       28 -      R({ selectKind: 'every-col', n: 2, off
          -set: 0, rotate: 90 }),
       29 -      R({ selectKind: 'checker', opacity: 0.
          -6 }),
       30 -    ],
       31 -    animAxis: 'diag', animWaves: 3, fade: 0.
          -18 } },
       32 -
       33 -  { id: 'twill-weave', label: 'Twill weave',
          - params: {
       34 -    shape: 'prim:bar', cols: 10, rows: 10, c
          -ell: 78, gap: 5,
       35 -    colorRule: 'diag', color: PAL.navy, colo
          -r2: PAL.blue, color3: PAL.sky, bg: PAL.ink,
       36 -    rules: [
       37 -      R({ selectKind: 'every-col', n: 3, off
          -set: 0, rotate: 90 }),
       38 -      R({ selectKind: 'every-col', n: 3, off
          -set: 1, rotate: 90 }),
       39 -      R({ selectKind: 'checker', opacity: 0.
          -7 }),
       40 -    ],
       41 -    animAxis: 'diag', animWaves: 3, colorMix
          -: 0.15, fade: 0.2 } },
       42 -
       43 -  { id: 'basketweave', label: 'Basketweave',
          - params: {
       44 -    shape: 'prim:bar', cols: 8, rows: 8, cel
          -l: 88, gap: 6,
       45 -    color: PAL.amber, bg: PAL.ochre,
       46 -    rules: [
       47 -      R({ selectKind: 'checker', groupW: 2,
          -groupH: 2, rotate: 90 }),
       48 -      R({ selectKind: 'every-nth', n: 5, off
          -set: 0, opacity: 0.65 }),
       49 -    ],
       50 -    animAxis: 'diag', animWaves: 2, fade: 0.
          -2 } },
       51 -
       52 -  { id: 'satin-weave', label: 'Satin weave',
          - params: {
       53 -    shape: 'prim:bar', cols: 10, rows: 10, c
          -ell: 76, gap: 5,
       54 -    colorRule: 'diag', color: PAL.gold, colo
          -r2: PAL.amber, color3: PAL.ochre, bg: PAL.in
          -k,
       55 -    rules: [
       56 -      R({ selectKind: 'every-col', n: 5, off
          -set: 0, rotate: 90 }),
       57 -      R({ selectKind: 'every-row', n: 5, off
          -set: 2, opacity: 0.55 }),
       58 -    ],
       59 -    animAxis: 'diag', animWaves: 2, colorMix
          -: 0.18, fade: 0.22 } },
       60 -
       61 -  // ── herringbone & chevron ──
       42 +  // ── herringbone & chevron — genuine tria
          +ngle tessellations (tiles) ──
       43    { id: 'herringbone', label: 'Herringbone',
            params: {
       44      shape: 'prim:triangle', cols: 10, rows:
           10, cell: 76, gap: -2,
       45      colorRule: 'checker', color: PAL.camel,
           color2: PAL.tan, bg: PAL.char,
       65 -    rules: [
       66 -      R({ selectKind: 'every-col', n: 2, fli
          -pH: true }),
       67 -      R({ selectKind: 'every-row', n: 2, fli
          -pV: true }),
       68 -    ],
       46 +    rules: [R({ selectKind: 'every-col', n:
          +2, flipH: true }), R({ selectKind: 'every-ro
          +w', n: 2, flipV: true })],
       47      animAxis: 'diag', animWaves: 3, fade: 0.
           18 } },
       70 -
       48    { id: 'herringbone-bold', label: 'Herringb
           one bold', params: {
       49      shape: 'prim:triangle', cols: 6, rows: 6
           , cell: 120, gap: -4,
       50      colorRule: 'checker', color: PAL.navy, c
           olor2: PAL.bone, bg: PAL.ink,
       74 -    rules: [
       75 -      R({ selectKind: 'every-col', n: 2, fli
          -pH: true }),
       76 -      R({ selectKind: 'every-row', n: 2, fli
          -pV: true }),
       77 -    ],
       51 +    rules: [R({ selectKind: 'every-col', n:
          +2, flipH: true }), R({ selectKind: 'every-ro
          +w', n: 2, flipV: true })],
       52      animAxis: 'diag', animWaves: 2, fade: 0.
           16 } },
       79 -
       53    { id: 'chevron-weave', label: 'Chevron wea
           ve', params: {
       54      shape: 'prim:triangle', cols: 8, rows: 8
           , cell: 90, gap: 0,
       55      colorRule: 'rows', color: PAL.teal, colo
           r2: PAL.sky, color3: PAL.navy, bg: PAL.ink2,
       83 -    rules: [
       84 -      R({ selectKind: 'every-col', n: 2, fli
          -pH: true }),
       85 -      R({ selectKind: 'every-row', n: 2, fli
          -pV: true }),
       86 -    ],
       56 +    rules: [R({ selectKind: 'every-col', n:
          +2, flipH: true }), R({ selectKind: 'every-ro
          +w', n: 2, flipV: true })],
       57      animAxis: 'diag', animWaves: 3, colorMix
           : 0.15, fade: 0.2 } },
       58
       89 -  // ── lattice & trellis ──
       59 +  // ── lattice & trellis (tiles) ──
       60    { id: 'trellis', label: 'Trellis', params:
            {
       61      shape: 'prim:plus', cols: 4, rows: 4, ce
           ll: 170, gap: 10, showGrid: true,
       62      color: PAL.forest, bg: PAL.moss,
       63      animAxis: 'radial', animWaves: 1, fade:
           0.2 } },
       94 -
       64    { id: 'lattice', label: 'Lattice', params:
            {
       65      shape: 'prim:plus', cols: 8, rows: 8, ce
           ll: 90, gap: 6, showGrid: true,
       66      colorRule: 'checker', color: PAL.cream,
           color2: PAL.oat, bg: PAL.brick,
       67      animAxis: 'diag', animWaves: 2, fade: 0.
           2 } },
       99 -
       68    { id: 'diamond-lattice', label: 'Diamond l
           attice', params: {
       69      shape: 'prim:diamond', cols: 6, rows: 6,
            cell: 110, gap: -6, showGrid: true,
       70      colorRule: 'checker', color: PAL.sky, co
           lor2: PAL.teal, bg: PAL.ink,
       71      animAxis: 'diag', animWaves: 2, fade: 0.
           22 } },
      104 -
       72    { id: 'caning', label: 'Caning', params: {
       73      shape: 'prim:plus', cols: 16, rows: 16,
           cell: 62, gap: 4, showGrid: true,
       74      color: PAL.camel, bg: PAL.tan,
       75      animAxis: 'radial', animWaves: 4, fade:
           0.18 } },
       76 +  { id: 'grid-weave', label: 'Grid weave', p
          +arams: {
       77 +    shape: 'prim:plus', cols: 20, rows: 20,
          +cell: 55, gap: 5, showGrid: true,
       78 +    color: PAL.bone, bg: PAL.char,
       79 +    animAxis: 'diag', animWaves: 5, fade: 0.
          +18 } },
       80
      110 -  // ── chainlink & reef ──
       81 +  // ── chainlink & netting (tiles) ──
       82    { id: 'chainlink', label: 'Chainlink', par
           ams: {
       83      shape: 'prim:diamond', cols: 8, rows: 8,
            cell: 96, gap: -12,
       84      colorRule: 'checker', color: PAL.slate,
           color2: PAL.bone, bg: PAL.ink,
       85      animAxis: 'diag', animWaves: 2, fade: 0.
           2, animCurveExpr: 'k<0.5?2*k*k:1-2*(1-k)*(1-
           k)' } },
      115 -
       86    { id: 'chainlink-gold', label: 'Chainlink
           gold', params: {
       87      shape: 'prim:diamond', cols: 6, rows: 6,
            cell: 120, gap: -14,
       88      colorRule: 'checker', color: PAL.gold, c
           olor2: PAL.amber, bg: PAL.ink,
       89      animAxis: 'diag', animWaves: 2, fade: 0.
           22 } },
      120 -
      121 -  { id: 'reef-knot', label: 'Reef knot', par
          -ams: {
      122 -    shape: 'prim:square', cols: 6, rows: 6,
          -cell: 110, gap: 0, stretch: true, showGrid:
          -true,
      123 -    colorRule: 'checker', color: PAL.teal, c
          -olor2: PAL.navy, bg: PAL.ink,
      124 -    rules: [R({ selectKind: 'checker', rotat
          -e: 45 })],
      125 -    animAxis: 'diag', animWaves: 2, fade: 0.
          -18 } },
      126 -
      127 -  // ── mesh & netting ──
      128 -  { id: 'mesh', label: 'Mesh', params: {
      129 -    shape: 'prim:bar', cols: 16, rows: 16, c
          -ell: 62, gap: 4,
      130 -    color: PAL.ink, bg: PAL.bone,
      131 -    rules: [
      132 -      R({ selectKind: 'every-col', n: 2, off
          -set: 0, rotate: 90 }),
      133 -    ],
      134 -    animAxis: 'diag', animWaves: 4, fade: 0.
          -2 } },
      135 -
       90    { id: 'netting', label: 'Netting', params:
            {
       91      shape: 'prim:diamond', cols: 10, rows: 1
           0, cell: 78, gap: -4,
       92      color: PAL.sky, bg: PAL.ink2,
       93      rules: [R({ selectKind: 'every-nth', n:
           3, offset: 1, opacity: 0.55 })],
       94      animAxis: 'radial', animWaves: 3, fade:
           0.25 } },
      141 -
      142 -  { id: 'grid-weave', label: 'Grid weave', p
          -arams: {
      143 -    shape: 'prim:plus', cols: 20, rows: 20,
          -cell: 55, gap: 5, showGrid: true,
      144 -    color: PAL.bone, bg: PAL.char,
      145 -    animAxis: 'diag', animWaves: 5, fade: 0.
          -18 } },
      146 -
      147 -  // ── loom / cable (bold textile feel) ──
      148 -  { id: 'loom', label: 'Loom', params: {
      149 -    shape: 'prim:bar', cols: 8, rows: 10, ce
          -ll: 84, gap: 6,
      150 -    colorRule: 'cols', color: PAL.red, color
          -2: PAL.amber, color3: PAL.navy, bg: PAL.ink,
      151 -    rules: [
      152 -      R({ selectKind: 'every-row', n: 2, off
          -set: 0, rotate: 90, opacity: 0.7 }),
      153 -    ],
      154 -    animAxis: 'col', animWaves: 3, colorMix:
          - 0.15, fade: 0.2 } },
      155 -
      156 -  { id: 'cable', label: 'Cable', params: {
      157 -    shape: 'prim:bar', cols: 6, rows: 6, cel
          -l: 120, gap: 8,
      158 -    colorRule: 'checker', color: PAL.cream,
          -color2: PAL.coral, bg: PAL.brick,
      159 -    rules: [
      160 -      R({ selectKind: 'every-col', n: 2, off
          -set: 0, rotate: 90 }),
      161 -      R({ selectKind: 'checker', groupW: 2,
          -groupH: 2, opacity: 0.7 }),
      162 -    ],
      163 -    animAxis: 'diag', animWaves: 2, fade: 0.
          -2 } },
       95 +  { id: 'reef-knot', label: 'Reef knot', par
          +ams: {
       96 +    shape: 'prim:square', cols: 6, rows: 6,
          +cell: 110, gap: 0, stretch: true, showGrid:
          +true,
       97 +    colorRule: 'checker', color: PAL.teal, c
          +olor2: PAL.navy, bg: PAL.ink,
       98 +    rules: [R({ selectKind: 'checker', rotat
          +e: 45 })],
       99 +    animAxis: 'diag', animWaves: 2, fade: 0.
          +18 } },
      100  ]

⏺ Now the weave controls in PatternControls (a new render ===
  'weave' branch, before the tile structure):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 22 lines
      245      )
      246    }
      247
      248 +  // Weave render — interlaced over/under st
          +rands (no tile Shape/Grid/Rules).
      249 +  if (v.render === 'weave') {
      250 +    return (
      251 +      <>
      252 +        <Section label="Weave">
      253 +          <LabeledControl inline label="Type
          +">
      254 +            <Dropdown variant="subtle" size=
          +"sm" className="w-full" options={WEAVE_OPTIO
          +NS} value={v.weaveType ?? 'plain'} onChange=
          +{(val) => onChange('weaveType', val)} />
      255 +          </LabeledControl>
      256 +          <Slider labeled label="Columns" mi
          +n={2} max={28} step={1} value={v.cols} onCha
          +nge={(x) => onChange('cols', roundIfNum(x))}
          + variant="default" />
      257 +          <Slider labeled label="Rows" min={
          +2} max={28} step={1} value={v.rows} onChange
          +={(x) => onChange('rows', roundIfNum(x))} va
          +riant="default" />
      258 +          <Slider labeled label="Cell" min={
          +40} max={240} step={1} value={v.cell} onChan
          +ge={(x) => onChange('cell', roundIfNum(x))}
          +variant="default" />
      259 +          <Slider labeled label="Strand" min
          +={0.3} max={0.95} step={0.02} value={v.stran
          +dWidth ?? 0.7} onChange={(x) => onChange('st
          +randWidth', x)} variant="default" />
      260 +        </Section>
      261 +        <Section label="Colour">
      262 +          {colorCtl('Warp', 'color')}
      263 +          {colorCtl('Weft', 'color2')}
      264 +          {colorCtl('Ground', 'bg')}
      265 +        </Section>
      266 +      </>
      267 +    )
      268 +  }
      269 +
      270    const rules = v.rules || []
      271    const setRules = (r) => onChange('rules',
           r)
      272    const addRule = () => setRules([...rules,
           newRule()])

⏺ I referenced WEAVE_OPTIONS — let me define it alongside the
  other option consts:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 7 lines
      67    { id: 'ripple',     label: 'Ripple',
          params: { spin: 0, animAxis: 'radial', animCy
          cles: 1, animWaves: 4, animCurveExpr: '',
                       pulse: 0.5, fade: 0.5, swing: 0,
            colorMix: 0 } },
      68  ]
      69
      70 +const WEAVE_OPTIONS = [
      71 +  { value: 'plain', label: 'Plain' },
      72 +  { value: 'twill', label: 'Twill' },
      73 +  { value: 'satin', label: 'Satin' },
      74 +  { value: 'basket', label: 'Basket' },
      75 +]
      76 +
      77  const SWEEP_AXES = [
      78    { value: 'none', label: 'None' },
      79    { value: 'diag', label: 'Diagonal' },

⏺ Phase 3 wired. Blocks needs no engine change (the stepped
  re-tile cascade it wants is already exemplified in
  pixel-check/static-field, and you confirmed it's good — I'm
  not churning what works). Build:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could
      not resolve|is not defined" | tail -5)
  ⎿  ✓ built in 2.82s

⏺ Build green. The weave draws to a canvas (no node Canvas2D),
  so let me verify via a mock ctx that draw() runs the weave
  path and produces strands, plus check the parity logic gives
  real over/under variation per weave type:

⏺ Bash(node --input-type=module -e '
      import patternLoop from
      "./src/loops/pattern/patternLoop.js";…)
  ⎿  Error: Exit code 1
     file:///Users/biskup/dev/projects/kol-apparat/kol-labs-si
     ngle/src/loops/pattern/shapes.js:6
     const abstractModules =
     import.meta.glob('./shapes/*.svg', { eager: true, query:
     '?raw', import: 'default' })
                                         ^

     TypeError: (intermediate value).glob is not a function
         at file:///Users/biskup/dev/projects/kol-apparat/kol-
     labs-single/src/loops/pattern/shapes.js:6:37
         at ModuleJob.run
     (node:internal/modules/esm/module_job:439:25)
         at async onImport.tracePromise.__proto__
     (node:internal/modules/esm/loader:227:26)
         at async ModuleLoader.executeModuleJob
     (node:internal/modules/esm/loader:224:20)
     … +3 lines (ctrl+o to expand)

⏺ patternLoop pulls in Vite-only import.meta.glob, so node
  can't import it. Let me verify the parity logic standalone
  (the over/under correctness) — drawWeave rendering itself
  needs the live eyeball:

⏺ Bash(node --input-type=module -e '
      const par=(t,c,r)=>{switch(t){case "twill":return
      ((((c-r)%4)+4)%4)<2;case "satin":return
      (((c*2+r*3)%5)+5)%5===0;case "basket":re…)
  ⎿  parity plain: 72/144 warp-over (both >0 = real over/
     under interlace)
     parity twill: 72/144 warp-over (both >0 = real over/
     … +7 lines (ctrl+o to expand)

⏺ Weave verified: all four types give real over/under
  (plain/twill/basket 50/50, satin sparse floats), and travel
  has 0 parity flips u=0→u=1 (seamless). Final consolidated
  build:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error" | tail
      -3)
  ⎿  ✓ built in 2.94s

⏺ All phases build green. Let me finish the one cross-cutting
  item I flagged — gate the inert Form axis for field/weave
  renders (their motion lives on Frame→Flow), so it's not a
  dead tab. Reading the current animation branch to make
  precise edits:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 4 lines
      133        const opts = presets.map((p) => ({ val
           ue: p.id, label: p.label }))
      134        return (val == null || val === 'custom
           ') ? [{ value: 'custom', label: 'Custom' },
           ...opts] : opts
      135      }
      136 +    // Form (the per-cell sweep) is a TILE c
          +oncept — field/weave renders move on the
      137 +    // Frame axis only (stripe drift · tarta
          +n scroll · organic orbit · weave travel,
      138 +    // all driven by Frame → Flow). So hide
          +the whole Form axis when not on tiles.
      139 +    const tilesRender = (v.render ?? 'tiles'
          +) === 'tiles'
      140      return (
      141        <>
      142          {/* Quick-select layer: pick the Fra
           me + Pattern motion presets without

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 10 lines, removed 6 lines
      146            <LabeledControl inline label="Fram
           e">
      147              <Dropdown variant="subtle" size=
           "sm" className="w-full" options={presetOpts(
           FRAME_PRESETS, v.framePreset)} value={v.fram
           ePreset ?? 'custom'} onChange={applyPreset('
           framePreset', FRAME_PRESETS)} />
      148            </LabeledControl>
      149 -          <LabeledControl inline label="Form
          -">
      150 -            <Dropdown variant="subtle" size=
          -"sm" className="w-full" options={presetOpts(
          -FORM_PRESETS, v.formPreset)} value={v.formPr
          -eset ?? 'custom'} onChange={applyPreset('for
          -mPreset', FORM_PRESETS)} />
      151 -          </LabeledControl>
      149 +          {tilesRender && (
      150 +            <LabeledControl inline label="Fo
          +rm">
      151 +              <Dropdown variant="subtle" siz
          +e="sm" className="w-full" options={presetOpt
          +s(FORM_PRESETS, v.formPreset)} value={v.form
          +Preset ?? 'custom'} onChange={applyPreset('f
          +ormPreset', FORM_PRESETS)} />
      152 +            </LabeledControl>
      153 +          )}
      154          </Section>
      153 -        <SegmentedToggle value={animTab} onC
          -hange={setAnimTab} className="w-full" option
          -s={[{ value: 'frame', label: 'Frame' }, { va
          -lue: 'form', label: 'Form' }]} />
      154 -        {animTab === 'frame' && (
      155 +        {tilesRender && (
      156 +          <SegmentedToggle value={animTab} o
          +nChange={setAnimTab} className="w-full" opti
          +ons={[{ value: 'frame', label: 'Frame' }, {
          +value: 'form', label: 'Form' }]} />
      157 +        )}
      158 +        {(!tilesRender || animTab === 'frame
          +') && (
      159          <Section label="Frame">
      160            <Slider labeled label="Flow" min={
           0} max={4} step={1} value={v.camFlow} onChan
           ge={(x) => onFrame('camFlow', roundIfNum(x))
           } variant="default" />
      161            {/* Direction is a tile-grid pan;
           fields drift along their own axis via Flow.
           */}
      158 -          {(v.render ?? 'tiles') === 'tiles'
          - && (
      162 +          {tilesRender && (
      163              <LabeledControl inline label="Di
           rection">
      164                <Dropdown variant="subtle" siz
           e="sm" className="w-full" options={PAN_DIRS}
            value={v.panDir ?? 'diag'} onChange={(val)
           => onFrame('panDir', val)} />
      165              </LabeledControl>

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 1 line, removed 1 line
      169          </Section>
      170          )}
      171
      172 -        {animTab === 'form' && (
      172 +        {tilesRender && animTab === 'form' &
          +& (
      173          <Section label="Form">
      174            <Slider labeled label="Spin" min={
           0} max={3} step={1} value={v.spin} onChange=
           {(x) => onForm('spin', roundIfNum(x))} varia
           nt="default" />
      175            <LabeledControl inline label="Axis
           ">

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error" | tail
      -3)
  ⎿  ✓ built in 2.74s

⏺ All phases done, build green (2.74s). Here's the whole arc:

  Pattern studio — five genuinely distinct families

  The engine went from one shape per grid cell to a pluggable
  render dispatch (patternLoop.draw branches on render):
  'tiles' (the original loop, untouched) · 'field' (continuous
  per-pixel via the existing field/ rasterizer + camera) ·
  'weave' (a strand pass reusing the tile kernels). Each
  family leads with its true form but keeps genuine tile
  members where the pattern really is a tile tessellation.

  ┌──────────┬─────────────────────┬───────┬─────────────┐
  │  Family  │   Now renders as    │ Engin │ Animation ( │
  │          │                     │   e   │ Frame→Flow) │
  ├──────────┼─────────────────────┼───────┼─────────────┤
  │          │ directional band    │       │             │
  │ Stripes  │ field — any angle,  │ field │ barber-pole │
  │          │ solid/pinstripe/omb │       │  drift      │
  │          │ ré                  │       │             │
  ├──────────┼─────────────────────┼───────┼─────────────┤
  │          │ crossing warp×weft  │       │             │
  │ Tartan   │ setts, averaged     │ field │ sett scroll │
  │          │ into the woven mix  │       │             │
  │          │ tone                │       │             │
  ├──────────┼─────────────────────┼───────┼─────────────┤
  │          │ the tile engine     │       │ stepped     │
  │ Blocks   │ (unchanged — it was │ tiles │ re-tile     │
  │          │  right)             │       │             │
  ├──────────┼─────────────────────┼───────┼─────────────┤
  │          │ summed metaball     │       │ orbiting /  │
  │ Organic  │ iso-field — blobs   │ field │ merging     │
  │          │ that fuse           │       │             │
  ├──────────┼─────────────────────┼───────┼─────────────┤
  │          │ real over/under     │       │             │
  │ Interlac │ strands with        │ weave │ the weave   │
  │ e        │ per-crossing        │       │ travels     │
  │          │ z-order             │       │             │
  └──────────┴─────────────────────┴───────┴─────────────┘

  Mixed where honest: argyle/houndstooth stay tiles under
  Tartan; polka/halftone/petals stay tiles under Organic;
  herringbone/lattice/chainlink stay tiles under Interlace.

  Verified (not just built)

  - Stripes — seam, real bands, pinstripe ratio, ombré blend ✓
  - Tartan — seamless, distinct crossing tones ✓
  - Organic — seamless (Δ≈0), fused blobs (56% fill),
  continuous motion ✓
  - Interlace — over/under mix per type (plain/twill/basket
  50/50, satin sparse), travel seam 0 flips ✓

  Files

  New: fields/stripeField.js, fields/tartanField.js,
  fields/metaballField.js, fields/setts.js.
  Edited: patternLoop.js (dispatch, drawField, drawWeave,
  parityWeave, defaults), PatternControls.jsx (render-aware
  sections per family + Form axis hidden for field/weave), and
  re-authored stripes/tartan/organic/interlace.js.

  UI cleanup included

  The Animation tab is now render-aware: field/weave presets
  show only the Frame axis (their motion is Flow-driven) — the
  tiles-only Form sweep and Direction controls are hidden, no
  dead tabs.

  Honest caveats

  - Not eyeballed live — all coefficients (stripe pitch, sett
  scales, metaball threshold/radius, strand width) are
  first-calibration; they'll want tuning by eye on :5173.
  - Setts are plausible, not museum-accurate threadcounts.
  - New params persist via getSettings and ride the preset
  patches for deep-links; they're classified structural, so
  they swap with the preset while your camera motion carries
  over.

  Switch to :5173 and look — especially Tartan crossings,
  Organic fusion, and Interlace over/under. Tell me what needs
  tuning.

✻ Cooked for 17m 20s

❯ I noticed on the first page, first example that it was 1.
  not smooth (little jerky) and 2. not a loop, animation has
  to be a loop -- find out why this is

⏺ Good catch — and you're right. Let me find the cause. The
  first example is Stripes → Awning (the /pattern index),
  animating via Flow drift. Let me look at exactly how the
  stripe drift advances per loop:

  Read 1 file (ctrl+o to expand)

⏺ Found it. drift = cam.phase / TAU advances by round(camFlow)
  bands per loop — but a stripe's repeat period is bandCount
  bands. Awning is bandCount: 2, camFlow: 1, so over the loop
  it shifts one band = the half-phase (colours swapped), not a
  whole period → at u=1 the pattern doesn't match u=0, so it
  snaps at the wrap. That snap is both "not a loop" and the
  per-loop hitch you read as jerky.

  (My Phase-1 seam test passed only because I happened to use
  camFlow: 2 = exactly 2 bands = one full period for
  bandCount: 2 — a false positive. Good catch.)

  Fix: drift whole periods, not whole bands — multiply by
  bands:

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 4 lines, removed 1 line
      28    const pitch = Math.max(2, p.stripePitch ||
          60)
      29    const duty = p.duty == null ? 1 : p.duty
      30    const soft = p.edgeSoftness || 0
      31 -  const drift = cam.phase / TAU // whole cycl
         -es ⇒ seamless
      31 +  // Drift whole PERIODS per loop, not whole
         +bands: the palette repeats every
      32 +  // `bands` bands, so a 1-band shift (camFlo
         +w=1, bands=2) lands on the half-phase
      33 +  // and the loop snaps. ×bands ⇒ camFlow ful
         +l periods per loop ⇒ truly seamless.
      34 +  const drift = (cam.phase / TAU) * bands
      35    const solid = duty >= 0.999
      36
      37    return (i, j, W, H) => {

⏺ Bash(node --input-type=module -e '
      import { stripeColorAt } from
      "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  camFlow=1 bands=1: mismatchPx=0 maxΔ=0.0
     camFlow=1 bands=2: mismatchPx=0 maxΔ=0.0
     camFlow=1 bands=3: mismatchPx=0 maxΔ=0.0
     moves mid-loop (u0 vs u0.25): true (199 px changed)

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error" | tail
      -2)
  ⎿  ✓ built in 2.87s

⏺ Fixed and verified — build green.

  Cause: the stripe drift advanced by round(camFlow) bands per
  loop, but the colour pattern repeats every bandCount bands.
  Awning (bandCount 2, camFlow 1) drifted exactly one band
  over the loop → it ended on the half-phase (colours
  swapped), so u=1 ≠ u=0 and the loop snapped back. That snap
  is what you saw as "not a loop," and the once-per-cycle jump
  is the hitch that reads as "jerky."

  Fix: drift by whole periods (× bandCount), so camFlow=1 =
  one full period per loop. Now verified seamless at camFlow=1
  for 1/2/3 bands (0-pixel mismatch u=0↔u=1) and it still
  moves mid-loop. This was stripes-only — tartan (scrolls
  whole setts), organic (full orbits), and weave (period-1
  travel) were already whole-period and tested clean at
  camFlow=1.

  If any continuous jerkiness remains after this (separate
  from the loop snap), the likely suspect is the per-pixel
  field raster cost at a large stage size — tell me and I'll
  profile it rather than guess. But the loop itself is now
  correct.

✻ Sautéed for 3m 16s

❯ simple red white animation in stripe is only 21 fps? whats
  dragging it down? (even when everything is off the frame
  rate is 17-19 fps idle) -- what is causing this?

⏺ Two separate things here, and "17-19 fps even when
  idle/paused" is the key clue — that says the render loop is
  doing heavy work every frame regardless of play state. Let
  me confirm by reading the tick loop and measuring the actual
  per-pixel field cost:

  Read 1 file (ctrl+o to expand)

⏺ Bash(node --input-type=module -e '
      import { stripeColorAt } from
      "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  1Mpx stripe colorAt loop: 49.7 ms/frame  -> 20 fps c
     eiling (JS only, excl putImageData/drawImage)
     1Mpx stripe colorAt loop: 43.5 ms/frame  -> 23 fps c
     … +3 lines (ctrl+o to expand)
  ⎿  Interrupted · What should Claude do instead?

❯ [Image #3] are you making stripes from million boxes?? that
  must be the reson, why are you not just making it from 1
  box?
  ⎿  [Image #3]

⏺ You're right, and that's exactly the cause — let me show the
  numbers and fix the real problem.

  The bench confirms it: the stripe was being rendered by
  computing a colour for ~1 million pixels every frame (a full
  per-pixel raster) — ~43–50ms/frame on its own = ~20fps
  ceiling. Not literally a million boxes, but just as dumb:
  stripes are flat bands, so painting them pixel-by-pixel is
  absurd. They should be a few fillRects (one per visible band
  ≈ 20–40 rects), which is sub-millisecond.

  Two compounding bugs:
  1. The over-engineered renderer — stripes (and tartan) used
  the per-pixel field meant for organic blobs. Wrong tool.
  2. It redrew every frame even when paused — that's your
  17–19fps idle: the loop re-rasterized the whole field on
  every rAF regardless of play state.

  Fixing both. First, redraw stripes as vector bands instead
  of per-pixel:

⏺ Write(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 39 lines, removed 44 lines
       1 -import { TAU, hexToRgb } from '../../lib/util
         -.js'
       2 -import { sample } from '../../field/camera.js
         -'
       3 -import { mix2 } from '../../field/raster.js'
       1 +import { TAU } from '../../lib/util.js'
       2
       5 -// Stripes — a continuous directional band FI
         -ELD (no tiles). Reads the pattern
       6 -// palette: color/color2/color3 are the bands
         -, bg is the ground for pinstripes.
       7 -// Two looks from one model:
       8 -//   · duty >= 1  → solid colour bands cyclin
         -g the palette; edgeSoftness blends
       9 -//                  adjacent band colours (om
         -bré).
      10 -//   · duty <  1  → an ink band of width `dut
         -y` (the band colour) on the bg
      11 -//                  ground (pinstripe / slats
         -); edgeSoftness softens the edges.
      12 -// Direction is `stripeAngle` (0 vertical · 9
         -0 horizontal · 45 diagonal). Seamless:
      13 -// drift is whole cycles (cam.phase = u·TAU·r
         -ound(camFlow)), so u=0 ≡ u=1.
      14 -
      15 -const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1
         - : x)
      16 -const smoothstep = (e0, e1, x) => {
      17 -  const t = clamp01((x - e0) / (e1 - e0 || 1e
         --6))
      18 -  return t * t * (3 - 2 * t)
      19 -}
      20 -
      21 -// Factory: returns a colorAt(i,j,W,H) → [r,g
         -,b] for the shared rasterizer.
      22 -export function stripeColorAt(p, cam, w, h) {
      23 -  const cols = [hexToRgb(p.color), hexToRgb(p
         -.color2 || p.color), hexToRgb(p.color3 || p.c
         -olor2 || p.color)]
      24 -  const ground = hexToRgb(p.bg)
       3 +// Stripes — drawn as VECTOR bands (a handful
         + of fillRects), NOT per-pixel. Stripes
       4 +// are flat geometry, so we transform into a
         +stripe-local frame (camera angle+zoom,
       5 +// then the stripe angle) and fill one rect p
         +er visible band. Canvas anti-aliases
       6 +// the edges and sub-pixel positions, so moti
         +on is smooth. Reads the palette:
       7 +// color/color2/color3 are the bands, bg is t
         +he ground for pinstripes.
       8 +//   duty >= 1  → solid colour bands (edgeSof
         +tness ⇒ ombré gradient per band)
       9 +//   duty <  1  → an ink band of width `duty`
         + on the bg ground (pinstripe/slats)
      10 +// Seamless: drift advances whole PERIODS per
         + loop (×bandCount), cam.phase whole cycles.
      11 +export function drawStripes(ctx, cam, w, h, p
         +) {
      12 +  const cols = [p.color, p.color2 || p.color,
         + p.color3 || p.color2 || p.color]
      13    const bands = Math.max(1, Math.round(p.band
          Count || 2))
      14    const theta = (p.stripeAngle || 0) * Math.P
          I / 180
      27 -  const ct = Math.cos(theta), st = Math.sin(t
         -heta)
      15 +  const camAng = (p.camAngle || 0) * Math.PI
         +/ 180
      16    const pitch = Math.max(2, p.stripePitch ||
          60)
      17    const duty = p.duty == null ? 1 : p.duty
      18    const soft = p.edgeSoftness || 0
      31 -  // Drift whole PERIODS per loop, not whole
         -bands: the palette repeats every
      32 -  // `bands` bands, so a 1-band shift (camFlo
         -w=1, bands=2) lands on the half-phase
      33 -  // and the loop snaps. ×bands ⇒ camFlow ful
         -l periods per loop ⇒ truly seamless.
      34 -  const drift = (cam.phase / TAU) * bands
      35 -  const solid = duty >= 0.999
      19 +  const z = cam.zoom
      20 +  const drift = (cam.phase / TAU) * bands //
         +whole periods ⇒ seamless loop
      21
      37 -  return (i, j, W, H) => {
      38 -    const [rx, ry] = sample(cam, (i / W) * w,
         - (j / H) * h)
      39 -    const ph = (rx * ct + ry * st) / pitch +
         -drift
      40 -    const n = Math.floor(ph)
      41 -    const frac = ph - n
      22 +  ctx.save()
      23 +  ctx.translate(cam.cx, cam.cy)
      24 +  ctx.rotate(camAng)
      25 +  ctx.scale(z, z)
      26 +  ctx.rotate(theta)            // stripe-loca
         +l frame: x = the stripe normal
      27 +
      28 +  const reach = (Math.hypot(w, h) / 2) / z +
         +pitch * 2
      29 +  const y0 = -reach, yH = reach * 2
      30 +  const nLo = Math.floor(-reach / pitch + dri
         +ft) - 1
      31 +  const nHi = Math.ceil(reach / pitch + drift
         +) + 1
      32 +  for (let n = nLo; n <= nHi; n++) {
      33      const idx = ((n % bands) + bands) % bands
      43 -    const ink = cols[idx]
      44 -    if (solid) {
      45 -      if (soft <= 0) return ink
      46 -      // blend toward the next band's colour
         -across the boundary (ombré)
      47 -      return mix2(smoothstep(1 - soft, 1, fra
         -c), ink, cols[(idx + 1) % bands])
      34 +    const x = (n - drift) * pitch
      35 +    if (duty < 0.999 && soft <= 0) {
      36 +      ctx.fillStyle = cols[idx]
      37 +      ctx.fillRect(x, y0, pitch * duty, yH) /
         +/ ink band on the (already-filled) bg
      38 +    } else if (soft > 0) {
      39 +      const g = ctx.createLinearGradient(x, 0
         +, x + pitch, 0)
      40 +      g.addColorStop(0, cols[idx])
      41 +      g.addColorStop(1, cols[(idx + 1) % band
         +s])
      42 +      ctx.fillStyle = g
      43 +      ctx.fillRect(x, y0, pitch, yH)
      44 +    } else {
      45 +      ctx.fillStyle = cols[idx]
      46 +      ctx.fillRect(x, y0, pitch, yH)
      47      }
      49 -    // ink band of width `duty` riding on the
         - ground colour (pinstripe / slats)
      50 -    const cov = soft <= 0
      51 -      ? (frac < duty ? 1 : 0)
      52 -      : clamp01(smoothstep(0, soft, frac) - s
         -moothstep(duty, Math.min(1, duty + soft), fra
         -c))
      53 -    return mix2(cov, ground, ink)
      48    }
      49 +  ctx.restore()
      50  }

❯ and 'organic' is not pattern? its just blobs, we dont need
  that, organic would be for example stripes with an organic
  'profile' f.e. [Image #4]
  ⎿  [Image #4]

⏺ You're right on both counts — and message 2 actually makes
  the perf fix cleaner. "Organic" as metaball blobs isn't a
  pattern; organic = stripes/bands with a wavy organic edge
  profile (your image). That means none of the families need
  the per-pixel raster — stripes, tartan, and organic are all
  cheap vector geometry. I'm dropping the field-raster +
  metaball entirely.

  Let me redo all three as vector draws (self-contained, no
  cam/raster coupling). Stripes first:

⏺ Write(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 13 lines, removed 16 lines
       1  import { TAU } from '../../lib/util.js'
       2
       3 -// Stripes — drawn as VECTOR bands (a handful
         - of fillRects), NOT per-pixel. Stripes
       4 -// are flat geometry, so we transform into a
         -stripe-local frame (camera angle+zoom,
       5 -// then the stripe angle) and fill one rect p
         -er visible band. Canvas anti-aliases
       6 -// the edges and sub-pixel positions, so moti
         -on is smooth. Reads the palette:
       7 -// color/color2/color3 are the bands, bg is t
         -he ground for pinstripes.
       8 -//   duty >= 1  → solid colour bands (edgeSof
         -tness ⇒ ombré gradient per band)
       9 -//   duty <  1  → an ink band of width `duty`
         - on the bg ground (pinstripe/slats)
      10 -// Seamless: drift advances whole PERIODS per
         - loop (×bandCount), cam.phase whole cycles.
      11 -export function drawStripes(ctx, cam, w, h, p
         -) {
       3 +// Stripes — VECTOR bands (a handful of fillR
         +ects), NOT per-pixel. Transform into a
       4 +// stripe-local frame (camera angle + zoom, t
         +hen the stripe angle) and fill one rect
       5 +// per visible band; canvas anti-aliases edge
         +s + sub-pixel motion. Palette:
       6 +// color/color2/color3 = bands, bg = ground f
         +or pinstripes.
       7 +//   duty >= 1 → solid bands (edgeSoftness ⇒
         +per-band ombré gradient)
       8 +//   duty <  1 → ink band of width `duty` on
         +the bg ground (pinstripe / slats)
       9 +// Seamless: drift advances whole PERIODS per
         + loop (×bandCount); phase = u·TAU·round(camFl
         +ow).
      10 +export function drawStripes(ctx, u, w, h, p)
         +{
      11    const cols = [p.color, p.color2 || p.color,
           p.color3 || p.color2 || p.color]
      12    const bands = Math.max(1, Math.round(p.band
          Count || 2))
      14 -  const theta = (p.stripeAngle || 0) * Math.P
         -I / 180
      15 -  const camAng = (p.camAngle || 0) * Math.PI
         -/ 180
      13    const pitch = Math.max(2, p.stripePitch ||
          60)
      14    const duty = p.duty == null ? 1 : p.duty
      15    const soft = p.edgeSoftness || 0
      19 -  const z = cam.zoom
      20 -  const drift = (cam.phase / TAU) * bands //
         -whole periods ⇒ seamless loop
      16 +  const z = p.camZoom || 1
      17 +  const drift = u * Math.round(p.camFlow || 0
         +) * bands // whole periods ⇒ seamless
      18
      19    ctx.save()
      23 -  ctx.translate(cam.cx, cam.cy)
      24 -  ctx.rotate(camAng)
      20 +  ctx.translate(w / 2, h / 2)
      21 +  ctx.rotate((p.camAngle || 0) * Math.PI / 18
         +0)
      22    ctx.scale(z, z)
      26 -  ctx.rotate(theta)            // stripe-loca
         -l frame: x = the stripe normal
      23 +  ctx.rotate((p.stripeAngle || 0) * Math.PI /
         + 180) // stripe-local: x = band normal
      24
      25    const reach = (Math.hypot(w, h) / 2) / z +
          pitch * 2
      26    const y0 = -reach, yH = reach * 2

⏺ Tartan as vector (solid weft + 50% warp = the average
  weave):

⏺ Write(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 40 lines, removed 27 lines
       1 -import { TAU, hexToRgb } from '../../lib/util
         -.js'
       2 -import { sample } from '../../field/camera.js
         -'
       3 -import { mix2 } from '../../field/raster.js'
       1 +import { TAU } from '../../lib/util.js'
       2  import { SETTS } from './setts.js'
       3
       6 -// Tartan — crossing warp + weft threads (no
         -tiles). Each axis walks the sett (a
       7 -// threadcount of palette-indexed bands); the
         - cell colour is the AVERAGE of the
       8 -// warp + weft thread — the woven "mix" tone.
         - Same colour on both axes ⇒ that solid
       9 -// colour; different colours ⇒ the muddy cros
         -sing third. A small twill bias shows
      10 -// more warp or weft along alternating diagon
         -als (the 2/2-twill grain). Seamless:
      11 -// scroll advances by whole sett-repeats (cam
         -.phase = u·TAU·round(camFlow)).
      12 -export function tartanColorAt(p, cam, w, h) {
      13 -  const pal = [hexToRgb(p.color), hexToRgb(p.
         -color2 || p.color), hexToRgb(p.color3 || p.co
         -lor2 || p.color), hexToRgb(p.bg)]
       4 +// Tartan — VECTOR bands, not per-pixel. The
         +woven "mix" tone comes for free from
       5 +// alpha compositing: draw the weft (horizont
         +al sett bands) solid, then the warp
       6 +// (vertical sett bands) at 50% → every cell
         +is the AVERAGE of its warp+weft thread
       7 +// (same colour ⇒ that colour; different ⇒ th
         +e muddy crossing third). A few dozen
       8 +// rects total. Palette indices 0..3 → color/
         +color2/color3/bg. Seamless: the sett
       9 +// scrolls whole repeats per loop (phase = u·
         +TAU·round(camFlow)).
      10 +export function drawTartan(ctx, u, w, h, p) {
      11 +  const pal = [p.color, p.color2 || p.color,
         +p.color3 || p.color2 || p.color, p.bg]
      12    const sett = SETTS[p.sett] || SETTS['black-
          watch']
      13    const total = sett.reduce((s, b) => s + b[1
          ], 0)
      16 -  const scale = Math.max(0.5, p.settScale ||
         -5)   // px per thread unit
      17 -  const twill = p.twill == null ? 0.18 : p.tw
         -ill
      18 -  const span = total * scale
         -      // one full repeat, px
      19 -  const drift = (cam.phase / TAU) * span
         -      // whole repeats ⇒ seamless
      14 +  const scale = Math.max(0.5, p.settScale ||
         +5)
      15 +  const span = total * scale
      16 +  const z = p.camZoom || 1
      17 +  const drift = u * Math.round(p.camFlow || 0
         +) * span // whole repeats ⇒ seamless
      18
      21 -  const at = (t) => {
      22 -    let tt = (((t / scale) % total) + total)
         -% total
      23 -    for (let b = 0; b < sett.length; b++) { i
         -f (tt < sett[b][1]) return pal[sett[b][0]]; t
         -t -= sett[b][1] }
      24 -    return pal[sett[sett.length - 1][0]]
      19 +  ctx.save()
      20 +  ctx.translate(w / 2, h / 2)
      21 +  ctx.rotate((p.camAngle || 0) * Math.PI / 18
         +0)
      22 +  ctx.scale(z, z)
      23 +  ctx.translate(-drift, -drift) // diagonal s
         +ett scroll
      24 +
      25 +  const reach = (Math.hypot(w, h) / 2) / z +
         +span
      26 +  const lo = -reach + drift, hi = reach + dri
         +ft
      27 +  const r0 = Math.floor(lo / span) - 1, r1 =
         +Math.ceil(hi / span) + 1
      28 +  const long0 = lo - span, longLen = (hi - lo
         +) + span * 2
      29 +
      30 +  const drawAxis = (horizontal, alpha) => {
      31 +    ctx.globalAlpha = alpha
      32 +    for (let r = r0; r <= r1; r++) {
      33 +      let pos = r * span
      34 +      for (let b = 0; b < sett.length; b++) {
      35 +        const wdt = sett[b][1] * scale
      36 +        ctx.fillStyle = pal[sett[b][0]]
      37 +        if (horizontal) ctx.fillRect(long0, p
         +os, longLen, wdt)
      38 +        else ctx.fillRect(pos, long0, wdt, lo
         +ngLen)
      39 +        pos += wdt
      40 +      }
      41 +    }
      42 +    ctx.globalAlpha = 1
      43    }
      26 -  return (i, j, W, H) => {
      27 -    const [rx, ry] = sample(cam, (i / W) * w,
         - (j / H) * h)
      28 -    const warp = at(rx + drift)
      29 -    const weft = at(ry + drift)
      30 -    const diag = Math.floor((rx - ry) / (scal
         -e * 2))
      31 -    const bias = (((diag % 2) + 2) % 2) ? twi
         -ll : -twill  // alternate which thread shows
      32 -    return mix2(0.5 + bias, warp, weft)
         -             // 0.5 = even average (the weave
         -)
      33 -  }
      44 +  drawAxis(true, 1)     // weft (horizontal)
         +— solid
      45 +  drawAxis(false, 0.5)  // warp (vertical) at
         + 50% ⇒ average over the weft
      46 +  ctx.restore()
      47  }

⏺ Now Organic redefined — wavy-profile bands (your image), not
  blobs. Creating the new vector renderer and removing the
  metaball:

⏺ Write(src/loops/pattern/fields/organicField.js)
  ⎿  Wrote 42 lines to
     src/loops/pattern/fields/organicField.js
      2 import { TAU } from '../../lib/util.js'
      3 // Organic — bands with a wavy/undulating edge
      4 // as stripes, but each boundary is a sine-disp
        laced curve, so the bands read as a
      5 // flowing water/contour motif. Drawn as filled
      6 // thousand line segments, not a per-pixel fiel
        d. Boundaries share one consistent
        lor/color2/color3 cycle the bands.. Palette: co
      8 //   waveAmp   undulation depth (× pitch)
        waveFre
     … +53 lines (ctrl+o to expand)

⏺ Bash(rm /Users/biskup/dev/projects/kol-apparat/kol-labs-sing
      le/src/loops/pattern/fields/metaballField.js && echo
      "deleted metaballField.js")
  ⎿  deleted metaballField.js

⏺ Now rewire patternLoop.js — all three families are vector
  draws, drop the raster/camera/metaball imports:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines, removed 5 lines
       2  import { resolveShape, DEFAULT_SHAPE_ID } fro
          m './shapes.js'
       3  import { composeCell, compileRules } from './
          rules.js'
       4  import { glyphShape, ensureGlyphFontUrl } fro
          m '../../lib/glyphPath.js'
       5 -import { makeCam } from '../field/camera.js'
       6 -import { raster } from '../field/raster.js'
       7 -import { stripeColorAt } from './fields/strip
         -eField.js'
       8 -import { tartanColorAt } from './fields/tarta
         -nField.js'
       9 -import { metaballColorAt } from './fields/met
         -aballField.js'
       5 +import { drawStripes } from './fields/stripeF
         +ield.js'
       6 +import { drawTartan } from './fields/tartanFi
         +eld.js'
       7 +import { drawOrganic } from './fields/organic
         +Field.js'
       8
       9  // Pattern — the ported kol-client rule/tilin
          g system, rendered to Canvas2D so it
      10  // animates + outputs a texture. The cols×row
          s rule-block TILES infinitely; the

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 7 lines, removed 8 lines
      69    diag: [1, 1], anti: [1, -1],
      70  }
      71
      72 -// Field families (render:'field') — continuo
         -us per-pixel renderers that bypass
      73 -// the tile loop and reuse the shared field r
         -asterizer + camera. Each maps the
      74 -// pattern palette (color/color2/color3 + bg)
         - to a colorAt. Seamlessness is the
      75 -// colorAt's job (periodic phase via cam.phas
         -e).
      76 -const FIELD_COLOR_AT = { stripes: stripeColor
         -At, tartan: tartanColorAt, organic: metaballC
         -olorAt }
      72 +// Field families (render:'field') — continuo
         +us VECTOR renderers that bypass the
      73 +// tile loop. All three are cheap geometry (r
         +ects / filled paths), NOT per-pixel:
      74 +// stripes = bands · tartan = crossed sett ba
         +nds · organic = bands with a wavy edge.
      75 +// Each reads the pattern palette (color/colo
         +r2/color3 + bg). Seamless on whole-
      76 +// cycle phase (u·TAU·round(camFlow)).
      77 +const FIELD_DRAW = { stripes: drawStripes, ta
         +rtan: drawTartan, organic: drawOrganic }
      78  function drawField(ctx, u, w, h, p) {
      78 -  const make = FIELD_COLOR_AT[p.field] || FIE
         -LD_COLOR_AT.stripes
      79 -  const cam = makeCam(u, p, w, h)
      80 -  raster(ctx, w, h, make(p, cam, w, h))
      79 +  (FIELD_DRAW[p.field] || drawStripes)(ctx, u
         +, w, h, p)
      80  }
      81
      82  // Weave (render:'weave') — true over/under i
          nterlacing. Per crossing the warp

⏺ Update the Organic params in defaults (drop metaball, add
  wave):

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 3 lines, removed 5 lines
      202      sett: 'black-watch', // threadcount tabl
           e (src/loops/pattern/fields/setts.js)
      203      settScale: 5,        // px per thread un
           it
      204      twill: 0.18,         // 2/2-twill diagon
           al bias (0 = flat average)
      205 -    // Organic field (field:'organic') — sum
          -med metaball iso-surface
      206 -    blobCount: 9,        // number of orbiti
          -ng seeds
      207 -    blobRadius: 0.5,     // seed influence r
          -adius (× canvas)
      208 -    threshold: 1,        // iso level — high
          -er = tighter blobs
      209 -    warp: 0.2,           // domain-warp wobb
          -le
      205 +    // Organic field (field:'organic') — ban
          +ds with a wavy edge profile
      206 +    waveAmp: 0.4,        // undulation depth
          + (× pitch)
      207 +    waveFreq: 1.5,       // waves across the
          + field
      208      // Weave render (render:'weave') — inter
           laced over/under strands
      209      weaveType: 'plain',  // plain | twill |
           satin | basket (which strand goes over)
      210      strandWidth: 0.7,    // ribbon width (×
           cell)

⏺ Re-author the Organic presets as wavy bands:

⏺ Write(src/pages/pattern/categories/organic.js)
  ⎿  Added 45 lines, removed 60 lines
       1  import { R, PAL } from './_helpers.js'
       2
       3 -// ORGANIC — soft natural marks. The headline
         - is the metaball FIELD (render:'field',
       4 -// field:'organic'): orbiting seeds sum into
         -an iso-surface so blobs FUSE with smooth
       5 -// necks (color→color2→color3 depth ramp on t
         -he bg ground). camFlow drives the orbit
       6 -// (whole cycles ⇒ seamless; paused on load).
       7 -//   blobCount  seed count    blobRadius  inf
         -luence (× canvas)
       8 -//   threshold  iso level (higher = tighter)
         -  warp  domain wobble
       9 -// Regular dot/abstract marks (polka, halfton
         -e, honeycomb, petals…) are genuine TILE
      10 -// patterns, kept on the tile engine (no `ren
         -der` ⇒ 'tiles').
       3 +// ORGANIC — bands with a wavy/undulating edg
         +e PROFILE (render:'field', field:'organic'):
       4 +// flowing water/contour stripes, drawn as ch
         +eap vector paths. Same band model as
       5 +// Stripes (angle/pitch/bands + palette) plus
         + a wave:
       6 +//   waveAmp   undulation depth (× pitch)
         +  waveFreq  waves across the field
       7 +// camFlow undulates the wave (whole cycles ⇒
         + seamless; paused on load).
       8 +// A few genuine dot/abstract tile marks are
         +kept on the tile engine for variety.
       9
      12 -const blob = (o) => ({ render: 'field', field
         -: 'organic', ...o })
      10 +const wave = (o) => ({ render: 'field', field
         +: 'organic', ...o })
      11
      12  export default [
      15 -  // ── metaballs (field) ──
      16 -  { id: 'blobs', label: 'Blobs', params: blob
         -({
      17 -    blobCount: 9, blobRadius: 0.5, threshold:
         - 1, warp: 0.2,
      18 -    color: PAL.sky, color2: PAL.teal, color3:
         - PAL.navy, bg: PAL.ink }) },
      19 -  { id: 'lava', label: 'Lava', params: blob({
      20 -    blobCount: 7, blobRadius: 0.7, threshold:
         - 0.9, warp: 0.3,
      21 -    color: PAL.gold, color2: PAL.rust, color3
         -: PAL.brick, bg: PAL.noir }) },
      22 -  { id: 'mercury', label: 'Mercury', params:
         -blob({
      23 -    blobCount: 10, blobRadius: 0.5, threshold
         -: 1.3, warp: 0.1,
      24 -    color: PAL.bone, color2: PAL.grey, color3
         -: PAL.slate, bg: PAL.ink }) },
      25 -  { id: 'foam', label: 'Foam', params: blob({
      26 -    blobCount: 16, blobRadius: 0.36, threshol
         -d: 1.1, warp: 0.25,
      27 -    color: PAL.bone, color2: PAL.oat, color3:
         - PAL.cream, bg: PAL.teal }) },
      28 -  { id: 'cells', label: 'Cells', params: blob
         -({
      29 -    blobCount: 12, blobRadius: 0.5, threshold
         -: 1.1, warp: 0.15,
      30 -    color: PAL.teal, color2: PAL.green, color
         -3: PAL.forest, bg: PAL.ink }) },
      31 -  { id: 'goo', label: 'Goo', params: blob({
      32 -    blobCount: 6, blobRadius: 0.8, threshold:
         - 0.8, warp: 0.35,
      33 -    color: PAL.green, color2: PAL.moss, color
         -3: PAL.olive, bg: PAL.noir }) },
      34 -  { id: 'magma', label: 'Magma', params: blob
         -({
      35 -    blobCount: 8, blobRadius: 0.6, threshold:
         - 0.95, warp: 0.4,
      36 -    color: PAL.amber, color2: PAL.coral, colo
         -r3: PAL.red, bg: PAL.char }) },
      37 -  { id: 'ooze', label: 'Ooze', params: blob({
      38 -    blobCount: 9, blobRadius: 0.6, threshold:
         - 1, warp: 0.3,
      39 -    color: PAL.purple, color2: PAL.violet, co
         -lor3: PAL.plum, bg: PAL.noir }) },
      40 -  { id: 'droplets', label: 'Droplets', params
         -: blob({
      41 -    blobCount: 14, blobRadius: 0.42, threshol
         -d: 1.2, warp: 0.15,
      42 -    color: PAL.sky, color2: PAL.blue, color3:
         - PAL.navy, bg: PAL.ink2 }) },
      43 -  { id: 'nuclei', label: 'Nuclei', params: bl
         -ob({
      44 -    blobCount: 5, blobRadius: 0.7, threshold:
         - 0.85, warp: 0.2,
      45 -    color: PAL.amber, color2: PAL.gold, color
         -3: PAL.ochre, bg: PAL.ink }) },
      13 +  // ── wavy bands ──
      14 +  { id: 'waves', label: 'Waves', params: wave
         +({
      15 +    stripeAngle: 90, stripePitch: 90, bandCou
         +nt: 2, waveAmp: 0.4, waveFreq: 1.4,
      16 +    color: PAL.sky, color2: PAL.ink2 }) },
      17 +  { id: 'tide', label: 'Tide', params: wave({
      18 +    stripeAngle: 90, stripePitch: 110, bandCo
         +unt: 3, waveAmp: 0.5, waveFreq: 1,
      19 +    color: PAL.teal, color2: PAL.navy, color3
         +: PAL.sky }) },
      20 +  { id: 'dunes', label: 'Dunes', params: wave
         +({
      21 +    stripeAngle: 90, stripePitch: 120, bandCo
         +unt: 3, waveAmp: 0.6, waveFreq: 0.8,
      22 +    color: PAL.gold, color2: PAL.ochre, color
         +3: PAL.amber }) },
      23 +  { id: 'ripple', label: 'Ripple', params: wa
         +ve({
      24 +    stripeAngle: 90, stripePitch: 60, bandCou
         +nt: 2, waveAmp: 0.35, waveFreq: 2.4,
      25 +    color: PAL.bone, color2: PAL.teal }) },
      26 +  { id: 'contour', label: 'Contour', params:
         +wave({
      27 +    stripeAngle: 90, stripePitch: 70, bandCou
         +nt: 3, waveAmp: 0.45, waveFreq: 1.6,
      28 +    color: PAL.moss, color2: PAL.forest, colo
         +r3: PAL.olive }) },
      29 +  { id: 'strata', label: 'Strata', params: wa
         +ve({
      30 +    stripeAngle: 90, stripePitch: 100, bandCo
         +unt: 3, waveAmp: 0.3, waveFreq: 1.1,
      31 +    color: PAL.rust, color2: PAL.brick, color
         +3: PAL.coral }) },
      32 +  { id: 'current', label: 'Current', params:
         +wave({
      33 +    stripeAngle: 90, stripePitch: 80, bandCou
         +nt: 2, waveAmp: 0.55, waveFreq: 1.8,
      34 +    color: PAL.blue, color2: PAL.navy }) },
      35 +  { id: 'swell', label: 'Swell', params: wave
         +({
      36 +    stripeAngle: 90, stripePitch: 140, bandCo
         +unt: 2, waveAmp: 0.7, waveFreq: 0.7,
      37 +    color: PAL.sky, color2: PAL.ink2 }) },
      38 +  { id: 'marble', label: 'Marble', params: wa
         +ve({
      39 +    stripeAngle: 70, stripePitch: 64, bandCou
         +nt: 3, waveAmp: 0.5, waveFreq: 2,
      40 +    color: PAL.bone, color2: PAL.slate, color
         +3: PAL.oat }) },
      41 +  { id: 'lava-flow', label: 'Lava flow', para
         +ms: wave({
      42 +    stripeAngle: 90, stripePitch: 96, bandCou
         +nt: 3, waveAmp: 0.65, waveFreq: 1.2,
      43 +    color: PAL.amber, color2: PAL.red, color3
         +: PAL.brick }) },
      44 +  { id: 'aurora', label: 'Aurora', params: wa
         +ve({
      45 +    stripeAngle: 80, stripePitch: 110, bandCo
         +unt: 3, waveAmp: 0.6, waveFreq: 1.3,
      46 +    color: PAL.teal, color2: PAL.purple, colo
         +r3: PAL.sky }) },
      47 +  { id: 'sand', label: 'Sand', params: wave({
      48 +    stripeAngle: 90, stripePitch: 48, bandCou
         +nt: 2, waveAmp: 0.3, waveFreq: 2.6,
      49 +    color: PAL.oat, color2: PAL.camel }) },
      50
      47 -  // ── dots & polka (tiles) ──
      51 +  // ── dot & abstract marks (genuine tiles)
         +──
      52    { id: 'polka', label: 'Polka', params: {
      53      shape: 'prim:circle', cols: 6, rows: 6, c
          ell: 120, gap: 14,
      54      colorRule: 'checker', color: PAL.cream, c
          olor2: PAL.red, bg: PAL.ink,
     ...
      57      shape: 'prim:circle', cols: 14, rows: 14,
           cell: 70, gap: 18,
      58      color: PAL.bone, bg: PAL.navy,
      59      animAxis: 'radial', animWaves: 3, fade: 0
          .3 } },
      56 -  { id: 'caviar', label: 'Caviar', params: {
      57 -    shape: 'prim:circle', cols: 24, rows: 24,
         - cell: 46, gap: 10,
      58 -    color: PAL.ink, bg: PAL.oat,
      59 -    animAxis: 'radial', animWaves: 4, fade: 0
         -.2 } },
      60    { id: 'halftone', label: 'Halftone', params
          : {
      61      shape: 'prim:circle', cols: 22, rows: 22,
           cell: 52, gap: 6,
      62      color: PAL.ink, bg: PAL.bone,
      63      animAxis: 'radial', animWaves: 3, pulse:
          0.4, animCurveExpr: 'pow(sin(PI*k),2)' } },
      64 -
      65 -  // ── honeycomb & cells (tiles) ──
      64    { id: 'honeycomb', label: 'Honeycomb', para
          ms: {
      65      shape: 'prim:hexagon', cols: 8, rows: 8,
          cell: 120, gap: 6,
      66      color: PAL.gold, bg: PAL.ochre,
      67      animAxis: 'radial', animWaves: 2, fade: 0
          .2 } },
      70 -
      71 -  // ── scatter & confetti (tiles) ──
      68    { id: 'scatter', label: 'Scatter', params:
          {
      69      shape: 'prim:circle', cols: 16, rows: 16,
           cell: 80, gap: 8,
      70      color: PAL.gold, bg: PAL.ink,
      71      rules: [R({ selectKind: 'expression', exp
          ression: 'sin(col*12.9 + row*7.3) - 0.2', hid
          e: true })],
      72      animAxis: 'radial', animWaves: 3, fade: 0
          .35, animCurveExpr: 'round(k)' } },
      77 -  { id: 'confetti', label: 'Confetti', params
         -: {
      78 -    shape: 'prim:star', cols: 12, rows: 12, c
         -ell: 90, gap: 10,
      79 -    colorRule: 'diag', color: PAL.coral, colo
         -r2: PAL.amber, color3: PAL.sky, bg: PAL.noir,
      80 -    rules: [R({ selectKind: 'expression', exp
         -ression: 'cos(col*9.7 + row*4.3) - 0.1', hide
         -: true })],
      81 -    animAxis: 'diag', animWaves: 3, swing: 30
         -, colorMix: 0.3 } },
      82 -
      83 -  // ── petals & blossom (abstract-blob tiles
         -) ──
      73    { id: 'petals', label: 'Petals', params: {
      74      shape: 'abstract:abstract-01', cols: 6, r
          ows: 6, cell: 150, gap: 8,
      75      colorRule: 'checker', color: PAL.pink, co
          lor2: PAL.rose, bg: PAL.plum,
      76      spin: 1, animAxis: 'diag', animWaves: 2,
          swing: 35, fade: 0.25 } },
      88 -  { id: 'lily-pads', label: 'Lily pads', para
         -ms: {
      89 -    shape: 'abstract:abstract-02', cols: 4, r
         -ows: 4, cell: 200, gap: 12,
      90 -    colorRule: 'checker', color: PAL.green, c
         -olor2: PAL.forest, bg: PAL.ink2,
      91 -    spin: 1, animAxis: 'radial', animWaves: 2
         -, pulse: 0.3, fade: 0.35 } },
      77  ]

⏺ Now the Organic controls in PatternControls — swap metaball
  sliders for wave/band controls:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 5 lines, removed 4 lines
      230          )}
      231          {field === 'organic' && (
      232            <Section label="Organic">
      233 -            <Slider labeled label="Blobs" mi
          -n={2} max={16} step={1} value={v.blobCount ?
          -? 9} onChange={(x) => onChange('blobCount',
          -roundIfNum(x))} variant="default" />
      234 -            <Slider labeled label="Radius" m
          -in={0.2} max={1.2} step={0.05} value={v.blob
          -Radius ?? 0.5} onChange={(x) => onChange('bl
          -obRadius', x)} variant="default" />
      235 -            <Slider labeled label="Threshold
          -" min={0.5} max={2} step={0.05} value={v.thr
          -eshold ?? 1} onChange={(x) => onChange('thre
          -shold', x)} variant="default" />
      236 -            <Slider labeled label="Warp" min
          -={0} max={1} step={0.05} value={v.warp ?? 0.
          -2} onChange={(x) => onChange('warp', x)} var
          -iant="default" />
      233 +            <Slider labeled label="Angle" mi
          +n={0} max={180} step={1} value={v.stripeAngl
          +e ?? 90} onChange={(x) => onChange('stripeAn
          +gle', roundIfNum(x))} variant="default" />
      234 +            <Slider labeled label="Pitch" mi
          +n={20} max={240} step={1} value={v.stripePit
          +ch ?? 90} onChange={(x) => onChange('stripeP
          +itch', roundIfNum(x))} variant="default" />
      235 +            <Slider labeled label="Bands" mi
          +n={1} max={3} step={1} value={v.bandCount ??
          + 2} onChange={(x) => onChange('bandCount', r
          +oundIfNum(x))} variant="default" />
      236 +            <Slider labeled label="Amplitude
          +" min={0} max={1} step={0.05} value={v.waveA
          +mp ?? 0.4} onChange={(x) => onChange('waveAm
          +p', x)} variant="default" />
      237 +            <Slider labeled label="Frequency
          +" min={0.3} max={4} step={0.1} value={v.wave
          +Freq ?? 1.5} onChange={(x) => onChange('wave
          +Freq', x)} variant="default" />
      238            </Section>
      239          )}
      240          <Section label="Colour">

⏺ Fix the Organic colour labels (wavy bands cycle the palette,
  no ground):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 4 lines
      251              {colorCtl('Ground', 'bg')}
      252            </>}
      253            {field === 'organic' && <>
      254 -            {colorCtl('Surface', 'color')}
      255 -            {colorCtl('Mid', 'color2')}
      256 -            {colorCtl('Deep', 'color3')}
      257 -            {colorCtl('Ground', 'bg')}
      254 +            {colorCtl('Colour A', 'color')}
      255 +            {(v.bandCount ?? 2) >= 2 && colo
          +rCtl('Colour B', 'color2')}
      256 +            {(v.bandCount ?? 2) >= 3 && colo
          +rCtl('Colour C', 'color3')}
      257            </>}
      258          </Section>
      259        </>

⏺ Now the idle-redraw fix in PatternEditor — only render when
  playing or something changed. Let me read the exact tick:

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 3 lines
      55    const uRef = useRef(0)
      56    const lastRef = useRef(0)
      57    const sizeRef = useRef({ w: 0, h: 0 })
      58 +  // Redraw-on-demand: when PAUSED, only re-r
         +ender when something changed (dirty).
      59 +  // The old loop re-rendered every rAF even
         +paused — wasted full frames at idle.
      60 +  const dirtyRef = useRef(true)
      61
      62    const onChange = (k, v) => setValues((s) =>
           ({ ...s, [k]: v }))
      63

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      113      cv.width = Math.floor(fw * dpr); cv.heig
           ht = Math.floor(fh * dpr)
      114      cv.getContext('2d').setTransform(dpr, 0,
            0, dpr, 0, 0)
      115      sizeRef.current = { w: fw, h: fh }
      116 +    dirtyRef.current = true
      117    }, [aspect])
      118
      119    useEffect(() => {

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 7 lines, removed 1 line
      127        const dur = patternLoop.duration || 8
      128        if (playingRef.current) uRef.current =
            (uRef.current + dt * (tempoRef.current / 12
           0) / dur) % 1
      129        const { w, h } = sizeRef.current
      130 -      if (w && h) {
      130 +      // Render only while playing OR when m
          +arked dirty (a control/size changed).
      131 +      // Paused + unchanged ⇒ skip the frame
          + entirely → ~0 idle cost.
      132 +      if (w && h && (playingRef.current || d
          +irtyRef.current)) {
      133          patternLoop.draw(cv.getContext('2d')
           , uRef.current, w, h, resolveParams(valuesRe
           f.current, uRef.current * dur))
      134          if (fxChainRef.current.length) apply
           CanvasFx(cv, fxChainRef.current)
      135 +        dirtyRef.current = false
      136        }
      137      }
      138      raf = requestAnimationFrame(tick)
      139      return () => cancelAnimationFrame(raf)
      140    }, [])
      141
      142 +  // Mark dirty on any control/aspect/scale/
          +fx change so the paused canvas repaints once
          +.
      143 +  useEffect(() => { dirtyRef.current = true
          +}, [values, aspect, scale, fxChain])
      144 +
      145    useEffect(() => {
      146      sizeStage()
      147      const ro = new ResizeObserver(() => size
           Stage())

⏺ Check for any stale references to the removed colorAt
  exports, then build:

⏺ Bash(echo "=== stale colorAt refs (should be empty) ===";
      grep -rn "ColorAt\|FIELD_COLOR_AT\|metaballField" src/
      2>/dev/null; echo "(empty = clean)"; echo; pnpm buil…)
  ⎿  === stale colorAt refs (should be empty) ===
     (empty = clean)

     ✓ built in 3.20s

⏺ Clean, build green. Let me verify the vector draws are cheap
  (tens of ops, not a million) and seamless, via a mock
  canvas:

⏺ Bash(node --input-type=module -e '
      import { drawStripes } from
      "./src/loops/pattern/fields/stripeField.js";…)
  ⎿  stripes(solid): 29 ops, 29 fills/frame | seam u0==u1
     : true
     stripes(pin): 41 ops, 41 fills/frame | seam u0==u1:
     … +5 lines (ctrl+o to expand)

⏺ Stripes (29 rects vs 1,000,000 pixel evals!) and organic
  (vector paths) are cheap and seamless. Tartan's "seam:
  false" is a mock artifact — it uses ctx.translate(-drift)
  which my mock ignores. Let me re-check with a
  translate-aware mock:

⏺ Bash(node --input-type=module -e '
      import { drawTartan } from
      "./src/loops/pattern/fields/tartanField.js";…)
  ⎿  tartan: 132 rects/frame | visible-rect mismatch u0 v
     s u1: 0 (0 = seamless)

⏺ Confirmed — all four field families are now cheap vector
  geometry and seamless:

  ┌─────────┬────────────────────┬────────────────────────┐
  │ Family  │       Before       │         After          │
  ├─────────┼────────────────────┼────────────────────────┤
  │         │ ~1,000,000 pixel   │                        │
  │ Stripes │ evals/frame        │ 29 fillRects           │
  │         │ (~45ms)            │                        │
  ├─────────┼────────────────────┼────────────────────────┤
  │         │                    │ 132 rects (solid weft  │
  │ Tartan  │ ~1M pixel evals    │ + 50% warp = the       │
  │         │                    │ average weave)         │
  ├─────────┼────────────────────┼────────────────────────┤
  │ Organic │ ~1M pixel evals    │ 23 filled paths (wavy  │
  │         │ (metaball)         │ bands)                 │
  └─────────┴────────────────────┴────────────────────────┘

  Build green, all verified seamless (u=0 ≡ u=1).

  What changed (both your points)

  1. Perf — you were right, it was painting stripes
  pixel-by-pixel. The whole per-pixel field raster is gone
  from the pattern engine. Stripes/tartan/organic now draw as
  a handful of rects/paths in a rotated frame — canvas
  anti-aliases the edges and sub-pixel motion, so it's smooth
  and fast. Plus the idle bug: the loop re-rendered every
  frame even when paused — now it only redraws when playing or
  when a control/size changed, so paused = ~0 cost (that was
  your 17-19fps idle).

  2. Organic = wavy bands, not blobs. Metaball deleted
  (metaballField.js gone). Organic is now bands with an
  undulating sine edge profile — the water/contour motif from
  your image. Controls: Angle · Pitch · Bands · Amplitude ·
  Frequency. Presets: Waves, Tide, Dunes, Ripple, Contour,
  Strata, Current, Swell, Marble, Lava flow, Aurora, Sand (+ a
  few genuine dot/abstract tile marks kept for variety). Flow
  undulates the wave.

  Net: every pattern family (tiles, stripes, tartan, organic,
  weave) is now light vector drawing — should sit at 60fps
  animating and cost nothing idle.

  Not eyeballed live — check /pattern on :5173: the stripe
  fps, and that Organic reads as flowing wavy bands. Tell me
  if the wave profile or speed needs tuning.

✻ Crunched for 10m 44s

❯ in stripes why are there no 'stripe' animation options,
  f.e. width scale, color or whatever?

  same in organic, missing 'stripe' animation , also we could
  expose organic profile?

  in blocks, there seems to be a limit to how close the
  blocks can get, there should be bipolarity there, from 'a
  big gap' to  'negative gap'

⏺ Three good calls. Let me knock them out.

  Blocks gap — make it bipolar. Widen the Grid gap range so
  blocks go from a big gap to heavy overlap:

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 1 line, removed 1 line
      329          <Slider labeled label="Columns" min=
           {1} max={32} step={1} value={v.cols} onChang
           e={(x) => onChange('cols', roundIfNum(x))} v
           ariant="default" />
      330          <Slider labeled label="Rows" min={1}
            max={32} step={1} value={v.rows} onChange={
           (x) => onChange('rows', roundIfNum(x))} vari
           ant="default" />
      331          <Slider labeled label="Cell size" mi
           n={40} max={280} step={1} value={v.cell} onC
           hange={(x) => onChange('cell', roundIfNum(x)
           )} variant="default" />
      332 -        <Slider labeled label="Gap" min={-40
          -} max={80} step={1} value={v.gap} onChange={
          -(x) => onChange('gap', roundIfNum(x))} varia
          -nt="default" />
      332 +        <Slider labeled label="Gap" min={-12
          +0} max={120} step={1} value={v.gap} onChange
          +={(x) => onChange('gap', roundIfNum(x))} var
          +iant="default" />
      333          <ToggleSwitch variant="plain" label=
           "Stretch" checked={v.stretch} onChange={(c)
           => onChange('stretch', c)} />
      334          <ToggleSwitch variant="plain" label=
           "Grid lines" checked={!!v.showGrid} onChange
           ={(c) => onChange('showGrid', c)} />
      335        </Section>

⏺ Field animation. Add the params (Pulse = width/scale
  breathe, Shimmer = colour, Cycles), driven seamlessly:

⏺ Update(src/loops/pattern/patternLoop.js)
  ⎿  Added 5 lines
      205      // Organic field (field:'organic') — ban
           ds with a wavy edge profile
      206      waveAmp: 0.4,        // undulation depth
            (× pitch)
      207      waveFreq: 1.5,       // waves across the
            field
      208 +    // Field animation (stripes/tartan/organ
          +ic) — modulations over the loop, all
      209 +    // seamless on whole `fieldCycles`. 0 =
          +off. (Flow/camFlow stays the drift.)
      210 +    fieldPulse: 0,       // breathe the scal
          +e (stripe/tartan pitch · organic amplitude)
      211 +    fieldShimmer: 0,     // oscillate band c
          +olours toward their neighbour
      212 +    fieldCycles: 1,      // whole cycles per
          + loop for the above
      213      // Weave render (render:'weave') — inter
           laced over/under strands
      214      weaveType: 'plain',  // plain | twill |
           satin | basket (which strand goes over)
      215      strandWidth: 0.7,    // ribbon width (×
           cell)

⏺ Now wire the animation into the three field draws. Stripes
  (pitch breathe + colour shimmer):

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.js
        +'
      2
      3  // Stripes — VECTOR bands (a handful of fillRe
         cts), NOT per-pixel. Transform into a
      4  // stripe-local frame (camera angle + zoom, th
         en the stripe angle) and fill one rect

⏺ Update(src/loops/pattern/fields/stripeField.js)
  ⎿  Added 17 lines, removed 12 lines
      15    const soft = p.edgeSoftness || 0
      16    const z = p.camZoom || 1
      17    const drift = u * Math.round(p.camFlow || 0
          ) * bands // whole periods ⇒ seamless
      18 +  // Field animation (seamless on whole field
         +Cycles): pitch breathe + colour shimmer.
      19 +  const tphase = u * TAU * Math.round(p.field
         +Cycles || 1)
      20 +  const pitchA = pitch * (1 + (p.fieldPulse |
         +| 0) * 0.4 * Math.sin(tphase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5 -
         + 0.5 * Math.cos(tphase)) // 0→1→0
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHex
         +(cols[idx], cols[(idx + 1) % bands], cmix) :
         +cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)
     ...
      27    ctx.scale(z, z)
      28    ctx.rotate((p.stripeAngle || 0) * Math.PI /
           180) // stripe-local: x = band normal
      29
      25 -  const reach = (Math.hypot(w, h) / 2) / z +
         -pitch * 2
      30 +  const reach = (Math.hypot(w, h) / 2) / z +
         +pitchA * 2
      31    const y0 = -reach, yH = reach * 2
      27 -  const nLo = Math.floor(-reach / pitch + dri
         -ft) - 1
      28 -  const nHi = Math.ceil(reach / pitch + drift
         -) + 1
      32 +  const nLo = Math.floor(-reach / pitchA + dr
         +ift) - 1
      33 +  const nHi = Math.ceil(reach / pitchA + drif
         +t) + 1
      34    for (let n = nLo; n <= nHi; n++) {
      35      const idx = ((n % bands) + bands) % bands
      31 -    const x = (n - drift) * pitch
      36 +    const x = (n - drift) * pitchA
      37      if (duty < 0.999 && soft <= 0) {
      33 -      ctx.fillStyle = cols[idx]
      34 -      ctx.fillRect(x, y0, pitch * duty, yH) /
         -/ ink band on the (already-filled) bg
      38 +      ctx.fillStyle = bandCol(idx)
      39 +      ctx.fillRect(x, y0, pitchA * duty, yH)
         +// ink band on the (already-filled) bg
      40      } else if (soft > 0) {
      36 -      const g = ctx.createLinearGradient(x, 0
         -, x + pitch, 0)
      37 -      g.addColorStop(0, cols[idx])
      38 -      g.addColorStop(1, cols[(idx + 1) % band
         -s])
      41 +      const g = ctx.createLinearGradient(x, 0
         +, x + pitchA, 0)
      42 +      g.addColorStop(0, bandCol(idx))
      43 +      g.addColorStop(1, bandCol((idx + 1) % b
         +ands))
      44        ctx.fillStyle = g
      40 -      ctx.fillRect(x, y0, pitch, yH)
      45 +      ctx.fillRect(x, y0, pitchA, yH)
      46      } else {
      42 -      ctx.fillStyle = cols[idx]
      43 -      ctx.fillRect(x, y0, pitch, yH)
      47 +      ctx.fillStyle = bandCol(idx)
      48 +      ctx.fillRect(x, y0, pitchA, yH)
      49      }
      50    }
      51    ctx.restore()

⏺ Organic (wave-amplitude breathe + colour shimmer):

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      1 -import { TAU } from '../../lib/util.js'
      1 +import { TAU, mixHex } from '../../lib/util.js
        +'
      2
      3  // Organic — bands with a wavy/undulating edge
          PROFILE (not blobs). Same band model
      4  // as stripes, but each boundary is a sine-dis
         placed curve, so the bands read as a

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 6 lines, removed 1 line
      11    const cols = [p.color, p.color2 || p.color,
           p.color3 || p.color2 || p.color]
      12    const bands = Math.max(1, Math.round(p.band
          Count || 2))
      13    const pitch = Math.max(8, p.stripePitch ||
          90)
      14 -  const amp = (p.waveAmp == null ? 0.4 : p.wa
         -veAmp) * pitch
      14    const freq = p.waveFreq == null ? 1.5 : p.w
          aveFreq
      15    const z = p.camZoom || 1
      16    const wavePhase = u * TAU * Math.round(p.ca
          mFlow || 0) // undulation, whole cycles ⇒ sea
          mless
      17 +  // Field animation (seamless on whole field
         +Cycles): the profile amplitude breathes,
      18 +  // band colours shimmer toward their neighb
         +our.
      19 +  const tphase = u * TAU * Math.round(p.field
         +Cycles || 1)
      20 +  const amp = (p.waveAmp == null ? 0.4 : p.wa
         +veAmp) * pitch * (1 + (p.fieldPulse || 0) * 0
         +.6 * Math.sin(tphase))
      21 +  const cmix = (p.fieldShimmer || 0) * (0.5 -
         + 0.5 * Math.cos(tphase))
      22 +  const bandCol = (idx) => (cmix > 0 ? mixHex
         +(cols[idx], cols[(idx + 1) % bands], cmix) :
         +cols[idx])
      23
      24    ctx.save()
      25    ctx.translate(w / 2, h / 2)

⏺ Update(src/loops/pattern/fields/organicField.js)
  ⎿  Added 1 line, removed 1 line
      35    const nLo = Math.floor(-reach / pitch) - 1
      36    const nHi = Math.ceil(reach / pitch) + 1
      37    for (let n = nLo; n <= nHi; n++) {
      38 -    ctx.fillStyle = cols[((n % bands) + bands
         -) % bands]
      38 +    ctx.fillStyle = bandCol(((n % bands) + ba
         +nds) % bands)
      39      ctx.beginPath()
      40      ctx.moveTo(bx(n, -reach), -reach)
      41      for (let y = -reach; y <= reach; y += ste
          p) ctx.lineTo(bx(n, y), y)

⏺ Tartan (sett-scale breathe + weave shimmer):

⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 5 lines, removed 1 line
      11    const pal = [p.color, p.color2 || p.color,
          p.color3 || p.color2 || p.color, p.bg]
      12    const sett = SETTS[p.sett] || SETTS['black-
          watch']
      13    const total = sett.reduce((s, b) => s + b[1
          ], 0)
      14 -  const scale = Math.max(0.5, p.settScale ||
         -5)
      14 +  // Field animation (seamless on whole field
         +Cycles): the sett breathes its scale,
      15 +  // the warp/weft balance shimmers.
      16 +  const tphase = u * TAU * Math.round(p.field
         +Cycles || 1)
      17 +  const scale = Math.max(0.5, p.settScale ||
         +5) * (1 + (p.fieldPulse || 0) * 0.3 * Math.si
         +n(tphase))
      18 +  const warpAlpha = 0.5 + (p.fieldShimmer ||
         +0) * 0.3 * Math.sin(tphase)
      19    const span = total * scale
      20    const z = p.camZoom || 1
      21    const drift = u * Math.round(p.camFlow || 0
          ) * span // whole repeats ⇒ seamless

⏺ Update(src/loops/pattern/fields/tartanField.js)
  ⎿  Added 2 lines, removed 2 lines
      45      }
      46      ctx.globalAlpha = 1
      47    }
      48 -  drawAxis(true, 1)     // weft (horizontal)
         -— solid
      49 -  drawAxis(false, 0.5)  // warp (vertical) at
         - 50% ⇒ average over the weft
      48 +  drawAxis(true, 1)         // weft (horizont
         +al) — solid
      49 +  drawAxis(false, warpAlpha) // warp (vertica
         +l) ~50% ⇒ average over the weft
      50    ctx.restore()
      51  }

⏺ Add the field-animation params to the preserved motion set
  so they survive preset switches:

⏺ Update(src/pages/pattern/PatternEditor.jsx)
  ⎿  Added 1 line
      26    'camZoom', 'camFlow', 'camAngle', 'panDir',
           'spin',
      27    'animAxis', 'animCycles', 'animWaves', 'ani
          mCurveExpr',
      28    'pulse', 'fade', 'swing', 'colorMix', 'fram
          ePreset', 'formPreset',
      29 +  'fieldPulse', 'fieldShimmer', 'fieldCycles'
         +,
      30  ]
      31
      32  // Pattern studio — the kolkrabbi rule/tiling
           system (Image #4 from the brand

⏺ Now add the Animate section (Pulse · Shimmer · Cycles) to
  the Animation tab for field renders. Let me read the exact
  spot:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 10 lines
      169          </Section>
      170          )}
      171
      172 +        {/* Field families animate their own
          + form: scale breathe + colour shimmer
      173 +            (organic's Pulse breathes the wa
          +ve profile). Driven on whole Cycles. */}
      174 +        {!tilesRender && (
      175 +        <Section label="Animate">
      176 +          <Slider labeled label="Pulse" min=
          +{0} max={1} step={0.05} value={v.fieldPulse
          +?? 0} onChange={(x) => onFrame('fieldPulse',
          + x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" mi
          +n={0} max={1} step={0.05} value={v.fieldShim
          +mer ?? 0} onChange={(x) => onFrame('fieldShi
          +mmer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min
          +={1} max={4} step={1} value={v.fieldCycles ?
          +? 1} onChange={(x) => onFrame('fieldCycles',
          + roundIfNum(x))} variant="default" />
      179 +        </Section>
      180 +        )}
      181 +
      182          {tilesRender && animTab === 'form' &
           & (
      183          <Section label="Form">
      184            <Slider labeled label="Spin" min={
           0} max={3} step={1} value={v.spin} onChange=
           {(x) => onForm('spin', roundIfNum(x))} varia
           nt="default" />

⏺ fieldPulse/Shimmer/Cycles aren't part of the Frame preset,
  so they should use plain onChange (no preset-revert):

⏺ Update(src/pages/loops/PatternControls.jsx)
  ⎿  Added 3 lines, removed 3 lines
      173              (organic's Pulse breathes the wa
           ve profile). Driven on whole Cycles. */}
      174          {!tilesRender && (
      175          <Section label="Animate">
      176 -          <Slider labeled label="Pulse" min=
          -{0} max={1} step={0.05} value={v.fieldPulse
          -?? 0} onChange={(x) => onFrame('fieldPulse',
          - x)} variant="default" />
      177 -          <Slider labeled label="Shimmer" mi
          -n={0} max={1} step={0.05} value={v.fieldShim
          -mer ?? 0} onChange={(x) => onFrame('fieldShi
          -mmer', x)} variant="default" />
      178 -          <Slider labeled label="Cycles" min
          -={1} max={4} step={1} value={v.fieldCycles ?
          -? 1} onChange={(x) => onFrame('fieldCycles',
          - roundIfNum(x))} variant="default" />
      176 +          <Slider labeled label="Pulse" min=
          +{0} max={1} step={0.05} value={v.fieldPulse
          +?? 0} onChange={(x) => onChange('fieldPulse'
          +, x)} variant="default" />
      177 +          <Slider labeled label="Shimmer" mi
          +n={0} max={1} step={0.05} value={v.fieldShim
          +mer ?? 0} onChange={(x) => onChange('fieldSh
          +immer', x)} variant="default" />
      178 +          <Slider labeled label="Cycles" min
          +={1} max={4} step={1} value={v.fieldCycles ?
          +? 1} onChange={(x) => onChange('fieldCycles'
          +, roundIfNum(x))} variant="default" />
      179          </Section>
      180          )}
      181

⏺ Build and verify the new animations stay seamless with
  Pulse/Shimmer on:

⏺ Bash(pnpm build 2>&1 | grep -E "built in|error|Error|Could
      not resolve" | tail -3
      echo "--- seam check with field animation on
      (pulse+shimmer) ---"…)
  ⎿  ✓ built in 2.90s
     --- seam check with field animation on (pulse+shimme
     r) ---
     … +5 lines (ctrl+o to expand)

⏺ Done — all three, build green, animations verified seamless.

  1 & 2 — Field animation (Stripes + Organic + Tartan). The
  Animation tab now has an Animate section for field renders
  (it was hidden — fields only had Flow). Three modulations,
  all seamless and off by default:
  - Pulse — breathes the scale: stripe/tartan band width,
  organic wave amplitude (animates the profile depth).
  - Shimmer — oscillates each band's colour toward its
  neighbour.
  - Cycles — whole cycles per loop for both.

  So Stripes now animates width + colour (your "width scale,
  colour"); Organic animates its wavy profile + colour. They
  only run on play (no autoplay), and persist across preset
  switches like the other motion.

  Organic's profile is already exposed as controls in the
  Pattern tab — Amplitude + Frequency sliders. If you also
  want to pick the profile shape (sine vs sawtooth/steeper
  curves), say so and I'll add a curve selector.

  3 — Blocks gap is now bipolar. Widened the Grid Gap range
  from -40…80 to -120…120, so blocks go from a big mortar gap
  all the way into heavy overlap. (The engine blanks if cell +
  gap ≤ 0, so at very small cells the extreme-negative end
  has a floor — back off the gap or raise the cell.)

  Not eyeballed live — on :5173, check the Animate sliders on
  a stripe/organic preset (Pulse/Shimmer with play), and the
  Blocks gap sweep into overlap. Tell me if the pulse depth or
  shimmer feel needs tuning.

