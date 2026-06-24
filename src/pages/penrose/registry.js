// Penrose — Page › Category › Preset, like scanlines/pattern/loops. The 8 engine
// CATEGORIES (Foundations: Packing/Growth/Fields/Layered · Territories: the 4
// domains) list in the sidebar; the PRESETS inside each are the prototypes,
// picked in the rail's Preset dropdown (NOT the nav). First category owns /penrose,
// the rest are /penrose/<cat>.

import { CATEGORY_ORDER, categoryLabel, categoryOf } from './prototypes/categories.js'
import { PROTOTYPES } from './prototypes'

export const CATEGORIES = CATEGORY_ORDER.map((id) => ({ id, label: categoryLabel(id) }))

export const catRoute = (id) => (id === CATEGORY_ORDER[0] ? '/penrose' : `/penrose/${id}`)
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]

// Presets of a category = the prototypes whose id maps to it (proto.id → {id,label}).
export const presetsForCat = (id) =>
  PROTOTYPES.filter((p) => categoryOf(p.id) === id).map((p) => ({ id: p.id, label: p.name }))
