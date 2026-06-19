// The loop catalog — the single source of truth for the library (+ the future
// effect source-picker). Keep this module LIGHT: it imports loop DEFINITIONS
// (cheap draw fns + schema), so radar/synth can import it for the source list
// without dragging any heavy 3d/WebGL engine. When 3d (PrimitiveEngine) or WebGL
// loops land, register them as LAZY factories here.
//
// /loops is a router shell with one routed subpage per GROUP (Simple · Pattern ·
// Field). Each group exposes its own PRESETS — the picker entries. A preset names
// a base loop + a partial param override; `presetParams` resolves the full set.

import { loopDefaults } from './contract.js'
import { SHAPE_LOOPS, SHAPE_PRESETS } from './shape/presets.js'
import { FIELD_LOOPS, FIELD_PRESETS } from './field/presets.js'
import { PATTERN_LOOPS, PATTERN_PRESETS } from './pattern/presets.js'

// Three CATEGORIES, each with six routed SUB-PAGES (mirrors Math's labeled
// nav groups → routed pages). Simple is the index (/loops); each category's first
// sub-page is that category's index route. `sub` matches the preset `sub` label;
// `path` is the route relative to /loops (App mounts LoopsPage at /loops/*).
export const GROUPS = [
  { id: 'shape', label: 'Simple', route: '/loops' },
  { id: 'pattern', label: 'Pattern', route: '/loops/pattern' },
  { id: 'field', label: 'Field', route: '/loops/field' },
]
export const groupById = (id) => GROUPS.find((g) => g.id === id) || GROUPS[0]

// Per-category sub-pages. The order here is the nav + route order. `sub` is the
// preset bucket the page scopes to; `route` is absolute (sidebar), `path` is
// relative (router). The first entry of each category owns the category route.
export const SUBGROUPS = {
  shape: [
    { sub: 'Discs', route: '/loops', path: '' },
    { sub: 'Curves', route: '/loops/curves', path: 'curves' },
    { sub: 'Rings', route: '/loops/rings', path: 'rings' },
    { sub: 'Grids', route: '/loops/grids', path: 'grids' },
    { sub: 'Lines', route: '/loops/lines', path: 'lines' },
    { sub: 'Particles', route: '/loops/particles', path: 'particles' },
  ],
  pattern: [
    { sub: 'Grids', route: '/loops/pattern', path: 'pattern' },
    { sub: 'Tessellations', route: '/loops/pattern/tessellations', path: 'pattern/tessellations' },
    { sub: 'Flow', route: '/loops/pattern/flow', path: 'pattern/flow' },
    { sub: 'Abstract', route: '/loops/pattern/abstract', path: 'pattern/abstract' },
    { sub: 'Stripes', route: '/loops/pattern/stripes', path: 'pattern/stripes' },
    { sub: 'Noise', route: '/loops/pattern/noise', path: 'pattern/noise' },
  ],
  field: [
    { sub: 'Bands', route: '/loops/field', path: 'field' },
    { sub: 'Plasma', route: '/loops/field/plasma', path: 'field/plasma' },
    { sub: 'Rings', route: '/loops/field/rings', path: 'field/rings' },
    { sub: 'Swirl', route: '/loops/field/swirl', path: 'field/swirl' },
    { sub: 'Moiré', route: '/loops/field/moire', path: 'field/moire' },
    { sub: 'Contour', route: '/loops/field/contour', path: 'field/contour' },
  ],
}

const LOOPS = [...SHAPE_LOOPS, ...FIELD_LOOPS, ...PATTERN_LOOPS]
const PRESETS_BY_GROUP = { shape: SHAPE_PRESETS, field: FIELD_PRESETS, pattern: PATTERN_PRESETS }
export const PRESETS = [...SHAPE_PRESETS, ...FIELD_PRESETS, ...PATTERN_PRESETS]

export const loopById = (id) => LOOPS.find((l) => l.id === id) || LOOPS[0]
export const presetsInGroup = (group) => PRESETS_BY_GROUP[group] || []
export const presetsInSub = (group, sub) => presetsInGroup(group).filter((p) => p.sub === sub)
export const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0]

// A preset's full param object = the loop's defaults overlaid with the preset's
// overrides. (Pattern presets carry a complete config; the spread still works.)
export const presetParams = (preset) => ({
  ...loopDefaults(loopById(preset.loop)),
  ...(preset.params || {}),
})
