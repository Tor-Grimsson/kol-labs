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

// Routed subpages, in nav order. Simple is the index (/loops).
export const GROUPS = [
  { id: 'shape', label: 'Simple', route: '/loops' },
  { id: 'pattern', label: 'Pattern', route: '/loops/pattern' },
  { id: 'field', label: 'Field', route: '/loops/field' },
]
export const groupById = (id) => GROUPS.find((g) => g.id === id) || GROUPS[0]

const LOOPS = [...SHAPE_LOOPS, ...FIELD_LOOPS, ...PATTERN_LOOPS]
const PRESETS_BY_GROUP = { shape: SHAPE_PRESETS, field: FIELD_PRESETS, pattern: PATTERN_PRESETS }
export const PRESETS = [...SHAPE_PRESETS, ...FIELD_PRESETS, ...PATTERN_PRESETS]

export const loopById = (id) => LOOPS.find((l) => l.id === id) || LOOPS[0]
export const presetsInGroup = (group) => PRESETS_BY_GROUP[group] || []
export const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0]

// A preset's full param object = the loop's defaults overlaid with the preset's
// overrides. (Pattern presets carry a complete config; the spread still works.)
export const presetParams = (preset) => ({
  ...loopDefaults(loopById(preset.loop)),
  ...(preset.params || {}),
})
